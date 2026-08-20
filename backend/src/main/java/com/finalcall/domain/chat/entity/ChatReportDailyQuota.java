package com.finalcall.domain.chat.entity;

import java.time.LocalDate;

import com.finalcall.common.entity.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Redis 장애와 병렬 요청에서도 사용자별 신고 일일 한도를 원자적으로 보장하는 DB quota. */
@Entity
@Getter
@Table(name = "chat_report_daily_quota")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatReportDailyQuota extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reporter_id", nullable = false, updatable = false)
    private Long reporterId;

    @Column(name = "quota_date", nullable = false, updatable = false)
    private LocalDate quotaDate;

    @Column(name = "report_count", nullable = false)
    private int reportCount;

    @Builder
    private ChatReportDailyQuota(Long reporterId, LocalDate quotaDate, int reportCount) {
        this.reporterId = reporterId;
        this.quotaDate = quotaDate;
        this.reportCount = reportCount;
    }
}
