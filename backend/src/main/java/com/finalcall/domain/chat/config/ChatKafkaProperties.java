package com.finalcall.domain.chat.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** 채팅 outbox Kafka topic과 단일 복구 consumer group의 운영 설정. */
@Validated
@ConfigurationProperties(prefix = "chat.kafka")
public record ChatKafkaProperties(
    @Valid @NotNull Topic topic,
    @Valid @NotNull Consumer consumer) {

    /** topic 보존·복제 설정. local은 단일 broker라 replication/min ISR을 각각 1로 내린다. */
    public record Topic(
        @NotBlank String name,
        @Positive int partitions,
        @Positive short replicationFactor,
        @Positive short minInSyncReplicas,
        @NotNull Duration retention) {

        @AssertTrue(message = "chat.kafka.topic의 min-in-sync-replicas는 replication-factor 이하여야 합니다.")
        public boolean isReplicationPolicyValid() {
            return minInSyncReplicas <= replicationFactor;
        }
    }

    /** Redis 재발행 실패 때 offset을 커밋하지 않고 재전달받기 위한 consumer 설정. */
    public record Consumer(
        boolean enabled,
        @NotBlank String groupId,
        @NotNull Duration retryBackoff,
        @NotNull Duration monitorInterval,
        @NotNull Duration monitorTimeout) {

        @AssertTrue(message = "chat.kafka.consumer 시간 설정은 양수여야 합니다.")
        public boolean isDurationPolicyValid() {
            return isPositive(retryBackoff)
                && isPositive(monitorInterval)
                && isPositive(monitorTimeout)
                && monitorTimeout.compareTo(monitorInterval) < 0;
        }

        private boolean isPositive(Duration duration) {
            return duration != null && !duration.isZero() && !duration.isNegative();
        }
    }
}
