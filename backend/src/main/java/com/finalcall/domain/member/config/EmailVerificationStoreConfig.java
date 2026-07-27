package com.finalcall.domain.member.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

import com.finalcall.infra.security.EmailVerificationCodeStore;

/**
 * 이메일 인증 코드 저장소({@link EmailVerificationCodeStore}) 빈 배선(EPIC-EMAIL-VERIFY B7, spec §2.3~§2.4).
 *
 * <p>{@code EmailVerificationCodeStore}는 정책값(만료·쿨다운·시도제한·자릿수)을 생성자 primitive 로 주입받는
 * 무-애노테이션 순수 클래스(infra)라 컴포넌트 스캔으로 등록되지 않는다 — 여기서 {@code @Bean} 으로 명시 배선한다.
 *
 * <p><b>배치가 member feature 인 이유</b>: 이 설정은 {@link EmailVerifyProperties}(member)를 참조해 infra 저장소를
 * 조립하는 domain→infra 의존이다. 커널 격리(§4)상 infra→domain 은 금지라 이 배선을 infra 에 둘 수 없다 — infra 가
 * member 의 Properties 를 역참조하게 되기 때문이다. 소비 feature(member)에 두면 domain→infra 단방향으로 정합한다.
 */
@Configuration
public class EmailVerificationStoreConfig {

    /**
     * 정책값을 주입한 {@link EmailVerificationCodeStore} 를 등록한다. {@link StringRedisTemplate} 빈은 Spring Boot
     * (spring-data-redis)이 자동 구성하며 {@link com.finalcall.infra.security.RefreshTokenStore} 와 동일 빈을 공유한다.
     */
    @Bean
    public EmailVerificationCodeStore emailVerificationCodeStore(
        StringRedisTemplate redisTemplate, EmailVerifyProperties properties) {
        return new EmailVerificationCodeStore(redisTemplate, properties.ttlSeconds(),
            properties.resendCooldownSeconds(), properties.maxAttempts(), properties.codeLength());
    }
}
