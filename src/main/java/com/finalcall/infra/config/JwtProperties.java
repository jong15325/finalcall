package com.finalcall.infra.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * JWT 설정 바인딩(Stage F1).
 *
 * <p>secret 은 fail-fast 로 주입한다: local 은 기본값, dev/prod 는 환경변수(JWT_SECRET) relaxed binding
 * (기본값 없음 → 누락 시 @NotBlank 로 부팅 실패). ★ HS256 은 최소 256비트(32바이트) secret 필요.
 */
@Validated
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        @NotBlank String secret,
        long accessExpMinutes,
        String algorithm
) {
}
