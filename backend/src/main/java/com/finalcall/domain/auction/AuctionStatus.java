package com.finalcall.domain.auction;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 경매 상태(auction FSM, domain-spec §5·erd §4.2). DB 는 {@code @Enumerated(EnumType.STRING)}으로 이름을 저장한다.
 *
 * <p>enum 은 전체 5값을 정의하되(게이트2 d — 부분 정의 시 후속 enum 마이그레이션 발생), <b>전이(상태 변경)는
 * 본 에픽 소유분만</b> 구현한다: (생성)→SCHEDULED/ACTIVE, SCHEDULED|ACTIVE→CANCELLED. SOLD/UNSOLD 전이는
 * EPIC-BID/EPIC-CLOSING 소유다(enum 값 존재 ≠ 전이 구현).
 */
@Getter
@RequiredArgsConstructor
public enum AuctionStatus {

    SCHEDULED("예약(시작 전)"),
    ACTIVE("진행 중"),
    SOLD("낙찰"),
    UNSOLD("유찰"),
    CANCELLED("취소");

    private final String description;
}
