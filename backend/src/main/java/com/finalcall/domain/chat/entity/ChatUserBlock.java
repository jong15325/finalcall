package com.finalcall.domain.chat.entity;

import com.finalcall.common.entity.BaseCreatedEntity;

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

/** 방향성 사용자 차단. 어느 방향의 행이든 존재하면 양쪽 신규 전송을 막는다. */
@Entity
@Getter
@Table(name = "chat_user_block")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatUserBlock extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "blocker_id", nullable = false, updatable = false)
    private Long blockerId;

    @Column(name = "blocked_id", nullable = false, updatable = false)
    private Long blockedId;

    @Builder
    private ChatUserBlock(Long blockerId, Long blockedId) {
        if (blockerId == null || blockedId == null || blockerId.equals(blockedId)) {
            throw new IllegalArgumentException("자기 자신은 차단할 수 없습니다.");
        }
        this.blockerId = blockerId;
        this.blockedId = blockedId;
    }
}
