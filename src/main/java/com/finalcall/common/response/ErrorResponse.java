package com.finalcall.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.finalcall.common.exception.ErrorCode;
import lombok.Getter;

import java.time.Instant;
import java.util.List;

/**
 * 에러 응답 wrapper(Stage 3). 성공({@link ApiResponse})과 <b>독립 타입</b>이다.
 *
 * <p>data 필드가 없다. success/timestamp 를 공유해도 공통 부모/인터페이스로 묶지 않는다(다형성 도입 금지).
 * 생성은 정적 팩토리로만 한다(생성자 private).
 */
@Getter
public class ErrorResponse {

    private final boolean success = false;

    private final String code;

    private final String message;

    /** 검증 실패가 없으면 응답에서 생략한다(그 외 필드는 항상 포함). */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private final List<FieldErrorDetail> errors;

    /** 응답 생성 시각(UTC, ISO-8601). */
    private final Instant timestamp;

    private ErrorResponse(String code, String message, List<FieldErrorDetail> errors) {
        this.code = code;
        this.message = message;
        this.errors = errors;
        this.timestamp = Instant.now();
    }

    public static ErrorResponse of(ErrorCode errorCode) {
        return new ErrorResponse(errorCode.getCode(), errorCode.getMessage(), null);
    }

    public static ErrorResponse of(ErrorCode errorCode, List<FieldErrorDetail> errors) {
        return new ErrorResponse(errorCode.getCode(), errorCode.getMessage(), errors);
    }

    /** 커스텀 메시지(BusinessException 의 customMessage 등)로 생성. */
    public static ErrorResponse of(ErrorCode errorCode, String message) {
        return new ErrorResponse(errorCode.getCode(), message, null);
    }
}
