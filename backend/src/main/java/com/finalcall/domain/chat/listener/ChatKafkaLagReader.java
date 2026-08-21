package com.finalcall.domain.chat.listener;

import static java.util.concurrent.TimeUnit.MILLISECONDS;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.KafkaAdminClient;
import org.apache.kafka.clients.admin.ListOffsetsResult.ListOffsetsResultInfo;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.KafkaFuture;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.stereotype.Component;

import com.finalcall.domain.chat.config.ChatKafkaProperties;

import jakarta.annotation.PreDestroy;

/** consumer group의 전역 committed offset과 topic end offset을 비교하는 read-only probe. */
@Component
@ConditionalOnProperty(prefix = "chat.kafka.consumer", name = "monitor-enabled", havingValue = "true")
public class ChatKafkaLagReader {

    private static final String PROBE_CLIENT_ID = "finalcall-chat-lag-probe";

    private final Admin admin;
    private final Consumer<String, String> probeConsumer;
    private final ChatKafkaProperties properties;
    private final Clock clock;

    @Autowired
    public ChatKafkaLagReader(KafkaAdmin kafkaAdmin, ChatKafkaProperties properties) {
        this(createAdmin(kafkaAdmin), createProbeConsumer(kafkaAdmin), properties, Clock.systemUTC());
    }

    ChatKafkaLagReader(Admin admin,
        Consumer<String, String> probeConsumer,
        ChatKafkaProperties properties,
        Clock clock) {
        this.admin = admin;
        this.probeConsumer = probeConsumer;
        this.properties = properties;
        this.clock = clock;
    }

    /** 수집용 consumer는 manual assign만 사용하며 application consumer group에 join하거나 commit하지 않는다. */
    public List<ChatKafkaPartitionLag> read() {
        try {
            String topic = properties.topic().name();
            Duration timeout = properties.consumer().monitorTimeout();
            List<TopicPartition> partitions = partitions(topic, timeout);
            Map<TopicPartition, OffsetAndMetadata> committed = await(
                admin.listConsumerGroupOffsets(properties.consumer().groupId()).partitionsToOffsetAndMetadata(),
                timeout);
            Map<TopicPartition, ListOffsetsResultInfo> earliest = offsets(partitions, OffsetSpec.earliest(), timeout);
            Map<TopicPartition, ListOffsetsResultInfo> latest = offsets(partitions, OffsetSpec.latest(), timeout);
            Map<TopicPartition, OffsetRange> ranges = ranges(partitions, committed, earliest, latest);
            Map<TopicPartition, Duration> durations = oldestUnconsumedDurations(ranges, timeout);

            return ranges.entrySet().stream()
                .map(entry -> new ChatKafkaPartitionLag(
                    entry.getKey().partition(),
                    entry.getValue().lag(),
                    durations.getOrDefault(entry.getKey(), Duration.ZERO)))
                .sorted(Comparator.comparingInt(ChatKafkaPartitionLag::partition))
                .toList();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Kafka consumer lag 수집이 중단됐습니다.", ex);
        } catch (ExecutionException | TimeoutException ex) {
            throw new IllegalStateException("Kafka consumer lag를 수집하지 못했습니다.", ex);
        }
    }

    @PreDestroy
    void close() {
        probeConsumer.close(properties.consumer().monitorTimeout());
        admin.close(properties.consumer().monitorTimeout());
    }

    private List<TopicPartition> partitions(String topic, Duration timeout)
        throws ExecutionException, InterruptedException, TimeoutException {
        return await(admin.describeTopics(List.of(topic)).allTopicNames(), timeout)
            .get(topic)
            .partitions()
            .stream()
            .map(info -> new TopicPartition(topic, info.partition()))
            .toList();
    }

    private Map<TopicPartition, ListOffsetsResultInfo> offsets(
        List<TopicPartition> partitions,
        OffsetSpec offsetSpec,
        Duration timeout) throws ExecutionException, InterruptedException, TimeoutException {
        Map<TopicPartition, OffsetSpec> request = partitions.stream()
            .collect(Collectors.toMap(Function.identity(), ignored -> offsetSpec));
        return await(admin.listOffsets(request).all(), timeout);
    }

    private Map<TopicPartition, OffsetRange> ranges(
        List<TopicPartition> partitions,
        Map<TopicPartition, OffsetAndMetadata> committed,
        Map<TopicPartition, ListOffsetsResultInfo> earliest,
        Map<TopicPartition, ListOffsetsResultInfo> latest) {
        Map<TopicPartition, OffsetRange> result = new LinkedHashMap<>();
        for (TopicPartition partition : partitions) {
            long earliestOffset = earliest.get(partition).offset();
            long endOffset = latest.get(partition).offset();
            OffsetAndMetadata committedOffset = committed.get(partition);
            long startOffset = committedOffset == null ? earliestOffset : committedOffset.offset();
            long clampedStart = Math.max(earliestOffset, Math.min(startOffset, endOffset));
            result.put(partition, new OffsetRange(clampedStart, endOffset));
        }
        return result;
    }

    private Map<TopicPartition, Duration> oldestUnconsumedDurations(
        Map<TopicPartition, OffsetRange> ranges,
        Duration timeout) {
        Map<TopicPartition, OffsetRange> pending = ranges.entrySet().stream()
            .filter(entry -> entry.getValue().lag() > 0L)
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (left, right) -> left,
                LinkedHashMap::new));
        if (pending.isEmpty()) {
            return Map.of();
        }

        Instant measuredAt = clock.instant();
        Instant deadline = measuredAt.plus(timeout);
        Map<TopicPartition, Duration> result = new HashMap<>();
        try {
            probeConsumer.assign(pending.keySet());
            pending.forEach((partition, range) -> probeConsumer.seek(partition, range.startOffset()));
            while (!pending.isEmpty()) {
                Duration remaining = Duration.between(clock.instant(), deadline);
                if (remaining.isZero() || remaining.isNegative()) {
                    throw new IllegalStateException("Kafka 미소비 record timestamp 조회가 시간 안에 끝나지 않았습니다.");
                }
                ConsumerRecords<String, String> records = probeConsumer.poll(remaining);
                collectFirstRecordDurations(records, pending.keySet(), measuredAt, result);
                pending.keySet().removeAll(result.keySet());
            }
            return Map.copyOf(result);
        } finally {
            probeConsumer.assign(List.of());
        }
    }

    private void collectFirstRecordDurations(
        ConsumerRecords<String, String> records,
        Set<TopicPartition> pending,
        Instant measuredAt,
        Map<TopicPartition, Duration> result) {
        Collection<TopicPartition> snapshot = new ArrayList<>(pending);
        for (TopicPartition partition : snapshot) {
            List<ConsumerRecord<String, String>> partitionRecords = records.records(partition);
            if (partitionRecords.isEmpty()) {
                continue;
            }
            long timestamp = partitionRecords.getFirst().timestamp();
            if (timestamp < 0L) {
                throw new IllegalStateException("Kafka 미소비 record에 timestamp가 없습니다.");
            }
            Duration duration = Duration.between(Instant.ofEpochMilli(timestamp), measuredAt);
            result.put(partition, duration.isNegative() ? Duration.ZERO : duration);
        }
    }

    private <T> T await(KafkaFuture<T> future, Duration timeout)
        throws ExecutionException, InterruptedException, TimeoutException {
        return future.get(timeout.toMillis(), MILLISECONDS);
    }

    private static Admin createAdmin(KafkaAdmin kafkaAdmin) {
        return KafkaAdminClient.create(kafkaAdmin.getConfigurationProperties());
    }

    private static Consumer<String, String> createProbeConsumer(KafkaAdmin kafkaAdmin) {
        Map<String, Object> consumerProperties = new HashMap<>(kafkaAdmin.getConfigurationProperties());
        consumerProperties.put(ConsumerConfig.CLIENT_ID_CONFIG, PROBE_CLIENT_ID);
        consumerProperties.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        consumerProperties.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        consumerProperties.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        return new KafkaConsumer<>(consumerProperties);
    }

    private record OffsetRange(long startOffset, long endOffset) {

        private long lag() {
            return Math.max(0L, endOffset - startOffset);
        }
    }
}
