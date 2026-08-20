package com.finalcall.domain.chat.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.chat.entity.ChatReport;

/** 채팅 신고와 장기 보존 증거 snapshot 저장소. */
public interface ChatReportRepository extends JpaRepository<ChatReport, Long> {

    Optional<ChatReport> findByPublicId(String publicId);

    boolean existsByReporterIdAndMessagePublicId(Long reporterId, String messagePublicId);

    /** 3년을 지난 신고 snapshot id를 (created_at,id) 순으로 잠그고 다른 worker 선점 행은 건너뛴다. */
    @Query(value = """
        SELECT id
        FROM chat_report
        WHERE created_at < :cutoff
        ORDER BY created_at, id
        LIMIT :batchSize
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    List<Long> findRetentionIdsForUpdate(
        @Param("cutoff") Instant cutoff, @Param("batchSize") int batchSize);

    /** 선택한 신고 snapshot 소배치만 물리 삭제한다. */
    @Modifying
    @Query("DELETE FROM ChatReport report WHERE report.id IN :ids")
    int deleteRetentionIds(@Param("ids") List<Long> ids);

    default ChatReport findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
