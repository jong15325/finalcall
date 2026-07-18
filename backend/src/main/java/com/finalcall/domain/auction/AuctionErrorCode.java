package com.finalcall.domain.auction;

import org.springframework.http.HttpStatus;

import com.finalcall.common.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 경매 도메인 에러 코드(auction, EPIC-AUCTION) — 네이밍 {@code AUCTION_{3자리}}(CLAUDE.md §5). 계약 §5 등재분과 1:1.
 *
 * <p>본 에픽 사용분만 정의한다. AUCTION_005(즉시구매 미설정)·AUCTION_009(자기구매)는 EPIC-CLOSING/purchase 소유라
 * 미포함(해당 에픽에서 추가). AUCTION_001 은 <b>403 단일</b>이다(게이트2 f, SEC-007 열거 방지) — 미소유·미보유·미존재를
 * 통일하고, 상태 충돌인 "이미 출품중"만 AUCTION_002(409)로 분리한다.
 */
@Getter
@RequiredArgsConstructor
public enum AuctionErrorCode implements ErrorCode {

    AUCTION_ITEM_NOT_SELLABLE("AUCTION_001", HttpStatus.FORBIDDEN, "출품할 수 없는 아이템입니다."),
    AUCTION_ALREADY_LISTED("AUCTION_002", HttpStatus.CONFLICT, "이미 출품 중인 아이템입니다."),
    AUCTION_INVALID_BUY_NOW_PRICE("AUCTION_003", HttpStatus.UNPROCESSABLE_ENTITY, "즉시구매가는 시작가보다 커야 합니다."),
    AUCTION_NOT_FOUND("AUCTION_004", HttpStatus.NOT_FOUND, "경매를 찾을 수 없습니다."),
    AUCTION_ALREADY_CLOSED("AUCTION_006", HttpStatus.CONFLICT, "이미 종료된 경매입니다."),
    AUCTION_HAS_BIDS("AUCTION_007", HttpStatus.CONFLICT, "입찰이 있어 취소할 수 없습니다."),
    AUCTION_INVALID_TIME_PARAM("AUCTION_008", HttpStatus.UNPROCESSABLE_ENTITY, "경매 시간 파라미터가 올바르지 않습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
