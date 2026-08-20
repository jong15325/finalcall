package com.finalcall.domain.chat.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** 채팅 메시지·신고 snapshot·outbox 보존과 CDC 안전 확인 정책. */
@Validated
@ConfigurationProperties(prefix = "chat.retention")
public record ChatRetentionProperties(
    boolean enabled,
    @Positive long fixedDelayMs,
    @Positive int batchSize,
    @NotNull Duration messageAge,
    @NotNull Duration reportAge,
    @NotNull Duration outboxAge,
    @NotNull Duration cdcCheckpointMaxAge,
    @NotNull Duration binlogSafetyMargin) {

    /** 보존·안전 시간은 모두 양수여야 하며 outbox 삭제에는 보존 기간보다 긴 binlog 여유를 요구한다. */
    @AssertTrue(message = "chat.retention 시간 설정은 모두 양수여야 합니다.")
    public boolean isValidDurations() {
        return isPositive(messageAge)
            && isPositive(reportAge)
            && isPositive(outboxAge)
            && isPositive(cdcCheckpointMaxAge)
            && isPositive(binlogSafetyMargin);
    }

    /** outbox 원행을 지우기 전에 DB binlog가 보장해야 하는 최소 보존 시간. */
    public Duration requiredBinlogAge() {
        return outboxAge.plus(binlogSafetyMargin);
    }

    private boolean isPositive(Duration duration) {
        return duration != null && !duration.isZero() && !duration.isNegative();
    }
}
