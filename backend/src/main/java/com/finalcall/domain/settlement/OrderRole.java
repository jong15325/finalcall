package com.finalcall.domain.settlement;

/**
 * 요청자의 주문 관점(settlement, purchase-spec §5.2) — 같은 sale_order 라도 요청자가 구매자냐 판매자냐에 따라
 * 노출 필드가 달라진다(역할 인지 응답). {@code GET /me/orders} 의 {@code role} 필터로도 쓰인다(그 축으로 목록을
 * 좁힘). {@code myRole==SELLER} 일 때만 {@code feeAmount}·{@code settleAmount}(판매자 회계)를 노출한다(B2).
 */
public enum OrderRole {

    BUYER,
    SELLER
}
