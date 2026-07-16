package com.finalcall.domain.common;

import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;

/**
 * 작성자 감사(Auditing)까지 제공하는 공통 상위 엔티티(Stage F1).
 *
 * <p>계층 분리: 시각만 필요하면 {@link BaseTimeEntity}, 작성자까지 필요하면 이 {@code BaseEntity} 를 상속한다.
 * 작성자는 {@code AuditorAware}(SecurityContext) 에서 채워지며, 비인증 시 null(가짜 SYSTEM 기본값 금지).
 */
@Getter
@MappedSuperclass
public abstract class BaseEntity extends BaseTimeEntity {

    @CreatedBy
    @Column(name = "created_by", updatable = false, length = 100)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "modified_by", length = 100)
    private String modifiedBy;
}
