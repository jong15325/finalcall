package com.finalcall.domain.auction.dto;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 경매 등록 요청(auction, 계약 §3.1 POST /auctions body). 형식 검증(@Valid)만 여기서 하고, 시간 관계·가격 규칙
 * (endAt&gt;now·buyNow&gt;startPrice 등)은 서비스가 도메인 에러(AUCTION_003/008)로 검증한다(계약 §5 1:1).
 *
 * <p>{@code startPrice} 는 양수 검증도 서비스가 AUCTION_003(422)로 수행한다(spec §5.1 — @Positive 400 과 코드 통일).
 * soft-close 값은 optional(미지정 시 서버 기본, 게이트2 c). 시각은 ISO-8601 UTC(Instant)로 바인딩된다.
 */
public record AuctionRegisterRequest(
    @NotBlank String itemInstancePublicId,
    long startPrice,
    Long buyNowPrice,
    Instant startAt,
    @NotNull Instant endAt,
    Integer softCloseWindowSec,
    Integer softCloseExtendSec,
    @NotNull Instant maxEndAt) {
}
