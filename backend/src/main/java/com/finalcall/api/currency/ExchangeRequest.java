package com.finalcall.api.currency;

import com.finalcall.domain.currency.ExchangeDirection;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 교환 요청(currency) — 계약 §4.4 {@code { direction, cashAmount }}.
 *
 * <p>형식 검증은 Bean Validation, 한국어 메시지. {@code direction} 은 enum({@link ExchangeDirection}) 으로 받아
 * 알 수 없는 문자열은 파싱 단계에서 400 으로 막고, 유효하나 미지원인 역방향은 서비스에서 {@code EXC_002}(422)로 막는다.
 * {@code cashAmount} 는 래퍼 {@link Long} + {@code @NotNull}(누락 400) + {@code @Positive}(0/음수 400)로 강제한다.
 */
public record ExchangeRequest(
    @NotNull(message = "교환 방향은 필수입니다.") ExchangeDirection direction,
    @NotNull(message = "캐시 금액은 필수입니다.") @Positive(message = "캐시 금액은 1 이상이어야 합니다.") Long cashAmount) {
}
