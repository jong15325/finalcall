-- item 도메인(FC-022): 임시보관(오버플로우) + slot 유일성/커서 인덱스. erd v0.9 §4.3·§5 정합.
-- append-only 원칙상 V7 다음(V8)로 이어붙인다. instance 시드(V9)는 slot_key UK 이후 실행이라 배정이 안전하다.

-- 임시보관(location=TEMP 일 때만 행 존재, 1:1). 상한 없음. 회수 규칙(expire_at) 미확정 → 이연.
-- insert + delete 만 있고 갱신 생애주기가 없어 updated_at 없음(BaseCreatedEntity, erd §4.3).
CREATE TABLE temp_storage
(
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    instance_id BIGINT      NOT NULL,
    owner_id    BIGINT      NOT NULL,
    stored_at   DATETIME(6) NOT NULL,
    expire_at   DATETIME(6) NULL,
    created_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_temp_storage_instance (instance_id),
    CONSTRAINT fk_temp_storage_instance FOREIGN KEY (instance_id) REFERENCES item_instance (id),
    CONSTRAINT fk_temp_storage_owner FOREIGN KEY (owner_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- G3: 사용자 임시보관 목록 + cursor 안정 정렬((stored_at desc, instance_id desc)) 커버. 계약 §4.2.
CREATE INDEX ix_temp_storage_owner_cursor ON temp_storage (owner_id, stored_at, instance_id);

-- G2: slot 유일성 생성 컬럼 UK(D-081 패턴 응용). INVENTORY 행만 값 → (owner, slot) 유일, 그 외 NULL(다중 허용).
--   relocate/인벤토리 복귀 동시성의 이중 배정을 DB 가 최종 차단한다("정합성은 DB", spec §3.2·§8).
--   생성 컬럼·문법은 MySQL 8.0 기준. slot_no·owner_id 는 원본 컬럼을 그대로 두고 UK 만 생성 컬럼에 건다.
ALTER TABLE item_instance
    ADD COLUMN slot_key VARCHAR(40) GENERATED ALWAYS AS (
        IF(location = 'INVENTORY', CONCAT(owner_id, '-', slot_no), NULL)
    ) STORED;
ALTER TABLE item_instance
    ADD UNIQUE KEY uk_item_instance_slot (slot_key);
