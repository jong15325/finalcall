package com.finalcall.domain.auction.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 경매 낙찰 결과 유형(auction, erd §4.2). SOLD 전이 시 세팅되며 저장은 {@code @Enumerated(EnumType.STRING)}.
 *
 * <p><b>본 에픽 미사용(항상 NULL)</b> — 낙찰(BID)·즉시구매(BUYNOW) 전이는 EPIC-BID/EPIC-CLOSING 소유다.
 * enum 정의만 두어 후속 에픽의 값 마이그레이션을 피한다(게이트2 d).
 */
@Getter
@RequiredArgsConstructor
public enum AuctionResultType {

    BID("입찰 낙찰"),
    BUYNOW("즉시구매");

    private final String description;
}
