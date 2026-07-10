package com.finalcall.common.response;

/**
 * 필드 단위 검증 실패 상세(Stage 3, INCLUDE_VALIDATION_ERRORS).
 *
 * <p>{@code @Valid} 실패 시 {@link ErrorResponse#getErrors()} 배열에 담긴다.
 *
 * @param field  검증에 실패한 필드명
 * @param reason 실패 사유(검증 메시지)
 */
public record FieldErrorDetail(String field, String reason) {
}
