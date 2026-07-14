package com.finalcall.domain.auth;

import java.time.Instant;

/**
 * 로그인 발급 결과(auth) — 서비스가 반환하는 도메인 레벨 값(표현 변환은 api 계층이 담당).
 *
 * @param accessToken     무상태 JWT(짧은 만료)
 * @param refreshToken    opaque refresh 원문(서버는 해시만 저장, B-011)
 * @param accessExpiresAt access 만료 시각(UTC, Instant)
 */
public record LoginResult(String accessToken, String refreshToken, Instant accessExpiresAt) {
}
