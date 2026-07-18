package com.finalcall.domain.currency;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 게임머니 홀드 상태(money_hold, erd §4.1). DB 는 {@code @Enumerated(EnumType.STRING)}으로 이름을 저장한다.
 *
 * <p>enum 은 전체 3값을 정의하되 <b>전이는 본 에픽 소유분만</b> 구현한다: (생성)→HELD, HELD→RELEASED
 * (상위 입찰 시 즉시 해제, P-008). HELD→CAPTURED(낙찰 차감) 전이는 EPIC-CLOSING 소유다.
 *
 * <p>즉시 해제 규약 때문에 경매당 {@code HELD} 는 항상 최대 1건이다(bid-domain-spec §10 I3) — 밀린 입찰의
 * 홀드가 누적돼 사용자 잔액이 장시간 묶이지 않는다(domain-spec §4 P-008).
 */
@Getter
@RequiredArgsConstructor
public enum MoneyHoldStatus {

    HELD("홀드 중"),
    RELEASED("해제됨"),
    CAPTURED("낙찰 차감됨");

    private final String description;
}
