package com.finalcall.domain.shop.dto;

import com.finalcall.domain.shop.entity.Shop;

/**
 * 내 판매 리스팅 1건(shop, EPIC-SHOP-MANAGE / 계약 §3.2 GET /me/shops). 조회된 {@link Shop} 에 판매자 전용 예상
 * 정산 2값을 결합한다.
 *
 * <p><b>예상치(estimate)임에 주의한다(shop-spec §10.3).</b> ACTIVE 리스팅은 아직 {@code sale_order} 가 없어
 * {@code estimatedFee}·{@code estimatedSettle} 은 현재 수수료 정책({@code FeeCalculator})으로 서버가 파생한
 * <b>예상값</b>이다 — SOLD 시점 {@code feePolicy.version()} 기준 실현값과 드리프트할 수 있다(S-B). 실현 fee/settle
 * 은 판매 후 {@code GET /me/orders?sourceType=SHOP}(판매자 전용)에 그대로 노출된다.
 *
 * @param shop            조회된 고정가(item·seller fetch join 초기화됨)
 * @param estimatedFee    예상 수수료 = {@code FeeCalculator.compute(price)}
 * @param estimatedSettle 예상 정산액 = {@code price − estimatedFee}
 */
public record MyShopListing(Shop shop, long estimatedFee, long estimatedSettle) {
}
