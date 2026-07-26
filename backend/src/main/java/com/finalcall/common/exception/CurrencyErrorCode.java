package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 화폐(currency) 도메인 에러 코드 — 공통 {@link ErrorCode} 인터페이스 구현. 네이밍은 {@code EXC_{3자리}}.
 *
 * <p>api-contract §4.4 정합. 둘 다 상태 422(UNPROCESSABLE_ENTITY)로, 요청 형식은 유효하나 비즈니스 규칙상
 * 처리할 수 없는 경우다: 캐시 잔액 부족({@code EXC_001}), 역방향 미지원({@code EXC_002}).
 */
@Getter
@RequiredArgsConstructor
public enum CurrencyErrorCode implements ErrorCode {

    INSUFFICIENT_CASH("EXC_001", HttpStatus.UNPROCESSABLE_ENTITY, "캐시 잔액이 부족합니다."),
    EXCHANGE_REVERSE_NOT_SUPPORTED("EXC_002", HttpStatus.UNPROCESSABLE_ENTITY, "지원하지 않는 교환 방향입니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
