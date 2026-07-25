package com.finalcall.common.entity;

import java.time.Instant;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;

/**
 * 생성/수정 시각 감사(Auditing)를 제공하는 공통 상위 엔티티(Stage D).
 *
 * <p>시각 타입은 {@link Instant}(UTC)로 통일한다(관측성/응답 timestamp 와 일관).
 * 작성자(createdBy/modifiedBy)는 Stage F1(AuditorAware)에서 확장한다. 자리만 둔다.
 */
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseTimeEntity {

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
