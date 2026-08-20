package com.finalcall.domain.chat.entity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseCreatedEntity;
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

/** 방별 순번과 클라이언트 멱등 키를 갖는 변경 불가 텍스트 메시지. */
@Entity
@Getter
@Table(name = "chat_message")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatMessage extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @Column(name = "room_id", nullable = false, updatable = false)
    private Long roomId;

    @Column(name = "room_sequence", nullable = false, updatable = false)
    private long roomSequence;

    @Column(name = "sender_id", nullable = false, updatable = false)
    private Long senderId;

    @Column(name = "sender_nickname_snapshot", nullable = false, updatable = false, length = 30)
    private String senderNicknameSnapshot;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "client_message_id", nullable = false, updatable = false, length = 36)
    private String clientMessageId;

    @Column(name = "body", nullable = false, updatable = false, length = 1000)
    private String body;

    @Builder
    private ChatMessage(String publicId, Long roomId, long roomSequence, Long senderId,
        String senderNicknameSnapshot, String clientMessageId, String body) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.roomId = roomId;
        this.roomSequence = roomSequence;
        this.senderId = senderId;
        this.senderNicknameSnapshot = senderNicknameSnapshot;
        this.clientMessageId = clientMessageId;
        this.body = body;
    }
}
