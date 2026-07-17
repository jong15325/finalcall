-- currency 도메인: money_exchange (캐시→게임머니 교환 원장, erd §4.1 v0.8).
-- append-only 원칙상 V4 다음(V5)로 이어붙인다. V3(user_and_balance) 스타일을 그대로 따른다.
-- 멱등성(SEC-004): (user_id, idempotency_key) 복합 UK 로 재요청/동시 중복 제출의 이중 처리를 DB 에서 차단한다.
-- public_id 없음 — 교환 id 를 응답에 노출하지 않는다(erd money_exchange 표에 대리키 없음).
-- soft delete(is_deleted) 없음 — 정산·감사용 append-only 원장이라 논리 삭제 대상이 아니다.
CREATE TABLE money_exchange
(
    id                BIGINT         NOT NULL AUTO_INCREMENT,
    user_id           BIGINT         NOT NULL,
    cash_amount       BIGINT         NOT NULL,
    game_money_amount BIGINT         NOT NULL,
    applied_rate      DECIMAL(20, 6) NOT NULL,
    idempotency_key   VARCHAR(100)   NOT NULL,
    created_at        DATETIME(6)    NOT NULL,
    updated_at        DATETIME(6)    NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_money_exchange_user_idem (user_id, idempotency_key),
    CONSTRAINT fk_money_exchange_user FOREIGN KEY (user_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
