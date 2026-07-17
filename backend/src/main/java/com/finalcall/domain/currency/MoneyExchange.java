package com.finalcall.domain.currency;

import java.math.BigDecimal;

import com.finalcall.domain.common.BaseTimeEntity;
import com.finalcall.domain.member.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 캐시→게임머니 교환 원장 엔티티(currency) — {@link User}에 N:1(erd §4.1, money_exchange v0.8).
 *
 * <p>한 건의 교환 결과를 불변 기록으로 남긴다: 소모한 캐시({@code cashAmount})·지급한 게임머니
 * ({@code gameMoneyAmount})·적용 환율 스냅샷({@code appliedRate}, 처리 시점 rate)·멱등키({@code idempotencyKey}).
 * {@code (user_id, idempotency_key)} 복합 UK(V5)가 동일 요청의 이중 처리를 DB 에서 차단한다(SEC-004).
 *
 * <p>컨벤션(CLAUDE.md §5): {@code @NoArgsConstructor(PROTECTED)}·생성자 {@code @Builder}·{@code @Setter} 금지.
 * 이 원장은 append-only 라 상태 변경 도메인 메서드·soft delete·public_id 를 두지 않는다(교환 id 미노출).
 */
@Entity
@Getter
@Table(name = "money_exchange")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MoneyExchange extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Column(name = "cash_amount", nullable = false, updatable = false)
    private long cashAmount;

    @Column(name = "game_money_amount", nullable = false, updatable = false)
    private long gameMoneyAmount;

    @Column(name = "applied_rate", nullable = false, updatable = false, precision = 20, scale = 6)
    private BigDecimal appliedRate;

    @Column(name = "idempotency_key", nullable = false, updatable = false, length = 100)
    private String idempotencyKey;

    @Builder
    private MoneyExchange(User user, long cashAmount, long gameMoneyAmount, BigDecimal appliedRate,
        String idempotencyKey) {
        this.user = user;
        this.cashAmount = cashAmount;
        this.gameMoneyAmount = gameMoneyAmount;
        this.appliedRate = appliedRate;
        this.idempotencyKey = idempotencyKey;
    }
}
