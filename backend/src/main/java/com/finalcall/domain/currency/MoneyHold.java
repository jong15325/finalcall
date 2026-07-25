package com.finalcall.domain.currency;

import java.time.Instant;

import com.finalcall.common.entity.BaseTimeEntity;
import com.finalcall.domain.bid.Bid;
import com.finalcall.domain.member.entity.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 게임머니 홀드(에스크로) 원장 엔티티(currency) — 입찰 1건에 1:1 대응한다(erd §4.1 D-052).
 *
 * <p>이 원장은 {@code user_balance.game_money_held}(합계)의 <b>내역</b>이다. 두 값은 항상 일치해야 한다:
 * 사용자별 {@code SUM(amount WHERE status='HELD')} == {@code game_money_held}(bid-domain-spec §10 I4).
 * 그래서 원장 기록과 잔액 갱신은 반드시 같은 트랜잭션에서 일어난다({@link MoneyHoldService}).
 *
 * <p>{@code bid_id} UK(V11)가 홀드-입찰 1:1 을 DB 에서 강제해 동일 입찰의 중복 홀드를 차단한다.
 * {@code public_id} 는 두지 않는다 — 외부 노출 리소스가 아니다({@code money_exchange} 선례).
 *
 * <p><b>상태 전이에 dirty-checking 을 쓰지 않는다</b>({@code @Setter} 금지, CLAUDE.md §5). HELD→RELEASED 는
 * {@link MoneyHoldRepository#releaseIfHeld} 의 조건부 CAS 가 단일 진실원이며, 이것이 이중 해제(무자본 입찰)를
 * DB 수준에서 불가능하게 만드는 방어선이다(§4.5).
 */
@Entity
@Getter
@Table(name = "money_hold")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MoneyHold extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bid_id", nullable = false, unique = true, updatable = false)
    private Bid bid;

    @Column(name = "amount", nullable = false, updatable = false)
    private long amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MoneyHoldStatus status;

    @Column(name = "released_at")
    private Instant releasedAt;

    @Builder
    private MoneyHold(User user, Bid bid, long amount) {
        this.user = user;
        this.bid = bid;
        this.amount = amount;
        // 홀드는 생성 즉시 유효하다 — 잔액 홀드(user_balance) 성공 뒤에만 이 행이 만들어진다.
        this.status = MoneyHoldStatus.HELD;
    }
}
