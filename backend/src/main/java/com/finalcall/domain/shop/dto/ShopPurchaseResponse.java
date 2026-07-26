package com.finalcall.domain.shop.dto;

import lombok.Builder;

/**
 * 고정가 구매 응답(shop, 계약 §3.2 {@code POST /shops/{id}/purchase}) — 201 {@code { orderPublicId, finalPrice }}.
 * {@code finalPrice}는 서버가 확정한 고정 판매가다(요청 본문 없음 — 클라이언트 금액 신뢰 없음).
 */
@Builder
public record ShopPurchaseResponse(String orderPublicId, long finalPrice) {
}
