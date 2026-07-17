package com.finalcall.api.member;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;

/**
 * 탈퇴 요청(member) — 계약 §2.5 {@code { balanceForfeitAcknowledged: true }}.
 *
 * <p>잔존 잔액 소멸·복구 불가에 대한 <b>명시 동의</b>(D-080)다. 잔액이 0이어도 필드는 필수이며(클라 분기 제거·감사 추적 일관성),
 * 누락({@code null})·미동의({@code false})는 모두 400 으로 막는다: {@code @NotNull}(누락) + {@code @AssertTrue}(미동의).
 * {@code AssertTrue} 는 null 을 통과시키므로 두 제약을 함께 둔다. 래퍼 {@link Boolean} 을 써 누락과 false 를 구분한다.
 */
public record MemberWithdrawRequest(
    @NotNull(message = "잔액 소멸 동의는 필수입니다.") @AssertTrue(message = "동의가 필요합니다.") Boolean balanceForfeitAcknowledged) {
}
