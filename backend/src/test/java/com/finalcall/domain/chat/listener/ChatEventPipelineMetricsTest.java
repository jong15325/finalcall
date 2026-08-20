package com.finalcall.domain.chat.listener;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

class ChatEventPipelineMetricsTest {

    @Test
    void outbox_행과_partition별_global_consumer_group_lag를_관측한다() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        ChatEventPipelineMetrics metrics = new ChatEventPipelineMetrics(registry);

        metrics.observeOutboxRows(125L);
        metrics.observeConsumerLag(List.of(
            new ChatKafkaPartitionLag(0, 3L, Duration.ofSeconds(35)),
            new ChatKafkaPartitionLag(1, 0L, Duration.ZERO)));

        assertThat(registry.get("chat.outbox.rows").gauge().value()).isEqualTo(125.0);
        assertThat(registry.get("chat.kafka.consumer.lag").tag("partition", "0").gauge().value())
            .isEqualTo(3.0);
        assertThat(registry.get("chat.kafka.consumer.lag.duration").tag("partition", "0").gauge().value())
            .isEqualTo(35.0);
    }

    @Test
    void 다음_표본에서_사라진_partition_series를_제거한다() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        ChatEventPipelineMetrics metrics = new ChatEventPipelineMetrics(registry);

        metrics.observeConsumerLag(List.of(
            new ChatKafkaPartitionLag(0, 3L, Duration.ofSeconds(35)),
            new ChatKafkaPartitionLag(1, 2L, Duration.ofSeconds(5))));
        metrics.observeConsumerLag(List.of(new ChatKafkaPartitionLag(0, 0L, Duration.ZERO)));

        assertThat(registry.find("chat.kafka.consumer.lag").tag("partition", "1").gauge()).isNull();
        assertThat(registry.get("chat.kafka.consumer.lag").tag("partition", "0").gauge().value())
            .isZero();
    }

    @Test
    void 수집_실패를_counter로_남긴다() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        ChatEventPipelineMetrics metrics = new ChatEventPipelineMetrics(registry);

        metrics.recordCollectionFailure();

        assertThat(registry.get("chat.kafka.consumer.lag.collection.failures").counter().count())
            .isEqualTo(1.0);
    }
}
