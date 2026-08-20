package com.finalcall.domain.chat.repository;

import java.time.Instant;
import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.domain.chat.entity.ChatReportDailyQuota;

/** 사용자별 UTC 일자 신고 quota를 DB에서 원자 증가시키는 저장소. */
public interface ChatReportDailyQuotaRepository extends JpaRepository<ChatReportDailyQuota, Long> {

    /** 단일 upsert로 최초 생성과 증가를 직렬화한다. 11 이상은 호출 TX가 예외로 롤백해 커밋값 최대 10을 지킨다. */
    @Modifying
    @Query(value = """
        INSERT INTO chat_report_daily_quota
            (reporter_id, quota_date, report_count, created_at, updated_at)
        VALUES (:reporterId, :quotaDate, 1, :now, :now)
        ON DUPLICATE KEY UPDATE
            report_count = report_count + 1,
            updated_at = :now
        """, nativeQuery = true)
    int increment(
        @Param("reporterId") Long reporterId,
        @Param("quotaDate") LocalDate quotaDate,
        @Param("now") Instant now);

    /** 같은 TX의 upsert 결과를 읽는다. quota 행 락은 report 저장이 끝날 때까지 유지된다. */
    @Query("""
        SELECT quota.reportCount
        FROM ChatReportDailyQuota quota
        WHERE quota.reporterId = :reporterId
          AND quota.quotaDate = :quotaDate
        """)
    int findReportCount(
        @Param("reporterId") Long reporterId,
        @Param("quotaDate") LocalDate quotaDate);
}
