package com.finalcall.domain.auth;

import java.time.Instant;

/**
 * 발급된 토큰 묶음(auth) — login·refresh가 공용하는 도메인 레벨 값(표현 변환은 api 계층이 담당).
 *
 * @param accessToken     무상태 JWT(짧은 만료)
 * @param refreshToken    opaque refresh 원문(서버는 해시만 저장, B-011)
 * @param accessExpiresAt access 만료 시각(UTC, Instant)
 */
public record TokenBundle(String accessToken, String refreshToken, Instant accessExpiresAt) {
}
