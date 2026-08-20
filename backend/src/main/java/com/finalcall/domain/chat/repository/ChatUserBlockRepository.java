package com.finalcall.domain.chat.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.chat.entity.ChatUserBlock;

/** 방향성 사용자 차단 저장소. */
public interface ChatUserBlockRepository extends JpaRepository<ChatUserBlock, Long>, ChatUserBlockRepositoryCustom {

    Optional<ChatUserBlock> findByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    @Query("SELECT COUNT(b) > 0 FROM ChatUserBlock b "
        + "WHERE (b.blockerId = :firstId AND b.blockedId = :secondId) "
        + "OR (b.blockerId = :secondId AND b.blockedId = :firstId)")
    boolean existsBetween(@Param("firstId") Long firstId, @Param("secondId") Long secondId);

    default ChatUserBlock findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
