package com.finalcall.infra.config;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * JPA 설정(Stage D).
 *
 * <p>{@code @EnableJpaAuditing} 으로 BaseTimeEntity 의 생성/수정 시각 자동 기록을 켠다.
 * QueryDSL 커스텀 리포지토리에서 쓰는 {@link JPAQueryFactory} 를 빈으로 등록한다.
 */
@Configuration
@EnableJpaAuditing
public class JpaConfig {

    @Bean
    public JPAQueryFactory jpaQueryFactory(EntityManager entityManager) {
        return new JPAQueryFactory(entityManager);
    }
}
