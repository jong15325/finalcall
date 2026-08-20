package com.finalcall.domain.chat.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseTimeEntity;
import com.finalcall.common.util.Ulid;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 메시지 물리 삭제 뒤에도 외부 ID·본문·발신 닉네임 증거를 보존하는 신고. */
@Entity
@Getter
@Table(name = "chat_report")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatReport extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @Column(name = "room_id", nullable = false, updatable = false)
    private Long roomId;

    @Column(name = "message_id", updatable = false)
    private Long messageId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "message_public_id", nullable = false, updatable = false, length = 26)
    private String messagePublicId;

    @Column(name = "reporter_id", nullable = false, updatable = false)
    private Long reporterId;

    @Column(name = "reported_user_id", nullable = false, updatable = false)
    private Long reportedUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, updatable = false, length = 30)
    private ChatReportReason reason;

    @Column(name = "detail", updatable = false, length = 500)
    private String detail;

    @Column(name = "message_body_snapshot", nullable = false, updatable = false, length = 1000)
    private String messageBodySnapshot;

    @Column(name = "sender_nickname_snapshot", nullable = false, updatable = false, length = 30)
    private String senderNicknameSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ChatReportStatus status;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Builder
    private ChatReport(String publicId, Long roomId, Long messageId, String messagePublicId, Long reporterId,
        Long reportedUserId, ChatReportReason reason, String detail, String messageBodySnapshot,
        String senderNicknameSnapshot) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.roomId = roomId;
        this.messageId = messageId;
        this.messagePublicId = messagePublicId;
        this.reporterId = reporterId;
        this.reportedUserId = reportedUserId;
        this.reason = reason;
        this.detail = detail;
        this.messageBodySnapshot = messageBodySnapshot;
        this.senderNicknameSnapshot = senderNicknameSnapshot;
        this.status = ChatReportStatus.PENDING;
    }
}
