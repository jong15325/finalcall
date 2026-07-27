package com.finalcall.domain.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 이메일 인증 코드 확인 요청(member) — 계약 §4.4 {@code { code }}. 6자리 숫자(정책 §3).
 *
 * <p>형식 검증만 Bean Validation 으로(한국어 메시지). {@code @Pattern("\\d{6}")} 로 6자리 숫자만 통과시켜 저장소
 * 검증 전에 형식 오류를 400 으로 거른다. 코드 일치·만료·시도초과(EMAIL_001/002/003)는 저장소·서비스 책임이다.
 */
public record EmailVerifyRequest(
    @NotBlank(message = "인증 코드는 필수입니다.") @Pattern(regexp = "\\d{6}", message = "인증 코드는 6자리 숫자여야 합니다.") String code) {
}
