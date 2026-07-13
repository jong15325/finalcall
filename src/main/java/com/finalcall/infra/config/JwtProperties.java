package com.finalcall.infra.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * JWT 설정 바인딩(Stage F1, auth refresh 만료 추가).
 *
 * <p>secret 은 fail-fast 로 주입한다: local 은 기본값, dev/prod 는 환경변수(JWT_SECRET) relaxed binding
 * (기본값 없음 → 누락 시 @NotBlank 로 부팅 실패). ★ HS256 은 최소 256비트(32바이트) secret 필요.
 *
 * <p>{@code accessExpMinutes} 는 access JWT 만료(무상태·짧게), {@code refreshExpDays} 는 refresh 만료
 * (= Redis 저장분 TTL, B-011). 만료값은 데모 기본값이며 정책에 맞게 조정 대상이다.
 */
@Validated
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        @NotBlank String secret,
        long accessExpMinutes,
        long refreshExpDays,
        String algorithm
) {
}
