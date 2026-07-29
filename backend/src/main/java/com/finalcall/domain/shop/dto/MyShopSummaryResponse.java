package com.finalcall.domain.shop.dto;

import java.time.Instant;

import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopStatus;

import lombok.Builder;

/**
 * 내 판매 요약 응답(shop, 계약 §3.2 MyShopSummary — GET /me/shops content 항목):
 * {@code { shopPublicId, status, item, price, endAt?, sellerNickname, estimatedFee, estimatedSettle }}.
 *
 * <p>공개 {@link ShopSummaryResponse}(§3.3 ShopSummary) 필드에 <b>판매자 전용 예상 정산 2필드</b>를 더한 별도
 * DTO 다. 공개 {@code GET /shops} 응답에는 이 회계값이 절대 유입되지 않는다(별도 DTO 격리, shop-spec §10.3).
 * {@code /me/shops} 는 인증 주체(판매자 본인)라 노출이 안전하다. {@code sellerCompletedSales} 는 ShopSummary 상속분
 * (판매자 완료 판매 건수, shop-spec §11)이며 본인 리스팅이라 자기 판매 건수를 보여줘 무해하다.
 *
 * <p><b>예상치(estimate) 표기.</b> ACTIVE 리스팅은 아직 {@code sale_order} 가 없어 {@code estimatedFee}·
 * {@code estimatedSettle} 은 현재 수수료 정책으로 서버가 파생한 예상값이다 — SOLD 시점 실현값과 드리프트할 수
 * 있다(S-B). 실현 fee/settle 은 판매 후 {@code GET /me/orders?sourceType=SHOP}(판매자 전용)에 노출된다.
 * 본인 리스팅이라 {@code sellerNickname} 은 자기값이다(무해).
 */
@Builder
public record MyShopSummaryResponse(
    String shopPublicId,
    ShopStatus status,
    ShopItemResponse item,
    long price,
    Instant endAt,
    String sellerNickname,
    long sellerCompletedSales,
    long estimatedFee,
    long estimatedSettle) {

    /**
     * 내 판매 요약을 조립한다. {@code sellerCompletedSales} 는 본인(판매자) 완료 판매 건수로, /me/shops 페이지 전체가
     * 동일 판매자라 서비스가 단건 카운트 1회로 산출해 주입한다(§11.3).
     */
    public static MyShopSummaryResponse from(MyShopListing listing, long sellerCompletedSales) {
        Shop shop = listing.shop();
        return MyShopSummaryResponse.builder()
            .shopPublicId(shop.getPublicId())
            .status(shop.getStatus())
            .item(ShopItemResponse.from(shop))
            .price(shop.getPrice())
            .endAt(shop.getEndAt())
            .sellerNickname(shop.getSeller().getNickname())
            .sellerCompletedSales(sellerCompletedSales)
            .estimatedFee(listing.estimatedFee())
            .estimatedSettle(listing.estimatedSettle())
            .build();
    }
}
