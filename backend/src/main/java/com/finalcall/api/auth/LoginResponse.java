package com.finalcall.api.auth;

import java.time.Instant;

import com.finalcall.domain.auth.TokenBundle;

import lombok.Builder;

/**
 * 로그인 응답(auth) — 계약 §2 `{ accessToken, refreshToken, accessExpiresAt }`.
 * Response 는 record + @Builder + static from. 시각은 Instant(UTC, ISO-8601 직렬화).
 */
@Builder
public record LoginResponse(
    String accessToken,
    String refreshToken,
    Instant accessExpiresAt) {
    public static LoginResponse from(TokenBundle result) {
        return LoginResponse.builder()
            .accessToken(result.accessToken())
            .refreshToken(result.refreshToken())
            .accessExpiresAt(result.accessExpiresAt())
            .build();
    }
}
