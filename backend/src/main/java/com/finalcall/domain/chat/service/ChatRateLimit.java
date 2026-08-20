package com.finalcall.domain.chat.service;

/** Redis token bucket 하나의 용량·재충전 정책과 key 접미사. */
public record ChatRateLimit(long capacity, long refillTokens, long periodMillis, String suffix) {
}
