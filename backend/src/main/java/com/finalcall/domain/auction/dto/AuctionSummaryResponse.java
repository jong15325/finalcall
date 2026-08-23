package com.finalcall.domain.auction.dto;

import java.time.Instant;

import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.auction.entity.AuctionStatus;
import com.finalcall.domain.auction.entity.AuctionWithBidCount;
import com.finalcall.domain.item.dto.CardInfoResponse;

import lombok.Builder;

/**
 * 경매 요약 응답(auction, 계약 §3.3 AuctionSummary — GET /auctions content 항목).
 *
 * <p>{@code highestBidAmount}·{@code bidCount}는 EPIC-BID(FC-033)에서 <b>실값</b>으로 대체됐다 — 전자는
 * {@code auction.highest_bid_amount} 컬럼, 후자는 목록 쿼리의 상관 서브쿼리 집계다(계약·스키마 무변경).
 * {@code startPrice}는 현재가 대체가 아니라 시작가를 정직히 노출한다. {@code status}는 lazy 활성화 파생값이다
 * (게이트2 a — SCHEDULED 이고 start_at ≤ now 면 ACTIVE). {@code sellerNickname}은 리스팅 고유 정보라 마스킹하지
 * 않는다(최고입찰자만 상세에서 마스킹).
 */
@Builder
public record AuctionSummaryResponse(
    String auctionPublicId,
    AuctionStatus status,
    AuctionItemResponse item,
    long startPrice,
    Long buyNowPrice,
    Long highestBidAmount,
    long bidCount,
    Instant startAt,
    Instant endAt,
    String sellerNickname) {

    public static AuctionSummaryResponse from(AuctionWithBidCount row, Instant now, CardInfoResponse cardInfo) {
        Auction auction = row.auction();
        return AuctionSummaryResponse.builder()
            .auctionPublicId(auction.getPublicId())
            .status(auction.displayStatus(now))
            .item(AuctionItemResponse.from(auction, cardInfo))
            .startPrice(auction.getStartPrice())
            .buyNowPrice(auction.getBuyNowPrice())
            .highestBidAmount(auction.getHighestBidAmount())
            .bidCount(row.bidCount())
            .startAt(auction.getStartAt())
            .endAt(auction.getEndAt())
            .sellerNickname(auction.getSeller().getNickname())
            .build();
    }
}
