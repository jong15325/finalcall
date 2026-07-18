-- item 도메인(FC-021): 개별 아이템 계층 — item_instance, item_ownership_history.
-- erd §4.3·§5·§7 정합. append-only 원칙상 V6 다음(V7)로 이어붙인다.
-- 위치 디스크리미네이터(플래그 B): location(INVENTORY/TEMP/LISTED). INVENTORY 일 때만 slot_no(0~95).
--   slot 유일성 생성 컬럼 UK(slot_key)는 FC-022(V8)에서 추가한다(instance 시드 V9 전에 안전 배치).
-- soft delete 없음(아이템은 소멸이 아니라 소유 이전·이력 보존, spec §2.3·G10) → BaseTimeEntity(시각만) 상속.
CREATE TABLE item_instance
(
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    public_id    CHAR(26)    NOT NULL,
    template_id  BIGINT      NOT NULL,
    owner_id     BIGINT      NOT NULL,
    level        INT         NOT NULL,
    skill1_id    BIGINT      NULL,
    skill2_id    BIGINT      NULL,
    skill_percent INT        NOT NULL,
    gf_expire_at DATETIME(6) NULL,
    location     VARCHAR(20) NOT NULL,
    slot_no      INT         NULL,
    created_at   DATETIME(6) NOT NULL,
    updated_at   DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_item_instance_public_id (public_id),
    CONSTRAINT fk_item_instance_template FOREIGN KEY (template_id) REFERENCES item_template (id),
    CONSTRAINT fk_item_instance_owner FOREIGN KEY (owner_id) REFERENCES user (id),
    CONSTRAINT fk_item_instance_skill1 FOREIGN KEY (skill1_id) REFERENCES skill_definition (id),
    CONSTRAINT fk_item_instance_skill2 FOREIGN KEY (skill2_id) REFERENCES skill_definition (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- erd §5 보조 인덱스.
-- 시세 집계 단위(market-prices)는 EPIC-ITEM 제외·이연(게이트2, sale_order 데이터 선행)이나 인덱스는 후속 대비 존치.
CREATE INDEX ix_item_instance_market ON item_instance (template_id, level, skill1_id, skill2_id);
-- 특수스킬 조합 필터(스킬만으로 매물 탐색).
CREATE INDEX ix_item_instance_skills ON item_instance (skill1_id, skill2_id);
-- 골드포스 활성/잔여 필터·정렬(D-066, 검색 전용).
CREATE INDEX ix_item_instance_gf ON item_instance (gf_expire_at);
-- 사용자 인벤토리 조회(정규 슬롯 나열), 위치별 분리.
CREATE INDEX ix_item_instance_owner_loc_slot ON item_instance (owner_id, location, slot_no);

-- 소유 이전 이력(append-only). 최초 발행 시 from_owner_id NULL.
-- sale_order_id 는 거래(TRADE) 이전일 때만 연계되나 sale_order 테이블은 group4(auction 에픽) — EPIC-ITEM 미존재(G7).
--   따라서 컬럼만 두고 FK 제약은 걸지 않는다(후속 에픽에서 FK 추가). EPIC-ITEM 트리거는 SEED 뿐.
-- append-only 라 updated_at 없음(spec §2.4). created_at(감사) + transferred_at(업무 시각) 보유.
CREATE TABLE item_ownership_history
(
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    instance_id    BIGINT      NOT NULL,
    from_owner_id  BIGINT      NULL,
    to_owner_id    BIGINT      NOT NULL,
    transfer_type  VARCHAR(20) NOT NULL,
    sale_order_id  BIGINT      NULL,
    transferred_at DATETIME(6) NOT NULL,
    created_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_ioh_instance FOREIGN KEY (instance_id) REFERENCES item_instance (id),
    CONSTRAINT fk_ioh_from_owner FOREIGN KEY (from_owner_id) REFERENCES user (id),
    CONSTRAINT fk_ioh_to_owner FOREIGN KEY (to_owner_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 인스턴스 소유 체인 조회(최초=첫 행). erd §5.
CREATE INDEX ix_ioh_instance_transferred ON item_ownership_history (instance_id, transferred_at);
