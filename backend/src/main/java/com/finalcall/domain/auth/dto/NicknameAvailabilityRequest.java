package com.finalcall.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 닉네임 가용성 조회 요청(auth) — 쿼리 파라미터 {@code nickname} 바인딩(계약 §2 EPIC-NICKNAME-UX v1.17).
 *
 * <p>형식·길이 규칙은 signup·{@code PATCH /me} 의 nickname 과 <b>동일</b>하다({@code @NotBlank}·{@code @Size(max=30)},
 * erd {@code nickname} VARCHAR(30) 정합). 검증 실패는 {@code @Valid} 로 400(COMMON 검증, errors[] 필드 매핑)이 된다 —
 * 별도 정규화(trim·lowercase)는 가하지 않는다(signup 원문 저장·판정과 정합, 정규화 도입은 signup 동반 개정 별건).
 */
public record NicknameAvailabilityRequest(
    @NotBlank(message = "닉네임은 필수입니다.") @Size(max = 30, message = "닉네임은 30자 이하여야 합니다.") String nickname) {
}
