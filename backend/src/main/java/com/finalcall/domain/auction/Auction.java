package com.finalcall.domain.auction;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseTimeEntity;
import com.finalcall.common.util.Ulid;
import com.finalcall.domain.item.ItemInstance;
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
 * 경매 애그리거트(auction, EPIC-AUCTION) — 판매자·출품 아이템(에스크로) + 가격·상태·소프트클로즈 config(erd §4.2).
 *
 * <p>상태 전이는 CAS UPDATE(리포지토리 {@code @Modifying})가 단일 진실원이다(domain-spec §8 "정합성은 DB").
 * 취소는 조건부 CAS({@code WHERE status IN (SCHEDULED,ACTIVE) AND highest_bidder_id IS NULL}, 게이트2 e)로만
 * 수행하므로 엔티티에 dirty-checking 전이 메서드를 두지 않는다({@code @Setter} 금지, 섹션 5).
 *
 * <p><b>lazy 활성화 파생(게이트2 a):</b> status 는 등록값(SCHEDULED/ACTIVE)으로 영속하되, 조회 응답의 status 는
 * {@link #displayStatus(Instant)}로 파생한다(SCHEDULED 이고 start_at ≤ now 면 ACTIVE). DB 영속 전이 워커는
 * EPIC-CLOSING 소유라 본 에픽은 표시층에서만 파생한다.
 *
 * <p>소프트클로즈 config(window/extend/base_end_at/max_end_at/extension_count)는 본 에픽 <b>저장만</b>이다
 * (연장 로직=EPIC-BID/CLOSING, 게이트2 c). highest_bid_amount·highest_bidder·result_type 은 본 에픽 항상 NULL이다.
 */
@Entity
@Getter
@Table(name = "auction")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Auction extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seller_id", nullable = false, updatable = false)
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_instance_id", nullable = false, updatable = false)
    private ItemInstance itemInstance;

    @Column(name = "start_price", nullable = false)
    private long startPrice;

    @Column(name = "buy_now_price")
    private Long buyNowPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AuctionStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "result_type", length = 20)
    private AuctionResultType resultType;

    @Column(name = "highest_bid_amount")
    private Long highestBidAmount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "highest_bidder_id")
    private User highestBidder;

    @Column(name = "start_at")
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "base_end_at", nullable = false)
    private Instant baseEndAt;

    @Column(name = "max_end_at", nullable = false)
    private Instant maxEndAt;

    @Column(name = "soft_close_window_sec", nullable = false)
    private int softCloseWindowSec;

    @Column(name = "soft_close_extend_sec", nullable = false)
    private int softCloseExtendSec;

    @Column(name = "extension_count", nullable = false)
    private int extensionCount;

    @Column(name = "item_name_snapshot", nullable = false, length = 100)
    private String itemNameSnapshot;

    @Column(name = "item_spec_snapshot", nullable = false, length = 255)
    private String itemSpecSnapshot;

    @Builder
    private Auction(String publicId, User seller, ItemInstance itemInstance, long startPrice, Long buyNowPrice,
        AuctionStatus status, Instant startAt, Instant endAt, Instant maxEndAt, int softCloseWindowSec,
        int softCloseExtendSec, String itemNameSnapshot, String itemSpecSnapshot) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.seller = seller;
        this.itemInstance = itemInstance;
        this.startPrice = startPrice;
        this.buyNowPrice = buyNowPrice;
        this.status = status;
        this.startAt = startAt;
        this.endAt = endAt;
        // base_end_at = end_at(최초 마감 = 연장 기준), extension_count = 0(등록 시). 소프트클로즈 저장만(게이트2 c).
        this.baseEndAt = endAt;
        this.maxEndAt = maxEndAt;
        this.softCloseWindowSec = softCloseWindowSec;
        this.softCloseExtendSec = softCloseExtendSec;
        this.extensionCount = 0;
        this.itemNameSnapshot = itemNameSnapshot;
        this.itemSpecSnapshot = itemSpecSnapshot;
    }

    /**
     * 조회 응답용 파생 상태(게이트2 a, lazy 활성화). 영속 status 가 SCHEDULED 이고 start_at 이 도래(≤ now)했으면
     * ACTIVE 로 파생해 노출한다(DB 영속 전이는 EPIC-CLOSING 워커 소유). 그 외는 영속값 그대로다.
     */
    public AuctionStatus displayStatus(Instant now) {
        if (status == AuctionStatus.SCHEDULED && startAt != null && !startAt.isAfter(now)) {
            return AuctionStatus.ACTIVE;
        }
        return status;
    }
}
