package com.finalcall.domain.currency;

/**
 * 화폐 교환 방향(currency) — 계약 §4.4.
 *
 * <p>현재 지원 방향은 {@link #CASH_TO_GAME}(캐시→게임머니) 하나다. {@link #GAME_TO_CASH}(역방향)는
 * 미지원이며, 잘못된 문자열(파싱 실패 400)과 구분해 "형식은 옳으나 미지원"을 {@code EXC_002}(422)로
 * 돌려주기 위해 표현만 둔다(실제 역방향 교환 로직은 구현하지 않는다).
 */
public enum ExchangeDirection {

    CASH_TO_GAME,
    GAME_TO_CASH
}
