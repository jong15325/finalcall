package com.finalcall.infra.config;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.boot.autoconfigure.data.redis.RedisConnectionDetails;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/**
 * Redisson 설정(Stage E1) — 분산락 전용 {@link RedissonClient}.
 *
 * <p>Lettuce(spring.data.redis)와 같은 Redis 를 바라보되 설정은 각각 둔다.
 * 캐시는 Lettuce 가 담당하고 Redisson 은 캐시 백엔드로 쓰지 않는다.
 *
 * <p>★ 접속정보는 {@link RedisConnectionDetails}(Spring Boot 가 조립)에서 가져온다. RedisProperties(yml 원본)를
 * 직접 읽으면 @ServiceConnection(Testcontainers) 등으로 오버라이드된 실제 접속 대상을 놓친다.
 */
@Configuration
public class RedissonConfig {

    @Bean(destroyMethod = "shutdown")
    public RedissonClient redissonClient(RedisConnectionDetails redisConnectionDetails) {
        RedisConnectionDetails.Standalone standalone = redisConnectionDetails.getStandalone();
        Config config = new Config();
        var singleServer = config.useSingleServer()
            .setAddress("redis://" + standalone.getHost() + ":" + standalone.getPort());
        if (StringUtils.hasText(redisConnectionDetails.getPassword())) {
            singleServer.setPassword(redisConnectionDetails.getPassword());
        }
        return Redisson.create(config);
    }
}
