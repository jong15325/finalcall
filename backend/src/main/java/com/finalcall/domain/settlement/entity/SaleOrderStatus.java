package com.finalcall.domain.settlement.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 판매 성립 거래 상태(settlement, erd §4.2). DB 는 {@code @Enumerated(EnumType.STRING)}으로 이름을 저장한다.
 *
 * <p>정산은 <b>내부 DB 단일 TX</b>로 완결되므로 상태가 {@link #SETTLED} 하나뿐이다 — 생성 즉시 정산 완료다.
 * sale_order 는 append-only 라 이후 상태 전이가 없다(환불·크레딧은 후속 에픽에서 별도 원장으로 처리).
 */
@Getter
@RequiredArgsConstructor
public enum SaleOrderStatus {

    SETTLED("정산 완료");

    private final String description;
}
