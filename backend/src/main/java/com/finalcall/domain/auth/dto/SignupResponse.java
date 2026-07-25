package com.finalcall.domain.auth.dto;

import com.finalcall.domain.member.entity.User;

import lombok.Builder;

/**
 * 회원가입 응답(auth) — 계약 §2 `{ userPublicId, nickname }`. Response 는 record + @Builder + static from(Entity).
 *
 * <p>외부 노출 식별자는 public_id(ULID)만 싣는다. 내부 id(BIGINT)는 노출하지 않는다(B-004, 계약 §1.1).
 */
@Builder
public record SignupResponse(
    String userPublicId,
    String nickname) {
    public static SignupResponse from(User user) {
        return SignupResponse.builder()
            .userPublicId(user.getPublicId())
            .nickname(user.getNickname())
            .build();
    }
}
