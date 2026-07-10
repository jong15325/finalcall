package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 에러 코드 계약(Stage 3).
 *
 * <p>도메인별로 분산 구현한다: 각 도메인은 이 인터페이스를 구현한 enum 을 둔다
 * (네이밍 {@code {DOMAIN}_{3자리}}, 예: ORDER_001). 공통 코드는 {@link CommonErrorCode}.
 *
 * <p>{@code code} 는 HTTP status 와 별개의 식별자다(코드로 도메인/원인 식별, status 로 프로토콜 응답).
 */
public interface ErrorCode {

    String getCode();

    String getMessage();

    HttpStatus getStatus();
}
