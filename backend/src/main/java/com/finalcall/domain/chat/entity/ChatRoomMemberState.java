package com.finalcall.domain.chat.entity;

import java.time.Instant;

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

/** 채팅방 참여자의 단조 증가 읽음 위치와 사용자별 보관 상태. */
@Entity
@Getter
@Table(name = "chat_room_member_state")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatRoomMemberState extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_id", nullable = false, updatable = false)
    private Long roomId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "last_read_sequence", nullable = false)
    private long lastReadSequence;

    @Column(name = "last_read_at")
    private Instant lastReadAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Builder
    private ChatRoomMemberState(Long roomId, Long userId) {
        this.roomId = roomId;
        this.userId = userId;
        this.lastReadSequence = 0L;
    }

    /** 읽음 위치를 뒤로 보내지 않고 실제 전진했을 때만 시각을 갱신한다. */
    public boolean advanceReadTo(long throughSequence, Instant readAt) {
        if (throughSequence <= lastReadSequence) {
            return false;
        }
        this.lastReadSequence = throughSequence;
        this.lastReadAt = readAt;
        return true;
    }
}
