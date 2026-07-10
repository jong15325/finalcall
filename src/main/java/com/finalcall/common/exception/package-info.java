/**
 * 공통 예외 체계(Stage 3).
 *
 * <p>{@link com.finalcall.common.exception.ErrorCode} 인터페이스 + 공통 구현
 * {@link com.finalcall.common.exception.CommonErrorCode}, 비즈니스 예외 부모
 * {@link com.finalcall.common.exception.BusinessException}, 전역 처리
 * {@link com.finalcall.common.exception.GlobalExceptionHandler}.
 * 도메인별 ErrorCode 는 각 도메인 패키지에서 구현한다(Stage D 이후).
 */
package com.finalcall.common.exception;
