package com.finalcall.domain.chat.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.chat.entity.ChatMessage;

import jakarta.persistence.LockModeType;

/** 채팅 메시지 저장소. 방별 순서와 clientMessageId 멱등성은 DB UK가 최종 방어한다. */
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long>, ChatMessageRepositoryCustom {

    Optional<ChatMessage> findByRoomIdAndSenderIdAndClientMessageId(
        Long roomId, Long senderId, String clientMessageId);

    Optional<ChatMessage> findByRoomIdAndPublicId(Long roomId, String publicId);

    /** 신고 snapshot 생성과 retention 물리 삭제의 경합에서 메시지 행을 보존한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT message FROM ChatMessage message WHERE message.roomId = :roomId AND message.publicId = :publicId")
    Optional<ChatMessage> findByRoomIdAndPublicIdForUpdate(
        @Param("roomId") Long roomId, @Param("publicId") String publicId);

    List<ChatMessage> findByRoomIdOrderByRoomSequenceAsc(Long roomId);

    long countByRoomId(Long roomId);

    /** 오래된 메시지 id를 (created_at,id) 순으로 잠그되 다른 worker가 선점한 행은 건너뛴다. */
    @Query(value = """
        SELECT id
        FROM chat_message
        WHERE created_at < :cutoff
        ORDER BY created_at, id
        LIMIT :batchSize
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    List<Long> findRetentionIdsForUpdate(
        @Param("cutoff") Instant cutoff, @Param("batchSize") int batchSize);

    /** 선택한 소배치만 물리 삭제한다. chat_report.message_id는 FK ON DELETE SET NULL로 snapshot과 분리된다. */
    @Modifying
    @Query("DELETE FROM ChatMessage message WHERE message.id IN :ids")
    int deleteRetentionIds(@Param("ids") List<Long> ids);

    default ChatMessage findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
