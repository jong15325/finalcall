package com.finalcall.domain.settlement.dto;

import java.util.List;

import lombok.Builder;

/**
 * 거래내역 목록 커서 응답(order, 계약 §1.3·§4.3). content(역할 인지 요약) + 다음 커서(opaque) + hasNext.
 * 각 항목은 {@code viewerId} 관점으로 파생한다(myRole·상대 마스킹·판매자 전용 필드, purchase-spec §5.2).
 */
@Builder
public record OrderCursorResponse(
    List<OrderSummaryResponse> content,
    String nextCursor,
    boolean hasNext) {

    public static OrderCursorResponse from(OrderSlice slice) {
        return OrderCursorResponse.builder()
            .content(slice.content().stream()
                .map(order -> OrderSummaryResponse.from(order, slice.viewerId()))
                .toList())
            .nextCursor(slice.nextCursor())
            .hasNext(slice.hasNext())
            .build();
    }
}
