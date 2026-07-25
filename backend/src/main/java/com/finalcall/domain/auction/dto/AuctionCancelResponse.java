package com.finalcall.domain.auction.dto;

/**
 * 경매 취소 응답(auction, 계약 §3.1 응답 200 {@code { status }}). status 는 취소 결과("CANCELLED").
 */
public record AuctionCancelResponse(String status) {
}
