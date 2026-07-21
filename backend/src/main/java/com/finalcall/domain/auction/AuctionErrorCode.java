package com.finalcall.domain.auction;

import org.springframework.http.HttpStatus;

import com.finalcall.common.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 경매 도메인 에러 코드(auction, EPIC-AUCTION) — 네이밍 {@code AUCTION_{3자리}}(CLAUDE.md §5). 계약 §5 등재분과 1:1.
 *
 * <p>본 에픽 사용분에 더해 EPIC-PURCHASE(즉시구매, FC-089) 사용분 AUCTION_005(즉시구매 미설정)·AUCTION_009
 * (판매자 자기구매)를 추가한다. AUCTION_006 은 마감(EPIC-CLOSING) 취소 충돌에 더해 즉시구매의 <b>구매 불가 상태</b>
 * (미개시·종료)를 흡수하도록 라벨을 확대한다(purchase-spec §7-A5, 신규 코드 미추가 — enum↔계약 1:1 유지).
 * AUCTION_001 은 <b>403 단일</b>이다(게이트2 f, SEC-007 열거 방지) — 미소유·미보유·미존재를 통일하고, 상태 충돌인
 * "이미 출품중"만 AUCTION_002(409)로 분리한다.
 */
@Getter
@RequiredArgsConstructor
public enum AuctionErrorCode implements ErrorCode {

    AUCTION_ITEM_NOT_SELLABLE("AUCTION_001", HttpStatus.FORBIDDEN, "출품할 수 없는 아이템입니다."),
    AUCTION_ALREADY_LISTED("AUCTION_002", HttpStatus.CONFLICT, "이미 출품 중인 아이템입니다."),
    AUCTION_INVALID_BUY_NOW_PRICE("AUCTION_003", HttpStatus.UNPROCESSABLE_ENTITY, "즉시구매가는 시작가보다 커야 합니다."),
    AUCTION_NOT_FOUND("AUCTION_004", HttpStatus.NOT_FOUND, "경매를 찾을 수 없습니다."),
    AUCTION_BUY_NOW_NOT_SET("AUCTION_005", HttpStatus.UNPROCESSABLE_ENTITY, "즉시구매가 설정되지 않은 경매입니다."),
    AUCTION_ALREADY_CLOSED("AUCTION_006", HttpStatus.CONFLICT, "구매할 수 없는 경매입니다(미개시 또는 종료)."),
    AUCTION_HAS_BIDS("AUCTION_007", HttpStatus.CONFLICT, "입찰이 있어 취소할 수 없습니다."),
    AUCTION_INVALID_TIME_PARAM("AUCTION_008", HttpStatus.UNPROCESSABLE_ENTITY, "경매 시간 파라미터가 올바르지 않습니다."),
    AUCTION_SELF_PURCHASE("AUCTION_009", HttpStatus.FORBIDDEN, "판매자는 자신의 경매를 구매할 수 없습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
