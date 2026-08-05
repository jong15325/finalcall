-- item_delivery 도메인(FC-186, EPIC-ITEM-DELIVERY): 장터 낙찰(SOLD)·즉시구매(BUYNOW) 아이템을 게임 캐릭터
--   인벤토리(new_sp.user_item)로 도착시키는 finalcall-native 내구 우편함(다리). 정본 = delivery-domain-spec v1.0 §7·erd v1.7 §4.4·§5·§6(group 6-a).
-- append-only 채번 규율(FC-035 m9): V20 다음(V21)으로 이어붙인다. 기존 V1~V20 무편집 → 체크섬 무간섭.
--
-- 하이브리드(§3): DB = 내구 정본, Redis = best-effort 알림(순수 Redis 기각, bid §8 정신 — 매체를 정확성 경계로 삼지 않는다).
-- 게임은 이 테이블을 DB 직접 CAS 로 claim/apply(웹 REST API 아님, 게이트2 형상 (b)·§5.2·§13). 웹 계약면 = 스키마·상태 머신·자족 스냅샷·item_uuid 멱등키.
-- append 원장(updated_at 없음 — 상태 시각은 claimed_at/applied_at 이 담음, item_ownership_history·platform_revenue_ledger 선례). soft delete 없음(상태 전이).
--
-- FK 선행: sale_order(V14)·item_instance(V7)·user(V3) 가 이미 존재한다. FK 컬럼에 적합한 인덱스가 같은 문장에 있으면
--   MySQL 이 FK 용 인덱스를 자동 생성하지 않는다(V14 선례): sale_order_id 는 UK, recipient_user_id 는 (recipient_user_id,status)
--   인덱스가 겸한다. item_instance_id 는 겸하는 인덱스가 없어 MySQL 이 FK 용 인덱스를 자동 생성한다(배송 대상 역참조는 저빈도).
CREATE TABLE item_delivery
(
    id                BIGINT      NOT NULL AUTO_INCREMENT,
    public_id         CHAR(26)    NOT NULL,
    sale_order_id     BIGINT      NOT NULL,
    item_instance_id  BIGINT      NOT NULL,
    recipient_user_id BIGINT      NOT NULL,
    recipient_nickname VARCHAR(16) NOT NULL,
    item_uuid         CHAR(40)    NOT NULL,
    type_code         INT         NOT NULL,
    level             INT         NOT NULL,
    skill1_code       INT         NULL,
    skill2_code       INT         NULL,
    skill_percent     INT         NOT NULL,
    gf_expire_at      DATETIME(6) NULL,
    status            VARCHAR(20) NOT NULL,
    claim_token       VARCHAR(40) NULL,
    claimed_at        DATETIME(6) NULL,
    applied_at        DATETIME(6) NULL,
    created_at        DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    -- 외부 노출 식별자(B-004). 구매자 배송 상태 조회(GET /me/deliveries) 경로 리소스. 대리키라 D-081 자연키 UK 패턴 불요.
    UNIQUE KEY uk_item_delivery_public_id (public_id),
    -- 정산 1:1. 이중 배송 생성을 DB 에서 차단(형상 (c) — 낙찰·즉시구매 양 경로가 SettlementRecorder 공통 꼬리에서 생성, platform_revenue_ledger 선례).
    --   fk_item_delivery_sale_order 의 FK 인덱스도 이 UK 가 겸한다.
    UNIQUE KEY uk_item_delivery_sale_order (sale_order_id),
    -- 멱등키(§5) — 게임 user_item.itm_uuid 로 이관, 중복 apply UK 차단(at-least-once 전달 + exactly-once 효과).
    UNIQUE KEY uk_item_delivery_item_uuid (item_uuid),
    -- poller 가 PENDING/DEFERRED 를 오래된 순 스캔 + 리스 만료 재청구 sweeper 스캔(closing findClosableIds 선례, erd §5).
    KEY ix_item_delivery_status_created (status, created_at),
    -- 접속 시 claim(플레이어별 대기 배송) + Redis 신호 수신 시 조회 + 구매자 배송 상태 조회(recipient 스코프). FK 인덱스도 겸한다.
    KEY ix_item_delivery_recipient_status (recipient_user_id, status),
    CONSTRAINT fk_item_delivery_sale_order FOREIGN KEY (sale_order_id) REFERENCES sale_order (id),
    CONSTRAINT fk_item_delivery_item_instance FOREIGN KEY (item_instance_id) REFERENCES item_instance (id),
    CONSTRAINT fk_item_delivery_recipient FOREIGN KEY (recipient_user_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- item_instance.location 에 IN_GAME 값 추가(게이트2 형상 (a) — 별도 상태축 기각, erd §4.3·§9.2).
--   location 은 VARCHAR(20)(V7)에 @Enumerated(EnumType.STRING) 매핑이라 값 추가는 애플리케이션 enum(ItemLocation)만 변경하면 되고
--   DDL 변경이 없다(기존 데이터 무영향). slot_key 생성 컬럼(IF(location='INVENTORY', ...))도 IN_GAME 은 INVENTORY 가 아니므로
--   자동으로 NULL 이 되어 XOR 불변식(IN_GAME ⇒ slot_no NULL·slot_key NULL)을 유지한다. 별도 ALTER 불요.
