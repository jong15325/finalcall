package com.finalcall.domain.settlement;

import org.springframework.http.HttpStatus;

import com.finalcall.common.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 거래내역(주문) 도메인 에러 코드(settlement, EPIC-PURCHASE) — 네이밍 {@code ORDER_{3자리}}(CLAUDE.md §5). 계약 §5
 * 등재분과 1:1.
 *
 * <p>{@code GET /orders/{id}} 의 IDOR 인가에 쓴다(purchase-spec §5.1). 미존재는 {@code ORDER_001}(404), 당사자
 * (buyer·seller)가 아니면 {@code ORDER_002}(403)다. public_id 가 ULID(추측 불가)라 403/404 구분의 열거 리스크가
 * 실질 0이므로 계약 기확정대로 둘을 분리한다(SEC-007 무관).
 */
@Getter
@RequiredArgsConstructor
public enum OrderErrorCode implements ErrorCode {

    ORDER_NOT_FOUND("ORDER_001", HttpStatus.NOT_FOUND, "주문을 찾을 수 없습니다."),
    ORDER_NOT_PARTY("ORDER_002", HttpStatus.FORBIDDEN, "주문의 당사자가 아닙니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
