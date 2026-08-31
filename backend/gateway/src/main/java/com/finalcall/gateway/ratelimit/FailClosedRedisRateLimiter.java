package com.finalcall.gateway.ratelimit;

import java.util.Map;

import org.springframework.cloud.gateway.filter.ratelimit.RateLimiter;
import org.springframework.cloud.gateway.filter.ratelimit.RateLimiter.Response;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;

import reactor.core.publisher.Mono;

/** SCG Redis 오류의 remaining=-1 fail-open 응답만 거부로 변환하는 홈 추천 전용 limiter. */
public class FailClosedRedisRateLimiter implements RateLimiter<RedisRateLimiter.Config> {

    private static final String REDIS_ERROR_REMAINING = "-1";

    private final RedisRateLimiter delegate;

    public FailClosedRedisRateLimiter(RedisRateLimiter delegate) {
        this.delegate = delegate;
    }

    @Override
    public Mono<Response> isAllowed(String routeId, String id) {
        return delegate.isAllowed(routeId, id)
            .map(response -> REDIS_ERROR_REMAINING.equals(response.getHeaders().get(delegate.getRemainingHeader()))
                ? new Response(false, response.getHeaders()) : response);
    }

    @Override
    public Class<RedisRateLimiter.Config> getConfigClass() {
        return delegate.getConfigClass();
    }

    @Override
    public RedisRateLimiter.Config newConfig() {
        return delegate.newConfig();
    }

    @Override
    public Map<String, RedisRateLimiter.Config> getConfig() {
        return delegate.getConfig();
    }
}
