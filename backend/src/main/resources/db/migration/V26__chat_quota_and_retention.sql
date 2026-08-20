-- EPIC-CHAT(FC-326): 신고 일일 DB quota와 보존 소배치 인덱스·CDC 안전 checkpoint.
-- append-only 채번 규율: V25 다음 V26으로 이어붙이며 기존 마이그레이션은 수정하지 않는다.
-- 정본 = chat-domain-spec v1.0 §9.4~§10.2.

CREATE TABLE chat_report_daily_quota
(
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    reporter_id  BIGINT      NOT NULL,
    quota_date   DATE        NOT NULL,
    report_count INT         NOT NULL DEFAULT 0,
    created_at   DATETIME(6) NOT NULL,
    updated_at   DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_chat_report_daily_quota (reporter_id, quota_date),
    CONSTRAINT ck_chat_report_daily_quota_count CHECK (report_count >= 0),
    CONSTRAINT fk_chat_report_daily_quota_reporter FOREIGN KEY (reporter_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 외부 CDC 상태 점검기가 안전하게 소비한 마지막 outbox id와 점검 시각을 갱신한다.
-- checkpoint가 없거나 오래됐으면 worker는 outbox 삭제를 fail-safe로 건너뛴다.
CREATE TABLE chat_outbox_retention_checkpoint
(
    id                 BIGINT      NOT NULL,
    cdc_safe_outbox_id BIGINT      NOT NULL,
    cdc_checked_at     DATETIME(6) NOT NULL,
    created_at         DATETIME(6) NOT NULL,
    updated_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_chat_outbox_retention_checkpoint_singleton CHECK (id = 1),
    CONSTRAINT ck_chat_outbox_retention_checkpoint_id CHECK (cdc_safe_outbox_id >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

ALTER TABLE chat_message
    ADD KEY ix_chat_message_retention (created_at, id);

ALTER TABLE chat_report
    ADD KEY ix_chat_report_retention (created_at, id);
