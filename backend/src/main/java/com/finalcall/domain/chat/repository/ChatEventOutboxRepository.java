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
import com.finalcall.domain.chat.entity.ChatEventOutbox;

/** metadata-only 채팅 사건 outbox 저장소. */
public interface ChatEventOutboxRepository extends JpaRepository<ChatEventOutbox, Long> {

    Optional<ChatEventOutbox> findByEventId(String eventId);

    Optional<ChatEventOutbox> findTopByOrderByOccurredAtDescIdDesc();

    /** 전체 인덱스 count scan 없이 MySQL 통계의 outbox 행 수 근삿값을 관측한다. */
    @Query(value = """
        SELECT COALESCE(TABLE_ROWS, 0)
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'chat_event_outbox'
        """, nativeQuery = true)
    long estimateRowCount();

    /** CDC가 확인한 id 상한 안에서 7일을 지난 outbox 소배치를 잠근다. */
    @Query(value = """
        SELECT id
        FROM chat_event_outbox
        WHERE created_at < :cutoff
          AND id <= :safeOutboxId
        ORDER BY created_at, id
        LIMIT :batchSize
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    List<Long> findRetentionIdsForUpdate(
        @Param("cutoff") Instant cutoff,
        @Param("safeOutboxId") long safeOutboxId,
        @Param("batchSize") int batchSize);

    /** CDC/binlog 안전 가드를 통과해 선택된 outbox 소배치만 물리 삭제한다. */
    @Modifying
    @Query("DELETE FROM ChatEventOutbox outbox WHERE outbox.id IN :ids")
    int deleteRetentionIds(@Param("ids") List<Long> ids);

    default ChatEventOutbox findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
