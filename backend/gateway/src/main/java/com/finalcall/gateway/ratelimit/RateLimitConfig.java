package com.finalcall.gateway.ratelimit;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.finalcall.gateway.config.GatewayClientIpProperties;

/**
 * rate limit 키 해석기(D-068).
 *
 * <p>인증 계열 경로(login/signup/refresh)는 미인증 상태이므로 사용자 식별자 대신 클라이언트 IP 로
 * 토큰버킷을 분리한다(무차별 대입/열거 시도를 출발지 단위로 제한, SEC-005·SEC-007).
 *
 * <p>전달 헤더는 기본적으로 무시한다. 앞단 프록시 수를 명시한 경우에만 우측 고정 위치의
 * {@code Forwarded}/{@code X-Forwarded-For} 값을 사용해 클라이언트가 왼쪽에 주입한 값을 신뢰하지 않는다.
 */
@Configuration
public class RateLimitConfig {

    /** 클라이언트 IP 기반 키(RequestRateLimiter 의 기본 key-resolver 로 참조). */
    @Bean
    public KeyResolver clientIpKeyResolver(GatewayClientIpProperties properties) {
        return new TrustedProxyClientIpKeyResolver(properties);
    }
}
