package com.finalcall.common.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * 도메인 무관 공통 에러 코드(Stage 3).
 *
 * <p>도메인별 코드는 각 도메인 패키지에서 {@link ErrorCode} 를 구현한다(이번 단계에선 만들지 않는다).
 * 네이밍은 {@code COMMON_{3자리}}(COMMON_CODE_PREFIX=COMMON).
 */
@Getter
@RequiredArgsConstructor
public enum CommonErrorCode implements ErrorCode {

    INVALID_INPUT("COMMON_001", HttpStatus.BAD_REQUEST, "입력값이 올바르지 않습니다."),
    METHOD_NOT_ALLOWED("COMMON_002", HttpStatus.METHOD_NOT_ALLOWED, "허용되지 않은 HTTP 메서드입니다."),
    NOT_FOUND("COMMON_003", HttpStatus.NOT_FOUND, "요청한 리소스를 찾을 수 없습니다."),
    LOCK_ACQUISITION_FAILED("COMMON_004", HttpStatus.CONFLICT, "동시 요청이 많아 처리하지 못했습니다. 잠시 후 다시 시도해주세요."),
    UNAUTHORIZED("COMMON_005", HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    FORBIDDEN("COMMON_006", HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
    INTERNAL_ERROR("COMMON_999", HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
