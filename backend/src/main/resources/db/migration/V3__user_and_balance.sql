-- auth 도메인 기반: user, user_balance.
-- erd §4.1 정합 — ULID public_id 는 CHAR(26), snake_case, DATETIME(6), 유니크 인덱스.
-- 주: erd §6 의 V1 계획(user_and_money 단일 파일)은 스켈레톤이 V1/V2 를 notice 로 이미 소비해
--     append-only 원칙상 다음 버전(V3)로 이어붙인다. charge/money_exchange/money_hold 는 auth 범위 밖 → 후속 버전.
CREATE TABLE user
(
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    public_id     CHAR(26)     NOT NULL,
    login_id      VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    nickname      VARCHAR(30)  NOT NULL,
    is_admin      BIT          NOT NULL,
    is_deleted    BIT          NOT NULL,
    deleted_at    DATETIME(6)  NULL,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_public_id (public_id),
    UNIQUE KEY uk_user_login_id (login_id),
    UNIQUE KEY uk_user_nickname (nickname)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE user_balance
(
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    user_id            BIGINT      NOT NULL,
    cash_balance       BIGINT      NOT NULL,
    game_money_balance BIGINT      NOT NULL,
    game_money_held    BIGINT      NOT NULL,
    created_at         DATETIME(6) NOT NULL,
    updated_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_balance_user_id (user_id),
    CONSTRAINT fk_user_balance_user FOREIGN KEY (user_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
