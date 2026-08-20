-- EPIC-CHAT(FC-318): 1:1 채팅 DB 코어 — 방별 순서·멱등·읽음·차단·신고·metadata-only outbox.
-- append-only 채번 규율: V24 다음 V25로 이어붙이며 기존 마이그레이션은 수정하지 않는다.
-- 정본 = chat-domain-spec v1.0 §5~§6 · erd v2.0 §4.6·§5·§6 · api-contract v1.27 §2.7.

CREATE TABLE chat_room
(
    id               BIGINT      NOT NULL AUTO_INCREMENT,
    public_id        CHAR(26)    NOT NULL,
    member_low_id    BIGINT      NOT NULL,
    member_high_id   BIGINT      NOT NULL,
    last_sequence    BIGINT      NOT NULL DEFAULT 0,
    last_activity_at DATETIME(6) NOT NULL,
    created_at       DATETIME(6) NOT NULL,
    updated_at       DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_chat_room_public_id (public_id),
    UNIQUE KEY uk_chat_room_members (member_low_id, member_high_id),
    KEY ix_chat_room_low_activity (member_low_id, last_activity_at, id),
    KEY ix_chat_room_high_activity (member_high_id, last_activity_at, id),
    CONSTRAINT ck_chat_room_members CHECK (member_low_id < member_high_id),
    CONSTRAINT fk_chat_room_member_low FOREIGN KEY (member_low_id) REFERENCES user (id),
    CONSTRAINT fk_chat_room_member_high FOREIGN KEY (member_high_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE chat_room_member_state
(
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    room_id            BIGINT      NOT NULL,
    user_id            BIGINT      NOT NULL,
    last_read_sequence BIGINT      NOT NULL DEFAULT 0,
    last_read_at       DATETIME(6) NULL,
    archived_at        DATETIME(6) NULL,
    created_at         DATETIME(6) NOT NULL,
    updated_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_chat_room_member_state (room_id, user_id),
    KEY ix_chat_room_member_state_user (user_id, archived_at, room_id),
    CONSTRAINT fk_chat_room_member_state_room FOREIGN KEY (room_id) REFERENCES chat_room (id),
    CONSTRAINT fk_chat_room_member_state_user FOREIGN KEY (user_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE chat_message
(
    id                       BIGINT        NOT NULL AUTO_INCREMENT,
    public_id                CHAR(26)      NOT NULL,
    room_id                  BIGINT        NOT NULL,
    room_sequence            BIGINT        NOT NULL,
    sender_id                BIGINT        NOT NULL,
    sender_nickname_snapshot VARCHAR(30)   NOT NULL,
    client_message_id        CHAR(36)      NOT NULL,
    body                     VARCHAR(1000) NOT NULL,
    created_at               DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_chat_message_public_id (public_id),
    UNIQUE KEY uk_chat_message_room_sequence (room_id, room_sequence),
    UNIQUE KEY uk_chat_message_client (room_id, sender_id, client_message_id),
    CONSTRAINT fk_chat_message_room FOREIGN KEY (room_id) REFERENCES chat_room (id),
    CONSTRAINT fk_chat_message_sender FOREIGN KEY (sender_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE chat_user_block
(
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    blocker_id BIGINT      NOT NULL,
    blocked_id BIGINT      NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_chat_user_block (blocker_id, blocked_id),
    CONSTRAINT ck_chat_user_block_self CHECK (blocker_id <> blocked_id),
    CONSTRAINT fk_chat_user_block_blocker FOREIGN KEY (blocker_id) REFERENCES user (id),
    CONSTRAINT fk_chat_user_block_blocked FOREIGN KEY (blocked_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE chat_report
(
    id                       BIGINT        NOT NULL AUTO_INCREMENT,
    public_id                CHAR(26)      NOT NULL,
    room_id                  BIGINT        NOT NULL,
    message_id               BIGINT        NULL,
    message_public_id        CHAR(26)      NOT NULL,
    reporter_id              BIGINT        NOT NULL,
    reported_user_id         BIGINT        NOT NULL,
    reason                   VARCHAR(30)   NOT NULL,
    detail                   VARCHAR(500)  NULL,
    message_body_snapshot    VARCHAR(1000) NOT NULL,
    sender_nickname_snapshot VARCHAR(30)   NOT NULL,
    status                   VARCHAR(20)   NOT NULL,
    resolved_at              DATETIME(6)   NULL,
    created_at               DATETIME(6)   NOT NULL,
    updated_at               DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_chat_report_public_id (public_id),
    UNIQUE KEY uk_chat_report_message (reporter_id, message_public_id),
    CONSTRAINT fk_chat_report_room FOREIGN KEY (room_id) REFERENCES chat_room (id),
    CONSTRAINT fk_chat_report_message FOREIGN KEY (message_id) REFERENCES chat_message (id) ON DELETE SET NULL,
    CONSTRAINT fk_chat_report_reporter FOREIGN KEY (reporter_id) REFERENCES user (id),
    CONSTRAINT fk_chat_report_reported_user FOREIGN KEY (reported_user_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE chat_event_outbox
(
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    event_id       CHAR(26)    NOT NULL,
    aggregate_type VARCHAR(30) NOT NULL,
    aggregate_id   CHAR(26)    NOT NULL,
    event_type     VARCHAR(40) NOT NULL,
    event_version  INT         NOT NULL,
    payload        JSON        NOT NULL,
    occurred_at    DATETIME(6) NOT NULL,
    created_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_chat_event_outbox_event_id (event_id),
    KEY ix_chat_event_outbox_occurred (occurred_at, id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
