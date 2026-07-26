package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 정산 도메인 에러 코드(settlement, EPIC-CLOSING) — 네이밍 {@code SETTLEMENT_{3자리}}(CLAUDE.md §5).
 *
 * <p>마감은 <b>내부 워커</b>라 이 코드들은 외부 API 응답으로 나가지 않는다 — 전부 500(불변식 위반) 진단용이다.
 * 마감 TX 안에서 조건부 CAS/차감의 영향행이 기대와 다르면(이미 성립한 정합이 깨졌다는 뜻) 무시하지 않고 이 코드로
 * 올려 TX 전체를 롤백한다. 롤백된 경매는 다음 tick 이 재스캔해 자동 재시도한다(§3.4). 도메인 enum 으로 분리한
 * 이유는 로그·진단에서 "정산의 어느 단계가 깨졌는지" 를 코드로 식별하기 위해서다.
 */
@Getter
@RequiredArgsConstructor
public enum SettlementErrorCode implements ErrorCode {

    SETTLEMENT_NO_WINNING_BID("SETTLEMENT_001", HttpStatus.INTERNAL_SERVER_ERROR,
        "낙찰 대상 입찰을 찾을 수 없습니다."),
    SETTLEMENT_PRICE_MISMATCH("SETTLEMENT_002", HttpStatus.INTERNAL_SERVER_ERROR,
        "낙찰가와 최고가가 일치하지 않습니다."),
    SETTLEMENT_BID_NOT_WON("SETTLEMENT_003", HttpStatus.INTERNAL_SERVER_ERROR,
        "낙찰 입찰 상태 전이에 실패했습니다."),
    SETTLEMENT_SELLER_CREDIT_FAILED("SETTLEMENT_004", HttpStatus.INTERNAL_SERVER_ERROR,
        "판매자 정산 지급에 실패했습니다."),
    SETTLEMENT_ITEM_TRANSFER_FAILED("SETTLEMENT_005", HttpStatus.INTERNAL_SERVER_ERROR,
        "낙찰 아이템 소유 이전에 실패했습니다."),
    SETTLEMENT_TERMINAL_TRANSITION_FAILED("SETTLEMENT_006", HttpStatus.INTERNAL_SERVER_ERROR,
        "경매 종료 전이에 실패했습니다."),
    SETTLEMENT_UNEXPECTED_HOLD("SETTLEMENT_007", HttpStatus.INTERNAL_SERVER_ERROR,
        "유찰 경매에 홀드가 남아 있습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
