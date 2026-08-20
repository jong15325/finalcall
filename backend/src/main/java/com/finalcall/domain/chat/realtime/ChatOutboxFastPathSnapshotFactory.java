package com.finalcall.domain.chat.realtime;

import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.finalcall.domain.chat.entity.ChatEventOutbox;

import lombok.extern.slf4j.Slf4j;

/** outbox payload에서 Redis 계약의 허용 metadata만 worker 경계 전에 추출한다. */
@Slf4j
@Component
public class ChatOutboxFastPathSnapshotFactory {

    private static final Set<String> OPTIONAL_FIELDS = Set.of(
        "messagePublicId", "roomSequence", "senderId", "readerId", "throughSequence", "actorId", "changedAt");

    private final ObjectMapper objectMapper;

    public ChatOutboxFastPathSnapshotFactory(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Optional<ChatOutboxFastPathEvent> create(ChatEventOutbox event) {
        try {
            JsonNode source = objectMapper.readTree(event.getPayload());
            if (!source.isObject()) {
                return Optional.empty();
            }
            ObjectNode metadata = objectMapper.createObjectNode();
            metadata.put("eventId", event.getEventId());
            metadata.put("eventType", event.getEventType().name());
            metadata.put("eventVersion", event.getEventVersion());
            metadata.put("occurredAt", event.getOccurredAt().toString());
            metadata.put("roomPublicId", event.getAggregateId());
            copy(source, metadata, "recipientIds");
            OPTIONAL_FIELDS.forEach(field -> copy(source, metadata, field));
            return Optional.of(new ChatOutboxFastPathEvent(
                event.getEventId(), objectMapper.writeValueAsString(metadata)));
        } catch (JsonProcessingException ex) {
            log.warn("[ChatRealtime] outbox metadata snapshot 생성 실패로 fast-path를 건너뜁니다. eventId={}",
                event.getEventId());
            return Optional.empty();
        }
    }

    private void copy(JsonNode source, ObjectNode target, String field) {
        JsonNode value = source.get(field);
        if (value != null && !value.isNull()) {
            target.set(field, value);
        }
    }
}
