package com.finalcall.domain.item;

import java.time.Instant;

import com.finalcall.domain.common.BaseCreatedEntity;

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
 * 임시보관(오버플로우) 엔티티(item, FC-022) — {@link ItemInstance}와 1:1(location=TEMP 일 때만 행 존재, erd §4.3).
 *
 * <p>XOR 불변식(spec §3.1): TEMP 전이 시 이 행을 생성하고 relocate(TEMP→INVENTORY) 시 삭제한다 — 위치 전이와
 * 동일 트랜잭션에서 처리한다. insert/delete 만 있고 갱신 생애주기가 없어 {@link BaseCreatedEntity}(created_at 만)를
 * 상속한다. 소유자는 조회 필터(owner_id)로만 쓰여 원시 식별자로 보유한다(User 관계 미매핑).
 */
@Entity
@Getter
@Table(name = "temp_storage")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TempStorage extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "instance_id", nullable = false, unique = true, updatable = false)
    private ItemInstance instance;

    @Column(name = "owner_id", nullable = false, updatable = false)
    private Long ownerId;

    @Column(name = "stored_at", nullable = false, updatable = false)
    private Instant storedAt;

    @Column(name = "expire_at")
    private Instant expireAt;

    @Builder
    private TempStorage(ItemInstance instance, Long ownerId, Instant storedAt, Instant expireAt) {
        this.instance = instance;
        this.ownerId = ownerId;
        this.storedAt = storedAt != null ? storedAt : Instant.now();
        this.expireAt = expireAt;
    }
}
