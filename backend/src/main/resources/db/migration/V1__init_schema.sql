-- Stage D 초기 스키마: notice(공지사항) 참조 구현.
-- created_at/updated_at/is_deleted 포함 → JPA validate 통과.
CREATE TABLE notice
(
    id         BIGINT        NOT NULL AUTO_INCREMENT,
    title      VARCHAR(200)  NOT NULL,
    content    VARCHAR(2000) NOT NULL,
    type       VARCHAR(20)   NOT NULL,
    is_deleted BIT           NOT NULL,
    created_at DATETIME(6)   NOT NULL,
    updated_at DATETIME(6)   NOT NULL,
    PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
