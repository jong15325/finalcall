package com.finalcall.common.exception;

import java.util.List;

import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.finalcall.common.response.ErrorResponse;
import com.finalcall.common.response.FieldErrorDetail;

import lombok.extern.slf4j.Slf4j;

/**
 * 전역 예외 처리(Stage 3). 모든 핸들러는 {@link ErrorResponse} 를 반환한다(성공 타입 ApiResponse 를 에러에 쓰지 않는다).
 *
 * <p>★ 내부 예외 메시지/스택은 응답에 노출하지 않는다. 전체 스택은 로그에만 남기고, 응답엔 표준 메시지만 담는다.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 1) 우리가 의도적으로 던진 비즈니스 예외. */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException ex) {
        ErrorCode errorCode = ex.getErrorCode();
        log.warn("[BusinessException] {} - {}", errorCode.getCode(), ex.getMessage());
        return ResponseEntity.status(errorCode.getStatus())
            .body(ErrorResponse.of(errorCode, ex.getMessage()));
    }

    /** 2) @Valid 바디 검증 실패 → INVALID_INPUT + 필드별 errors 배열. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        List<FieldErrorDetail> errors = ex.getBindingResult().getFieldErrors().stream()
            .map(this::toFieldErrorDetail)
            .toList();
        return ResponseEntity.status(CommonErrorCode.INVALID_INPUT.getStatus())
            .body(ErrorResponse.of(CommonErrorCode.INVALID_INPUT, errors));
    }

    /** 3-a) 타입 불일치/바디 파싱 실패/필수 파라미터·헤더 누락 등 표준 4xx → INVALID_INPUT. */
    @ExceptionHandler({
        MethodArgumentTypeMismatchException.class,
        HttpMessageNotReadableException.class,
        MissingServletRequestParameterException.class,
        MissingRequestHeaderException.class
    })
    public ResponseEntity<ErrorResponse> handleBadRequest(Exception ex) {
        log.warn("[BadRequest] {}", ex.getMessage());
        return ResponseEntity.status(CommonErrorCode.INVALID_INPUT.getStatus())
            .body(ErrorResponse.of(CommonErrorCode.INVALID_INPUT));
    }

    /** 3-b) 지원하지 않는 HTTP 메서드 → METHOD_NOT_ALLOWED. */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        log.warn("[MethodNotAllowed] {}", ex.getMessage());
        return ResponseEntity.status(CommonErrorCode.METHOD_NOT_ALLOWED.getStatus())
            .body(ErrorResponse.of(CommonErrorCode.METHOD_NOT_ALLOWED));
    }

    /** 3-c) 매핑되지 않은 경로(미노출 엔드포인트/오타 등) → NOT_FOUND. 전역 핸들러가 없으면 generic 500 으로 새는 것을 방지. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException ex) {
        log.warn("[NotFound] {}", ex.getResourcePath());
        return ResponseEntity.status(CommonErrorCode.NOT_FOUND.getStatus())
            .body(ErrorResponse.of(CommonErrorCode.NOT_FOUND));
    }

    /**
     * 3-d) 행 락 경합 실패(데드락·락 대기 timeout) → LOCK_ACQUISITION_FAILED(409).
     *
     * <p>입찰처럼 행 락으로 직렬화하는 경로는 경합이 심할 때 DB 가 희생자를 골라 롤백시킨다. 이는 서버 결함이
     * 아니라 <b>재시도하면 성공할 수 있는 일시적 경합</b>이므로 500 이 아니라 409 로 안내한다(bid-domain-spec
     * §4.4 백스톱). 정합성은 롤백으로 보존되므로 부분 반영은 남지 않는다.
     *
     * <p>{@code DeadlockLoserDataAccessException}·{@code CannotAcquireLockException} 이 모두 이 타입의 하위라
     * 상위 한 곳에서 받는다.
     */
    @ExceptionHandler(PessimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleLockFailure(PessimisticLockingFailureException ex) {
        log.warn("[LockFailure] 행 락 경합으로 트랜잭션이 롤백됐다 - {}", ex.getMessage());
        return ResponseEntity.status(CommonErrorCode.LOCK_ACQUISITION_FAILED.getStatus())
            .body(ErrorResponse.of(CommonErrorCode.LOCK_ACQUISITION_FAILED));
    }

    /** 4) 그 외 미처리 예외 → 500. 내부 정보는 응답에 노출하지 않고 로그에만 전체 스택을 남긴다. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        log.error("[Unexpected] 처리되지 않은 예외", ex);
        return ResponseEntity.status(CommonErrorCode.INTERNAL_ERROR.getStatus())
            .body(ErrorResponse.of(CommonErrorCode.INTERNAL_ERROR));
    }

    private FieldErrorDetail toFieldErrorDetail(FieldError fieldError) {
        String reason = fieldError.getDefaultMessage() != null
            ? fieldError.getDefaultMessage()
            : "유효하지 않은 값입니다.";
        return new FieldErrorDetail(fieldError.getField(), reason);
    }
}
