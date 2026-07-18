package com.finalcall.domain.bid;

import org.springframework.http.HttpStatus;

import com.finalcall.common.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 입찰 도메인 에러 코드(bid, EPIC-BID) — 네이밍 {@code BID_{3자리}}(CLAUDE.md §5). 계약 v1.8 §5 등재분과 1:1.
 *
 * <p>code ↔ HTTP status 는 1:1 이다(계약 §5 규칙) — 한 상수가 두 status 를 갖지 않는다.
 * "경매를 찾을 수 없음"은 {@code AUCTION_004}(AuctionErrorCode)를 재사용한다 — 입찰 경로에서 새 코드를 만들지 않는다.
 *
 * <p>{@code BID_006}(마감·종료)과 {@code BID_007}(미개시)을 나눈 이유: 클라이언트 안내 문구와 재시도 가능성이
 * 정반대라 하나로 합치면 UX 가 성립하지 않는다(bid-domain-spec §13 F4).
 */
@Getter
@RequiredArgsConstructor
public enum BidErrorCode implements ErrorCode {

    BID_BELOW_MIN_INCREMENT("BID_001", HttpStatus.UNPROCESSABLE_ENTITY, "최소 입찰 단위에 미치지 못하는 금액입니다."),
    BID_EXCEEDS_BUY_NOW("BID_002", HttpStatus.UNPROCESSABLE_ENTITY, "즉시구매가 이상은 입찰할 수 없습니다."),
    BID_SELF_AUCTION("BID_003", HttpStatus.FORBIDDEN, "자신의 경매에는 입찰할 수 없습니다."),
    BID_CONSECUTIVE("BID_004", HttpStatus.CONFLICT, "이미 최고 입찰자입니다."),
    BID_INSUFFICIENT_BALANCE("BID_005", HttpStatus.UNPROCESSABLE_ENTITY, "사용 가능한 게임머니가 부족합니다."),
    BID_NOT_BIDDABLE("BID_006", HttpStatus.CONFLICT, "이미 마감된 경매입니다."),
    BID_NOT_STARTED("BID_007", HttpStatus.CONFLICT, "아직 시작되지 않은 경매입니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
