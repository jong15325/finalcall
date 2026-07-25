package com.finalcall.domain.currency.dto;

import com.finalcall.domain.currency.entity.ExchangeDirection;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 교환 요청(currency) — 계약 §4.4 {@code { direction, cashAmount }}.
 *
 * <p>형식 검증은 Bean Validation, 한국어 메시지. {@code direction} 은 enum({@link ExchangeDirection}) 으로 받아
 * 알 수 없는 문자열은 파싱 단계에서 400 으로 막고, 유효하나 미지원인 역방향은 서비스에서 {@code EXC_002}(422)로 막는다.
 * {@code cashAmount} 는 래퍼 {@link Long} + {@code @NotNull}(누락 400) + {@code @Positive}(0/음수 400)로 강제한다.
 *
 * <p>{@code @Max} 상한은 {@code cashAmount × rate} 오버플로 위생이다(FC-011). 기본 교환비율
 * {@code exchange.rate=1,000,000} 역산 상한({@code Long.MAX_VALUE / 1,000,000})으로, 이 이하이면 지급액 곱이
 * {@code long} 절대금액을 넘지 않아 {@code ExchangeWriter} 의 {@code Math.multiplyExact} 가 던지는
 * {@code ArithmeticException}(→ 500)이 발생하지 않는다. 초과 요청은 부수효과 전에 400({@code COMMON_001}
 * {@code errors[]})으로 정상화된다. multiplyExact 는 운영상 rate override 극단값을 위한 심층 방어로 유지한다.
 */
public record ExchangeRequest(
    @NotNull(message = "교환 방향은 필수입니다.") ExchangeDirection direction,
    @NotNull(message = "캐시 금액은 필수입니다.") @Positive(message = "캐시 금액은 1 이상이어야 합니다.") @Max(value = Long.MAX_VALUE
        / 1_000_000L, message = "캐시 금액이 허용 범위를 초과했습니다.") Long cashAmount) {
}
