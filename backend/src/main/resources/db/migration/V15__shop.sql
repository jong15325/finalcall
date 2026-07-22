-- shop 도메인(FC-093, EPIC-SHOP): 고정가 마켓 애그리거트 — shop 테이블 최초 생성(erd v1.4 §4.2·§5, group4 이연분).
-- append-only 채번 규율(FC-035 m9): V14 다음(V15)으로 이어붙인다. 기존 V1~V14 무편집 → 체크섬 무간섭.
-- 상태(status)는 FSM 4값(ACTIVE/SOLD/EXPIRED/CANCELLED). 종료 3종은 모두 ACTIVE 에서만 진입(shop-spec §2.1).
-- end_at 은 nullable — 등록 시 서버가 now + shop.listing.default-duration-days(기본 7일)로 자동 계산해 채운다.
--   NULL(무기한)은 향후 "무기한 노출 캐시아이템" 전용이며 만료 워커가 end_at IS NOT NULL 로 스캔 제외한다(shop-spec §3.1·§4.4).
-- soft delete 없음(종료 상태로 보존) → BaseTimeEntity(created_at/updated_at)만 상속.
-- 정산 꼬리(sale_order·platform_revenue_ledger)는 V14 재사용 — source_type=SHOP 실사용만 시작(스키마 무변경).
CREATE TABLE shop
(
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    public_id          CHAR(26)     NOT NULL,
    seller_id          BIGINT       NOT NULL,
    item_instance_id   BIGINT       NOT NULL,
    price              BIGINT       NOT NULL,
    status             VARCHAR(20)  NOT NULL,
    end_at             DATETIME(6)  NULL,
    item_name_snapshot VARCHAR(100) NOT NULL,
    item_spec_snapshot VARCHAR(255) NOT NULL,
    created_at         DATETIME(6)  NOT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_shop_public_id (public_id),
    -- 만료 워커 후보 스캔(status=ACTIVE AND end_at<=now, D-057) 커버. 판매자 목록의 status 축도 겸한다.
    KEY ix_shop_status_end_at (status, end_at),
    -- 판매자 고정가 목록. fk_shop_seller 의 FK 인덱스도 이 복합이 겸한다(seller_id 선두).
    KEY ix_shop_seller_status (seller_id, status),
    -- 출품 아이템 역참조(에스크로 상태 확인, auction 대칭). fk_shop_item 의 FK 인덱스도 겸한다.
    KEY ix_shop_item_instance (item_instance_id),
    -- 가격 부호 방어선(심층방어). 고정 판매가는 양수다(앱 검증 @Positive 와 이중 방어, auction 선례).
    CONSTRAINT ck_shop_price_positive CHECK (price > 0),
    CONSTRAINT fk_shop_seller FOREIGN KEY (seller_id) REFERENCES user (id),
    CONSTRAINT fk_shop_item FOREIGN KEY (item_instance_id) REFERENCES item_instance (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
