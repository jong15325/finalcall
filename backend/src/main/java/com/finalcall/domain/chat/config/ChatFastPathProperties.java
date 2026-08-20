package com.finalcall.domain.chat.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** 채팅 Redis fast-path 전용 bounded executor 설정. */
@Validated
@ConfigurationProperties(prefix = "chat.fast-path")
public record ChatFastPathProperties(
    @Positive int workers,
    @Positive int queueCapacity,
    @NotNull Duration shutdownTimeout) {

    @AssertTrue(message = "chat.fast-path.shutdown-timeout은 양수여야 합니다.")
    public boolean isShutdownTimeoutPositive() {
        return shutdownTimeout != null && !shutdownTimeout.isZero() && !shutdownTimeout.isNegative();
    }
}
