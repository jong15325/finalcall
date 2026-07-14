package com.finalcall.domain.auth;

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
 * 사용자별 잔액 엔티티(auth) — {@link User}와 1:1({@code user_id} UK FK, erd §4.1).
 *
 * <p>세 잔액을 BIGINT 로 보유한다: 캐시({@code cashBalance}, 충전 화폐)·게임머니({@code gameMoneyBalance},
 * 거래 화폐)·홀드 합계({@code gameMoneyHeld}). 가용 게임머니 = 잔액 − 홀드.
 *
 * <p><b>범위(006):</b> 잔액 증감 도메인 메서드는 <b>시그니처만</b> 둔다. 실제 원자적 갱신(조건부 UPDATE, D-008)과
 * 홀드/해제/차감의 정합·검증은 화폐 도메인 후속 단위에서 구현한다.
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

    // --- 잔액 증감 도메인 메서드(시그니처만, 원자성·검증은 화폐 도메인 후속) ---

    /** 캐시 잔액 증감. */
    public void addCash(long amount) {
        this.cashBalance += amount;
    }

    /** 게임머니 잔액 증감. */
    public void addGameMoney(long amount) {
        this.gameMoneyBalance += amount;
    }

    /** 게임머니 홀드(에스크로 잠금). */
    public void hold(long amount) {
        this.gameMoneyHeld += amount;
    }

    /** 게임머니 홀드 해제. */
    public void release(long amount) {
        this.gameMoneyHeld -= amount;
    }
}
