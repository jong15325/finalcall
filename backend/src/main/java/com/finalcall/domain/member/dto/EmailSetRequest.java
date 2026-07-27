package com.finalcall.domain.member.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 이메일 설정/변경 요청(member) — 계약 §4.2 {@code { email }}. 설정은 값이 필수라 {@code @NotBlank}.
 *
 * <p>형식 검증만 Bean Validation 으로(한국어 메시지). 정규화(lowercase+trim)·중복(EMAIL_007)은 서비스 계층 책임이다.
 * 길이 상한 255 는 이메일 표준 상한이자 {@code user.email} 컬럼(V17)과 정합.
 */
public record EmailSetRequest(
    @NotBlank(message = "이메일 필수") @Email(message = "형식 오류") @Size(max = 255, message = "255자 이하") String email) {
}
