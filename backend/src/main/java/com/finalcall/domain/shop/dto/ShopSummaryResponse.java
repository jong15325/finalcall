package com.finalcall.domain.shop.dto;

import java.time.Instant;

import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopStatus;

import lombok.Builder;

/**
 * 고정가 요약 응답(shop, 계약 §3.3 ShopSummary — GET /shops content 항목):
 * {@code { shopPublicId, status, item, price, endAt?, sellerNickname }}.
 *
 * <p>{@code status}는 영속값 그대로다(고정가는 lazy 활성화 파생이 없다 — 등록 즉시 ACTIVE, 예약 시작 없음).
 * {@code endAt}은 서버가 자동 계산한 판매 기한이며 무기한(null)은 향후 캐시아이템 전용이라 이 에픽 목록엔 사실상
 * 항상 값이 있다. {@code sellerNickname}은 리스팅 고유 정보라 마스킹하지 않는다(경매 대칭).
 */
@Builder
public record ShopSummaryResponse(
    String shopPublicId,
    ShopStatus status,
    ShopItemResponse item,
    long price,
    Instant endAt,
    String sellerNickname) {

    public static ShopSummaryResponse from(Shop shop) {
        return ShopSummaryResponse.builder()
            .shopPublicId(shop.getPublicId())
            .status(shop.getStatus())
            .item(ShopItemResponse.from(shop))
            .price(shop.getPrice())
            .endAt(shop.getEndAt())
            .sellerNickname(shop.getSeller().getNickname())
            .build();
    }
}
