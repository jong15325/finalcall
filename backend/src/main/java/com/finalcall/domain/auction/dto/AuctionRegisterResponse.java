package com.finalcall.domain.auction.dto;

import java.time.Instant;

import com.finalcall.domain.auction.entity.AuctionStatus;

import lombok.Builder;

/**
 * 경매 등록 응답(auction, 계약 §3.1 응답 201 {@code { auctionPublicId, status, endAt }}).
 */
@Builder
public record AuctionRegisterResponse(
    String auctionPublicId,
    AuctionStatus status,
    Instant endAt) {
}
