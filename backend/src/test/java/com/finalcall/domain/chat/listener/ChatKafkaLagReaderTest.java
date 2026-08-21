package com.finalcall.domain.chat.listener;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.DescribeTopicsResult;
import org.apache.kafka.clients.admin.ListConsumerGroupOffsetsResult;
import org.apache.kafka.clients.admin.ListOffsetsResult;
import org.apache.kafka.clients.admin.ListOffsetsResult.ListOffsetsResultInfo;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.KafkaFuture;
import org.apache.kafka.common.Node;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.TopicPartitionInfo;
import org.apache.kafka.common.header.internals.RecordHeaders;
import org.apache.kafka.common.record.TimestampType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.finalcall.domain.chat.config.ChatKafkaProperties;

class ChatKafkaLagReaderTest {

    private static final String TOPIC = "finalcall.chat.events.v1";
    private static final String GROUP_ID = "finalcall-chat-fanout-v1";
    private static final Instant NOW = Instant.parse("2026-08-18T00:01:00Z");
    private static final TopicPartition PARTITION = new TopicPartition(TOPIC, 0);

    private final Admin admin = mock(Admin.class);
    private final Consumer<String, String> probeConsumer = mock(Consumer.class);
    private final DescribeTopicsResult describeTopicsResult = mock(DescribeTopicsResult.class);
    private final ListConsumerGroupOffsetsResult groupOffsetsResult = mock(ListConsumerGroupOffsetsResult.class);
    private final ListOffsetsResult earliestOffsetsResult = mock(ListOffsetsResult.class);
    private final ListOffsetsResult latestOffsetsResult = mock(ListOffsetsResult.class);

    private ChatKafkaLagReader reader;

    @BeforeEach
    void setUp() {
        ChatKafkaProperties properties = new ChatKafkaProperties(
            new ChatKafkaProperties.Topic(TOPIC, 1, (short)1, (short)1, Duration.ofDays(7)),
            new ChatKafkaProperties.Consumer(true, true, GROUP_ID, Duration.ofSeconds(1),
                Duration.ofSeconds(10), Duration.ofSeconds(5)));
        reader = new ChatKafkaLagReader(admin, probeConsumer, properties, Clock.fixed(NOW, ZoneOffset.UTC));

        TopicPartitionInfo partitionInfo = new TopicPartitionInfo(
            0, Node.noNode(), List.of(), List.of(), List.of(), List.of());
        TopicDescription description = new TopicDescription(TOPIC, false, List.of(partitionInfo));
        when(admin.describeTopics(List.of(TOPIC))).thenReturn(describeTopicsResult);
        when(describeTopicsResult.allTopicNames())
            .thenReturn(KafkaFuture.completedFuture(Map.of(TOPIC, description)));
        when(admin.listConsumerGroupOffsets(GROUP_ID)).thenReturn(groupOffsetsResult);
        when(groupOffsetsResult.partitionsToOffsetAndMetadata())
            .thenReturn(KafkaFuture.completedFuture(Map.of(PARTITION, new OffsetAndMetadata(5L))));
        when(admin.listOffsets(anyMap())).thenReturn(earliestOffsetsResult, latestOffsetsResult);
        when(earliestOffsetsResult.all()).thenReturn(KafkaFuture.completedFuture(
            Map.of(PARTITION, new ListOffsetsResultInfo(2L, -1L, Optional.empty()))));
        when(latestOffsetsResult.all()).thenReturn(KafkaFuture.completedFuture(
            Map.of(PARTITION, new ListOffsetsResultInfo(8L, -1L, Optional.empty()))));
    }

    @Test
    void global_committed_offset과_end_offset으로_partition_lag를_계산한다() {
        ConsumerRecord<String, String> firstUnconsumed = new ConsumerRecord<>(
            TOPIC,
            0,
            5L,
            NOW.minusSeconds(35).toEpochMilli(),
            TimestampType.CREATE_TIME,
            0,
            0,
            "room",
            "event",
            new RecordHeaders(),
            Optional.empty());
        when(probeConsumer.poll(Duration.ofSeconds(5)))
            .thenReturn(new ConsumerRecords<>(Map.of(PARTITION, List.of(firstUnconsumed))));

        List<ChatKafkaPartitionLag> result = reader.read();

        assertThat(result).containsExactly(new ChatKafkaPartitionLag(0, 3L, Duration.ofSeconds(35)));
        verify(probeConsumer).seek(PARTITION, 5L);
        verify(probeConsumer).assign(List.of());
    }

    @Test
    void group_offset이_end에_도달하면_probe로_record를_읽지_않는다() {
        when(groupOffsetsResult.partitionsToOffsetAndMetadata())
            .thenReturn(KafkaFuture.completedFuture(Map.of(PARTITION, new OffsetAndMetadata(8L))));

        List<ChatKafkaPartitionLag> result = reader.read();

        assertThat(result).containsExactly(new ChatKafkaPartitionLag(0, 0L, Duration.ZERO));
    }
}
