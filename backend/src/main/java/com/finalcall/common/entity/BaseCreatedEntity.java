package com.finalcall.common.entity;

import java.time.Instant;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;

/**
 * 생성 시각만 감사하는 공통 상위 엔티티(item).
 *
 * <p>{@link BaseTimeEntity}(created_at + updated_at)와 계층을 나눈다: 생성 후 갱신 생애주기가 없는
 * append-only 이력·1:1 부속 행 테이블은 updated_at 을 두지 않는다(erd §4.3 공통 컬럼 규약 —
 * "갱신 대상만 updated_at", spec §2.4 소유이력 명시). 시각 타입은 {@link Instant}(UTC)로 통일한다.
 */
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseCreatedEntity {

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;
}
