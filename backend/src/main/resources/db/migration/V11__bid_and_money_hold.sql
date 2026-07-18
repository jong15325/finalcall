-- bid·money_hold 도메인(FC-031, EPIC-BID): 입찰 애그리거트 + 게임머니 홀드 원장(erd v1.0 §4.1·§4.2·§5·§6 4-b).
-- append-only 원칙상 V10(auction) 다음(V11)으로 이어붙인다(단일 채번).
--
-- 파일 내 순서 강제: money_hold.bid_id 가 NOT NULL FK + UK 라 bid 를 먼저 만들어야 한다(bid-domain-spec §2.2).
-- 마지막에 F6 인덱스(auction (status, highest_bid_amount))를 추가한다 — EPIC-AUCTION 시점엔 전건 NULL 이라
--   이연됐던 항목으로, 계약 §3.3 목록 정렬 화이트리스트 highestBidAmount 가 EPIC-BID 에서 실사용을 시작한다.
--
-- 인덱스는 CREATE TABLE 안에 KEY 로 선언한다. FK 컬럼에 적합한 인덱스가 같은 문장 안에 이미 있으면 MySQL 이
--   FK 용 인덱스를 자동 생성하지 않으므로, 사후 CREATE INDEX 방식과 달리 중복 인덱스가 생기지 않는다.

-- 경매 입찰. 원장이라 soft delete 가 없다 — 밀려난 입찰은 삭제가 아니라 status=OUTBID 로 보존한다.
-- status 는 ACTIVE/OUTBID/WON 3값이며 본 에픽 세팅값은 ACTIVE·OUTBID 다(WON = EPIC-CLOSING).
-- 상태 전이는 조건부 CAS UPDATE(WHERE status='ACTIVE')로만 수행한다(domain-spec §8 "정합성은 DB").
CREATE TABLE bid
(
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    public_id  CHAR(26)    NOT NULL,
    auction_id BIGINT      NOT NULL,
    bidder_id  BIGINT      NOT NULL,
    amount     BIGINT      NOT NULL,
    status     VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_bid_public_id (public_id),
    -- 경매별 최고가·입찰 내역 조회. "현재 최고 입찰" 식별도 이 인덱스가 커버한다 — 입찰 금액이 단조 증가하므로
    --   (bid-domain-spec §10 I2) 선두 행이 곧 현재 최고 입찰이라 (auction_id, status) 인덱스는 두지 않는다(§11 G4).
    KEY ix_bid_auction_amount (auction_id, amount DESC),
    -- 사용자 입찰 내역 조회.
    KEY ix_bid_bidder (bidder_id),
    -- 금액 부호 최종 방어선(심층방어). 앱 검증(최소 증분 BID_001)과 별개로 DB 가 0·음수를 거부한다.
    --   음수 입찰액은 홀드 CAS 조건(가용 >= amount)을 자명하게 통과시켜 홀드를 되레 줄이는 경로가 되므로,
    --   검증이 한 군데라도 빠지면 무자본 획득으로 이어진다. 스키마에 못을 박아 그 가능성을 없앤다.
    CONSTRAINT ck_bid_amount_positive CHECK (amount > 0),
    CONSTRAINT fk_bid_auction FOREIGN KEY (auction_id) REFERENCES auction (id),
    CONSTRAINT fk_bid_bidder FOREIGN KEY (bidder_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 입찰 시 게임머니 홀드(에스크로, D-052). 상위 입찰 시 즉시 해제(P-008), 낙찰 시 차감(EPIC-CLOSING).
-- bid_id UK 가 홀드-입찰 1:1(erd §4.1)을 DB 에서 강제해 동일 입찰의 중복 홀드를 원천 차단한다.
-- status 는 HELD/RELEASED/CAPTURED 3값이며 본 에픽 세팅값은 HELD·RELEASED 다(CAPTURED = EPIC-CLOSING).
-- public_id 없음 — 외부 노출 리소스가 아니다(money_exchange 선례).
CREATE TABLE money_hold
(
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    user_id     BIGINT      NOT NULL,
    bid_id      BIGINT      NOT NULL,
    amount      BIGINT      NOT NULL,
    status      VARCHAR(20) NOT NULL,
    released_at DATETIME(6) NULL,
    created_at  DATETIME(6) NOT NULL,
    updated_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    -- 홀드-입찰 1:1. fk_money_hold_bid 의 FK 인덱스도 이 UK 가 겸한다.
    UNIQUE KEY uk_money_hold_bid (bid_id),
    -- 사용자 홀드 합계·해제 대상 조회(erd §5). fk_money_hold_user 의 FK 인덱스도 겸한다.
    KEY ix_money_hold_user_status (user_id, status),
    -- bid 와 동일한 부호 방어선. money_hold.amount 는 항상 bid.amount 와 같아야 하므로(I3) 제약도 대칭이다.
    CONSTRAINT ck_money_hold_amount_positive CHECK (amount > 0),
    CONSTRAINT fk_money_hold_user FOREIGN KEY (user_id) REFERENCES user (id),
    CONSTRAINT fk_money_hold_bid FOREIGN KEY (bid_id) REFERENCES bid (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- erd v1.0 F6: 계약 §3.3 목록 정렬 화이트리스트 highestBidAmount(진행 중 경매의 최고가 정렬)를 커버한다.
CREATE INDEX ix_auction_status_highest_bid ON auction (status, highest_bid_amount);
