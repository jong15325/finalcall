package com.finalcall.domain.shop;

import java.util.List;

/**
 * 내 판매 목록 커서 슬라이스(shop, 계약 §1.3·§3.2 GET /me/shops). 공개 목록의 {@link ShopSlice} 와 동형이나
 * content 가 판매자 전용 예상 정산을 얹은 {@link MyShopListing} 이라는 점만 다르다(공개 {@code ShopSummary} 무오염).
 *
 * @param content    현재 페이지 항목(예상 정산 결합)
 * @param nextCursor 다음 페이지 커서(opaque, 마지막 페이지면 null)
 * @param hasNext    다음 페이지 존재 여부
 */
public record MyShopSlice(List<MyShopListing> content, String nextCursor, boolean hasNext) {
}
