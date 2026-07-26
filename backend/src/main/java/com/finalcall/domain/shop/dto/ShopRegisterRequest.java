package com.finalcall.domain.shop.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * 고정가 등록 요청(shop, 계약 §3.2 POST /shops body): {@code { itemInstancePublicId, price }}. <b>기한 입력 필드
 * 없음</b> — 서버가 설정 일수로 end_at 을 자동 계산한다(shop-spec §3.1, 게이트2 C5).
 *
 * <p>{@code price} 양수 검증은 여기서 {@code @Positive}(→ 400)로 한다(shop-spec §3 "위반 → 검증 400"). 소유·출품
 * 가능 여부는 서비스가 도메인 에러(SHOP_001/002)로 검증한다.
 */
public record ShopRegisterRequest(
    @NotBlank String itemInstancePublicId,
    @Positive long price) {
}
