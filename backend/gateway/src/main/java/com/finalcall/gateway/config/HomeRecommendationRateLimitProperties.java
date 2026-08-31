package com.finalcall.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Positive;

/** 홈 추천 공개 API의 Redis 토큰버킷 설정. */
@Validated
@ConfigurationProperties(prefix = "gateway.home-recommend-rate-limit")
public record HomeRecommendationRateLimitProperties(
    @Positive int replenishRate,
    @Positive int burstCapacity,
    @Positive int requestedTokens) {

    @AssertTrue(message = "burstCapacity는 replenishRate 이상이어야 합니다")
    public boolean isBurstCapacityValid() {
        return burstCapacity >= replenishRate;
    }

    public long retryAfterSeconds() {
        return (((long)requestedTokens - 1L) / replenishRate) + 1L;
    }
}
