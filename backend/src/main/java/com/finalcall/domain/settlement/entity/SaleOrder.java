package com.finalcall.domain.settlement.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseCreatedEntity;
import com.finalcall.common.util.Ulid;
import com.finalcall.domain.item.entity.ItemInstance;
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
 * 판매 성립(SOLD) 거래 레코드 엔티티(settlement, EPIC-CLOSING) — 낙찰 정산의 정본(erd §4.2, closing-domain-spec §2).
 *
 * <p>경매 낙찰과 shop 구매·즉시구매를 {@code source_type/source_id} 폴리모픽으로 한 테이블에 수렴시킨다(코어는
 * {@code AUCTION} 만 기록). {@code final_price = settle_amount + fee_amount} 가 항상 성립하며(불변식 I-B),
 * {@code (source_type, source_id)} UK 가 동일 경매의 이중 SOLD 를 DB 에서 차단한다(I-C).
 *
 * <p><b>append-only</b> — SETTLED 로 한 번 기록되고 갱신되지 않는다(상태 전이 없음, 단일 TX 정산). 그래서
 * {@link BaseCreatedEntity}(created_at 만) 를 상속하고 {@code @Setter}·update 메서드를 두지 않는다. {@code fee_amount}
 * 은 SOLD 성립분이라 항상 값이 존재해 NOT NULL 이다(취소·유찰은 애초에 sale_order 미생성).
 *
 * <p>{@code public_id} 는 외부 식별자(B-004)다 — {@code GET /orders/{id}}(후속) 경로 리소스가 된다. 연관은
 * 폴리모픽 참조라 {@code source_id} 만 원시값으로 보유하고 리스팅(auction/shop) 물리 FK 는 두지 않는다.
 */
@Entity
@Getter
@Table(name = "sale_order")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SaleOrder extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20, updatable = false)
    private SaleOrderSourceType sourceType;

    @Column(name = "source_id", nullable = false, updatable = false)
    private Long sourceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "buyer_id", nullable = false, updatable = false)
    private User buyer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seller_id", nullable = false, updatable = false)
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_instance_id", nullable = false, updatable = false)
    private ItemInstance itemInstance;

    @Column(name = "final_price", nullable = false, updatable = false)
    private long finalPrice;

    @Column(name = "fee_amount", nullable = false, updatable = false)
    private long feeAmount;

    @Column(name = "settle_amount", nullable = false, updatable = false)
    private long settleAmount;

    @Column(name = "fee_policy_version", nullable = false, length = 10, updatable = false)
    private String feePolicyVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20, updatable = false)
    private SaleOrderStatus status;

    @Column(name = "settled_at", nullable = false, updatable = false)
    private Instant settledAt;

    @Builder
    private SaleOrder(String publicId, SaleOrderSourceType sourceType, Long sourceId, User buyer, User seller,
        ItemInstance itemInstance, long finalPrice, long feeAmount, long settleAmount, String feePolicyVersion,
        Instant settledAt) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.buyer = buyer;
        this.seller = seller;
        this.itemInstance = itemInstance;
        this.finalPrice = finalPrice;
        this.feeAmount = feeAmount;
        this.settleAmount = settleAmount;
        this.feePolicyVersion = feePolicyVersion;
        // 내부 DB 단일 TX 정산이라 생성 즉시 SETTLED 다(다른 상태로 태어나는 경로가 없다).
        this.status = SaleOrderStatus.SETTLED;
        this.settledAt = settledAt;
    }
}
