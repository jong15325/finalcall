package com.finalcall.infra.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 설정 바인딩 표준 데모(Stage 2).
 *
 * <p>산발적 {@code @Value} 대신 {@code @ConfigurationProperties} + {@code @Validated} 로 묶는다.
 * record 기반 불변 바인딩, Bean Validation({@code @NotBlank})으로 필수값을 강제한다.
 *
 * <p>prefix "app" 의 값은 프로파일별로 주입된다.
 * local 은 {@code ${ENV:기본값}} 으로 환경변수 없이도 뜨고,
 * dev/prod 는 {@code ${ENV}} (기본값 없음) 이라 누락 시 부팅이 실패한다(fail-fast).
 */
@Validated
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @NotBlank String name,
        @NotBlank String description
) {
}
