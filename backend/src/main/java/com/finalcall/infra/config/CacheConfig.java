package com.finalcall.infra.config;

import java.time.Duration;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * Spring Cache(Lettuce) 설정(Stage E1).
 *
 * <p>값 직렬화는 JSON({@link GenericJackson2JsonRedisSerializer}) — JDK 직렬화는 절대 금지.
 * 키는 문자열({@link StringRedisSerializer}). 분산락(Redisson)과 역할을 분담하며 Redisson 을 캐시 백엔드로 쓰지 않는다.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    // TTL 은 데모 기본값(CACHE_DEFAULT_TTL_SECONDS=60). 데이터 변경 빈도에 맞게 캐시 이름별로 조정한다
    // (RedisCacheManager.builder 의 withCacheConfiguration 으로 캐시별 TTL 구성 열어둠). TTL 없는 캐시는 금지.
    private static final Duration DEFAULT_TTL = Duration.ofSeconds(60);

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        GenericJackson2JsonRedisSerializer valueSerializer = new GenericJackson2JsonRedisSerializer(
            cacheObjectMapper());

        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(DEFAULT_TTL)
            .disableCachingNullValues()
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(valueSerializer));

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(config)
            .build();
    }

    private ObjectMapper cacheObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        // ★ JavaTimeModule 등록 — Instant/LocalDateTime 직렬화(없으면 시간 필드 캐싱 시 런타임 에러).
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        // ★ GenericJackson2JsonRedisSerializer 는 JSON 에 클래스 타입(@class)을 저장한다(다형성 역직렬화용).
        //   클래스 이동/서비스 분리 시 역직렬화가 깨질 수 있어 캐시 무효화가 필요하다.
        mapper.activateDefaultTyping(
            BasicPolymorphicTypeValidator.builder()
                .allowIfSubType("com.finalcall.")
                .allowIfSubType("java.")
                .build(),
            ObjectMapper.DefaultTyping.NON_FINAL,
            JsonTypeInfo.As.PROPERTY);
        return mapper;
    }
}
