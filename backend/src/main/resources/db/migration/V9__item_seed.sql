-- item 도메인(FC-023): 최소 시드. 진입 경로 = 시드-only(게이트2). erd §6 group5, spec §8.1 배치.
-- 생성 순서(FK 선행): seed user(+user_balance) → item_template → skill_definition → item_instance → item_ownership_history.
-- member 시드 부재 해소: user 는 signup 으로만 생성되므로(현 마이그레이션에 user 시드 없음) 시드가 소유자부터 만든다.
-- FK 참조는 자연키 서브쿼리(login_id·type_code·skill_code)·public_id 패턴으로 건다 — auto_increment id 에 의존하지 않아 견고.
-- slot_key UK(V8) 이후 실행이라 slot 배정이 안전하다(instance 는 전부 INVENTORY, slot 0~9 유일).
-- public_id 는 CHAR(26) — 'SEEDITEM' + 18자리 0패딩 인덱스(고정 26자, 유일). 대량·정밀 실데이터(원게임)는 이연(D-067).

-- 1) seed user 2명. 비밀번호는 BCrypt 더미 해시(로컬용, 평문 "password"). 생성 컬럼(login_id_active 등)은 미기재.
INSERT INTO user (public_id, login_id, password_hash, nickname, is_admin, is_deleted, created_at, updated_at)
VALUES ('SEEDUSER000000000000000001', 'seed_seller',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '경매장주인', 0, 0,
        '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       ('SEEDUSER000000000000000002', 'seed_buyer',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '아이템수집가', 0, 0,
        '2026-07-18 00:00:00', '2026-07-18 00:00:00');

-- 2) 각 seed user 의 잔액(1:1). 가용 게임머니를 넉넉히 부여(후속 경매/입찰 시연 공급).
INSERT INTO user_balance (user_id, cash_balance, game_money_balance, game_money_held, created_at, updated_at)
SELECT id, 1000000, 5000000, 0, '2026-07-18 00:00:00', '2026-07-18 00:00:00'
FROM user
WHERE login_id IN ('seed_seller', 'seed_buyer');

-- 3) item_template 8건 (대분류2 × 종류2 × 속성2, sub_group 고정=1). type_code = main*1000+sub*100+element*10+kind.
INSERT INTO item_template (main_category, sub_group, element, kind, type_code, display_name, created_at, updated_at)
VALUES (1, 1, 1, 1, 1111, '물의 검', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (1, 1, 1, 2, 1112, '물의 도', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (1, 1, 2, 1, 1121, '불의 검', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (1, 1, 2, 2, 1122, '불의 도', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (2, 1, 1, 1, 2111, '물의 방패', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (2, 1, 1, 2, 2112, '물의 갑옷', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (2, 1, 2, 1, 2121, '불의 방패', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (2, 1, 2, 2, 2122, '불의 갑옷', '2026-07-18 00:00:00', '2026-07-18 00:00:00');

-- 4) skill_definition 5건 (skill_code 100~140).
INSERT INTO skill_definition (skill_code, name, description, created_at, updated_at)
VALUES (100, '치명타', '일정 확률로 치명타 발생', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (110, '흡혈', '피해량의 일부를 체력으로 회복', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (120, '관통', '방어력 일부 무시', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (130, '보호막', '피격 시 보호막 생성', '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
       (140, '신속', '이동/공격 속도 증가', '2026-07-18 00:00:00', '2026-07-18 00:00:00');

-- 5) item_instance 10건. 전부 seed_seller 소유·location=INVENTORY·slot_no 0~9. 스킬/레벨/골드포스는 다양하게.
--    FK 는 자연키 서브쿼리로 연결(다른 테이블 참조라 VALUES 서브쿼리 허용). slot_key(생성 컬럼)는 미기재.
INSERT INTO item_instance (public_id, template_id, owner_id, level, skill1_id, skill2_id, skill_percent,
                           gf_expire_at, location, slot_no, created_at, updated_at)
VALUES
('SEEDITEM000000000000000001', (SELECT id FROM item_template WHERE type_code = 1111),
 (SELECT id FROM user WHERE login_id = 'seed_seller'), 1,
 (SELECT id FROM skill_definition WHERE skill_code = 100), NULL, 10,
 NULL, 'INVENTORY', 0, '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
('SEEDITEM000000000000000002', (SELECT id FROM item_template WHERE type_code = 1112),
 (SELECT id FROM user WHERE login_id = 'seed_seller'), 3,
 (SELECT id FROM skill_definition WHERE skill_code = 110),
 (SELECT id FROM skill_definition WHERE skill_code = 120), 25,
 '2026-08-18 00:00:00', 'INVENTORY', 1, '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
('SEEDITEM000000000000000003', (SELECT id FROM item_template WHERE type_code = 1121),
 (SELECT id FROM user WHERE login_id = 'seed_seller'), 5,
 NULL, NULL, 0,
 NULL, 'INVENTORY', 2, '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
('SEEDITEM000000000000000004', (SELECT id FROM item_template WHERE type_code = 1122),
 (SELECT id FROM user WHERE login_id = 'seed_seller'), 7,
 (SELECT id FROM skill_definition WHERE skill_code = 130),
 (SELECT id FROM skill_definition WHERE skill_code = 140), 40,
 '2026-09-18 00:00:00', 'INVENTORY', 3, '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
('SEEDITEM000000000000000005', (SELECT id FROM item_template WHERE type_code = 2111),
 (SELECT id FROM user WHERE login_id = 'seed_seller'), 2,
 (SELECT id FROM skill_definition WHERE skill_code = 100), NULL, 15,
 NULL, 'INVENTORY', 4, '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
('SEEDITEM000000000000000006', (SELECT id FROM item_template WHERE type_code = 2112),
 (SELECT id FROM user WHERE login_id = 'seed_seller'), 9,
 (SELECT id FROM skill_definition WHERE skill_code = 120),
 (SELECT id FROM skill_definition WHERE skill_code = 130), 55,
 '2026-10-18 00:00:00', 'INVENTORY', 5, '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
('SEEDITEM000000000000000007', (SELECT id FROM item_template WHERE type_code = 2121),
 (SELECT id FROM user WHERE login_id = 'seed_seller'), 4,
 NULL, NULL, 0,
 NULL, 'INVENTORY', 6, '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
('SEEDITEM000000000000000008', (SELECT id FROM item_template WHERE type_code = 2122),
 (SELECT id FROM user WHERE login_id = 'seed_seller'), 6,
 (SELECT id FROM skill_definition WHERE skill_code = 140),
 (SELECT id FROM skill_definition WHERE skill_code = 100), 30,
 NULL, 'INVENTORY', 7, '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
('SEEDITEM000000000000000009', (SELECT id FROM item_template WHERE type_code = 1111),
 (SELECT id FROM user WHERE login_id = 'seed_seller'), 8,
 (SELECT id FROM skill_definition WHERE skill_code = 110), NULL, 20,
 '2026-11-18 00:00:00', 'INVENTORY', 8, '2026-07-18 00:00:00', '2026-07-18 00:00:00'),
('SEEDITEM000000000000000010', (SELECT id FROM item_template WHERE type_code = 2111),
 (SELECT id FROM user WHERE login_id = 'seed_seller'), 1,
 NULL, NULL, 5,
 NULL, 'INVENTORY', 9, '2026-07-18 00:00:00', '2026-07-18 00:00:00');

-- 6) item_ownership_history 첫 행(각 인스턴스 1행). 최초 발행이라 from_owner NULL·transfer_type SEED·sale_order NULL.
INSERT INTO item_ownership_history (instance_id, from_owner_id, to_owner_id, transfer_type, sale_order_id,
                                    transferred_at, created_at)
SELECT ii.id, NULL, ii.owner_id, 'SEED', NULL, '2026-07-18 00:00:00', '2026-07-18 00:00:00'
FROM item_instance ii
WHERE ii.public_id LIKE 'SEEDITEM%';
