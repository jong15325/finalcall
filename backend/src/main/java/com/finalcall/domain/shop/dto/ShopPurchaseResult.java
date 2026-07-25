package com.finalcall.domain.shop.dto;

/**
 * 고정가 구매 성립 결과(shop, shop-spec §4.1) — 표현 계층이 201 응답 {@code { orderPublicId, finalPrice }} 으로
 * 옮긴다. {@code finalPrice = shop.price}(서버가 확정한 고정 판매가, 클라이언트 금액 신뢰 없음).
 *
 * @param orderPublicId 생성된 거래 레코드(sale_order)의 외부 식별자(ULID)
 * @param finalPrice    최종 결제 금액(= 고정 판매가)
 */
public record ShopPurchaseResult(String orderPublicId, long finalPrice) {
}
