package com.finalcall.domain.auction;

import java.time.Instant;

/**
 * 경매 등록 명령(auction, 도메인 내부 DTO). api 요청(record)을 서비스 계층 입력으로 옮긴 값 객체 — 형식 검증(@Valid)은
 * api 가, 비즈니스·시간·가격 검증(AUCTION_003/008)은 서비스가 담당한다. soft-close 값은 optional(미지정 시 서버 기본).
 *
 * @param softCloseWindowSec null 이면 서버 기본(게이트2 c)
 * @param softCloseExtendSec null 이면 서버 기본(게이트2 c)
 */
public record AuctionRegisterCommand(
    String itemInstancePublicId,
    long startPrice,
    Long buyNowPrice,
    Instant startAt,
    Instant endAt,
    Integer softCloseWindowSec,
    Integer softCloseExtendSec,
    Instant maxEndAt) {
}
