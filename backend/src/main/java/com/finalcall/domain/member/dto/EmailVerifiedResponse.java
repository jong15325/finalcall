package com.finalcall.domain.member.dto;

import com.finalcall.domain.member.entity.User;

import lombok.Builder;

/**
 * 이메일 인증 확인 응답(member) — 계약 §4.4 {@code { emailVerified: true }}.
 *
 * <p>인증 성공 시에만 반환되므로 항상 {@code true} 이나, 형상 명세대로 엔티티 상태에서 파생한다. Response 는
 * record + {@code @Builder} + {@code static from(Entity)}(CLAUDE.md §5).
 */
@Builder
public record EmailVerifiedResponse(boolean emailVerified) {

    public static EmailVerifiedResponse from(User user) {
        return EmailVerifiedResponse.builder()
            .emailVerified(user.isEmailVerified())
            .build();
    }
}
