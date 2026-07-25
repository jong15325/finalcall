package com.finalcall.domain.bid.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 입찰 상태(bid, erd §4.2). DB 는 {@code @Enumerated(EnumType.STRING)}으로 이름을 저장한다.
 *
 * <p>enum 은 전체 3값을 정의하되(부분 정의 시 후속 enum 마이그레이션 발생), <b>전이는 본 에픽 소유분만</b>
 * 구현한다: (생성)→ACTIVE, ACTIVE→OUTBID(상위 입찰 발생). WON 전이는 EPIC-CLOSING 소유다.
 *
 * <p>경매당 {@code ACTIVE} 는 항상 최대 1건이다(bid-domain-spec §10 I1) — 상위 입찰이 성립하는 즉시 직전
 * 최고 입찰이 OUTBID 로 밀려나기 때문이다. 이 불변식이 "현재 최고 입찰" 단건 조회의 근거다.
 */
@Getter
@RequiredArgsConstructor
public enum BidStatus {

    ACTIVE("현재 최고 입찰"),
    OUTBID("상위 입찰에 밀림"),
    WON("낙찰");

    private final String description;
}
