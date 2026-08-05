package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 배송(우편함) 도메인 에러 코드(delivery, EPIC-ITEM-DELIVERY) — 네이밍 {@code DELIVERY_{3자리}}(CLAUDE.md §5).
 * 계약 §10.3 등재분과 1:1. 배치는 V2 중앙화 규약대로 {@code com.finalcall.common.exception}(feature 루트 아님).
 *
 * <p>구매자 배송 상태 조회(§10.1)의 미존재·비당사자는 열거 방지를 위해 {@link #DELIVERY_NOT_FOUND}(404)로 통일한다
 * (ULID public_id 라 열거 무해로 404 통일). 게임 claim 은 DB 직접 프로토콜(웹 REST 아님, 형상 (b))이라 CAS 영향행으로
 * 판정하며 도메인 에러코드 대상이 아니다(§10.2).
 */
@Getter
@RequiredArgsConstructor
public enum DeliveryErrorCode implements ErrorCode {

    DELIVERY_NOT_FOUND("DELIVERY_001", HttpStatus.NOT_FOUND, "배송을 찾을 수 없습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
