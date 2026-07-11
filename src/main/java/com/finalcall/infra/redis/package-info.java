/**
 * Redis 인프라(Stage E1).
 *
 * <p>{@link com.finalcall.infra.redis.DistributedLockAspect} — Redisson 기반 {@code @DistributedLock} 처리
 * (락-트랜잭션 순서 보장). 캐시(Lettuce) 설정은 {@code infra.config.CacheConfig},
 * Redisson 클라이언트는 {@code infra.config.RedissonConfig}.
 */
package com.finalcall.infra.redis;
