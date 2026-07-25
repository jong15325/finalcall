package com.finalcall.domain.shop.dto;

import java.util.List;

import lombok.Builder;

/**
 * 내 판매 목록 커서 응답(shop, 계약 §1.3·§3.2 GET /me/shops). content(예상 정산 결합 요약) + 다음 커서(opaque) +
 * hasNext. 공개 {@link ShopCursorResponse} 와 동형이나 content 항목이 {@link MyShopSummaryResponse}(판매자 전용
 * 예상 정산 포함)라는 점만 다르다.
 */
@Builder
public record MyShopCursorResponse(
    List<MyShopSummaryResponse> content,
    String nextCursor,
    boolean hasNext) {

    public static MyShopCursorResponse from(MyShopSlice slice) {
        return MyShopCursorResponse.builder()
            .content(slice.content().stream().map(MyShopSummaryResponse::from).toList())
            .nextCursor(slice.nextCursor())
            .hasNext(slice.hasNext())
            .build();
    }
}
