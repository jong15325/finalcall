-- auction·bid 데모 시드(FC-053). 홈·경매목록·경매상세 세 화면의 시각 검증을 가능하게 하는 것이 유일한 목적이다.
-- ★ append-only 규율(FC-035 m9): V9~V12 를 편집하지 않고 V13 으로 이어붙인다. 스키마 무변경(컬럼·타입·인덱스·UK 무접촉).
-- 데이터 출처: V12 가 만든 item_instance 42건(전부 seed_seller 소유·INVENTORY) 중 20건을 경매로 돌린다.
--
-- ---------------------------------------------------------------------------
-- [A] 시간 기준 — 왜 NOW(6) 상대시간인가, 그리고 무엇이 만료되는가
-- ---------------------------------------------------------------------------
-- 마이그레이션은 DB 당 딱 한 번 실행되므로 고정 timestamp 를 박으면 며칠 뒤 전건이 "마감됨"이 되어 시드가 죽는다.
-- 그래서 모든 시각을 NOW(6) 기준 상대 오프셋(초)으로 계산한다 — 적용 시점이 곧 데모 기준시각이다.
--
-- ★ 그럼에도 만료되는 구간이 있다(감추지 않고 명시한다):
--   · 마감 여유(T+12분 ~ T+5일)  → 적용 후 수 시간~수 일 유효. 재적용 불요.
--   · 마감 임박(T-5분 구간, §5.9) → 적용 후 약 4분 30초만 유효.
--   · 마감 초임박(T-30초 구간)     → 적용 후 약 28초만 유효.
--   임박·초임박은 "지금부터 N초 뒤"라는 정의상 정적 데이터로 오래 유지할 방법이 없다. 긴 시간을 넣으면 그건
--   이미 임박이 아니다. 따라서 재적용 가능성을 시드 설계에 넣는 쪽을 택했다(아래 [B]).
--   · SOLD/UNSOLD/SCHEDULED 는 상대시간이 과거·미래로 충분히 멀어 수 일간 안정적이다.
--
-- ---------------------------------------------------------------------------
-- [B] 만료 시 재적용(re-anchor) 방법 — Flyway 재실행 없이 시드 시각만 현재로 당긴다
-- ---------------------------------------------------------------------------
-- 아래 4문장을 MySQL 세션에서 그대로 실행하면 시드 전체(경매·입찰·홀드)가 "지금"을 기준으로 재배치된다.
-- 상대 간격은 그대로 보존되므로 임박·초임박 경매가 다시 임박·초임박이 된다. 몇 번이든 반복 실행할 수 있다.
-- ★ 기준행 = 'SEEDAUCT000000000000000001'(created_at 이 적용 시점 NOW 와 정확히 일치하도록 심어 둔 앵커다).
-- ★ 반드시 아래 순서로 실행한다 — @seed_shift 를 먼저 확정하지 않으면 두 번째 UPDATE 이후 기준이 바뀐다.
--
--   SET @seed_shift := (SELECT TIMESTAMPDIFF(SECOND, created_at, NOW(6))
--                       FROM auction WHERE public_id = 'SEEDAUCT000000000000000001');
--
--   UPDATE auction
--      SET start_at    = DATE_ADD(start_at,    INTERVAL @seed_shift SECOND),
--          end_at      = DATE_ADD(end_at,      INTERVAL @seed_shift SECOND),
--          base_end_at = DATE_ADD(base_end_at, INTERVAL @seed_shift SECOND),
--          max_end_at  = DATE_ADD(max_end_at,  INTERVAL @seed_shift SECOND),
--          created_at  = DATE_ADD(created_at,  INTERVAL @seed_shift SECOND),
--          updated_at  = DATE_ADD(updated_at,  INTERVAL @seed_shift SECOND)
--    WHERE public_id LIKE 'SEEDAUCT%';
--
--   UPDATE bid
--      SET created_at = DATE_ADD(created_at, INTERVAL @seed_shift SECOND),
--          updated_at = DATE_ADD(updated_at, INTERVAL @seed_shift SECOND)
--    WHERE public_id LIKE 'SEEDBID0%';
--
--   UPDATE money_hold mh JOIN bid b ON b.id = mh.bid_id
--      SET mh.created_at  = DATE_ADD(mh.created_at,  INTERVAL @seed_shift SECOND),
--          mh.updated_at  = DATE_ADD(mh.updated_at,  INTERVAL @seed_shift SECOND),
--          mh.released_at = DATE_ADD(mh.released_at, INTERVAL @seed_shift SECOND)
--    WHERE b.public_id LIKE 'SEEDBID0%';
--
-- 금액·홀드·잔액·에스크로는 시각과 무관하므로 재적용이 정합을 깨지 않는다(어떤 상태 전이도 일으키지 않는다).
--
-- ---------------------------------------------------------------------------
-- [C] 불변식(bid-domain-spec §10 I1~I10) 준수 방법
-- ---------------------------------------------------------------------------
-- I1  경매당 bid.status='ACTIVE' 는 최대 1건이고 auction.highest_* 와 일치 → 각 체인의 마지막 입찰만
--     ACTIVE(종료 경매는 WON)로 두고, highest_bid_amount/highest_bidder_id 는 하드코딩하지 않고
--     "그 행에서 UPDATE 로 파생"시킨다(6절). 손으로 적어 어긋날 여지를 없앤다.
-- I2  입찰 금액은 체인 내 시각순 엄격 증가(아래 3절 데이터가 그렇게 배치돼 있다).
-- I3  경매당 money_hold.status='HELD' 는 최대 1건 → 홀드 상태를 bid.status 에서 기계적으로 파생한다
--     (ACTIVE→HELD, OUTBID→RELEASED, WON→CAPTURED). 즉 밀린 입찰의 홀드는 구조적으로 남지 않는다.
-- I4  user_balance.game_money_held == SUM(HELD) → 7절에서 홀드 원장을 SUM 해 잔액에 반영한다(역산 금지).
-- I5  0 <= held <= balance → seed 입찰자 잔액 500만, 홀드 합계는 seed_buyer 257,500 / seed_bidder 119,000.
-- I6  부분 커밋 없음 — 마이그레이션은 단일 실행 단위이고 실패 시 Flyway 가 전체를 실패로 남긴다.
-- I7  end_at <= max_end_at, extension_count = 0(연장 이력 없음) → max_end_at = end_at + 10분으로 고정.
-- I8  마감 경계는 런타임 규칙이라 시드가 위반할 여지가 없다(종료 경매의 마지막 입찰 시각 < end_at 로 배치).
-- I9  취소 경합은 런타임 규칙 — 시드는 CANCELLED 경매를 만들지 않는다.
-- I10 최고입찰자의 연속 재입찰 금지 → 모든 체인이 seed_buyer 와 seed_bidder 를 교대로 쓴다(연속 동일 없음).
--
-- 에스크로: 진행 가능(SCHEDULED·ACTIVE) 경매의 아이템만 LISTED·slot NULL(= markListedIfInInventory 결과와 동일),
--   SOLD 는 낙찰자 인벤토리로 이전(+TRADE 이력), UNSOLD 는 판매자 인벤토리 원위치 유지(에스크로 해제 결과).
-- 결제: SOLD(BID)는 money_hold CAPTURED 가 원장이므로 잔액을 차감한다(CAPTURED = "낙찰 차감", erd §4.1).
--   SOLD(BUYNOW)는 sale_order·정산이 EPIC-CLOSING 미구현이라 원장 행이 없다 → 잔액을 임의로 건드리지 않는다
--   (없는 원장을 시드가 발명하지 않는다). I1~I10 은 홀드 원장에 관한 것이라 이 생략으로 깨지지 않는다.

-- ---------------------------------------------------------------------------
-- 1) 입찰자 계정 1명 추가. seed_seller 는 자기 경매에 입찰할 수 없고(BID 규칙), 입찰자가 1명뿐이면
--    같은 사람이 연속 입찰하게 되어 I10 을 어기므로 교대 입찰이 가능하도록 두 번째 입찰자를 만든다.
--    비밀번호 해시는 V9 와 동일한 로컬 더미(평문 "password"). 생성 컬럼(login_id_active 등)은 미기재.
-- ---------------------------------------------------------------------------
INSERT INTO user (public_id, login_id, password_hash, nickname, is_admin, is_deleted, created_at, updated_at)
VALUES ('SEEDUSER000000000000000003', 'seed_bidder',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '한밤의사냥꾼', 0, 0,
        '2026-07-19 00:00:00', '2026-07-19 00:00:00');

INSERT INTO user_balance (user_id, cash_balance, game_money_balance, game_money_held, created_at, updated_at)
SELECT id, 1000000, 5000000, 0, '2026-07-19 00:00:00', '2026-07-19 00:00:00'
FROM user
WHERE login_id = 'seed_bidder';

-- ---------------------------------------------------------------------------
-- 2) auction 20건. 오프셋은 초 단위이며 음수 = 과거다.
--    상태 분포: ACTIVE 12(여유 8 · 임박 2 · 초임박 2) / SCHEDULED 3 / SOLD 3(BID 2 · BUYNOW 1) / UNSOLD 2.
--    buy_now_price: 10건 값 있음 · 10건 NULL("설정 없음" 자리 유지 확인용).
--    골드포스: 아이템 011·014·016·019·022·025·028 이 gf_expire_at 활성(§5.12 아웃라인 확인용).
--    highest_bid_amount·highest_bidder_id 는 여기서 NULL 로 두고 6절에서 입찰 원장으로부터 파생한다(I1).
--    ★ 첫 UNION 분기의 nullable 컬럼은 CAST 로 타입을 못 박는다 — 안 하면 파생 컬럼이 NULL 타입으로 추론된다.
--    ★ 'SEEDAUCT000000000000000001' 의 created_off = 0 이다. 이 행이 [B] 재적용의 시간 앵커다(변경 금지).
-- ---------------------------------------------------------------------------
INSERT INTO auction (public_id, seller_id, item_instance_id, start_price, buy_now_price, status, result_type,
                     highest_bid_amount, highest_bidder_id, start_at, end_at, base_end_at, max_end_at,
                     soft_close_window_sec, soft_close_extend_sec, extension_count,
                     item_name_snapshot, item_spec_snapshot, created_at, updated_at)
SELECT d.public_id, u.id, ii.id, d.start_price, d.buy_now_price, d.status, d.result_type,
       NULL, NULL,
       IF(d.start_off IS NULL, NULL, DATE_ADD(NOW(6), INTERVAL d.start_off SECOND)),
       DATE_ADD(NOW(6), INTERVAL d.end_off SECOND),
       DATE_ADD(NOW(6), INTERVAL d.end_off SECOND),
       DATE_ADD(NOW(6), INTERVAL (d.end_off + 600) SECOND),
       30, 30, 0,
       t.display_name,
       CONCAT('Lv.', ii.level,
              ' / skill1=', IFNULL(k1.skill_code, '-'), '/skill2=', IFNULL(k2.skill_code, '-'),
              ' / ', ii.skill_percent, '%',
              ' / GF=', IFNULL(DATE_FORMAT(ii.gf_expire_at, '%Y-%m-%dT%H:%i:%sZ'), '-')),
       DATE_ADD(NOW(6), INTERVAL d.created_off SECOND),
       DATE_ADD(NOW(6), INTERVAL d.created_off SECOND)
FROM (
    -- 마감 여유(ACTIVE)
    SELECT 'SEEDAUCT000000000000000001' AS public_id, 'SEEDITEM000000000000000011' AS item_public_id,
           150000 AS start_price, CAST(900000 AS SIGNED) AS buy_now_price, 'ACTIVE' AS status,
           CAST(NULL AS CHAR(20)) AS result_type, CAST(NULL AS SIGNED) AS start_off,
           259200 AS end_off, 0 AS created_off
    UNION ALL SELECT 'SEEDAUCT000000000000000002', 'SEEDITEM000000000000000012',
                      60000, NULL, 'ACTIVE', NULL, NULL, 172800, -14400
    UNION ALL SELECT 'SEEDAUCT000000000000000003', 'SEEDITEM000000000000000013',
                      20000, 120000, 'ACTIVE', NULL, NULL, 108000, -7200
    UNION ALL SELECT 'SEEDAUCT000000000000000004', 'SEEDITEM000000000000000014',
                      210000, NULL, 'ACTIVE', NULL, NULL, 64800, -86400
    UNION ALL SELECT 'SEEDAUCT000000000000000005', 'SEEDITEM000000000000000015',
                      35000, 300000, 'ACTIVE', NULL, NULL, 28800, -28800
    UNION ALL SELECT 'SEEDAUCT000000000000000006', 'SEEDITEM000000000000000016',
                      180000, 1200000, 'ACTIVE', NULL, NULL, 10800, -43200
    UNION ALL SELECT 'SEEDAUCT000000000000000007', 'SEEDITEM000000000000000017',
                      8000, NULL, 'ACTIVE', NULL, NULL, 2700, -10800
    UNION ALL SELECT 'SEEDAUCT000000000000000008', 'SEEDITEM000000000000000018',
                      95000, NULL, 'ACTIVE', NULL, NULL, 720, -21600
    -- 마감 임박(T-5분 구간)
    UNION ALL SELECT 'SEEDAUCT000000000000000009', 'SEEDITEM000000000000000019',
                      45000, 400000, 'ACTIVE', NULL, NULL, 270, -18000
    UNION ALL SELECT 'SEEDAUCT000000000000000010', 'SEEDITEM000000000000000020',
                      260000, NULL, 'ACTIVE', NULL, NULL, 180, -32400
    -- 마감 초임박(T-30초 구간)
    UNION ALL SELECT 'SEEDAUCT000000000000000011', 'SEEDITEM000000000000000021',
                      15000, 150000, 'ACTIVE', NULL, NULL, 28, -9000
    UNION ALL SELECT 'SEEDAUCT000000000000000012', 'SEEDITEM000000000000000022',
                      120000, NULL, 'ACTIVE', NULL, NULL, 12, -12600
    -- 미개시(SCHEDULED) — start_at 이 미래라 displayStatus 파생에서도 SCHEDULED 로 남는다(BID_007 확인용)
    UNION ALL SELECT 'SEEDAUCT000000000000000013', 'SEEDITEM000000000000000023',
                      88000, 500000, 'SCHEDULED', NULL, 7200, 172800, -3600
    UNION ALL SELECT 'SEEDAUCT000000000000000014', 'SEEDITEM000000000000000024',
                      24000, NULL, 'SCHEDULED', NULL, 21600, 259200, -5400
    UNION ALL SELECT 'SEEDAUCT000000000000000015', 'SEEDITEM000000000000000025',
                      175000, 1000000, 'SCHEDULED', NULL, 86400, 432000, -1800
    -- 종료 · 낙찰(SOLD)
    UNION ALL SELECT 'SEEDAUCT000000000000000016', 'SEEDITEM000000000000000026',
                      10000, NULL, 'SOLD', 'BID', NULL, -7200, -18000
    UNION ALL SELECT 'SEEDAUCT000000000000000017', 'SEEDITEM000000000000000027',
                      70000, 450000, 'SOLD', 'BID', NULL, -86400, -108000
    UNION ALL SELECT 'SEEDAUCT000000000000000018', 'SEEDITEM000000000000000028',
                      130000, 600000, 'SOLD', 'BUYNOW', NULL, -18000, -25200
    -- 종료 · 유찰(UNSOLD) — 입찰 0건으로 마감
    UNION ALL SELECT 'SEEDAUCT000000000000000019', 'SEEDITEM000000000000000029',
                      240000, NULL, 'UNSOLD', NULL, NULL, -10800, -86400
    UNION ALL SELECT 'SEEDAUCT000000000000000020', 'SEEDITEM000000000000000030',
                      18000, 90000, 'UNSOLD', NULL, NULL, -172800, -259200
) d
         JOIN item_instance ii ON ii.public_id = d.item_public_id
         JOIN item_template t ON t.id = ii.template_id
         JOIN user u ON u.login_id = 'seed_seller'
         LEFT JOIN skill_definition k1 ON k1.id = ii.skill1_id
         LEFT JOIN skill_definition k2 ON k2.id = ii.skill2_id;

-- ---------------------------------------------------------------------------
-- 3) bid 27건. 체인 규칙(위 [C] I2·I10):
--    · 같은 경매 안에서 금액은 시각순 엄격 증가한다.
--    · 입찰자는 seed_buyer 와 seed_bidder 가 반드시 교대한다(연속 동일 입찰자 없음).
--    · 체인의 마지막 1건만 ACTIVE(진행 경매) 또는 WON(낙찰 경매), 나머지는 전부 OUTBID 다.
--    · 첫 입찰 금액 = 시작가, 이후는 계단식 증가.
--    입찰이 붙은 경매 9건 / 입찰이 없는 경매 11건 → 목록에서 "입찰 없음·시작가"와 "현재가·입찰 N회"가 섞인다.
-- ---------------------------------------------------------------------------
INSERT INTO bid (public_id, auction_id, bidder_id, amount, status, created_at, updated_at)
SELECT d.public_id, a.id, u.id, d.amount, d.status,
       DATE_ADD(NOW(6), INTERVAL d.created_off SECOND),
       DATE_ADD(NOW(6), INTERVAL d.created_off SECOND)
FROM (
    -- A02(여유·3회)
    SELECT 'SEEDBID0000000000000000001' AS public_id, 'SEEDAUCT000000000000000002' AS auction_public_id,
           'seed_buyer' AS bidder, 60000 AS amount, 'OUTBID' AS status, -10800 AS created_off
    UNION ALL SELECT 'SEEDBID0000000000000000002', 'SEEDAUCT000000000000000002', 'seed_bidder', 66000, 'OUTBID', -7200
    UNION ALL SELECT 'SEEDBID0000000000000000003', 'SEEDAUCT000000000000000002', 'seed_buyer', 73000, 'ACTIVE', -3600
    -- A03(여유·1회)
    UNION ALL SELECT 'SEEDBID0000000000000000004', 'SEEDAUCT000000000000000003', 'seed_bidder', 20000, 'ACTIVE', -5400
    -- A05(여유·5회)
    UNION ALL SELECT 'SEEDBID0000000000000000005', 'SEEDAUCT000000000000000005', 'seed_buyer', 35000, 'OUTBID', -21600
    UNION ALL SELECT 'SEEDBID0000000000000000006', 'SEEDAUCT000000000000000005', 'seed_bidder', 38000, 'OUTBID', -18000
    UNION ALL SELECT 'SEEDBID0000000000000000007', 'SEEDAUCT000000000000000005', 'seed_buyer', 42000, 'OUTBID', -14400
    UNION ALL SELECT 'SEEDBID0000000000000000008', 'SEEDAUCT000000000000000005', 'seed_bidder', 47000, 'OUTBID', -9000
    UNION ALL SELECT 'SEEDBID0000000000000000009', 'SEEDAUCT000000000000000005', 'seed_buyer', 55000, 'ACTIVE', -1800
    -- A07(여유·2회)
    UNION ALL SELECT 'SEEDBID0000000000000000010', 'SEEDAUCT000000000000000007', 'seed_bidder', 8000, 'OUTBID', -4800
    UNION ALL SELECT 'SEEDBID0000000000000000011', 'SEEDAUCT000000000000000007', 'seed_buyer', 9500, 'ACTIVE', -900
    -- A09(임박·4회)
    UNION ALL SELECT 'SEEDBID0000000000000000012', 'SEEDAUCT000000000000000009', 'seed_buyer', 45000, 'OUTBID', -3600
    UNION ALL SELECT 'SEEDBID0000000000000000013', 'SEEDAUCT000000000000000009', 'seed_bidder', 52000, 'OUTBID', -2400
    UNION ALL SELECT 'SEEDBID0000000000000000014', 'SEEDAUCT000000000000000009', 'seed_buyer', 61000, 'OUTBID', -1200
    UNION ALL SELECT 'SEEDBID0000000000000000015', 'SEEDAUCT000000000000000009', 'seed_bidder', 70000, 'ACTIVE', -300
    -- A11(초임박·6회)
    UNION ALL SELECT 'SEEDBID0000000000000000016', 'SEEDAUCT000000000000000011', 'seed_buyer', 15000, 'OUTBID', -5400
    UNION ALL SELECT 'SEEDBID0000000000000000017', 'SEEDAUCT000000000000000011', 'seed_bidder', 17000, 'OUTBID', -4200
    UNION ALL SELECT 'SEEDBID0000000000000000018', 'SEEDAUCT000000000000000011', 'seed_buyer', 19500, 'OUTBID', -3000
    UNION ALL SELECT 'SEEDBID0000000000000000019', 'SEEDAUCT000000000000000011', 'seed_bidder', 22000, 'OUTBID', -1800
    UNION ALL SELECT 'SEEDBID0000000000000000020', 'SEEDAUCT000000000000000011', 'seed_buyer', 25000, 'OUTBID', -600
    UNION ALL SELECT 'SEEDBID0000000000000000021', 'SEEDAUCT000000000000000011', 'seed_bidder', 29000, 'ACTIVE', -120
    -- A12(초임박·1회)
    UNION ALL SELECT 'SEEDBID0000000000000000022', 'SEEDAUCT000000000000000012', 'seed_buyer', 120000, 'ACTIVE', -240
    -- A16(낙찰·3회) — 마지막이 WON. 전건 end_at(-7200) 이전 시각이다(I8).
    UNION ALL SELECT 'SEEDBID0000000000000000023', 'SEEDAUCT000000000000000016', 'seed_buyer', 10000, 'OUTBID', -14400
    UNION ALL SELECT 'SEEDBID0000000000000000024', 'SEEDAUCT000000000000000016', 'seed_bidder', 11500, 'OUTBID', -12600
    UNION ALL SELECT 'SEEDBID0000000000000000025', 'SEEDAUCT000000000000000016', 'seed_buyer', 13000, 'WON', -10800
    -- A17(낙찰·2회) — 전건 end_at(-86400) 이전 시각이다(I8).
    UNION ALL SELECT 'SEEDBID0000000000000000026', 'SEEDAUCT000000000000000017', 'seed_bidder', 70000, 'OUTBID', -93600
    UNION ALL SELECT 'SEEDBID0000000000000000027', 'SEEDAUCT000000000000000017', 'seed_buyer', 82000, 'WON', -90000
) d
         JOIN auction a ON a.public_id = d.auction_public_id
         JOIN user u ON u.login_id = d.bidder;

-- ---------------------------------------------------------------------------
-- 4) money_hold — 입찰 1건당 정확히 1건(uk_money_hold_bid). 상태를 bid.status 에서 기계적으로 파생해
--    "경매당 HELD ≤ 1"(I3)을 데이터가 아니라 규칙으로 보장한다.
--    released_at: RELEASED 는 자신을 밀어낸 상위 입찰의 시각(P-008 즉시 해제), CAPTURED 는 경매 마감 시각.
-- ---------------------------------------------------------------------------
INSERT INTO money_hold (user_id, bid_id, amount, status, released_at, created_at, updated_at)
SELECT b.bidder_id, b.id, b.amount,
       CASE b.status WHEN 'ACTIVE' THEN 'HELD' WHEN 'WON' THEN 'CAPTURED' ELSE 'RELEASED' END,
       CASE b.status
           WHEN 'ACTIVE' THEN NULL
           WHEN 'WON' THEN a.end_at
           ELSE (SELECT MIN(nx.created_at) FROM bid nx
                 WHERE nx.auction_id = b.auction_id AND nx.amount > b.amount)
       END,
       b.created_at, b.created_at
FROM bid b
         JOIN auction a ON a.id = b.auction_id
WHERE b.public_id LIKE 'SEEDBID0%';

-- 해제·차감된 홀드의 updated_at 을 실제 해제 시각에 맞춘다(생성 시각 그대로 두면 감사 시각이 거짓이 된다).
UPDATE money_hold mh
    JOIN bid b ON b.id = mh.bid_id
SET mh.updated_at = mh.released_at
WHERE b.public_id LIKE 'SEEDBID0%'
  AND mh.released_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5) 에스크로(item_instance.location) — 도메인 상태를 화면과 일치시킨다.
-- 5-1) 진행 가능(SCHEDULED·ACTIVE) 경매의 아이템은 LISTED·slot NULL.
--      = AuctionService 등록 경로의 markListedIfInInventory CAS 결과와 동일한 상태다.
--      상태 조건으로 대상을 고르므로 아이템 목록을 따로 손으로 적지 않는다(2절과 어긋날 여지 제거).
-- ---------------------------------------------------------------------------
UPDATE item_instance ii
    JOIN auction a ON a.item_instance_id = ii.id
SET ii.location = 'LISTED', ii.slot_no = NULL, ii.updated_at = NOW(6)
WHERE a.public_id LIKE 'SEEDAUCT%'
  AND a.status IN ('SCHEDULED', 'ACTIVE');

-- 5-2) 낙찰(SOLD) 아이템은 낙찰자 인벤토리로 이전한다. 낙찰자 슬롯은 비어 있어(신규 소유) 0·1 을 쓴다.
--      UNSOLD 아이템은 손대지 않는다 — 에스크로 해제 후 판매자 원래 슬롯에 그대로 남은 상태가 정답이다.
UPDATE item_instance ii
    JOIN auction a ON a.item_instance_id = ii.id
    JOIN (SELECT 'SEEDAUCT000000000000000016' AS auction_public_id, 'seed_buyer' AS winner, 0 AS slot_no
          UNION ALL SELECT 'SEEDAUCT000000000000000017', 'seed_buyer', 1
          UNION ALL SELECT 'SEEDAUCT000000000000000018', 'seed_bidder', 0) w
         ON w.auction_public_id = a.public_id
    JOIN user u ON u.login_id = w.winner
SET ii.owner_id = u.id, ii.location = 'INVENTORY', ii.slot_no = w.slot_no, ii.updated_at = NOW(6);

-- 5-3) 소유 이전 이력(append-only). sale_order 테이블은 EPIC-CLOSING 소유라 아직 없으므로 sale_order_id 는 NULL.
INSERT INTO item_ownership_history (instance_id, from_owner_id, to_owner_id, transfer_type, sale_order_id,
                                    transferred_at, created_at)
SELECT ii.id, a.seller_id, ii.owner_id, 'TRADE', NULL, a.end_at, a.end_at
FROM auction a
         JOIN item_instance ii ON ii.id = a.item_instance_id
WHERE a.public_id LIKE 'SEEDAUCT%'
  AND a.status = 'SOLD';

-- ---------------------------------------------------------------------------
-- 6) auction.highest_* 파생(I1) — 체인의 ACTIVE/WON 입찰에서 그대로 가져온다. 경매당 그런 행은 정확히 1건이라
--    조인이 다중 매칭되지 않는다. 입찰 없는 경매(11건)와 BUYNOW 낙찰은 조인에 걸리지 않아 NULL 로 남는다.
-- ---------------------------------------------------------------------------
UPDATE auction a
    JOIN (SELECT b.auction_id, b.bidder_id, b.amount
          FROM bid b
          WHERE b.public_id LIKE 'SEEDBID0%'
            AND b.status IN ('ACTIVE', 'WON')) top ON top.auction_id = a.id
SET a.highest_bid_amount = top.amount, a.highest_bidder_id = top.bidder_id, a.updated_at = NOW(6);

-- ---------------------------------------------------------------------------
-- 7) 잔액 정합(I4·I5) — 홀드 원장을 SUM 해서 잔액에 반영한다. 반대 방향(잔액을 적고 홀드를 맞추기)으로 하면
--    두 값이 갈라질 수 있으므로 원장을 단일 진실원으로 둔다.
-- 7-1) game_money_held = SUM(HELD). 시드 이전 두 계정의 홀드는 0이라 가산 결과가 곧 합계와 같다.
-- ---------------------------------------------------------------------------
UPDATE user_balance ub
    JOIN (SELECT mh.user_id, SUM(mh.amount) AS held_sum
          FROM money_hold mh
                   JOIN bid b ON b.id = mh.bid_id
          WHERE b.public_id LIKE 'SEEDBID0%'
            AND mh.status = 'HELD'
          GROUP BY mh.user_id) h ON h.user_id = ub.user_id
SET ub.game_money_held = ub.game_money_held + h.held_sum, ub.updated_at = NOW(6);

-- 7-2) CAPTURED(낙찰 차감)는 잔액에서 실제로 빠져나간 금액이다. 홀드에는 더하지 않았으므로 순효과는 차감뿐이다.
--      판매자 정산(입금)은 EPIC-CLOSING 미구현이라 시드가 임의로 만들지 않는다(위 [C] 결제 항 참조).
UPDATE user_balance ub
    JOIN (SELECT mh.user_id, SUM(mh.amount) AS captured_sum
          FROM money_hold mh
                   JOIN bid b ON b.id = mh.bid_id
          WHERE b.public_id LIKE 'SEEDBID0%'
            AND mh.status = 'CAPTURED'
          GROUP BY mh.user_id) c ON c.user_id = ub.user_id
SET ub.game_money_balance = ub.game_money_balance - c.captured_sum, ub.updated_at = NOW(6);
