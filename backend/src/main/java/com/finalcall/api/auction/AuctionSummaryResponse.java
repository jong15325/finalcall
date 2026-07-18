package com.finalcall.api.auction;

import java.time.Instant;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionStatus;

import lombok.Builder;

/**
 * 경매 요약 응답(auction, 계약 §3.3 AuctionSummary — GET /auctions content 항목).
 *
 * <p>본 에픽 값(게이트2 b): {@code highestBidAmount}=null·{@code bidCount}=0(입찰 미구현). {@code startPrice}는
 * 현재가 대체가 아니라 시작가를 정직히 노출한다. {@code status}는 lazy 활성화 파생값이다(게이트2 a — SCHEDULED 이고
 * start_at ≤ now 면 ACTIVE). {@code sellerNickname}은 리스팅 고유 정보라 마스킹하지 않는다(최고입찰자만 상세에서 마스킹).
 */
@Builder
public record AuctionSummaryResponse(
    String auctionPublicId,
    AuctionStatus status,
    AuctionItemView item,
    long startPrice,
    Long buyNowPrice,
    Long highestBidAmount,
    long bidCount,
    Instant startAt,
    Instant endAt,
    String sellerNickname) {

    public static AuctionSummaryResponse from(Auction auction, Instant now) {
        return AuctionSummaryResponse.builder()
            .auctionPublicId(auction.getPublicId())
            .status(auction.displayStatus(now))
            .item(AuctionItemView.from(auction))
            .startPrice(auction.getStartPrice())
            .buyNowPrice(auction.getBuyNowPrice())
            .highestBidAmount(auction.getHighestBidAmount()) // 본 에픽 null
            .bidCount(0L) // 본 에픽 0(게이트2 b)
            .startAt(auction.getStartAt())
            .endAt(auction.getEndAt())
            .sellerNickname(auction.getSeller().getNickname())
            .build();
    }
}
