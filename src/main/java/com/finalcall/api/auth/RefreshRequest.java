package com.finalcall.api.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * 토큰 재발급 요청(auth) — 계약 §2 `{ refreshToken }`. 형식 검증은 Bean Validation, 한국어 메시지.
 */
public record RefreshRequest(
    @NotBlank(message = "리프레시 토큰은 필수입니다.") String refreshToken) {
}
