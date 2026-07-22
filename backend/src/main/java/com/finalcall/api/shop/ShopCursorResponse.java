package com.finalcall.api.shop;

import java.util.List;

import com.finalcall.domain.shop.ShopSlice;

import lombok.Builder;

/**
 * 고정가 목록 커서 응답(shop, 계약 §1.3·§3.2). content(요약) + 다음 커서(opaque) + hasNext.
 */
@Builder
public record ShopCursorResponse(
    List<ShopSummaryResponse> content,
    String nextCursor,
    boolean hasNext) {

    public static ShopCursorResponse from(ShopSlice slice) {
        return ShopCursorResponse.builder()
            .content(slice.content().stream().map(ShopSummaryResponse::from).toList())
            .nextCursor(slice.nextCursor())
            .hasNext(slice.hasNext())
            .build();
    }
}
