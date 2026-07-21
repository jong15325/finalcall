package com.finalcall.api.purchase;

import com.finalcall.domain.settlement.PurchaseResult;

import lombok.Builder;

/**
 * 즉시구매 응답(purchase, 계약 §3.1 {@code POST /auctions/{id}/purchase}) — 201 {@code { orderPublicId, finalPrice }}.
 * {@code finalPrice} 는 서버가 확정한 즉시구매가다(요청 본문 없음 — 클라이언트 금액 신뢰 없음).
 */
@Builder
public record PurchaseResponse(String orderPublicId, long finalPrice) {

    public static PurchaseResponse from(PurchaseResult result) {
        return PurchaseResponse.builder()
            .orderPublicId(result.orderPublicId())
            .finalPrice(result.finalPrice())
            .build();
    }
}
