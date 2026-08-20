package com.finalcall.domain.chat.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseCreatedEntity;
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

/** 동일 DB 트랜잭션에 append하는 metadata-only 채팅 사건. */
@Entity
@Getter
@Table(name = "chat_event_outbox")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatEventOutbox extends BaseCreatedEntity {

    public static final String AGGREGATE_TYPE = "CHAT_ROOM";
    public static final int EVENT_VERSION = 1;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "event_id", nullable = false, unique = true, updatable = false, length = 26)
    private String eventId;

    @Column(name = "aggregate_type", nullable = false, updatable = false, length = 30)
    private String aggregateType;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "aggregate_id", nullable = false, updatable = false, length = 26)
    private String aggregateId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, updatable = false, length = 40)
    private ChatEventType eventType;

    @Column(name = "event_version", nullable = false, updatable = false)
    private int eventVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false, updatable = false, columnDefinition = "json")
    private String payload;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    @Builder
    private ChatEventOutbox(String eventId, String aggregateId, ChatEventType eventType, String payload,
        Instant occurredAt) {
        this.eventId = eventId != null ? eventId : Ulid.generate();
        this.aggregateType = AGGREGATE_TYPE;
        this.aggregateId = aggregateId;
        this.eventType = eventType;
        this.eventVersion = EVENT_VERSION;
        this.payload = payload;
        this.occurredAt = occurredAt;
    }
}
