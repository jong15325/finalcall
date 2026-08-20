package com.finalcall.domain.chat.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.config.TopicConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

/** 채팅 metadata topic을 명시적 보존·복제 정책으로 생성하거나 기존 설정을 보정한다. */
@Configuration
@ConditionalOnProperty(prefix = "chat.kafka.consumer", name = "enabled", havingValue = "true")
public class ChatKafkaTopicConfig {

    @Bean
    public NewTopic chatEventsTopic(ChatKafkaProperties properties) {
        ChatKafkaProperties.Topic topic = properties.topic();
        return TopicBuilder.name(topic.name())
            .partitions(topic.partitions())
            .replicas(topic.replicationFactor())
            .config(TopicConfig.RETENTION_MS_CONFIG, String.valueOf(topic.retention().toMillis()))
            .config(TopicConfig.MIN_IN_SYNC_REPLICAS_CONFIG, String.valueOf(topic.minInSyncReplicas()))
            .config(TopicConfig.CLEANUP_POLICY_CONFIG, TopicConfig.CLEANUP_POLICY_DELETE)
            .build();
    }
}
