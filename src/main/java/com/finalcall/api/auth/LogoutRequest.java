package com.finalcall.api.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * 로그아웃 요청(auth) — 폐기 대상 세션의 `{ refreshToken }`. 형식 검증은 Bean Validation, 한국어 메시지.
 *
 * <p>인증 필요 엔드포인트다: 실제 폐기는 SecurityContext 주체 소유 세션에 한한다(타 사용자 세션 조작 방지).
 */
public record LogoutRequest(
    @NotBlank(message = "리프레시 토큰은 필수입니다.") String refreshToken) {
}
