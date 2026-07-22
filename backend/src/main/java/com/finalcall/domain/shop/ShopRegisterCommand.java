package com.finalcall.domain.shop;

/**
 * 고정가 등록 명령(shop, shop-spec §3). 판매자는 SecurityContext 주체라 명령에 담지 않고, <b>기한도 담지 않는다</b>
 * (서버가 설정 일수로 자동 계산 — 게이트2 C5). 진입은 아이템 식별자 + 고정 판매가뿐이다.
 *
 * @param itemInstancePublicId 출품 아이템 외부 식별자
 * @param price                고정 판매가(양수 검증은 요청 계층 @Positive → 400, shop-spec §3)
 */
public record ShopRegisterCommand(String itemInstancePublicId, long price) {
}
