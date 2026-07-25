package com.finalcall.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 로그인 요청(auth). 형식 검증은 Bean Validation, 한국어 메시지(계약 §2).
 *
 * <p>자격 검증(존재·해시 대조)은 서비스 계층에서 하며, 실패는 단일 코드 AUTH_003 으로 통일한다(열거 완화).
 */
public record LoginRequest(
    @NotBlank(message = "로그인 아이디는 필수입니다.") String loginId,

    @NotBlank(message = "비밀번호는 필수입니다.") String password) {
}
