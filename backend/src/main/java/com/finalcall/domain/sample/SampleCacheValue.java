package com.finalcall.domain.sample;

import java.time.Instant;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 캐시 데모 값(Stage E1). Instant 필드로 JSON 직렬화(JavaTimeModule)와 캐시 히트 여부를 확인한다.
 *
 * <p>record 가 아닌 일반 class 인 이유: GenericJackson2JsonRedisSerializer 의 기본 타이핑(NON_FINAL)이
 * final 인 record 에는 {@code @class} 를 심지 못해 역직렬화가 깨진다. 캐시 값은 비-final class 로 둔다.
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class SampleCacheValue {

    private String message;
    private Instant generatedAt;
}
