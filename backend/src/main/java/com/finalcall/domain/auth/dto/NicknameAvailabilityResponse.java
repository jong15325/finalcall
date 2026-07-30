package com.finalcall.domain.auth.dto;

/**
 * 닉네임 가용성 조회 응답(auth) — 계약 §2 `{ available: boolean }`(EPIC-NICKNAME-UX v1.17).
 *
 * <p>{@code true}=현재 사용 가능(활성 회원 중 동일 닉네임 없음), {@code false}=사용 중. advisory 성격이라
 * 예약이 아니며 최종 권위는 signup {@code AUTH_002}(409)다. 엔티티 매핑이 아니라 boolean 판정 결과라
 * {@code of(boolean)} 정적 팩터리로 감싼다.
 */
public record NicknameAvailabilityResponse(boolean available) {
    public static NicknameAvailabilityResponse of(boolean available) {
        return new NicknameAvailabilityResponse(available);
    }
}
