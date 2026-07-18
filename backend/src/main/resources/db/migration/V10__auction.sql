-- auction 도메인(FC-026): 경매 애그리거트 — auction 테이블(erd §4.2·§5, group4 판매·거래).
-- append-only 원칙상 V9(item 시드) 다음(V10)으로 이어붙인다(G9 단일 채번).
-- 상태(status)는 FSM 5값(SCHEDULED/ACTIVE/SOLD/UNSOLD/CANCELLED). 본 에픽 세팅값 = SCHEDULED·ACTIVE·CANCELLED.
--   SOLD/UNSOLD 전이와 result_type·highest_bid_amount·highest_bidder_id 세팅은 EPIC-BID/CLOSING 소유(항상 NULL 유지).
-- 소프트클로즈 config(window/extend/base_end_at/max_end_at/extension_count)는 본 에픽 "저장만"(게이트2 c).
-- soft delete 없음(CANCELLED 는 종료 상태로 보존, spec §2) → BaseTimeEntity(created_at/updated_at)만 상속.
CREATE TABLE auction
(
    id                    BIGINT      NOT NULL AUTO_INCREMENT,
    public_id             CHAR(26)    NOT NULL,
    seller_id             BIGINT      NOT NULL,
    item_instance_id      BIGINT      NOT NULL,
    start_price           BIGINT      NOT NULL,
    buy_now_price         BIGINT      NULL,
    status                VARCHAR(20) NOT NULL,
    result_type           VARCHAR(20) NULL,
    highest_bid_amount    BIGINT      NULL,
    highest_bidder_id     BIGINT      NULL,
    start_at              DATETIME(6) NULL,
    end_at                DATETIME(6) NOT NULL,
    base_end_at           DATETIME(6) NOT NULL,
    max_end_at            DATETIME(6) NOT NULL,
    soft_close_window_sec INT         NOT NULL,
    soft_close_extend_sec INT         NOT NULL,
    extension_count       INT         NOT NULL,
    item_name_snapshot    VARCHAR(100) NOT NULL,
    item_spec_snapshot    VARCHAR(255) NOT NULL,
    created_at            DATETIME(6) NOT NULL,
    updated_at            DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_auction_public_id (public_id),
    CONSTRAINT fk_auction_seller FOREIGN KEY (seller_id) REFERENCES user (id),
    CONSTRAINT fk_auction_item FOREIGN KEY (item_instance_id) REFERENCES item_instance (id),
    CONSTRAINT fk_auction_highest_bidder FOREIGN KEY (highest_bidder_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- erd §5 보조 인덱스 4종.
-- 마감 트리거 DB 재구축 스캔(status=ACTIVE AND end_at<=now, D-058). 목록 기본 정렬(마감 임박)도 커버.
CREATE INDEX ix_auction_status_end ON auction (status, end_at);
-- 예약 시작(SCHEDULED→ACTIVE) 트리거 스캔(D-057). lazy 파생 근거 상태 조회.
CREATE INDEX ix_auction_status_start ON auction (status, start_at);
-- 판매자 진행/종료 경매 목록.
CREATE INDEX ix_auction_seller_status ON auction (seller_id, status);
-- 출품 아이템 역참조(에스크로 상태 확인).
CREATE INDEX ix_auction_item ON auction (item_instance_id);
