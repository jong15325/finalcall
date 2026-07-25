package com.finalcall.sample.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 샘플 요청 DTO(Stage 3) — @Valid 검증 실패 시 errors 배열 데모용.
 *
 * @param message 필수 문자열(빈 값/누락 시 검증 실패)
 */
public record SampleEchoRequest(
    @NotBlank(message = "message 는 필수입니다.") @Size(max = 100, message = "message 는 100자 이하여야 합니다.") String message) {
}
