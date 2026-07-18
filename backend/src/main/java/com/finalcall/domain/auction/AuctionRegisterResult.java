package com.finalcall.domain.auction;

import java.time.Instant;

/**
 * 경매 등록 결과(auction, 도메인 반환 타입). 계약 §3.1 응답 {@code { auctionPublicId, status, endAt }}의 원천이다.
 * status 는 등록 시 결정된 영속 상태(SCHEDULED/ACTIVE)다(등록 직후라 lazy 파생과 동일).
 */
public record AuctionRegisterResult(String auctionPublicId, AuctionStatus status, Instant endAt) {
}
