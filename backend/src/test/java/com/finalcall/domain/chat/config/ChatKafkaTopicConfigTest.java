package com.finalcall.domain.chat.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.config.TopicConfig;
import org.junit.jupiter.api.Test;

class ChatKafkaTopicConfigTest {

    @Test
    void production_topic은_7일_보존과_replica3_minIsr2를_사용한다() {
        ChatKafkaProperties properties = new ChatKafkaProperties(
            new ChatKafkaProperties.Topic("finalcall.chat.events.v1", 12, (short)3, (short)2,
                Duration.ofDays(7)),
            new ChatKafkaProperties.Consumer(true, true, "finalcall-chat-fanout-v1", Duration.ofSeconds(1),
                Duration.ofSeconds(10), Duration.ofSeconds(5)));

        NewTopic topic = new ChatKafkaTopicConfig().chatEventsTopic(properties);

        assertThat(topic.name()).isEqualTo("finalcall.chat.events.v1");
        assertThat(topic.numPartitions()).isEqualTo(12);
        assertThat(topic.replicationFactor()).isEqualTo((short)3);
        assertThat(topic.configs())
            .containsEntry(TopicConfig.RETENTION_MS_CONFIG, "604800000")
            .containsEntry(TopicConfig.MIN_IN_SYNC_REPLICAS_CONFIG, "2")
            .containsEntry(TopicConfig.CLEANUP_POLICY_CONFIG, TopicConfig.CLEANUP_POLICY_DELETE);
    }

    @Test
    void lag_monitor_timeout은_주기보다_짧은_양수여야_한다() {
        ChatKafkaProperties.Consumer consumer = new ChatKafkaProperties.Consumer(
            true,
            true,
            "finalcall-chat-fanout-v1",
            Duration.ofSeconds(1),
            Duration.ofSeconds(10),
            Duration.ofSeconds(10));

        assertThat(consumer.isDurationPolicyValid()).isFalse();
    }
}
