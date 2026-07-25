package com.finalcall.domain.member.dto;

import com.finalcall.domain.member.entity.UserBalance;

import lombok.Builder;

/**
 * 내 잔액 응답(member) — 계약 [4.4] {@code { cashBalance, gameMoneyBalance, gameMoneyHeld, gameMoneyAvailable }}.
 * Response 는 record + {@code @Builder} + {@code static from(Entity)}(CLAUDE.md [5]).
 *
 * <p>{@code gameMoneyAvailable} 은 파생값이다(= 게임머니 잔액 − 홀드, {@link UserBalance#getGameMoneyAvailable()}).
 * 별도 컬럼을 두지 않는다.
 */
@Builder
public record MemberBalanceResponse(
    long cashBalance,
    long gameMoneyBalance,
    long gameMoneyHeld,
    long gameMoneyAvailable) {

    public static MemberBalanceResponse from(UserBalance balance) {
        return MemberBalanceResponse.builder()
            .cashBalance(balance.getCashBalance())
            .gameMoneyBalance(balance.getGameMoneyBalance())
            .gameMoneyHeld(balance.getGameMoneyHeld())
            .gameMoneyAvailable(balance.getGameMoneyAvailable())
            .build();
    }
}
