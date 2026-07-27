package com.finalcall.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 회원가입 요청(auth). 형식 검증은 Bean Validation, 한국어 메시지(계약 §2).
 *
 * <p>길이 상한은 erd 컬럼과 정합(loginId 50·nickname 30). password 는 BCrypt 가 72바이트에서 잘리므로
 * 72자 이내로 제한한다(정책상 최소 길이 등은 미정 — 계약 확정 시 강화).
 *
 * <p>{@code email} 은 <b>선택</b>(spec §4.1) — 미제공(null)이면 이메일 없는 계정으로 생성된다. {@code @NotBlank}
 * 를 걸지 않아 null 을 허용하고, {@code @Email} 은 null 을 통과시키므로 값이 있을 때만 형식을 검증한다. 정규화
 * (lowercase+trim)는 서비스 책임이라 DTO 에서 변형하지 않는다.
 */
public record SignupRequest(
    @NotBlank(message = "로그인 아이디는 필수입니다.") @Size(max = 50, message = "로그인 아이디는 50자 이하여야 합니다.") String loginId,

    @NotBlank(message = "비밀번호는 필수입니다.") @Size(max = 72, message = "비밀번호는 72자 이하여야 합니다.") String password,

    @NotBlank(message = "닉네임은 필수입니다.") @Size(max = 30, message = "닉네임은 30자 이하여야 합니다.") String nickname,

    @Email(message = "이메일 형식이 올바르지 않습니다.") @Size(max = 255, message = "이메일은 255자 이하여야 합니다.") String email) {
}
