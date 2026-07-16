package com.finalcall.domain.sample;

/**
 * Stage E2 데모용 가짜 외부 호출 실패 예외.
 *
 * <p>CircuitBreaker 가 record(장애 통계 반영)하는 대상이다(4xx 성격 BusinessException 은 ignore).
 */
public class ExternalCallException extends RuntimeException {

    public ExternalCallException(String message) {
        super(message);
    }
}
