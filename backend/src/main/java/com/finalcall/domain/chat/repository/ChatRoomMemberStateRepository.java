package com.finalcall.domain.chat.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.chat.entity.ChatRoomMemberState;

import jakarta.persistence.LockModeType;

/** 방 참여자별 읽음 위치 저장소. */
public interface ChatRoomMemberStateRepository extends JpaRepository<ChatRoomMemberState, Long> {

    Optional<ChatRoomMemberState> findByRoomIdAndUserId(Long roomId, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM ChatRoomMemberState s WHERE s.roomId = :roomId AND s.userId = :userId")
    Optional<ChatRoomMemberState> findByRoomIdAndUserIdForUpdate(
        @Param("roomId") Long roomId, @Param("userId") Long userId);

    List<ChatRoomMemberState> findByRoomIdOrderByUserIdAsc(Long roomId);

    List<ChatRoomMemberState> findByRoomIdIn(Collection<Long> roomIds);

    /** 동시 room 생성 시 참여 상태를 사용자별 UK 기준으로 한 번만 생성한다. */
    @Modifying(flushAutomatically = true)
    @Query(value = "INSERT IGNORE INTO chat_room_member_state "
        + "(room_id, user_id, last_read_sequence, created_at, updated_at) "
        + "VALUES (:roomId, :userId, 0, :now, :now)", nativeQuery = true)
    int insertIfAbsent(@Param("roomId") Long roomId, @Param("userId") Long userId, @Param("now") Instant now);

    /** 메시지 purge floor까지 모든 참여자의 읽음 위치를 원자적으로 전진시킨다. 실제 읽음 시각은 변경하지 않는다. */
    @Modifying
    @Query(value = """
        UPDATE chat_room_member_state
        SET last_read_sequence = :floorSequence,
            updated_at = :now
        WHERE room_id = :roomId
          AND last_read_sequence < :floorSequence
        """, nativeQuery = true)
    int advanceRetentionFloor(
        @Param("roomId") Long roomId,
        @Param("floorSequence") long floorSequence,
        @Param("now") Instant now);

    default ChatRoomMemberState findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
