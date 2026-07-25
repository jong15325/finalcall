package com.finalcall.domain.auction.dto;

import java.time.Instant;

import com.finalcall.common.util.NicknameMasker;
import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.auction.entity.AuctionResultType;
import com.finalcall.domain.auction.entity.AuctionStatus;

import lombok.Builder;

/**
 * 경매 상세 응답(auction, 계약 §3.3 AuctionDetail = AuctionSummary + 상세 필드). record 는 상속 불가라 요약 필드를
 * 평면 재나열한다(item-domain-spec 선례 — DTO 는 계약 스키마에 1:1).
 *
 * <p>{@code highestBidAmount}·{@code bidCount}·{@code highestBidderMasked}·{@code extensionCount}는
 * EPIC-BID(FC-033)에서 <b>실값</b>으로 대체됐다(계약·스키마 무변경 — auction-domain-spec §9-b 설계대로).
 * {@code minNextBidAmount}는 계약 v1.8 F3 신규 파생 필드다. {@code resultType}은 EPIC-CLOSING 소유라 여전히 null 이다.
 * "남은 시간"은 클라 파생(endAt−now)이라 서버 미산출(spec §5.3).
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
    Instant createdAt,
    Long minNextBidAmount) {

    public static AuctionDetailResponse from(AuctionDetail detail, Instant now) {
        Auction auction = detail.auction();
        return AuctionDetailResponse.builder()
            .auctionPublicId(auction.getPublicId())
            .status(auction.displayStatus(now))
            .item(AuctionItemView.from(auction))
            .startPrice(auction.getStartPrice())
            .buyNowPrice(auction.getBuyNowPrice())
            .highestBidAmount(auction.getHighestBidAmount())
            .bidCount(detail.bidCount())
            .startAt(auction.getStartAt())
            .endAt(auction.getEndAt())
            .sellerNickname(auction.getSeller().getNickname())
            .resultType(auction.getResultType()) // EPIC-CLOSING 소유 — 본 에픽 null
            .highestBidderMasked(maskHighestBidder(auction))
            .extensionCount(auction.getExtensionCount())
            .maxEndAt(auction.getMaxEndAt())
            .createdAt(auction.getCreatedAt())
            .minNextBidAmount(detail.minNextBidAmount())
            .build();
    }

    /**
     * 최고입찰자 nickname 마스킹. 규약(앞 2자 + {@code ***})은 {@link NicknameMasker} 가 단독 소유한다 —
     * 계약 §3.3 이 이 값과 {@code BidSummary.bidderMasked} 를 "동일 규약"으로 못 박았기 때문이다.
     *
     * <p>입찰이 없으면 null 이다("마스킹된 빈 값"이 아니라 필드 부재). {@code highestBidder} 는 상세 쿼리가
     * fetch join 으로 초기화한다 — 하지 않으면 OSIV off 환경에서 여기서 lazy 예외가 난다.
     */
    private static String maskHighestBidder(Auction auction) {
        if (auction.getHighestBidder() == null) {
            return null;
        }
        return NicknameMasker.mask(auction.getHighestBidder().getNickname());
    }
}
