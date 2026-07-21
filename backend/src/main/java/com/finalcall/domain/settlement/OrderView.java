package com.finalcall.domain.settlement;

/**
 * 주문 상세 조회 결과(settlement) — sale_order 와 요청자 PK 를 함께 싣는다. 표현 계층이 {@code viewerId} 로
 * {@code myRole}·{@code counterpartyMasked} 와 판매자 전용 필드(fee/settle) 노출 여부를 파생한다(purchase-spec §5.2).
 *
 * @param order    조회된 sale_order(연관 fetch join 완료)
 * @param viewerId 요청자 PK(당사자 검증 통과 — buyer 또는 seller)
 */
public record OrderView(SaleOrder order, Long viewerId) {
}
