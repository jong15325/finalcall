package com.finalcall.domain.shop.dto;

import java.time.Instant;

import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopStatus;

import lombok.Builder;

/**
 * 고정가 상세 응답(shop, 계약 §3.3 ShopDetail = ShopSummary + {@code createdAt}). record 는 상속 불가라 요약 필드를
 * 평면 재나열한다(AuctionDetailResponse 선례 — DTO 는 계약 스키마에 1:1).
 */
@Builder
public record ShopDetailResponse(
    String shopPublicId,
    ShopStatus status,
    ShopItemResponse item,
    long price,
    Instant endAt,
    String sellerNickname,
    Instant createdAt) {

    public static ShopDetailResponse from(Shop shop) {
        return ShopDetailResponse.builder()
            .shopPublicId(shop.getPublicId())
            .status(shop.getStatus())
            .item(ShopItemResponse.from(shop))
            .price(shop.getPrice())
            .endAt(shop.getEndAt())
            .sellerNickname(shop.getSeller().getNickname())
            .createdAt(shop.getCreatedAt())
            .build();
    }
}
