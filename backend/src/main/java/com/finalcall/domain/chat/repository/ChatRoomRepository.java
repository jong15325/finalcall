package com.finalcall.domain.chat.repository;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.chat.entity.ChatRoom;

import jakarta.persistence.LockModeType;

/** 채팅방 저장소. 방별 쓰기는 반드시 {@code FOR UPDATE} 조회 뒤 수행한다. */
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long>, ChatRoomRepositoryCustom {

    Optional<ChatRoom> findByPublicId(String publicId);

    Optional<ChatRoom> findByMemberLowIdAndMemberHighId(Long memberLowId, Long memberHighId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM ChatRoom r WHERE r.publicId = :publicId")
    Optional<ChatRoom> findByPublicIdForUpdate(@Param("publicId") String publicId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM ChatRoom r "
        + "WHERE r.memberLowId = :memberLowId AND r.memberHighId = :memberHighId")
    Optional<ChatRoom> findByMemberPairForUpdate(
        @Param("memberLowId") Long memberLowId, @Param("memberHighId") Long memberHighId);

    /** 동시 direct room 생성을 쌍 UK에서 하나로 수렴시킨다. 반환값 1은 생성, 0은 기존 행 재사용이다. */
    @Modifying(flushAutomatically = true)
    @Query(value = "INSERT INTO chat_room "
        + "(public_id, member_low_id, member_high_id, last_sequence, last_activity_at, created_at, updated_at) "
        + "VALUES (:publicId, :memberLowId, :memberHighId, 0, :now, :now, :now) "
        + "ON DUPLICATE KEY UPDATE id = id", nativeQuery = true)
    int insertDirectIfAbsent(@Param("publicId") String publicId,
        @Param("memberLowId") Long memberLowId,
        @Param("memberHighId") Long memberHighId,
        @Param("now") Instant now);

    default ChatRoom findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
