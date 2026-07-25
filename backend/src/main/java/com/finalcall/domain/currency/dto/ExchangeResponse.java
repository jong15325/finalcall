package com.finalcall.domain.currency.dto;

import java.math.BigDecimal;

import com.finalcall.domain.currency.entity.MoneyExchange;

import lombok.Builder;

/**
 * 교환 응답(currency) — 계약 §4.4 {@code { gameMoneyAmount, appliedRate }}.
 * Response 는 record + {@code @Builder} + {@code static from(Entity)}(CLAUDE.md §5).
 *
 * <p>{@code appliedRate} 는 처리 시점의 환율 스냅샷이다(원장 {@code applied_rate} 그대로 — 이후 rate 가 바뀌어도 불변).
 */
@Builder
public record ExchangeResponse(
    long gameMoneyAmount,
    BigDecimal appliedRate) {

    public static ExchangeResponse from(MoneyExchange exchange) {
        return ExchangeResponse.builder()
            .gameMoneyAmount(exchange.getGameMoneyAmount())
            .appliedRate(exchange.getAppliedRate())
            .build();
    }
}
