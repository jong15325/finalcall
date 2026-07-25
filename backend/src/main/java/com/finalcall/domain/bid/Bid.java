package com.finalcall.domain.bid;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseTimeEntity;
import com.finalcall.common.util.Ulid;
import com.finalcall.domain.auction.entity.Auction;
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
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 경매 입찰 엔티티(bid, EPIC-BID) — 경매·입찰자에 N:1(erd §4.2).
 *
 * <p>입찰은 <b>원장</b>이라 soft delete 를 두지 않는다 — 밀려난 입찰은 삭제가 아니라 {@code status=OUTBID} 로
 * 보존한다(D-081 패턴 불요, bid-domain-spec §2.1).
 *
 * <p><b>상태 전이에 dirty-checking 을 쓰지 않는다</b>({@code @Setter} 금지, CLAUDE.md §5). 전이는
 * {@link BidRepository#markOutbidIfActive(Long)} 의 조건부 CAS UPDATE 가 단일 진실원이다. 이유는 두 가지다:
 * (1) 조건({@code WHERE status='ACTIVE'})을 DB 행 락 아래에서 평가해야 이중 전이가 성립하지 않는다,
 * (2) 입찰 트랜잭션은 잔액 조건부 UPDATE({@code UserBalanceRepository})를 호출하며 그것이 영속성 컨텍스트를
 * clear 하므로, dirty-checking 에 의존하면 갱신이 <b>예외 없이 조용히 유실</b>된다(bid-domain-spec §4.2).
 *
 * <p>금액 검증(최소 증분·즉시구매가 상한)·자기/연속 입찰 금지는 경매 행 락 아래의 서비스 검증이며 엔티티 책임이 아니다.
 */
@Entity
@Getter
@Table(name = "bid")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Bid extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다(auction 선례).
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "auction_id", nullable = false, updatable = false)
    private Auction auction;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bidder_id", nullable = false, updatable = false)
    private User bidder;

    @Column(name = "amount", nullable = false, updatable = false)
    private long amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BidStatus status;

    @Builder
    private Bid(String publicId, Auction auction, User bidder, long amount) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.auction = auction;
        this.bidder = bidder;
        this.amount = amount;
        // 성립한 입찰은 항상 그 시점의 최고 입찰이다(직전 최고 입찰은 동일 트랜잭션에서 OUTBID 로 밀려난다).
        this.status = BidStatus.ACTIVE;
    }
}
