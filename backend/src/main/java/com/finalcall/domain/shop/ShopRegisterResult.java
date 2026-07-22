package com.finalcall.domain.shop;

import java.time.Instant;

/**
 * 고정가 등록 결과(shop, shop-spec §3) — 표현 계층이 201 응답 {@code { shopPublicId, status, endAt }} 으로 옮긴다.
 * {@code endAt} 은 서버가 설정 일수로 자동 계산한 판매 기한이다(판매자는 고르지 않는다).
 *
 * @param shopPublicId 생성된 고정가의 외부 식별자(ULID)
 * @param status       생성 상태(항상 ACTIVE)
 * @param endAt        서버 자동 계산 판매 기한
 */
public record ShopRegisterResult(String shopPublicId, ShopStatus status, Instant endAt) {
}
