# 게임 DB(`new_sp`) 전수 조사 — finalcall 재구성 기준 문서

상태: v0.1 (조사 초안) · 작성: 2026-08-01 · 성격: **읽기 전용 조사 산출물**(DB 무변경, SELECT/SHOW만 사용)

## 0. 개요·목적

finalcall DB가 장차 게임 서버가 쓰는 원본 스키마 `new_sp`를 대체한다. 게임 기능(메모·인벤토리·친구 등)을
finalcall 안에 네이티브 도메인으로 재구성하되, **게임 클라이언트는 수정 불가**이므로(서버만 재컴파일 가능)
클라가 기대하는 **고정 계약**(바이트 포맷·정수 패킹·고정폭 char·특정 코드값)은 finalcall boundary(에뮬레이터
서버 코드)에서 흡수해야 한다. 본 문서의 핵심 산출은 각 테이블/컬럼에서 **"클라 고정 계약으로 보존해야 할 것"
vs "finalcall 컨벤션으로 자유롭게 바꿔도 되는 것"** 을 구분하는 것이다.

### 조사 방법·대상
- 대상 스키마: **`new_sp`**(현재 게임). `old_sp`·`sp_2019`는 비대상.
- 방법: `docker exec finalcall-mysql mysql -uroot -proot --default-character-set=utf8mb4` 로
  `information_schema`(카탈로그) + `SHOW CREATE TABLE`(DDL) + 샘플 행(`CONCAT('[',col,']')` 경계 표시 ·
  `CHAR_LENGTH`/`LENGTH` 문자수 vs 바이트 · `GROUP BY` 코드 분포)를 조회.
- 인코딩 주의: 전 테이블 `DEFAULT CHARSET=utf8mb3`(구 utf8, 3바이트 BMP). 컬럼 COMMENT는 정상 조회됨(한글 OK).
  `usr_name`/`usr_pw`만 `utf8mb3_bin`(대소문자·자모 구분 정렬).

---

## 1. 전체 테이블 카탈로그

행수는 `information_schema`(근사) 기준, 핵심 테이블은 실측 병기(★). 용도는 컬럼·샘플로 추정.

| 테이블 | 행수 | 용도 추정 | 통합 관련도 |
|---|---|---|---|
| `user` | 2440★ | 계정·닉네임·재화·전적·인벤토리한도 마스터 | **핵심** |
| `user_item` | 5★ | 유저 아이템(인벤토리) 마스터 | **핵심** |
| `user_item_trash` | 22 | 삭제 아이템 보관(복구/감사용) | **핵심** |
| `user_equipments` | 4555★ | 유저 장착 슬롯(11부위) 1:1 | **핵심** |
| `user_memo` | 3897★ | 유저 간 메모(쪽지) | **핵심(메모 도메인 착수 대상)** |
| `user_friend` | 7 | 친구 목록(양방향, 복합PK) | **핵심** |
| `user_ban` | 0 | 제재(닉네임 기준, 만료일) | **핵심** |
| `user_active` | 2 | 현재 접속 세션(닉네임 PK, 휘발성) | **핵심** |
| `usershop_box` | 30 | 개인상점 매대(판매 등록) | 상점 |
| `usershop2_item_box` | 0 | 개인상점2 아이템 보관함 | 상점 |
| `log_usershop` | 215 | 개인상점 거래 로그 | 상점/로그 |
| `cardshop_bank` | 4 | 카드샵 예치금(유저별 잔액) | 재화/상점 |
| `cardshop_trans` | 36 | 카드샵 거래 이력 | 상점/로그 |
| `gameshop` | 492 | NPC 상점 카탈로그(아이템 정가) | 상점/시드 |
| `log_gameshop` | 20 | NPC 상점 구매 로그(재화 before/after) | 로그 |
| `gift_box` | 41 | 선물함(대기) | 선물 |
| `gift_item` | 0 | 선물 아이템 상세 | 선물 |
| `log_gift` | 157 | 선물 로그 | 로그 |
| `itembuylist` | 53 | 아이템 구매/전달 큐 | 상점/선물 |
| `log_access` | 1777 | 접속/해제 로그(재화 스냅샷 대량) | 로그 |
| `log_reward` | 171 | 보상 지급 로그(before/output/amount/after) | 로그 |
| `log_trade` | 28 | 1:1 교환 로그 | 로그 |
| `guild` / `guild_member` / `guild_position` / `guild_application` / `guild_occupy` / `guild_point` | 63/302/331/5/8/2 | 길드 체계 | 부가(후순위) |
| `web_article`/`web_reply`/`web_article_view`/`web_guest_book`/`web_guild_like`/`web_my_like` | 191/150/205/394/22/14 | 홈페이지(게시판·방명록·좋아요) | 웹(별개 관심사) |
| `set_*` (mode/npc/levelup/today_bonus/upgrade/weight/trainingitems/serverinfo) | 1~40 | 서버 정책·밸런스 시드 | 설정/시드 |

> 통합 우선순위는 **`user*` 8종 핵심 테이블**. `guild_*`·`web_*`·`log_*`·`set_*`는 후순위 또는 별개 관심사.

---

## 2. 핵심 테이블 심층 (DDL 요약 + 컬럼 + 클라 고정 계약 + 패킹)

### 2.1 `user` — 계정·재화·전적 마스터 (실측 2440행, AUTO_INCREMENT=4557)

컬럼(발췌): `usr_id smallint PK AI` · `usr_name varchar(16) utf8mb3_bin, KEY(비유니크!)` ·
`usr_pw varchar(16) utf8mb3_bin` · `usr_ip varchar(16)` · `usr_gender tinyint(1)` · `usr_char int` ·
`usr_level int unsigned` · `usr_type int unsigned` · `usr_points/usr_code bigint unsigned` ·
`usr_coins/usr_cash int unsigned` · `usr_water/fire/earth/wind int unsigned`(정령 4속성) ·
`usr_inventory smallint unsigned DEFAULT 24`(인벤 칸 수) · `usr_wins/losses/ko/down`(전적) ·
`usr_scroll1~3` · `usr_mission` · `usr_supporters` · `usr_admin tinyint unsigned` ·
`usr_chat_ban tinyint(1)` · `data_edit_time`(ON UPDATE) · `usr_today_bonus` · `create_date` ·
`delete_date` · `delete_yn tinyint unsigned`.

**클라 고정 계약(보존 필수)**
- `usr_name varchar(16)` **utf8mb3_bin**: 닉네임 최대 16자, **바이트/자모 구분 정렬**. 유니크 제약이
  아니라 **비유니크 KEY**다(중복 닉 이론상 가능 — 게임은 앱단 방어 추정). 메모·친구·상점·밴 등
  **거의 모든 관계 테이블이 이 닉네임 문자열을 자연키로 참조**한다(§4 리스크 R1).
- `usr_pw varchar(16)`: **평문 또는 16자 이내 해시**(길이상 bcrypt 불가). 로그인 프로토콜 계약.
- `usr_gender tinyint`: 실측 분포 `1`(남?)=2370, `0`=70. **0/1 두 값**. → 메모 패킹(§2.5)·상점 keeper_gender에 재사용.
- 재화 4종 + 정령 4속성 = **8종 지갑**을 클라가 개별 필드로 기대. `usr_code`(bigint, 거래 화폐) · `usr_cash`(캐시) ·
  `usr_coins` · `usr_points` · `water/fire/earth/wind`(정령).
- `usr_type` int: 접속 가능 채널(주석 "10:초보,20:중수,30:고수"). 실측 분포 0=2428, 10=4, 30=8.
- `usr_char` int DEFAULT 12: 주 캐릭터 코드(분포 10/80/20/90…). 캐릭터 외형 계약.

**자유 재구성 가능**: PK 타입(`smallint`는 32767 상한이라 오히려 위험 — finalcall `BIGINT`로 승격 권장),
컬럼 물리 배치, 감사 컬럼(`create_date`/`data_edit_time` → finalcall `created_at/updated_at DATETIME(6)`),
soft delete 표현(`delete_yn tinyint` → `is_deleted BIT`).

> 주의: 게임 내부에서조차 `user.usr_id`는 `smallint`인데 참조측(`user_item.itm_usr_id`)은 `int unsigned`로
> 타입 불일치. finalcall은 내부 PK를 `BIGINT`로 통일하되, **게임 클라에 노출되는 usr_id 값 범위(≤32767)**를
> 어댑터가 유지해야 할 수 있음(클라가 usr_id를 2바이트로 읽을 가능성 — 서버 소스 확인 필요, §5 미해결).

### 2.2 `user_item` — 아이템 인스턴스 (실측 5행, AUTO_INCREMENT=67545)

DDL: `itm_id int PK AI` · `itm_slot int unsigned`(인벤 슬롯번호) · `itm_usr_id int unsigned`(소유자 usr_id) ·
`itm_type int unsigned`(아이템 타입코드) · `itm_gf timestamp`(골드포스 만료시각) · `itm_level int unsigned` ·
`itm_skill int unsigned`(**패킹된 스킬값**) · `itm_uuid char(40)`(실측 36자 UUID) · `first_owner varchar(15)` ·
`before_owner varchar(15)` · `lastPurchaseType int unsigned` · `create_date`.
인덱스: `itm_usr_id`, `itm_type`, `itm_slot`(비유니크).

**클라 고정 계약(보존 필수)**
- **`itm_type` = 4자리 자리값 코드**(천/백/십/일 = 상품군/대분류/속성/종류). 예 `1111`=카드·무기·물·도끼,
  `1321`=카드·마법·불·종류1, `2001`=방어구계, `3004`. **finalcall `item_template.type_code`와 1:1**
  (spec §2.1 명시). 코드 사전 = `docs/spec/proposals/item-code-dictionary.md`, `new_sp.gameshop.itm_name`이
  타입→영문명 매핑의 원천(예 `1111`=`WEAPONE_WATER_AXE_*`).
- **`itm_skill int unsigned` = 패킹 정수**. 대부분 0이나 실측 `13387000` 발견 — 두 스킬 슬롯 + 발동확률을
  합성한 값으로 추정. finalcall은 이를 `skill1_id/skill2_id/skill_percent` 3필드로 분해(spec §2.3).
  **정확한 비트/자리 분해식은 게임 서버 소스 확인 필요**(§5 미해결 U1).
- `itm_uuid char(40)`: 실측 표준 36자 UUID(`3a7f1928-...`). 클라/거래 추적 식별자.
- `itm_gf timestamp`: 골드포스(임대 아이템) **만료 절대시각**. finalcall `gf_expire_at DATETIME(6)`.
- `itm_slot`: 인벤토리 슬롯 위치(0-based). 클라 인벤 렌더 계약.
- `first_owner`/`before_owner varchar(15)`: 소유 이력 **닉네임 문자열**(15자, usr_name 16자보다 1 짧음 — 주의).
- `lastPurchaseType`: 획득 경로 코드(실측 2·3; gameshop `purchase_type` 0=CARD/1=CHARGE와 관련 추정).

**finalcall 대응**: 이미 `item_instance`로 모델됨(§3). 단 게임은 **인벤/장착/삭제를 별도 테이블**로
분리(`user_item` / `user_equipments` / `user_item_trash`)하는데, finalcall은 **단일 테이블 +
`location` 디스크리미네이터(INVENTORY/TEMP/LISTED)**로 통합 — 구조 괴리 존재(§4 R2).

### 2.3 `user_item_trash` — 삭제 아이템 (22행)

`user_item`과 **동일 컬럼 + `itm_trash_id` PK**. 게임은 아이템 삭제 시 물리 이동(insert-to-trash + delete).
finalcall은 soft delete를 두지 않고(아이템은 소멸이 아니라 소유 이전·이력 보존, spec §2.3) `item_ownership_history`로
이력을 남긴다 → **패러다임 차이**. 클라가 "휴지통 복구" UI를 기대하면 어댑터가 별도 상태를 매핑해야 함.

### 2.4 `user_equipments` — 장착 슬롯 (실측 4555행)

`usr_id int PK` + **11개 부위 컬럼** `equip_magic/weapon/arm/pet/foot/body/hand1/hand2/face/hair/head int DEFAULT -1`.
각 값 = 장착된 `itm_id`(또는 `-1`=미장착). usr당 정확히 1행(1:1).

**클라 고정 계약**: **부위 11종 고정 + `-1` 센티널**. 부위 순서·이름이 클라 장비창 슬롯과 대응. finalcall엔
**장착 개념 자체가 아직 없음**(§4 R3, 신규 도메인 필요). 재구성 시 `-1`→NULL, itm_id→instance FK로 바꿀 수
있으나 **부위 집합·의미는 클라 계약**.

### 2.5 `user_memo` — 메모(쪽지) (실측 3897행, AUTO_INCREMENT=45752) ★ 메모 도메인 착수 대상

DDL: `memo_id int PK AI` · `memo_sender char(16)` · `memo_reciever char(16)`(sic, 오타 그대로) ·
`memo_type int DEFAULT 5` · `memo_level_gender int DEFAULT 0` · `memo_msg char(120)` ·
`memo_state int DEFAULT 0` · `add_date timestamp` · `memo_del int DEFAULT 0`.

**클라 고정 계약(보존 필수) + 확인된 패킹**
- **`memo_level_gender = usr_level * 100 + usr_gender`** — 실측 검증 완료. 예 `2601`=레벨26·성별1,
  `2600`=레벨26·성별0, `301`=레벨3·성별1. 보낸 사람 레벨/성별을 **한 int에 합성**해 클라가
  `/100`, `%100`으로 푼다. **finalcall이 반드시 boundary에서 재합성해야 하는 대표 계약.**
- **`memo_sender`/`memo_reciever char(16)` = 닉네임 자연키**(usr_id 아님). §4 R1의 핵심 사례.
- `memo_type int` 분포: `5`=3168(일반 유저 메모, 기본값), `14`=428, `0`=301(시스템/운영자 발신, 예 선물
  실패 안내). → **type별 발신 주체·렌더가 다른 enum**. 클라가 타입으로 분기.
- `memo_state int`: **0=미열람 / 1=열람**(주석). 실측 0=98, 1=3799.
- `memo_del int DEFAULT 0`: **soft delete 플래그**(0=존재, 1=삭제). 주석은 "삭제 날짜"라지만 실측은 0/1 플래그.
- `memo_msg char(120)`: **저장 상한 120자**. 단, 배경 지시의 "클라 28바이트 고정폭 렌더"는 **입력/표시
  제한**이지 저장 폭이 아니다 — 실측 `memo_type=5`(유저) 최대 115자·평균 15.5자, 시스템 메모(type 0/14)는
  더 김. **28바이트 = 클라가 유저 입력창에서 계산하는 폭(숫자·영문 1바이트, 그 외 2바이트)**으로,
  저장은 char(120)까지 허용. finalcall이 유저 발신 메모를 검증할 때 이 28바이트 규칙을 재현할지는 정책 결정(§5 U2).

**finalcall 대응**: **없음**(신규 도메인). 재구성 권고 — `memo_level_gender`는 **저장은 분해**(sender의
level/gender를 발신 시점 스냅샷 2필드로) 하되 **클라 응답에서 `level*100+gender`로 재합성**. sender/receiver는
내부적으로 user FK로 정규화하되 **클라에는 닉네임 문자열로 노출**(발신 시점 닉네임 스냅샷 보존 — 닉 변경 대비).

### 2.6 `user_friend` — 친구 (7행)

DDL: **복합 PK `(usr_id, friend_id)`** + `friend_name char(16)` + `add_date`. `friend_id` 보조 KEY.
실측: 방향성 있는 단방향 행(A→B, B→A 각각 저장, 예 usr 1→4 와 4→1 별개). `friend_name`=상대 닉 스냅샷.

**클라 고정 계약**: 친구 관계는 **usr_id 쌍**(여기선 id 기반이라 R1 완화) + **닉 스냅샷 동반**.
**finalcall 대응 없음**(신규). 재구성 용이 — user FK 복합키 그대로, friend_name은 닉 스냅샷/조인 택일.

### 2.7 `user_ban` — 제재 (0행)

DDL: `id int PK AI` · `usr_name char(16) KEY` · `ban_date timestamp` · `expiration_date timestamp NULL`.
**닉네임 기준 제재**(usr_id 아님 — R1). NULL 만료 = 영구밴 추정. finalcall 대응 없음(신규, 용이).

### 2.8 `user_active` — 현재 접속 세션 (2행, 휘발성)

DDL: **PK `usr_name`**(닉네임!) · `usr_id int` · `usr_ip` · `connect_time` · `channelName char(29)` ·
`channelPort` · `channelType smallint` · `room int` · `connect_type` · `server_uniqueValue char(100)` ·
`disconnect_req tinyint(1)`(0 유지/1 접속해제 요청).
**런타임 세션 테이블**(게임 서버가 접속/해제 시 갱신). finalcall이 게임 세션을 대체하려면 서버 어댑터가
이 테이블을 계속 쓰거나 대체 메커니즘 제공 필요. **PK가 닉네임**이라 동시 접속·닉 유일성 가정에 결합(R1).

### 2.9 상점 계열 (참고)

- `usershop_box`(30): 개인상점 매대. `user_shop_keeper_name char(16)`(닉) · `user_shop_keeper_level int` ·
  `user_shop_keeper_gender smallint`(레벨·성별을 **분리 저장** — 메모와 달리 미패킹) · `user_shop_code bigint`(가격) ·
  `user_shop_box_type`(1=아이템/2=정령) · `itm_id`(box_type1=아이템 고유번호/2=정령) · `user_shop_state`(0판매중/1종료).
- `log_usershop`(215): 거래 로그. buyer/seller **닉네임** + 코드 before/after 스냅샷.
- `cardshop_bank`(4): 유저별 예치금 `deposit bigint`(실측 26억~50억). `usr_name char(16)` 동반.
- **finalcall 대응**: `shop`·`sale_order`·`platform_revenue_ledger` 도메인이 이미 존재(§3). 단 게임 상점은
  개인상점(C2C)이고 finalcall shop은 별개 설계 — 매핑 정밀도는 상점 통합 착수 시 재조사.

---

## 3. finalcall 현행 스키마 대조표

finalcall 마이그레이션 V1~V19 + 엔티티 기준. 게임 테이블 → finalcall 대응.

| 게임 테이블/개념 | finalcall 대응 | 상태 | 재구성 권고 |
|---|---|---|---|
| `user`(계정·닉·비번) | `user`(V3, `id BIGINT`·`public_id CHAR(26) ULID`·`login_id`·`password_hash`·`nickname VARCHAR(30)`·`is_admin`·soft delete) | **부분 일치** | 신원 필드는 대응. **닉 30자 vs 게임 16자** 불일치(R4). 게임 `usr_id≤32767`·평문비번·utf8mb3_bin 정렬은 어댑터 흡수 |
| `user` 재화 8종(code/cash/coins/points/정령4) | `user_balance`(V3: `cash_balance`·`game_money_balance`·`game_money_held`) | **불일치(대폭)** | finalcall은 **2종 지갑**만. 게임 8종 지갑↔finalcall 매핑 정의 필요(R5). 정령 4속성은 finalcall에 개념 없음 |
| `user`(level·gender·char·전적·정령·미션·스크롤) | **없음** | **누락** | 게임성 필드 전부 finalcall user에 부재. 메모 패킹(level·gender)만이라도 스냅샷 필요 |
| `user_item`(인벤 아이템) | `item_instance`(V7: `template_id`·`owner_id`·`level`·`skill1/2_id`·`skill_percent`·`gf_expire_at`·`location`·`slot_no`) | **개념 대응, 구조 괴리** | 게임 3테이블(item/equip/trash)→finalcall 1테이블(location). `itm_skill` 패킹→3필드 분해. `itm_type`→`type_code`(1:1) |
| `user_item_trash` | (없음, `item_ownership_history`로 대체) | **패러다임 차이** | 게임 물리삭제↔finalcall 이력보존. 휴지통 UI 계약 시 어댑터 매핑 |
| `user_equipments`(장착 11부위) | **없음** | **누락** | 장착 도메인 신설. 부위 11종·`-1` 센티널은 클라 계약 |
| `user_memo`(메모) | **없음** | **누락(착수 대상)** | 신규 memo 도메인. `memo_level_gender` 재합성·닉 스냅샷·type enum·state/del 보존 |
| `user_friend` | **없음** | **누락** | user FK 복합키로 재구성 용이 |
| `user_ban` | **없음** | **누락** | 제재 도메인 신설. 닉 기준→user FK 전환 권고(닉 스냅샷 병행) |
| `user_active`(세션) | **없음**(finalcall은 JWT 자체검증 F1) | **패러다임 차이** | 게임 세션 테이블은 게임서버 런타임 자산. finalcall 인증과 별개 — 어댑터 유지 여부 결정 필요 |
| `item_template`/`skill_definition`(게임엔 gameshop·set_*가 원천) | `item_template`(V6)·`skill_definition`(V6) | **대응** | `type_code`·`skill_code`가 게임 코드와 1:1. 시드 정합 부채는 spec §2.1 |
| `usershop_box`·`log_usershop`·`cardshop_*` | `shop`(V15)·`sale_order`(V14)·`platform_revenue_ledger` | **부분/불명** | 상점 통합 착수 시 정밀 재조사 |

finalcall 컨벤션 기준(CLAUDE.md §5·erd): 내부 PK `BIGINT AI`(비노출) + 외부 `public_id CHAR(26) ULID` ·
시각 `DATETIME(6)`(Instant UTC) · `utf8mb4_unicode_ci` · soft delete `is_deleted BIT`/`deleted_at` ·
`@Setter` 금지·도메인 메서드 · 유일성은 생성컬럼 UK(D-081).

---

## 4. 핵심 발견·리스크 요약

**클라 계약으로 못 바꾸는 것(boundary에서 반드시 보존)**
- **R1 — 닉네임(char16)이 범용 자연키**: `user_memo`·`user_friend.friend_name`·`user_ban`·`user_active`(PK!)·
  `usershop_box`·`cardshop_bank`·`log_*` 대부분이 usr_id가 아니라 **닉네임 문자열**로 유저를 참조한다.
  finalcall은 user FK로 정규화하되 **클라 노출 경로에선 닉 문자열을 재현**해야 하고, **닉 변경 시 과거
  스냅샷 보존**(발신 시점 닉)이 필요하다. 이것이 통합 최대 난점.
- **R6 — 정수 패킹**: `memo_level_gender = level*100+gender`(검증됨), `itm_type` 4자리 자리값 코드,
  `itm_skill` 패킹(미해독). 저장은 분해하더라도 **클라 응답에선 원 포맷으로 재합성** 필수.
- **고정폭·센티널·코드값**: `char(16)` 닉 · `char(40)` uuid · `equip_*` `-1` 미장착 · `memo_state 0/1` ·
  `memo_del 0/1` · `usr_gender 0/1` · `usr_type 10/20/30` · `lastPurchaseType`/`purchase_type` 코드.

**자유롭게 바꿔도 되는 것(finalcall 컨벤션으로 재구성)**
- 내부 PK 타입/전략(smallint→BIGINT, ULID public_id 추가), 물리 컬럼 배치, 감사 컬럼(create_date/
  data_edit_time→created_at/updated_at DATETIME(6)), soft delete 표현(tinyint delete_yn→BIT is_deleted),
  charset(utf8mb3→utf8mb4), 인덱스, 게임 3테이블(item/equip/trash)의 finalcall 단일 location 통합.

**구조 괴리 리스크**
- R2: 아이템 3테이블 분리 ↔ finalcall `location` 단일 디스크리미네이터.
- R3: **장착(equipments) 도메인이 finalcall에 전무** — 신설 필요.
- R4: 닉 길이 16(게임) vs 30(finalcall) — 신규 유저 닉 30자 허용 시 게임 클라 렌더 깨질 위험 → **16자로 제한** 권고.
- R5: 재화 8종(게임) vs 2종(finalcall balance) — 매핑/확장 정의 필요.

---

## 5. 미해결·추가 확인 필요

- **U1 — `itm_skill` 패킹 분해식**: 실측 `13387000` 1건뿐. 두 스킬 슬롯 + percent 합성 방식(자릿수/비트)을
  **게임 서버 소스**(아이템 직렬화 코드) 또는 `old_sp`/`sp_2019` 대량 샘플로 역산 필요.
- **U2 — 메모 28바이트 폭 규칙**: 클라 입력폭 계산(숫자·영문 1B, 그외 2B)을 finalcall 발신 검증에서
  재현할지 = 정책 결정. 저장 한계는 char(120)로 별개.
- **U3 — `usr_id` 클라 노출 폭**: `smallint`(≤32767)를 클라가 2바이트로 읽는지 서버 소스 확인. 그렇다면
  finalcall BIGINT PK와 별개로 **게임용 usr_id 범위**를 어댑터가 관리해야 함.
- **U4 — `memo_type`·`lastPurchaseType`·`usr_char`·`gift_type` 코드값 전수 의미**: 서버 소스/기획 문서 필요.
- **U5 — 상점 계열 통합 정밀도**: usershop/cardshop ↔ finalcall shop/sale_order 매핑은 상점 통합 착수 시 재조사.
- **U6 — 게임 세션(`user_active`) 처리 방침**: finalcall JWT 인증과 게임서버 세션 테이블의 공존/대체 결정.
