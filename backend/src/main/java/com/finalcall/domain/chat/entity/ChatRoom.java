package com.finalcall.domain.chat.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseTimeEntity;
import com.finalcall.common.util.Ulid;

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

/** 두 회원의 1:1 채팅방. 이 행의 비관적 락이 방별 메시지 순서와 send/block 경합을 직렬화한다. */
@Entity
@Getter
@Table(name = "chat_room")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatRoom extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @Column(name = "member_low_id", nullable = false, updatable = false)
    private Long memberLowId;

    @Column(name = "member_high_id", nullable = false, updatable = false)
    private Long memberHighId;

    @Column(name = "last_sequence", nullable = false)
    private long lastSequence;

    @Column(name = "last_activity_at", nullable = false)
    private Instant lastActivityAt;

    @Builder
    private ChatRoom(String publicId, Long memberLowId, Long memberHighId, Instant lastActivityAt) {
        if (memberLowId == null || memberHighId == null || memberLowId >= memberHighId) {
            throw new IllegalArgumentException("채팅방 참여자 ID는 오름차순의 서로 다른 값이어야 합니다.");
        }
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.memberLowId = memberLowId;
        this.memberHighId = memberHighId;
        this.lastSequence = 0L;
        this.lastActivityAt = lastActivityAt;
    }

    /** 요청자가 이 방의 두 참여자 중 하나인지 확인한다. */
    public boolean isParticipant(Long userId) {
        return userId != null && (userId.equals(memberLowId) || userId.equals(memberHighId));
    }

    /** 요청자의 상대 참여자 ID를 반환한다. 호출 전에 {@link #isParticipant}를 검증해야 한다. */
    public Long counterpartId(Long userId) {
        return userId.equals(memberLowId) ? memberHighId : memberLowId;
    }

    /** 방 행 락을 보유한 트랜잭션에서 다음 메시지 순번을 배정하고 최근 활동 시각을 갱신한다. */
    public long advanceSequence(Instant occurredAt) {
        this.lastSequence++;
        this.lastActivityAt = occurredAt;
        return lastSequence;
    }
}
