package com.finalcall.api.auction;

import java.time.Instant;

import com.finalcall.domain.auction.AuctionRegisterResult;
import com.finalcall.domain.auction.AuctionStatus;

import lombok.Builder;

/**
 * 경매 등록 응답(auction, 계약 §3.1 응답 201 {@code { auctionPublicId, status, endAt }}).
 */
@Builder
public record AuctionRegisterResponse(
    String auctionPublicId,
    AuctionStatus status,
    Instant endAt) {

    public static AuctionRegisterResponse from(AuctionRegisterResult result) {
        return AuctionRegisterResponse.builder()
            .auctionPublicId(result.auctionPublicId())
            .status(result.status())
            .endAt(result.endAt())
            .build();
    }
}
