package com.finalcall.api.auction;

import java.time.Instant;
import java.util.List;

import com.finalcall.domain.auction.AuctionSlice;

import lombok.Builder;

/**
 * 경매 목록 커서 응답(auction, 계약 §1.3·§3.1). content(요약) + 다음 커서(opaque) + hasNext.
 */
@Builder
public record AuctionCursorResponse(
    List<AuctionSummaryResponse> content,
    String nextCursor,
    boolean hasNext) {

    public static AuctionCursorResponse from(AuctionSlice slice, Instant now) {
        return AuctionCursorResponse.builder()
            .content(slice.content().stream().map(auction -> AuctionSummaryResponse.from(auction, now)).toList())
            .nextCursor(slice.nextCursor())
            .hasNext(slice.hasNext())
            .build();
    }
}
