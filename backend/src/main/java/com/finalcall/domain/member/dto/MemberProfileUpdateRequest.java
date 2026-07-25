package com.finalcall.domain.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 프로필 수정 요청(member) — 계약 §2.5 {@code { nickname }}. 수정 가능 필드는 nickname 뿐이다(비밀번호 변경은 범위 밖).
 *
 * <p>형식 검증은 Bean Validation, 한국어 메시지. 길이 상한 30 은 erd {@code user.nickname} 컬럼과 정합.
 * 닉네임 중복(MEMBER_001)은 형식이 아닌 비즈니스 규칙이라 서비스 계층에서 검증한다.
 */
public record MemberProfileUpdateRequest(
    @NotBlank(message = "닉네임은 필수입니다.") @Size(max = 30, message = "닉네임은 30자 이하여야 합니다.") String nickname) {
}
