package com.finalcall.common.exception;

import lombok.Getter;

/**
 * 우리가 의도적으로 던지는 모든 비즈니스 예외의 부모(Stage 3).
 *
 * <p>도메인별 예외 클래스를 남발하지 않는다. {@link ErrorCode} 로 원인을 구분한다.
 * 메시지는 커스텀 메시지가 있으면 그것을, 없으면 ErrorCode 의 기본 메시지를 사용한다.
 */
@Getter
public class BusinessException extends RuntimeException {

    private final transient ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public BusinessException(ErrorCode errorCode, String customMessage) {
        super(customMessage);
        this.errorCode = errorCode;
    }
}
