package com.finalcall.domain.shop.dto;

import java.time.Instant;

import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopStatus;

import lombok.Builder;

/**
 * 고정가 요약 응답(shop, 계약 §3.3 ShopSummary — GET /shops content 항목):
 * {@code { shopPublicId, status, item, price, endAt?, sellerNickname, sellerCompletedSales }}.
 *
 * <p>{@code status}는 영속값 그대로다(고정가는 lazy 활성화 파생이 없다 — 등록 즉시 ACTIVE, 예약 시작 없음).
 * {@code endAt}은 서버가 자동 계산한 판매 기한이며 무기한(null)은 향후 캐시아이템 전용이라 이 에픽 목록엔 사실상
 * 항상 값이 있다. {@code sellerNickname}은 리스팅 고유 정보라 마스킹하지 않는다(경매 대칭).
 *
 * <p>{@code sellerCompletedSales}(long, non-null, ≥0)는 판매자의 완료(정산 성립) 판매 건수다(shop-spec §11, FC-149)
 * — {@code sale_order} 를 seller_id 로 집계한 값(경매 낙찰 + 마켓 판매 합산, 취소·유찰·만료는 행이 없어 자동 제외).
 * 집계 카운트일 뿐 PII·거래상대·금액이 없어 공개 목록/상세에 노출해도 안전하다(판매자 신뢰 지표). 집계 자체는
 * 서비스가 페이지당 배치 1쿼리로 채워 넘긴다(N+1 회피, §11.3) — DTO 는 값만 담는다.
 */
@Builder
public record ShopSummaryResponse(
    String shopPublicId,
    ShopStatus status,
    ShopItemResponse item,
    long price,
    Instant endAt,
    String sellerNickname,
    long sellerCompletedSales) {

    /**
     * 요약 응답을 조립한다. {@code sellerCompletedSales} 는 DTO 가 스스로 셀 수 없어(N+1 유발) 서비스가 배치 집계로
     * 산출한 값을 주입받는다 — 이력 없는 판매자는 0 이다.
     */
    public static ShopSummaryResponse from(Shop shop, long sellerCompletedSales) {
        return ShopSummaryResponse.builder()
            .shopPublicId(shop.getPublicId())
            .status(shop.getStatus())
            .item(ShopItemResponse.from(shop))
            .price(shop.getPrice())
            .endAt(shop.getEndAt())
            .sellerNickname(shop.getSeller().getNickname())
            .sellerCompletedSales(sellerCompletedSales)
            .build();
    }
}
