package com.finalcall.domain.member;

import com.finalcall.domain.common.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 사용자별 잔액 엔티티(member) — {@link User}와 1:1({@code user_id} UK FK, erd §4.1).
 *
 * <p>세 잔액을 BIGINT 로 보유한다: 캐시({@code cashBalance}, 충전 화폐)·게임머니({@code gameMoneyBalance},
 * 거래 화폐)·홀드 합계({@code gameMoneyHeld}). 가용 게임머니 = 잔액 − 홀드.
 *
 * <p><b>잔액 갱신(D-008):</b> 증감은 엔티티 dirty-checking 이 아니라 {@link UserBalanceRepository} 의 조건부
 * {@code @Modifying} UPDATE 로 원자적으로 수행한다(마감 직전 폭주 시 read-modify-write 경합 제거). 엔티티는 상태
 * 보유와 파생값({@link #getGameMoneyAvailable()})만 담당하며, 세터·인메모리 증감 메서드는 두지 않는다.
 */
@Entity
@Getter
@Table(name = "user_balance")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserBalance extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true, updatable = false)
    private User user;

    @Column(name = "cash_balance", nullable = false)
    private long cashBalance;

    @Column(name = "game_money_balance", nullable = false)
    private long gameMoneyBalance;

    @Column(name = "game_money_held", nullable = false)
    private long gameMoneyHeld;

    @Builder
    private UserBalance(User user) {
        this.user = user;
        this.cashBalance = 0L;
        this.gameMoneyBalance = 0L;
        this.gameMoneyHeld = 0L;
    }

    /** 가용 게임머니(= 잔액 − 홀드). 표현/검증용 파생값. */
    public long getGameMoneyAvailable() {
        return gameMoneyBalance - gameMoneyHeld;
    }
}
