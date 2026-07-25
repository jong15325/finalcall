package com.finalcall.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 회원가입 요청(auth). 형식 검증은 Bean Validation, 한국어 메시지(계약 §2).
 *
 * <p>길이 상한은 erd 컬럼과 정합(loginId 50·nickname 30). password 는 BCrypt 가 72바이트에서 잘리므로
 * 72자 이내로 제한한다(정책상 최소 길이 등은 미정 — 계약 확정 시 강화).
 */
public record SignupRequest(
    @NotBlank(message = "로그인 아이디는 필수입니다.") @Size(max = 50, message = "로그인 아이디는 50자 이하여야 합니다.") String loginId,

    @NotBlank(message = "비밀번호는 필수입니다.") @Size(max = 72, message = "비밀번호는 72자 이하여야 합니다.") String password,

    @NotBlank(message = "닉네임은 필수입니다.") @Size(max = 30, message = "닉네임은 30자 이하여야 합니다.") String nickname) {
}
