package com.finalcall.api.auth;

import java.time.Instant;

import com.finalcall.domain.auth.TokenBundle;

import lombok.Builder;

/**
 * 토큰 재발급 응답(auth) — 계약 §2 v1.1 `{ accessToken, refreshToken(회전된 신규), accessExpiresAt }`.
 * 로그인 응답과 형태는 같으나 계약상 별도 DTO 로 둔다. 시각은 Instant(UTC, ISO-8601 직렬화).
 */
@Builder
public record RefreshResponse(
    String accessToken,
    String refreshToken,
    Instant accessExpiresAt) {
    public static RefreshResponse from(TokenBundle result) {
        return RefreshResponse.builder()
            .accessToken(result.accessToken())
            .refreshToken(result.refreshToken())
            .accessExpiresAt(result.accessExpiresAt())
            .build();
    }
}
