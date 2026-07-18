package com.finalcall.api.auction;

import java.time.Instant;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionResultType;
import com.finalcall.domain.auction.AuctionStatus;

import lombok.Builder;

/**
 * 경매 상세 응답(auction, 계약 §3.3 AuctionDetail = AuctionSummary + 상세 필드). record 는 상속 불가라 요약 필드를
 * 평면 재나열한다(item-domain-spec 선례 — DTO 는 계약 스키마에 1:1).
 *
 * <p>본 에픽 값(게이트2 b): {@code resultType}=null·{@code highestBidderMasked}=null(입찰 미구현)·
 * {@code extensionCount}=0(소프트클로즈 연장 미구현). "남은 시간"은 클라 파생(endAt−now)이라 서버 미산출(spec §5.3).
 */
@Builder
public record AuctionDetailResponse(
    String auctionPublicId,
    AuctionStatus status,
    AuctionItemView item,
    long startPrice,
    Long buyNowPrice,
    Long highestBidAmount,
    long bidCount,
    Instant startAt,
    Instant endAt,
    String sellerNickname,
    AuctionResultType resultType,
    String highestBidderMasked,
    int extensionCount,
    Instant maxEndAt,
    Instant createdAt) {

    public static AuctionDetailResponse from(Auction auction, Instant now) {
        return AuctionDetailResponse.builder()
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
            .resultType(auction.getResultType()) // 본 에픽 null
            .highestBidderMasked(maskHighestBidder(auction)) // 본 에픽 null(입찰 없음)
            .extensionCount(auction.getExtensionCount()) // 본 에픽 0
            .maxEndAt(auction.getMaxEndAt())
            .createdAt(auction.getCreatedAt())
            .build();
    }

    /**
     * 최고입찰자 nickname 마스킹(앞 2자 + {@code ***}, item-spec §5.2 ownerMasked 규약 대칭). 입찰이 없으면 null.
     * 본 에픽은 highest_bidder 가 전건 NULL 이라 항상 null 이며, EPIC-BID 활성 시 실값으로 자연 대체된다.
     */
    private static String maskHighestBidder(Auction auction) {
        if (auction.getHighestBidder() == null) {
            return null;
        }
        String nickname = auction.getHighestBidder().getNickname();
        if (nickname == null || nickname.isEmpty()) {
            return "***";
        }
        int prefixLength = Math.min(2, nickname.length());
        return nickname.substring(0, prefixLength) + "***";
    }
}
