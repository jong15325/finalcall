package com.finalcall.gateway.ratelimit;

import java.net.InetSocketAddress;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import reactor.core.publisher.Mono;

/**
 * rate limit 키 해석기(D-068).
 *
 * <p>인증 계열 경로(login/signup/refresh)는 미인증 상태이므로 사용자 식별자 대신 클라이언트 IP 로
 * 토큰버킷을 분리한다(무차별 대입/열거 시도를 출발지 단위로 제한, SEC-005·SEC-007).
 *
 * <p>★ 운영 주의: 로드밸런서/프록시 뒤에서는 remoteAddress 가 LB IP 로 수렴할 수 있다.
 * 실제 배포에서는 {@code X-Forwarded-For} 신뢰 정책(신뢰 프록시 수)을 확정한 뒤 그 헤더 기반으로 조정한다.
 * 이 스켈레톤은 remoteAddress 기준으로 둔다.
 */
@Configuration
public class RateLimitConfig {

    private static final String UNKNOWN_KEY = "unknown";

    /** 클라이언트 IP 기반 키(RequestRateLimiter 의 기본 key-resolver 로 참조). */
    @Bean
    public KeyResolver clientIpKeyResolver() {
        return exchange -> {
            InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
            if (remoteAddress == null || remoteAddress.getAddress() == null) {
                return Mono.just(UNKNOWN_KEY);
            }
            return Mono.just(remoteAddress.getAddress().getHostAddress());
        };
    }
}
