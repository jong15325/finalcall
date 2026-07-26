package com.finalcall.domain.currency.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.Positive;

/**
 * 화폐 교환 설정 바인딩(currency, FC-007 확정).
 *
 * <p>{@code rate} 는 캐시→게임머니 교환 비율이다(1 캐시 = {@code rate} 게임머니, 기본 1,000,000).
 * 산발적 {@code @Value} 대신 {@code @ConfigurationProperties} + {@code @Validated} 표준을 따른다.
 * 운영에서 {@code EXCHANGE_RATE} 환경변수로 override 할 수 있으며(application.yml relaxed binding),
 * {@code @Positive} 로 0/음수 설정을 부팅 시 차단한다(fail-fast).
 */
@Validated
@ConfigurationProperties(prefix = "exchange")
public record ExchangeProperties(@Positive long rate) {
}
