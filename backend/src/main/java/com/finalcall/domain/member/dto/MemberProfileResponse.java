package com.finalcall.domain.member.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.finalcall.domain.member.entity.User;

import lombok.Builder;

/**
 * 내 프로필 응답(member) — 계약 §2.5·§4.5
 * {@code { userPublicId, nickname, isAdmin, createdAt, emailVerified, emailMasked }}.
 * 조회(GET)·수정(PATCH) 응답이 동일 스키마를 공유한다. Response 는 record + {@code @Builder} + {@code static from(Entity)}(CLAUDE.md §5).
 *
 * <p>노출 범위: {@code loginId}·{@code passwordHash} 는 싣지 않는다(노출 이득 없음·열거 리스크 SEC-007).
 * {@code isAdmin} 은 관리자 UI 표시 제어용이며 인가는 서버 권위다(§1.2). {@code createdAt} 은 도메인 고유 컬럼이
 * 아니라 {@link com.finalcall.common.entity.BaseTimeEntity} 공통 감사 컬럼이다.
 *
 * <p><b>이메일 노출(§4.5)</b>: 원문은 노출하지 않는다 — {@code emailMasked}(마스킹, null=미설정)와
 * {@code emailVerified} 조합으로 프론트가 미설정/설정·미인증/인증완료 3상태를 구분한다.
 */
@Builder
public record MemberProfileResponse(
    String userPublicId,
    String nickname,
    // record 의 boolean 컴포넌트(isAdmin)가 Jackson 에서 'admin' 으로 오인 매핑되지 않도록 계약 키를 명시한다.
    @JsonProperty("isAdmin") boolean isAdmin,
    Instant createdAt,
    boolean emailVerified,
    String emailMasked) {

    public static MemberProfileResponse from(User user) {
        return MemberProfileResponse.builder()
            .userPublicId(user.getPublicId())
            .nickname(user.getNickname())
            .isAdmin(user.isAdmin())
            .createdAt(user.getCreatedAt())
            .emailVerified(user.isEmailVerified())
            .emailMasked(maskEmail(user.getEmail()))
            .build();
    }

    /**
     * 이메일 로컬파트를 첫 글자만 남기고 마스킹한다(예: {@code a***@naver.com}). 원문 노출을 막는다(§4.5).
     * 미설정(null·빈 값)이면 {@code null} 을 반환해 "이메일 없음" 상태를 표현한다.
     */
    private static String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        int at = email.indexOf('@');
        if (at <= 0) {
            return "***"; // '@' 없음·로컬파트 없음 — 원문 노출 없이 마스킹만
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
