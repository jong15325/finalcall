package com.finalcall.infra.config;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.boot.autoconfigure.data.redis.RedisProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/**
 * Redisson 설정(Stage E1) — 분산락 전용 {@link RedissonClient}.
 *
 * <p>Lettuce(spring.data.redis)와 같은 Redis 를 바라보되 설정은 각각 둔다.
 * 캐시는 Lettuce 가 담당하고 Redisson 은 캐시 백엔드로 쓰지 않는다.
 */
@Configuration
public class RedissonConfig {

    @Bean(destroyMethod = "shutdown")
    public RedissonClient redissonClient(RedisProperties redisProperties) {
        Config config = new Config();
        var singleServer = config.useSingleServer()
                .setAddress("redis://" + redisProperties.getHost() + ":" + redisProperties.getPort());
        if (StringUtils.hasText(redisProperties.getPassword())) {
            singleServer.setPassword(redisProperties.getPassword());
        }
        return Redisson.create(config);
    }
}
