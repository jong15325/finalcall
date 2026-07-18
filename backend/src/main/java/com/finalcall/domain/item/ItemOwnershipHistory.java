package com.finalcall.domain.item;

import java.time.Instant;

import com.finalcall.domain.common.BaseCreatedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 소유 이전 이력 엔티티(item, FC-021) — append-only 원장(erd §4.3, spec §2.4).
 *
 * <p>소유자 변경이 발생하는 모든 경로에서 1행 append 한다. 최초 발행이면 {@code fromOwnerId} NULL. 불변 이력이라
 * updated_at 이 없다({@link BaseCreatedEntity} 상속). EPIC-ITEM 이 소유하는 트리거는 SEED(최초 발행)뿐이며(spec §4),
 * relocate(위치 이동)는 소유자 변경이 아니므로 이력을 남기지 않는다. {@code saleOrderId}는 거래 이전용이나
 * sale_order 미존재(G7)라 FK 없이 컬럼만 두고 EPIC-ITEM 에선 NULL 이다. FK id 는 관계 대신 원시 식별자로 보유한다.
 */
@Entity
@Getter
@Table(name = "item_ownership_history")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ItemOwnershipHistory extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instance_id", nullable = false, updatable = false)
    private Long instanceId;

    @Column(name = "from_owner_id", updatable = false)
    private Long fromOwnerId;

    @Column(name = "to_owner_id", nullable = false, updatable = false)
    private Long toOwnerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "transfer_type", nullable = false, length = 20, updatable = false)
    private TransferType transferType;

    @Column(name = "sale_order_id", updatable = false)
    private Long saleOrderId;

    @Column(name = "transferred_at", nullable = false, updatable = false)
    private Instant transferredAt;

    @Builder
    private ItemOwnershipHistory(Long instanceId, Long fromOwnerId, Long toOwnerId, TransferType transferType,
        Long saleOrderId, Instant transferredAt) {
        this.instanceId = instanceId;
        this.fromOwnerId = fromOwnerId;
        this.toOwnerId = toOwnerId;
        this.transferType = transferType;
        this.saleOrderId = saleOrderId;
        this.transferredAt = transferredAt != null ? transferredAt : Instant.now();
    }
}
