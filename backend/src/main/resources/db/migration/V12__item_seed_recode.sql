-- item 시드 재작성·확장(FC-052). V9 시드를 교정하고 아트 커버리지를 채운다.
-- ★ append-only 규율(FC-035 m9): V9 를 편집하지 않고 V12 로 이어붙인다. 스키마 무변경(컬럼·UK·인덱스 무접촉).
--
-- 1) FC-044 D2 집행 — 자리 의미 교정(게이트2 승인 2026-07-19, 계약 v1.10 §3.3.1).
--    원본 itm_type = [상품군][대분류][속성][종류] 인데 V9 는 두 선두 자리를 뒤바꿔 채웠다.
--    교정: main_category = 1 고정(상품군 = 아이템 카드) · sub_group = 1 무기 / 2 방어구 / 3 마법.
--    산식(main*1000 + sub*100 + element*10 + kind)·컬럼·UK 는 무변경이고 데이터만 바뀐다.
--    부수 효과: 2111~2122 가 원본 SILVER(2xxx) 대역을 침범하던 충돌이 소멸한다.
--    표시명도 원본 kind 정의에 맞춰 정정한다(원본 kind1 = AXE 라 기존 "물의 검"은 실제로 도끼다).
--
-- 2) 아트 커버리지 확장 — 카드 아트가 실제로 존재하는 조합만 넣는다.
--    아트 경로: docs/game_ui/item_info/card_image/gold_black/level{1~9}/{l|s}/{water|fire|earth|wind}/{9종}.png
--    전수 확인 결과 9레벨 × 2크기 × 4속성 × 9물리종류 = 648 파일이 빠짐없이 존재한다.
--    코드 조합은 무기 16 + 방어구 16 + 마법 8 = 40 종이고, 마법 kind 1(일반)·2(특수)가 magic.png 를
--    공유하므로(D5) 40 종 전부 아트가 있다. → 템플릿을 40 종 전수로 채운다.
--    레벨은 아트에 구워져 있어(level1~9 가 서로 다른 스프라이트) 인스턴스 레벨을 1~9 로 흩뿌린다.

-- ---------------------------------------------------------------------------
-- 1) 기존 템플릿 8건 교정. type_code 를 바꾸는 4건은 방어구(sub_group=2) 대역으로 이동한다.
--    UPDATE 라 item_instance.template_id FK 는 그대로 유지된다(인스턴스 재작성 불요).
--    이동 목적지(1211·1212·1221·1222)는 이 시점에 비어 있어 type_code UK·축 UK 모두 충돌하지 않는다.
-- ---------------------------------------------------------------------------

-- 1-1) 표시명만 정정(코드 동일). 원본 무기 kind: 1 AXE · 2 WAND.
UPDATE item_template SET display_name = '물의 도끼', updated_at = '2026-07-19 00:00:00' WHERE type_code = 1111;
UPDATE item_template SET display_name = '물의 완드', updated_at = '2026-07-19 00:00:00' WHERE type_code = 1112;
UPDATE item_template SET display_name = '불의 도끼', updated_at = '2026-07-19 00:00:00' WHERE type_code = 1121;
UPDATE item_template SET display_name = '불의 완드', updated_at = '2026-07-19 00:00:00' WHERE type_code = 1122;

-- 1-2) 코드 변경 4건(2xxx → 12xx). 원본 방어구 kind: 1 SHIELD · 2 PENDANT.
UPDATE item_template
SET main_category = 1, sub_group = 2, element = 1, kind = 1, type_code = 1211,
    display_name = '물의 방패', updated_at = '2026-07-19 00:00:00'
WHERE type_code = 2111;
UPDATE item_template
SET main_category = 1, sub_group = 2, element = 1, kind = 2, type_code = 1212,
    display_name = '물의 펜던트', updated_at = '2026-07-19 00:00:00'
WHERE type_code = 2112;
UPDATE item_template
SET main_category = 1, sub_group = 2, element = 2, kind = 1, type_code = 1221,
    display_name = '불의 방패', updated_at = '2026-07-19 00:00:00'
WHERE type_code = 2121;
UPDATE item_template
SET main_category = 1, sub_group = 2, element = 2, kind = 2, type_code = 1222,
    display_name = '불의 펜던트', updated_at = '2026-07-19 00:00:00'
WHERE type_code = 2122;

-- ---------------------------------------------------------------------------
-- 2) 템플릿 확장 32건 — 위 8건과 합쳐 상품군 1 대역 40종 전수. 전부 아트 존재 조합이다.
--    무기(sub 1) kind: 1 도끼 · 2 완드 · 3 검 · 4 활
--    방어구(sub 2) kind: 1 방패 · 2 펜던트 · 3 갑옷 · 4 신발
--    마법(sub 3) kind: 1 일반 · 2 특수 (2값뿐 — kind 3·4 는 성립 불가 조합이라 넣지 않는다)
-- ---------------------------------------------------------------------------
INSERT INTO item_template (main_category, sub_group, element, kind, type_code, display_name, created_at, updated_at)
VALUES (1, 1, 1, 3, 1113, '물의 검', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 1, 4, 1114, '물의 활', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 2, 3, 1123, '불의 검', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 2, 4, 1124, '불의 활', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 3, 1, 1131, '흙의 도끼', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 3, 2, 1132, '흙의 완드', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 3, 3, 1133, '흙의 검', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 3, 4, 1134, '흙의 활', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 4, 1, 1141, '바람의 도끼', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 4, 2, 1142, '바람의 완드', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 4, 3, 1143, '바람의 검', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 1, 4, 4, 1144, '바람의 활', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 1, 3, 1213, '물의 갑옷', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 1, 4, 1214, '물의 신발', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 2, 3, 1223, '불의 갑옷', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 2, 4, 1224, '불의 신발', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 3, 1, 1231, '흙의 방패', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 3, 2, 1232, '흙의 펜던트', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 3, 3, 1233, '흙의 갑옷', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 3, 4, 1234, '흙의 신발', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 4, 1, 1241, '바람의 방패', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 4, 2, 1242, '바람의 펜던트', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 4, 3, 1243, '바람의 갑옷', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 2, 4, 4, 1244, '바람의 신발', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 3, 1, 1, 1311, '물의 일반 마법', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 3, 1, 2, 1312, '물의 특수 마법', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 3, 2, 1, 1321, '불의 일반 마법', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 3, 2, 2, 1322, '불의 특수 마법', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 3, 3, 1, 1331, '흙의 일반 마법', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 3, 3, 2, 1332, '흙의 특수 마법', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 3, 4, 1, 1341, '바람의 일반 마법', '2026-07-19 00:00:00', '2026-07-19 00:00:00'),
       (1, 3, 4, 2, 1342, '바람의 특수 마법', '2026-07-19 00:00:00', '2026-07-19 00:00:00');

-- ---------------------------------------------------------------------------
-- 3) item_instance 확장 32건 — 위에서 새로 넣은 템플릿 32종에 1:1 대응(전 템플릿이 실물을 갖는다).
--    소유자·위치는 V9 와 동일하게 seed_seller / INVENTORY. slot_no 10~41 로 이어 붙인다
--    (V9 가 0~9 를 썼고 정원은 96 이라 여유. slot_key UK(V8) 는 (owner, slot) 유일이므로 충돌 없음).
--    public_id 는 V9 패턴 'SEEDITEM' + 18자리 0패딩을 이어받아 011~042.
--    FK 는 자연키(type_code·login_id·skill_code) 조인으로 건다 — auto_increment id 에 의존하지 않는다.
--    레벨은 1~9 를 고르게 흩뿌린다(아트가 레벨별로 달라 시각 다양성이 여기서 나온다).
--    ★ 첫 UNION 분기는 모든 컬럼을 non-null 로 두어 파생 테이블 컬럼 타입이 NULL 로 추론되지 않게 한다.
-- ---------------------------------------------------------------------------
INSERT INTO item_instance (public_id, template_id, owner_id, level, skill1_id, skill2_id, skill_percent,
                           gf_expire_at, location, slot_no, created_at, updated_at)
SELECT s.public_id, t.id, u.id, s.lvl, k1.id, k2.id, s.skill_percent,
       s.gf_expire_at, 'INVENTORY', s.slot_no, '2026-07-19 00:00:00', '2026-07-19 00:00:00'
FROM (SELECT 'SEEDITEM000000000000000011' AS public_id, 1113 AS type_code, 9 AS lvl, 100 AS s1, 110 AS s2,
             35 AS skill_percent, CAST('2026-09-01 00:00:00' AS DATETIME) AS gf_expire_at, 10 AS slot_no
      UNION ALL SELECT 'SEEDITEM000000000000000012', 1114, 5, 120, NULL, 18, NULL, 11
      UNION ALL SELECT 'SEEDITEM000000000000000013', 1123, 2, NULL, NULL, 0, NULL, 12
      UNION ALL SELECT 'SEEDITEM000000000000000014', 1124, 7, 130, 140, 42, '2026-10-05 00:00:00', 13
      UNION ALL SELECT 'SEEDITEM000000000000000015', 1131, 3, 110, NULL, 22, NULL, 14
      UNION ALL SELECT 'SEEDITEM000000000000000016', 1132, 8, 140, 100, 50, '2026-08-25 00:00:00', 15
      UNION ALL SELECT 'SEEDITEM000000000000000017', 1133, 1, NULL, NULL, 0, NULL, 16
      UNION ALL SELECT 'SEEDITEM000000000000000018', 1134, 6, 120, 130, 33, NULL, 17
      UNION ALL SELECT 'SEEDITEM000000000000000019', 1141, 4, 100, NULL, 15, '2026-11-10 00:00:00', 18
      UNION ALL SELECT 'SEEDITEM000000000000000020', 1142, 9, 110, 140, 47, NULL, 19
      UNION ALL SELECT 'SEEDITEM000000000000000021', 1143, 2, 130, NULL, 20, NULL, 20
      UNION ALL SELECT 'SEEDITEM000000000000000022', 1144, 5, NULL, NULL, 0, '2026-09-20 00:00:00', 21
      UNION ALL SELECT 'SEEDITEM000000000000000023', 1213, 8, 100, 120, 38, NULL, 22
      UNION ALL SELECT 'SEEDITEM000000000000000024', 1214, 3, 140, NULL, 12, NULL, 23
      UNION ALL SELECT 'SEEDITEM000000000000000025', 1223, 7, 110, 130, 45, '2026-10-15 00:00:00', 24
      UNION ALL SELECT 'SEEDITEM000000000000000026', 1224, 1, NULL, NULL, 0, NULL, 25
      UNION ALL SELECT 'SEEDITEM000000000000000027', 1231, 6, 120, NULL, 28, NULL, 26
      UNION ALL SELECT 'SEEDITEM000000000000000028', 1232, 4, 100, 140, 40, '2026-12-01 00:00:00', 27
      UNION ALL SELECT 'SEEDITEM000000000000000029', 1233, 9, 130, 110, 52, NULL, 28
      UNION ALL SELECT 'SEEDITEM000000000000000030', 1234, 2, NULL, NULL, 0, NULL, 29
      UNION ALL SELECT 'SEEDITEM000000000000000031', 1241, 8, 110, NULL, 24, '2026-08-30 00:00:00', 30
      UNION ALL SELECT 'SEEDITEM000000000000000032', 1242, 5, 140, 120, 36, NULL, 31
      UNION ALL SELECT 'SEEDITEM000000000000000033', 1243, 3, 100, NULL, 16, NULL, 32
      UNION ALL SELECT 'SEEDITEM000000000000000034', 1244, 7, 130, NULL, 30, '2026-11-25 00:00:00', 33
      UNION ALL SELECT 'SEEDITEM000000000000000035', 1311, 1, NULL, NULL, 0, NULL, 34
      UNION ALL SELECT 'SEEDITEM000000000000000036', 1312, 6, 120, 100, 44, NULL, 35
      UNION ALL SELECT 'SEEDITEM000000000000000037', 1321, 4, 110, NULL, 19, NULL, 36
      UNION ALL SELECT 'SEEDITEM000000000000000038', 1322, 9, 140, 130, 55, '2026-09-12 00:00:00', 37
      UNION ALL SELECT 'SEEDITEM000000000000000039', 1331, 2, 100, NULL, 14, NULL, 38
      UNION ALL SELECT 'SEEDITEM000000000000000040', 1332, 8, 130, 120, 41, NULL, 39
      UNION ALL SELECT 'SEEDITEM000000000000000041', 1341, 5, NULL, NULL, 0, NULL, 40
      UNION ALL SELECT 'SEEDITEM000000000000000042', 1342, 3, 110, 140, 26, '2026-10-28 00:00:00', 41) s
         JOIN item_template t ON t.type_code = s.type_code
         JOIN user u ON u.login_id = 'seed_seller'
         LEFT JOIN skill_definition k1 ON k1.skill_code = s.s1
         LEFT JOIN skill_definition k2 ON k2.skill_code = s.s2;

-- 4) 새 인스턴스의 소유 이력 첫 행(V9 6절과 동일 규약: 최초 발행이라 from_owner NULL·transfer_type SEED).
--    이미 이력이 있는 V9 인스턴스는 NOT EXISTS 로 제외해 중복 발행을 막는다.
INSERT INTO item_ownership_history (instance_id, from_owner_id, to_owner_id, transfer_type, sale_order_id,
                                    transferred_at, created_at)
SELECT ii.id, NULL, ii.owner_id, 'SEED', NULL, '2026-07-19 00:00:00', '2026-07-19 00:00:00'
FROM item_instance ii
WHERE ii.public_id LIKE 'SEEDITEM%'
  AND NOT EXISTS (SELECT 1 FROM item_ownership_history h WHERE h.instance_id = ii.id);
