package com.finalcall.domain.chat.config;

import java.net.URI;
import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** 채팅 WebSocket/STOMP 연결과 세션 보호 정책. */
@Validated
@ConfigurationProperties(prefix = "chat.realtime")
public record ChatRealtimeProperties(
    @NotEmpty List<String> allowedOrigins,
    @NotNull Duration connectTimeout,
    @NotNull Duration heartbeatInterval,
    @NotNull Duration inactivityTimeout,
    @NotNull Duration socketLeaseTtl,
    @Positive int maxSocketsPerUser,
    @Positive int connectRatePerMinute) {

    /** wildcard 없이 유효한 absolute origin만 허용하고 시간 경계를 fail-fast 검증한다. */
    @AssertTrue(message = "chat.realtime 설정이 유효하지 않습니다.")
    public boolean isValidPolicy() {
        boolean originsValid = allowedOrigins != null && allowedOrigins.stream()
            .allMatch(this::isExactHttpOrigin);
        return originsValid
            && isPositive(connectTimeout)
            && isPositive(heartbeatInterval)
            && isPositive(inactivityTimeout)
            && isPositive(socketLeaseTtl)
            && socketLeaseTtl.compareTo(heartbeatInterval) > 0
            && inactivityTimeout.compareTo(heartbeatInterval) > 0;
    }

    private boolean isPositive(Duration duration) {
        return duration != null && !duration.isZero() && !duration.isNegative();
    }

    private boolean isExactHttpOrigin(String origin) {
        if (origin == null || origin.contains("*")) {
            return false;
        }
        try {
            URI uri = URI.create(origin);
            return ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
                && uri.getHost() != null
                && (uri.getRawPath() == null || uri.getRawPath().isEmpty())
                && uri.getRawQuery() == null
                && uri.getRawFragment() == null
                && uri.getUserInfo() == null;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}
