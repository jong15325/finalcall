package com.finalcall.domain.auction.dto;

import java.util.List;

import com.finalcall.domain.auction.entity.AuctionWithBidCount;

/**
 * 경매 목록 커서 조회 결과(auction, 도메인 반환 타입). api 계층에서 커서 응답 DTO 로 변환한다.
 *
 * @param content    이번 페이지 경매 목록(itemInstance·template·skill·seller fetch join + 입찰 수 집계)
 * @param nextCursor 다음 페이지 커서(opaque), 비었으면 null
 * @param hasNext    다음 페이지 존재 여부
 */
public record AuctionSlice(List<AuctionWithBidCount> content, String nextCursor, boolean hasNext) {
}
