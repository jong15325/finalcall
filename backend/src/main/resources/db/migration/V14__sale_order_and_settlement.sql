-- sale_order·platform_revenue_ledger 도메인(FC-082, EPIC-CLOSING): 낙찰 정산 거래 레코드 + 사업자 수익 원장
--   (closing-domain-spec v1.0 §2·erd v1.3 §4.2 §5, 게이트2 #1·#4=④-C 승인 확정).
-- append-only 채번 규율(FC-035 m9): V13 다음(V14)으로 이어붙인다. 기존 V1~V13 무편집 → 체크섬 무간섭.
--
-- 파일 내 순서 강제: platform_revenue_ledger.sale_order_id 가 NOT NULL FK + UK 라 sale_order 를 먼저 만든다
--   (money_hold.bid_id 가 bid 를 선행하던 V11 선례와 동형).
--
-- 인덱스는 CREATE TABLE 안에 KEY 로 선언한다. FK 컬럼에 적합한 인덱스가 같은 문장에 이미 있으면 MySQL 이
--   FK 용 인덱스를 자동 생성하지 않으므로 중복 인덱스가 생기지 않는다(money_hold 선례).

-- 판매 성립(SOLD) 거래 레코드(erd §4.2). 경매 낙찰 + shop 구매·즉시구매를 source_type/source_id 폴리모픽으로
--   단일 핸드오프 수렴시킨다(코어는 source_type=AUCTION 만 기록). 정산·소유이전 단일 TX(D-053).
-- append-only — SETTLED 로 한 번 기록되고 이후 갱신되지 않는다(상태 전이 없음) → updated_at 미보유
--   (BaseCreatedEntity, item_ownership_history 선례). status·settled_at 은 도메인 값이다.
-- fee_amount 는 SOLD 성립분에만 생성되므로 NOT NULL(취소·유찰은 sale_order 미생성 → 수수료 없음, erd v1.3 델타).
-- (source_type, source_id) UK 가 동일 경매의 이중 SOLD 핸드오프를 DB 에서 차단한다(이중 정산 방지, §6 I-C).
CREATE TABLE sale_order
(
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    public_id          CHAR(26)    NOT NULL,
    source_type        VARCHAR(20) NOT NULL,
    source_id          BIGINT      NOT NULL,
    buyer_id           BIGINT      NOT NULL,
    seller_id          BIGINT      NOT NULL,
    item_instance_id   BIGINT      NOT NULL,
    final_price        BIGINT      NOT NULL,
    fee_amount         BIGINT      NOT NULL,
    settle_amount      BIGINT      NOT NULL,
    fee_policy_version VARCHAR(10) NOT NULL,
    status             VARCHAR(20) NOT NULL,
    settled_at         DATETIME(6) NOT NULL,
    created_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sale_order_public_id (public_id),
    -- 이중 SOLD 핸드오프 DB 차단(I-C) + 출처 리스팅 역참조.
    UNIQUE KEY uk_sale_order_source (source_type, source_id),
    -- 구매/판매 거래 내역 조회(후속 GET /me/orders). fk_sale_order_buyer/seller 의 FK 인덱스도 겸한다.
    KEY ix_sale_order_buyer (buyer_id),
    KEY ix_sale_order_seller (seller_id),
    -- 금액 부호 방어선(심층방어). 낙찰가는 양수, 수수료·정산액은 음수가 될 수 없다(fee-policy-spec).
    CONSTRAINT ck_sale_order_final_price_positive CHECK (final_price > 0),
    CONSTRAINT ck_sale_order_fee_amount_nonneg CHECK (fee_amount >= 0),
    CONSTRAINT ck_sale_order_settle_amount_nonneg CHECK (settle_amount >= 0),
    CONSTRAINT fk_sale_order_buyer FOREIGN KEY (buyer_id) REFERENCES user (id),
    CONSTRAINT fk_sale_order_seller FOREIGN KEY (seller_id) REFERENCES user (id),
    CONSTRAINT fk_sale_order_item FOREIGN KEY (item_instance_id) REFERENCES item_instance (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 사업자 수익 원장(④-C 확정). SOLD 정산 1건당 수수료(fee_amount)를 1행 적립하는 append-only 원장.
--   "사업자 게임머니 총수익 = SUM(amount)" 의 정본이며 게임머니 총량 보존(§6 I-H)의 회계 한 축이다.
--   플랫폼을 user 로 두지 않아(거래 주체 오염 회피) 전용 원장으로 분리한다(money_hold·money_exchange 선례).
-- sale_order_id UK 가 정산 1:1 을 강제해 수수료 이중 적립을 DB 에서 차단한다(I-C·I-H 연동).
-- public_id 없음(내부 회계 원장, 외부 노출 리소스 아님). 불변 원장이라 updated_at 없음(BaseCreatedEntity).
CREATE TABLE platform_revenue_ledger
(
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    sale_order_id      BIGINT      NOT NULL,
    amount             BIGINT      NOT NULL,
    fee_policy_version VARCHAR(10) NOT NULL,
    created_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    -- 정산 1:1 + 수수료 이중 적립 DB 차단(I-H). 조회·정합 겸용이라 별도 보조 인덱스 불요.
    --   fk_platform_revenue_ledger_sale_order 의 FK 인덱스도 이 UK 가 겸한다.
    UNIQUE KEY uk_platform_revenue_ledger_sale_order (sale_order_id),
    CONSTRAINT ck_platform_revenue_ledger_amount_nonneg CHECK (amount >= 0),
    CONSTRAINT fk_platform_revenue_ledger_sale_order FOREIGN KEY (sale_order_id) REFERENCES sale_order (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
