package com.finalcall.api.member;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.finalcall.domain.member.User;

import lombok.Builder;

/**
 * 내 프로필 응답(member) — 계약 §2.5 {@code { userPublicId, nickname, isAdmin, createdAt }}.
 * 조회(GET)·수정(PATCH) 응답이 동일 스키마를 공유한다. Response 는 record + {@code @Builder} + {@code static from(Entity)}(CLAUDE.md §5).
 *
 * <p>노출 범위: {@code loginId}·{@code passwordHash} 는 싣지 않는다(노출 이득 없음·열거 리스크 SEC-007).
 * {@code isAdmin} 은 관리자 UI 표시 제어용이며 인가는 서버 권위다(§1.2). {@code createdAt} 은 도메인 고유 컬럼이
 * 아니라 {@link com.finalcall.domain.common.BaseTimeEntity} 공통 감사 컬럼이다.
 */
@Builder
public record MemberProfileResponse(
    String userPublicId,
    String nickname,
    // record 의 boolean 컴포넌트(isAdmin)가 Jackson 에서 'admin' 으로 오인 매핑되지 않도록 계약 키를 명시한다.
    @JsonProperty("isAdmin") boolean isAdmin,
    Instant createdAt) {

    public static MemberProfileResponse from(User user) {
        return MemberProfileResponse.builder()
            .userPublicId(user.getPublicId())
            .nickname(user.getNickname())
            .isAdmin(user.isAdmin())
            .createdAt(user.getCreatedAt())
            .build();
    }
}
