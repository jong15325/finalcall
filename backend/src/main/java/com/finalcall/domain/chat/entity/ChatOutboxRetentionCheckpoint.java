package com.finalcall.domain.chat.entity;

import java.time.Instant;

import com.finalcall.common.entity.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** CDC가 안전하게 소비한 outbox 상한과 점검 시각을 보관하는 retention 안전 checkpoint. */
@Entity
@Getter
@Table(name = "chat_outbox_retention_checkpoint")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatOutboxRetentionCheckpoint extends BaseTimeEntity {

    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id;

    @Column(name = "cdc_safe_outbox_id", nullable = false)
    private long cdcSafeOutboxId;

    @Column(name = "cdc_checked_at", nullable = false)
    private Instant cdcCheckedAt;

    @Builder
    private ChatOutboxRetentionCheckpoint(Long id, long cdcSafeOutboxId, Instant cdcCheckedAt) {
        this.id = id != null ? id : SINGLETON_ID;
        this.cdcSafeOutboxId = cdcSafeOutboxId;
        this.cdcCheckedAt = cdcCheckedAt;
    }

    /** 외부 CDC 상태 점검 결과로 소비 안전 상한을 단조 전진시킨다. */
    public void advanceTo(long safeOutboxId, Instant checkedAt) {
        if (safeOutboxId > cdcSafeOutboxId) {
            this.cdcSafeOutboxId = safeOutboxId;
        }
        this.cdcCheckedAt = checkedAt;
    }
}
