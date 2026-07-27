package com.finalcall.domain.member.dto;

import com.finalcall.domain.member.entity.User;

import lombok.Builder;

/**
 * 이메일 설정 응답(member) — 계약 §4.2 {@code { email, emailVerified: false }}.
 *
 * <p><b>원문 에코</b>: 여기서는 이메일 원문(정규화 결과)을 그대로 싣는다 — 호출자가 방금 제출한 값이라 열거 리스크가
 * 없다(GET /me 의 마스킹 노출과 의도적으로 구분, spec §4.2). Response 는 record + {@code @Builder} +
 * {@code static from(Entity)}(CLAUDE.md §5).
 */
@Builder
public record EmailResponse(String email, boolean emailVerified) {

    public static EmailResponse from(User user) {
        return EmailResponse.builder()
            .email(user.getEmail())
            .emailVerified(user.isEmailVerified())
            .build();
    }
}
