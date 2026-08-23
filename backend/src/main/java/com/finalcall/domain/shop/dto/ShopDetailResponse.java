package com.finalcall.domain.shop.dto;

import java.time.Instant;

import com.finalcall.domain.item.dto.CardInfoResponse;
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopStatus;

import lombok.Builder;

/**
 * 고정가 상세 응답(shop, 계약 §3.3 ShopDetail = ShopSummary + {@code createdAt}). record 는 상속 불가라 요약 필드를
 * 평면 재나열한다(AuctionDetailResponse 선례 — DTO 는 계약 스키마에 1:1). {@code sellerCompletedSales} 도 요약과
 * 동일한 판매자 완료 판매 건수다(shop-spec §11 — ShopSummary 상속분, 상세는 단건 카운트로 채운다).
 */
@Builder
public record ShopDetailResponse(
    String shopPublicId,
    ShopStatus status,
    ShopItemResponse item,
    long price,
    Instant endAt,
    String sellerNickname,
    Instant createdAt,
    long sellerCompletedSales) {

    /** 상세 응답을 조립한다. {@code sellerCompletedSales} 는 서비스가 단건 카운트로 산출해 주입한다(§11.3). */
    public static ShopDetailResponse from(Shop shop, long sellerCompletedSales, CardInfoResponse cardInfo) {
        return ShopDetailResponse.builder()
            .shopPublicId(shop.getPublicId())
            .status(shop.getStatus())
            .item(ShopItemResponse.from(shop, cardInfo))
            .price(shop.getPrice())
            .endAt(shop.getEndAt())
            .sellerNickname(shop.getSeller().getNickname())
            .createdAt(shop.getCreatedAt())
            .sellerCompletedSales(sellerCompletedSales)
            .build();
    }
}
