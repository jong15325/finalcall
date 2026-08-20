package com.finalcall.domain.chat.listener;

import java.time.DateTimeException;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.chat.config.ChatKafkaProperties;
import com.finalcall.domain.chat.entity.ChatEventOutbox;
import com.finalcall.domain.chat.entity.ChatEventType;
import com.finalcall.domain.chat.realtime.ChatRedisFanoutPublisher;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;

/** Debezium outbox metadata를 소비해 모든 app node가 구독하는 Redis channel로 재발행한다. */
@Slf4j
@Component
public class ChatKafkaOutboxListener {

    private static final Pattern ULID_PATTERN = Pattern.compile("[0-7][0-9A-HJKMNP-TV-Z]{25}");
    private static final Set<String> SENSITIVE_FIELD_NAMES = Set.of("body", "authorization", "jwt");
    private static final String TOPIC_PROPERTY = "${chat.kafka.topic.name}";
    private static final String GROUP_ID_PROPERTY = "${chat.kafka.consumer.group-id}";
    private static final String ENABLED_PROPERTY = "${chat.kafka.consumer.enabled:false}";

    private final ObjectMapper objectMapper;
    private final ChatRedisFanoutPublisher fanoutPublisher;
    private final ChatKafkaProperties properties;
    private final Counter republishFailures;

    public ChatKafkaOutboxListener(ObjectMapper objectMapper,
        ChatRedisFanoutPublisher fanoutPublisher,
        ChatKafkaProperties properties,
        MeterRegistry meterRegistry) {
        this.objectMapper = objectMapper;
        this.fanoutPublisher = fanoutPublisher;
        this.properties = properties;
        this.republishFailures = Counter.builder("chat.kafka.republish.failures")
            .description("Kafka outbox metadata의 Redis 재발행 실패 횟수")
            .register(meterRegistry);
    }

    /** Redis publish 성공 뒤에만 수동 ack한다. 실패하면 같은 Kafka record를 다시 받는다. */
    @KafkaListener(topics = TOPIC_PROPERTY, groupId = GROUP_ID_PROPERTY, autoStartup = ENABLED_PROPERTY)
    public void consume(ConsumerRecord<String, String> record, Acknowledgment acknowledgment) {
        if (record.value() == null) {
            acknowledgment.acknowledge();
            return;
        }

        ChatFanoutMetadata metadata;
        try {
            metadata = parse(record.key(), record.value(), record.timestamp());
        } catch (IllegalArgumentException | JsonProcessingException ex) {
            log.warn("[ChatKafka] 유효하지 않은 outbox metadata를 폐기합니다. topic={}, partition={}, offset={}",
                record.topic(), record.partition(), record.offset());
            acknowledgment.acknowledge();
            return;
        }

        try {
            if (!fanoutPublisher.publish(objectMapper.writeValueAsString(metadata))) {
                retry(record, acknowledgment);
                return;
            }
        } catch (RuntimeException | JsonProcessingException ex) {
            retry(record, acknowledgment);
            return;
        }

        acknowledgment.acknowledge();
    }

    private void retry(ConsumerRecord<String, String> record, Acknowledgment acknowledgment) {
        republishFailures.increment();
        log.warn("[ChatKafka] Redis 재발행 실패로 offset을 커밋하지 않습니다. topic={}, partition={}, offset={}",
            record.topic(), record.partition(), record.offset());
        acknowledgment.nack(properties.consumer().retryBackoff());
    }

    private ChatFanoutMetadata parse(String key, String value, long recordTimestamp) throws JsonProcessingException {
        JsonNode envelope = objectMapper.readTree(value);
        if (envelope == null || !envelope.isObject() || containsSensitiveField(envelope)) {
            throw new IllegalArgumentException("채팅 outbox envelope가 유효하지 않습니다.");
        }
        JsonNode payload = payload(envelope);

        String eventId = requiredText(envelope, "eventId");
        String roomPublicId = requiredText(envelope, "roomPublicId");
        ChatEventType eventType = parseEventType(requiredText(envelope, "eventType"));
        int eventVersion = requiredInt(envelope, "eventVersion");
        Instant occurredAt = parseInstant(envelope.get("occurredAt"), recordTimestamp);
        List<Long> recipientIds = requiredRecipients(payload);

        validateEnvelope(key, eventId, roomPublicId, eventVersion);
        validateDuplicatedPayloadField(payload, "eventId", eventId);
        validateDuplicatedPayloadField(payload, "roomPublicId", roomPublicId);

        ChatFanoutMetadata metadata = new ChatFanoutMetadata(
            eventId,
            eventType,
            eventVersion,
            occurredAt,
            roomPublicId,
            recipientIds,
            optionalText(payload, "messagePublicId"),
            optionalLong(payload, "roomSequence"),
            optionalLong(payload, "senderId"),
            optionalLong(payload, "readerId"),
            optionalLong(payload, "throughSequence"),
            optionalLong(payload, "actorId"),
            optionalInstant(payload.get("changedAt")));
        validateEventPayload(metadata);
        return metadata;
    }

    private JsonNode payload(JsonNode envelope) throws JsonProcessingException {
        JsonNode payload = envelope.get("payload");
        if (payload != null && payload.isTextual()) {
            payload = objectMapper.readTree(payload.textValue());
        }
        if (payload == null || !payload.isObject()) {
            throw new IllegalArgumentException("채팅 outbox payload가 유효하지 않습니다.");
        }
        return payload;
    }

    private void validateEnvelope(String key, String eventId, String roomPublicId, int eventVersion) {
        if (!isUlid(eventId)
            || !isUlid(roomPublicId)
            || !roomPublicId.equals(key)
            || eventVersion != ChatEventOutbox.EVENT_VERSION) {
            throw new IllegalArgumentException("채팅 outbox envelope가 계약과 일치하지 않습니다.");
        }
    }

    private void validateDuplicatedPayloadField(JsonNode payload, String field, String expected) {
        JsonNode duplicated = payload.get(field);
        if (duplicated != null && (!duplicated.isTextual() || !expected.equals(duplicated.textValue()))) {
            throw new IllegalArgumentException("채팅 outbox envelope와 payload가 일치하지 않습니다.");
        }
    }

    private void validateEventPayload(ChatFanoutMetadata metadata) {
        switch (metadata.eventType()) {
            case MESSAGE_CREATED -> {
                if (!isUlid(metadata.messagePublicId())
                    || !isPositive(metadata.roomSequence())
                    || !isPositive(metadata.senderId())) {
                    throw new IllegalArgumentException("MESSAGE_CREATED metadata가 유효하지 않습니다.");
                }
            }
            case READ_UPDATED -> {
                if (!isPositive(metadata.readerId())
                    || metadata.throughSequence() == null
                    || metadata.throughSequence() < 0L) {
                    throw new IllegalArgumentException("READ_UPDATED metadata가 유효하지 않습니다.");
                }
            }
            case BLOCK_CHANGED -> {
                if (!isPositive(metadata.actorId()) || metadata.changedAt() == null) {
                    throw new IllegalArgumentException("BLOCK_CHANGED metadata가 유효하지 않습니다.");
                }
            }
            default -> throw new IllegalArgumentException("지원하지 않는 채팅 outbox event입니다.");
        }
    }

    private List<Long> requiredRecipients(JsonNode payload) {
        JsonNode recipients = payload.get("recipientIds");
        if (recipients == null || !recipients.isArray() || recipients.size() != 2) {
            throw new IllegalArgumentException("recipientIds가 유효하지 않습니다.");
        }
        List<Long> result = List.of(requiredLong(recipients.get(0)), requiredLong(recipients.get(1)));
        if (result.stream().anyMatch(id -> id <= 0L) || new HashSet<>(result).size() != 2) {
            throw new IllegalArgumentException("recipientIds가 유효하지 않습니다.");
        }
        return result;
    }

    private String requiredText(JsonNode node, String field) {
        String value = optionalText(node, field);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + "가 유효하지 않습니다.");
        }
        return value;
    }

    private String optionalText(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? value.textValue() : null;
    }

    private int requiredInt(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isIntegralNumber() || !value.canConvertToInt()) {
            throw new IllegalArgumentException(field + "가 유효하지 않습니다.");
        }
        return value.intValue();
    }

    private Long optionalLong(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : requiredLong(value);
    }

    private long requiredLong(JsonNode node) {
        if (node == null || !node.isIntegralNumber() || !node.canConvertToLong()) {
            throw new IllegalArgumentException("정수 metadata가 유효하지 않습니다.");
        }
        return node.longValue();
    }

    private Instant optionalInstant(JsonNode value) {
        return value == null || value.isNull() ? null : parseInstant(value, -1L);
    }

    private Instant parseInstant(JsonNode value, long fallbackTimestamp) {
        try {
            if (value != null && value.isTextual()) {
                return Instant.parse(value.textValue());
            }
            if (value != null && value.isIntegralNumber()) {
                long timestamp = value.longValue();
                if (Math.abs(timestamp) >= 100_000_000_000_000L) {
                    return Instant.ofEpochSecond(timestamp / 1_000_000L, timestamp % 1_000_000L * 1_000L);
                }
                if (Math.abs(timestamp) >= 100_000_000_000L) {
                    return Instant.ofEpochMilli(timestamp);
                }
                return Instant.ofEpochSecond(timestamp);
            }
            if (fallbackTimestamp >= 0L) {
                return Instant.ofEpochMilli(fallbackTimestamp);
            }
        } catch (DateTimeException ex) {
            throw new IllegalArgumentException("시간 metadata가 유효하지 않습니다.", ex);
        }
        throw new IllegalArgumentException("시간 metadata가 유효하지 않습니다.");
    }

    private ChatEventType parseEventType(String eventType) {
        try {
            return ChatEventType.valueOf(eventType);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("eventType이 유효하지 않습니다.", ex);
        }
    }

    private boolean containsSensitiveField(JsonNode node) {
        if (node.isObject()) {
            var fields = node.properties().iterator();
            while (fields.hasNext()) {
                var field = fields.next();
                String name = field.getKey().toLowerCase(Locale.ROOT);
                if (SENSITIVE_FIELD_NAMES.contains(name) || name.contains("token")) {
                    return true;
                }
                if (containsSensitiveField(field.getValue())) {
                    return true;
                }
            }
        } else if (node.isArray()) {
            for (JsonNode element : node) {
                if (containsSensitiveField(element)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean isPositive(Long value) {
        return value != null && value > 0L;
    }

    private boolean isUlid(String value) {
        return value != null && ULID_PATTERN.matcher(value).matches();
    }
}
