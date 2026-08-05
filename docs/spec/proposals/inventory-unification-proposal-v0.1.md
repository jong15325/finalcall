# 인벤토리 완전 통합(A) 조사·설계 proposal (v0.1)

상태: **v0.1 탐색 초안** · 작성: 2026-08-05 (architect, EPIC-ITEM-DELIVERY phase-2 방향 재판정) · 성격: **탐색·설계 — 구현 아님, 게이트1/게이트2 상신용**
소유: architect(spec). finalcall 코드·기존 spec·게임 서버 코드 **무변경**(읽기 전용 조사 + 본 신규 proposal 파일만).

## 배경·제약 (2026-08-05 사용자 확정)
- **finalcall DB가 곧 게임 DB로 통합**된다. 게임 서버는 수정·재컴파일 가능, **클라이언트는 수정 불가**.
- **클라가 요구하는 데이터·타입만 보존**하면 되고, 그 외 게임 테이블 컬럼은 자유롭게 변경·삭제 가능.
- 방향 = **완전 통합(A)**: 웹 `item_instance`를 웹·게임 공용 단일 인벤으로 삼고, 재컴파일 게임 서버가 그 테이블을 직접 읽어 클라 규약으로 번역.

## Ground truth (main이 DB에서 덤프)
- 게임 실접속 DB = **`old_sp`**(게임 `shared/ServerConfig.h` databaseName). `new_sp`는 거의 동일 사본(uuid만 char40).
- 조사 소스 = `D:\private_server\SP\gameserver\season5-250326\Channel32\`(`MySQL.cpp`·`MySQL.h`·`GameServer.cpp`·`ServerPackets.h`).
- 근거: `game-db-survey.md`(new_sp 조사)·`game-claim-phase2-proposal-v0.1.md`(코드가 old_sp 계통 `items`/`users`/`messages`를 읽음을 최초 발견)·`game-item-skill-format.md`(itm_skill 패킹·level 0-based)·`erd.md`(item_instance §413~).

---

## 0. ★ 게이트2 결정 요약 (맨 앞 · 되돌리기 어려운 결정 · 사용자 상신 대상)

| # | 결정 | 조사 결론(추천) | 되돌리기 비용 |
|---|---|---|---|
| **U0** | **식별자 체계 수렴** — 게임 int(itm_id·usr_id) ↔ 웹 bigint(id·owner_id)/char26(public_id) | **웹 bigint 정본, 게임엔 int32 노출 매핑.** 클라는 itm_id·itm_type을 4바이트 int로 읽는다(§1). item_instance.id(bigint)가 2^31 미만인 동안 그대로 int로 노출 가능 → 근시일 안전, 장기 오버플로 방어(int32 전용 game_item_id 컬럼) 필요 여부가 결정 대상 | 매우 큼 |
| **C1** | **클라 고정 계약 필드** = 유일 불변 | 인벤 렌더 계약 = **{slot(0~95), itm_type(int), gf_days(int), itm_level(int·0-based), itm_skill(int·패킹), itm_id(int·접속패킷만)}** 6종, 전부 4바이트 int. `first_owner`·`balance_cash`·`itm_uuid`·`create_date`는 **클라 미노출**(ServerPackets.h 부재 확인)이라 자유 변경·삭제 가능(§1·§2) | (계약이라 불변) |
| **G-DENORM** | item_instance 정규화(template_id·skill FK) ↔ 게임 요구 비정규(itm_type·itm_skill 코드값) | 게임은 행에서 **4자리 type 코드·패킹 skill int**를 직접 읽는다. item_instance는 이를 **FK로 정규화** → 매 인벤 읽기마다 `item_template`·`skill_definition` **조인+재패킹** 필요. 대안: item_instance에 **비정규 게임서빙 컬럼(type_code·itm_skill_packed) 추가**로 조인 제거(§3.2) | 큼(스키마 or 전 읽기경로 조인) |
| **G-VIEW** | 게임 SQL 최소수정 위해 `items` 이름 **호환 VIEW** 도입 가능한가 | **읽기는 가능, 쓰기는 불가.** MySQL은 **INSTEAD OF 트리거가 없어** 조인/생성컬럼 있는 VIEW로 INSERT/UPDATE 리다이렉트 불가 → **모든 쓰기 경로(items INSERT/UPDATE/DELETE)는 재컴파일 필수**(§4.2). 읽기 경로만 VIEW로 흡수 | 큼 |
| **G-WRITE** | 게임 서버 items 접근 코드 재작성 범위 | `MySQL.cpp` 단독 **~44개 items SQL + ~30개 아이템 함수**(인벤·장착·강화·NPC상점·개인상점C2C·거래·선물·골드포스). 쓰기 경로 전부가 item_instance 정규형(template 조회·skill 분해·location='INVENTORY'·slot_key 자동)으로 재작성 대상(§4·§5) | 큼(재컴파일) |
| **G-LOC** | 웹 전용 `location`/`slot_key`/`public_id`의 게임측 의미 | 게임엔 무의미분 = `location`(게임은 INVENTORY만)·`public_id`(게임은 int itm_id 사용)·`created_at/updated_at`. **`slot_key`(생성 UK)는 유익**(게임 GetValidSlot의 (owner,slot) 유일성을 DB가 강제). 통합 시 **`location=IN_GAME` 개념 소멸**(INVENTORY가 곧 게임 인벤)(§3.3) | 중간 |
| **A/B** | 최종 아키텍처 | **A(완전 통합) 실현 가능·사용자 방향과 정합**. 단 비용은 "정규↔비정규 번역 + MySQL VIEW 쓰기 불가로 전 쓰기경로 재컴파일 + int32 식별자 매핑"에 집중. **다리(B)는 이 비용을 회피하나 웹·게임 인벤이 두 벌로 분리**됨. 추천 = **A + 게임서빙 비정규 컬럼(하이브리드)**(§5) | 매우 큼 |

**요지**: 완화된 제약 아래 **A는 현실적**이다. 관문은 claim 알고리즘이 아니라 세 가지다 — (1) 클라가 int로 읽는 `itm_id`/`itm_type`/`usr_id` 폭과 웹 bigint의 정합, (2) item_instance의 정규화(FK)와 게임이 기대하는 비정규(코드값)의 번역 비용, (3) **MySQL이 INSTEAD OF 트리거를 지원하지 않아** `items` VIEW로 쓰기를 못 감추므로 게임 쓰기 경로 전부(~수십 SQL) 재컴파일이 불가피하다는 점.

---

## 1. ★ 클라 고정 계약 — 클라가 실제로 요구하는 아이템 필드 (유일 불변)

클라 노출은 두 지점으로 확인됐다: (a) 접속 시 인벤 전송(`JoinChannelPlayerDataResponse`), (b) 상점 구매 응답(`ShopBuyResponse`). 둘 다 **슬롯 0~95 고정폭 배열**이다.

### 1.1 인벤 로드 쿼리 — `MySQL::GetUserItems` (MySQL.cpp L455~485)

```sql
SELECT itm_id, itm_slot, itm_type, DATEDIFF(itm_gf, NOW()), itm_level, itm_skill
FROM items WHERE itm_usr_id = %d
```
- 결과를 `itm_slot`(0~95)을 인덱스로 배열에 흩뿌린다: `bMyCard[slot]=true`, `IDMyCard[slot]=itm_id`, `TypeMyCard[slot]=itm_type`, `GFMyCard[slot]=DATEDIFF일수`, `LevelMyCard[slot]=itm_level`, `SkillMyCard[slot]=itm_skill`.
- **gf는 절대시각이 아니라 `DATEDIFF(itm_gf, NOW())` = 남은 일수 int**로 클라에 전달, 음수는 **0으로 클램프**(L477~478). 빈 슬롯은 전 필드 0.

### 1.2 와이어 구조체 — `ServerPackets.h`

접속 패킷 `JoinChannelPlayerDataResponse`(L115~175)는 다음 96칸 배열을 **고정 오프셋**으로 담는다(L148~153):
```
bool bMyCard[96];   // 슬롯 점유 플래그(1B×96)
int  IDMyCard[96];  // itm_id (4B) — 접속 패킷에만 존재
int  TypeMyCard[96];// itm_type (4B)
int  GFMyCard[96];  // 남은 일수 (4B)
int  LevelMyCard[96];// itm_level 0-based (4B)
int  SkillMyCard[96];// itm_skill 패킹 (4B)
int  nOfSlots;      // 인벤 칸 수 (= users.usr_nslots)
```
상점 응답 `ShopBuyResponse`(L470~487)는 **동일하나 `IDMyCard`가 없다** — itm_id는 **접속 패킷에서만** 노출된다.

### 1.3 확정된 클라 고정 계약 (보존 필수)

| 클라 필드 | 폭·타입 | 의미 | 변환 규칙(재컴파일 boundary) |
|---|---|---|---|
| `itm_slot` | 배열 인덱스 0~95 | 인벤 슬롯 위치(0-based) | item_instance.slot_no 1:1 |
| `itm_type` | int(4B) | 4자리 자리값 코드(상품군/대분류/속성/종류) | item_template.type_code 조회 필요(정규화分) |
| `gf_days` | int(4B), 음수→0 | 골드포스 잔여 **일수** | `DATEDIFF(gf_expire_at, NOW())` — 저장은 절대시각이라도 계약 충족 |
| `itm_level` | int(4B), **0-based** | 강화 레벨(표시=+1) | item_instance.level(1-based) **−1** |
| `itm_skill` | int(4B) 패킹 | `percent*1e6+skill1*1e3+skill2` 불투명 int | skill1_id·skill2_id→skill_code + skill_percent **재패킹** |
| `itm_id` | int(4B), 접속패킷만 | 아이템 인스턴스 식별자 | item_instance.id(bigint) → **int32 노출 매핑**(U0) |

**클라 미노출(자유 변경·삭제 가능)**: `itm_uuid`·`first_owner`·`balance_cash`·`create_date` — 전부 `ServerPackets.h`에 **부재**(grep 0건). 게임 서버 내부(거래 출처·NPC 판매 환불액·감사)용일 뿐 클라 계약이 아니다.

> **usr_id 클라 노출 폭(U3 잔여)**: 인벤 배열에는 usr_id가 없다(소유자 암묵). 게임 코드는 usr_id를 `atoi`=int로 취급(`UpdateUserInfo` L393·L403). 그러나 다른 패킷(UserInfo·gift·find-user)에서 클라가 usr_id를 몇 바이트로 읽는지는 미확인 → int32 매핑의 상한 근거로 확인 필요.

---

## 2. old_sp.items 컬럼 분류 (a 보존 / b 서버내부·변경가능 / c 삭제가능)

`items` = `itm_id, itm_slot, itm_usr_id, itm_type, itm_gf, itm_level, itm_skill, itm_uuid, first_owner, balance_cash, create_date` (INSERT 컬럼순 = MySQL.cpp L555).

| 컬럼 | 타입(old_sp) | 분류 | 판정 근거 |
|---|---|---|---|
| `itm_id` | int PK | **(a) 클라 요구** | 접속 패킷 IDMyCard로 노출(int). 단 슬롯 기반 조작이 대부분이라 **값 안정성**보다 **int 폭**이 계약 |
| `itm_slot` | int | **(a) 클라 요구** | 배열 인덱스 0~95. 인벤 렌더의 핵심 |
| `itm_usr_id` | int | (b) 서버내부 | 소유자 FK. 아이템 와이어엔 미노출(암묵). owner 매핑으로 대체 가능 |
| `itm_type` | int | **(a) 클라 요구** | TypeMyCard(int). 4자리 코드 의미 보존 |
| `itm_gf` | timestamp | **(a) 클라 요구(변환)** | 클라는 절대시각이 아니라 DATEDIFF 일수를 받음 → **저장 형식 자유**, 잔여일 도출 가능성만 보존 |
| `itm_level` | int(0-base) | **(a) 클라 요구** | LevelMyCard(int·0-based). 0-based 의미 보존(웹은 1-based, boundary −1) |
| `itm_skill` | int(패킹) | **(a) 클라 요구** | SkillMyCard(int). 패킹식 보존, 게임은 불투명 저장(C++ 분해 코드 부재) |
| `itm_uuid` | int(이 코드)/char40(new_sp) | (b) 서버내부 | 클라 미노출. 거래 추적용. **item_instance엔 대응 컬럼 자체가 불필요**(웹은 id/public_id 사용) |
| `first_owner` | char15 | (b) 서버내부 | 클라 미노출. 개인상점 출처 표기 등 게임 내부 로직용. 필요 시 item_instance에 옵션 추가 |
| `balance_cash` | int | (b) 서버내부 | 클라 미노출. NPC 판매 환불액. 게임 내부 |
| `create_date` | timestamp | (c) 삭제가능 | 감사용. 클라 미노출. 웹 created_at으로 대체 |

**정리**: 클라 계약은 **6컬럼(itm_id·itm_slot·itm_type·itm_gf·itm_level·itm_skill)**의 값·폭·의미뿐. 나머지 5컬럼(itm_usr_id·itm_uuid·first_owner·balance_cash·create_date)은 게임 내부 사정이라 통합 시 자유롭게 재편(itm_usr_id→owner_id 매핑, itm_uuid 폐기, create_date 폐기, first_owner/balance_cash는 게임 내부 기능 유지 필요 시에만 존치).

---

## 3. item_instance 대조 — 커버·부족·불필요

item_instance(erd §413~429): `id(bigint PK)`, `public_id(char26 ULID)`, `template_id(FK)`, `owner_id(FK)`, `level(1-based)`, `skill1_id·skill2_id(FK)`, `skill_percent`, `gf_expire_at(datetime6)`, `location(INVENTORY/TEMP/LISTED/IN_GAME)`, `slot_no(0~95)`, `created_at·updated_at`, `slot_key(생성 UK)`.

### 3.1 클라 계약 커버 여부

| 클라 계약 | item_instance 대응 | 커버 | 비고 |
|---|---|---|---|
| itm_slot | `slot_no` (0~95, location=INVENTORY) | ✅ 1:1 | |
| itm_type | `template_id`→`item_template.type_code` | △ **조인 필요** | 값은 있으나 정규화됨(§3.2) |
| gf_days | `DATEDIFF(gf_expire_at, NOW())` | ✅ 도출 가능 | 저장 절대시각이라도 계약 충족 |
| itm_level | `level` − 1 | ✅ 변환 | 웹 1-based↔게임 0-based |
| itm_skill | `skill1_id·skill2_id`→code + `skill_percent` 재패킹 | △ **조인+재패킹** | 정규화됨(§3.2) |
| itm_id(int) | `id`(bigint) | △ **폭 매핑** | bigint→int32 노출(U0) |

### 3.2 부족분 (게임 서빙에 모자란 것)

1. **★ int32 게임 식별자**: 클라는 itm_id를 4바이트 int로 읽는데 item_instance.id는 bigint. id가 2^31(약 21.4억) 미만인 동안은 그대로 int 노출 가능하나, **장기 오버플로 방어**로 `game_item_id INT` 전용 컬럼(또는 노출 시 범위 보장)이 필요할 수 있음. usr_id(owner)도 동일(user.id bigint → int32 노출).
2. **비정규→비정규 서빙 데이터**: 게임은 행에서 `itm_type`(4자리 int)·`itm_skill`(패킹 int)을 **직접** 읽는다. item_instance는 이를 FK/분해로 저장 → **매 인벤 로드마다 `item_template`·`skill_definition` 조인 + itm_skill 재패킹**이 필요하다. 데이터가 없는 게 아니라 **형태가 다르다**. 조인 부담 제거를 원하면 item_instance에 **게임서빙 비정규 컬럼**(`type_code INT`, `itm_skill_packed INT`)을 추가하는 하이브리드(§5)가 선택지.
3. **게임 내부 컬럼(선택)**: `first_owner`(개인상점 출처)·`balance_cash`(NPC 환불)는 클라 계약은 아니나, 해당 게임 기능을 item_instance 위에서 그대로 돌리려면 옵션 컬럼으로 존치 필요. 불요 시 게임 로직에서 제거.

### 3.3 불필요분 (게임엔 무의미한 웹 전용)

- `location`(INVENTORY/TEMP/LISTED/**IN_GAME**): 웹 위치 디스크리미네이터. 게임은 INVENTORY만 읽는다. **통합 시 `IN_GAME` 상태 의미 소멸** — 별도 게임 인벤이 없으니 INVENTORY가 곧 게임 인벤이다(배송 APPLIED→IN_GAME 전이 개념이 사라짐, EPIC-ITEM-DELIVERY 재설계 함의).
- `public_id`(char26 ULID): 웹 외부 식별자. 게임은 int itm_id를 쓴다 → 게임 무사용.
- `created_at`/`updated_at`: 웹 감사. 게임은 create_date를 클라에 노출 안 함 → 무관.
- `slot_key`(생성 UK): 웹 슬롯 이중배정 방어. **게임에 유익** — 게임 `GetValidSlot`(MySQL.cpp L527)이 전제하는 (owner, slot) 유일성을 DB가 강제해준다(location='INVENTORY' 행만 UK). 통합 시 게임 동시 INSERT의 슬롯 충돌을 DB가 막는 안전망.

---

## 4. 게임 서버 items 접근 코드 규모 추정 (A 재작성 범위)

### 4.1 접근 함수·SQL 규모 (`MySQL.cpp`/`MySQL.h` 실측)

- `items` 테이블 대상 SQL = **~44건**(grep: FROM/INTO/UPDATE/DELETE items). `itm_uuid`/`first_owner` 동반 SQL = ~30건(대부분 개인상점 거래 복제).
- 아이템 함수 표면(`MySQL.h`) = **~30개 이상**, 기능 군집:
  - **인벤 로드/렌더**: `GetUserItems`(L47), `GetUserBooster`, `GetValidSlot`(L49), `GetnSlots`(L48) — **읽기**.
  - **장착**: `GetEquipData`(L72)·`ChangeEquips`(L70) — `equipments INNER JOIN items` 읽기 + 장착 슬롯 갱신.
  - **강화**: `UpgradeCard`(L74), `UpdateItem`(L121) — `UPDATE items SET itm_level/itm_skill`(L1372).
  - **NPC 상점**: `InsertNewItem`(L50), `DeleteItem`(L64), `GetShopItemCost`(L63) — 지급/판매.
  - **개인상점 C2C(usershop/cardshop)**: `UserShopNewItem`·`UserShopBuyProcess`·`InsertItem`(L78)·`AddToShop`/`AddToShop2`(L80·238)·`GetFromShop`·`UserShop2*`(다수) + `cardshoptrans`/`cardshop_log` 복제(L659·L661·L696·L3533).
  - **거래(1:1)**: `ItemTransfer`(L89·90)·`ItemCheck`(L91) — `UPDATE items SET itm_slot,itm_usr_id`(L1817).
  - **선물/수신**: `itemreceive` 계열.
  - **골드포스**: `ChargeForce`(L112) — `UPDATE items SET itm_gf`(L2340·2378).
- `GameServer.cpp` 호출부: `GetUserItems` 등 인벤 배열 채우기가 **최소 7개 핸들러**(L385·430·577·653·1278 등: 접속·상점구매·검색·강화 응답)에서 반복.

### 4.2 ★ MySQL VIEW로 쓰기를 감출 수 없다 (핵심 기술 제약)

- **읽기 경로**: item_instance(+item_template+skill_definition 조인)를 `items`라는 이름의 **VIEW**로 노출하면, `SELECT ... FROM items`류(인벤 로드·장착 조인)를 **게임 SQL 거의 그대로** 서빙 가능. gf도 뷰에서 `DATEDIFF` 계산, level −1, itm_type·itm_skill 비정규 컬럼(또는 조인 표현)으로 매핑.
- **쓰기 경로**: **MySQL은 INSTEAD OF 트리거를 지원하지 않는다.** 조인·생성컬럼(slot_key)·표현식이 있는 VIEW는 **비갱신(non-updatable)** 이라 `INSERT/UPDATE/DELETE items`를 뷰로 리다이렉트할 수 없다. 따라서 **모든 쓰기 경로(InsertNewItem·UPDATE items·DELETE items·ItemTransfer·usershop 복제 등 ~절반)는 item_instance 실컬럼(bigint id·template_id 조회·skill 분해·location·slot_key 자동 생성)으로 재컴파일**해야 한다.
- 결론: VIEW는 **읽기 churn만 흡수**한다. A의 진짜 비용은 **쓰기 경로 재작성**이며 이는 회피 불가.

---

## 5. 통합 설계(A) — item_instance 단일 인벤 + 게임 재지향

### 5.1 정본·번역 방향
- **item_instance = 웹·게임 공용 단일 정본.** 웹은 지금처럼 정규형으로 읽고 쓴다. 게임 서버는 재컴파일로 item_instance를 직접 읽고(또는 `items` 읽기 VIEW 경유), **boundary에서 클라 규약으로 번역**: level−1 · itm_skill 재패킹 · gf `DATEDIFF` · owner_id→int32 usr_id · id→int32 itm_id.
- **식별자 수렴 = 웹 bigint 정본, 게임 int32 노출 매핑**(U0). itm_uuid(게임 int)는 폐기 — 웹은 id/public_id로 추적하며 클라는 itm_uuid를 안 읽으므로 손실 없음. (이로써 phase-2 proposal의 G3 "itm_uuid char40 UK vs int" 충돌이 **소멸**한다 — 대상이 item_instance면 itm_uuid 컬럼 자체가 없다.)

### 5.2 추천안 — 하이브리드 A (게임서빙 비정규 컬럼 + 읽기 VIEW)
1. item_instance에 **게임서빙 비정규 컬럼** 추가: `type_code INT`(template의 4자리 코드 캐시), `itm_skill_packed INT`(재패킹 캐시). 웹 쓰기 시 파생 갱신(트리거 또는 앱). → 게임 읽기가 조인 없이 행에서 직접 확보(§3.2 부담 제거).
2. **읽기 VIEW `items`**: `SELECT id AS itm_id, slot_no AS itm_slot, owner_id AS itm_usr_id, type_code AS itm_type, gf_expire_at AS itm_gf, level-1 AS itm_level, itm_skill_packed AS itm_skill, ... FROM item_instance WHERE location='INVENTORY'`. 게임 SELECT 경로 대부분 무수정 재사용.
3. **쓰기 경로 재컴파일**(불가피, §4.2): InsertNewItem/UPDATE/DELETE/ItemTransfer/usershop을 item_instance 실컬럼 대상으로 재작성(template_id 조회·skill 분해·location='INVENTORY'·slot_no 배정, id는 auto). int32 노출 매핑을 삽입/전송 경계에 배치.
4. **IN_GAME 소멸**: 배송 완료가 곧 INVENTORY 편입이므로 IN_GAME 상태 제거 또는 INVENTORY로 병합(EPIC-ITEM-DELIVERY 재설계 별건).

### 5.3 대안 — 순정 A (비정규 컬럼 없이 조인)
비정규 캐시 컬럼을 두지 않고 게임 읽기 VIEW/쿼리가 매번 `item_template`·`skill_definition`을 조인+재패킹. 스키마는 깔끔하나 게임 읽기 쿼리 전면 수정 + 조인 비용. 인벤 로드가 접속마다 96행×조인이라 **읽기 성능·코드 churn 모두 열위** → 하이브리드 추천.

---

## 6. A vs B 재판정

| 축 | A (완전 통합, item_instance 단일 인벤) | B (다리/우편함, phase-2 proposal) |
|---|---|---|
| 인벤 진실원 | **단일**(item_instance). 웹 리스팅 아이템 = 게임 인벤 아이템 = 같은 행 | **이중**(item_instance ↔ items). claim 시 materialize로 소유 이전 |
| 게임 코드 변경 | **큼** — 쓰기 경로 전부 재컴파일(§4.2), 읽기는 VIEW 흡수 | 중간 — claim 훅 + InsertNewItem 확장(우편함 소비)만 |
| 식별자 | 웹 bigint 정본 + int32 노출 매핑(U0) | 게임 items 계통 유지, 우편함이 boundary 번역 |
| 정규↔비정규 | 게임서빙 비정규 컬럼 or 조인 필요(G-DENORM) | 우편함 스냅샷이 이미 boundary용 값 운반 |
| 일관성 모델 | **강**(단일 행, 웹·게임 즉시 정합) | 최종적(우편함 claim 지연, 리스·멱등 필요) |
| MySQL 제약 | INSTEAD OF 부재로 쓰기 VIEW 불가 → 쓰기 재컴파일 | 해당 없음(우편함은 별 테이블) |
| 되돌리기 | 매우 큼 | 중간 |

**재판정 결론**: 완화된 제약(공용 DB·서버 재컴파일·클라만 고정) 아래 **A는 기술적으로 성립하며 사용자 방향과 정합**한다. B 대비 A의 이점은 **단일 진실원·즉시 정합**(웹에 리스팅된 아이템과 게임 인벤 아이템이 물리적으로 같은 행 → materialize/claim 지연·이중지급 위험·리스 sweeper가 통째로 불필요)이다. 대가는 **게임 쓰기 경로 전면 재컴파일 + 정규↔비정규 번역 + int32 식별자 매핑**이다.
- **추천**: **하이브리드 A**(§5.2). 단 **U0(식별자 폭)·U7(게임 빌드 가부)** 가 선결. 이 둘이 막히면 B로 후퇴하는 것이 안전(B는 이미 phase-2 proposal에서 설계 완료·claim만 이식).
- 주의: A는 "웹이 게임 인벤의 정합성·동시성까지 소유"함을 뜻한다 — 게임 서버의 auto-commit 단문 쓰기(phase-2 G4)와 웹 트랜잭션이 **같은 행을 경합**하므로, slot_key UK(§3.3)와 낙관/비관 락 정책을 공용 규약으로 못박아야 한다(신규 게이트2 잠재).

---

## 7. old_sp vs new_sp 정합 (배송/쪽지 에픽 함의)

- **불일치 현황**: finalcall 배송(delivery)·쪽지(memo) 에픽은 **new_sp**(`user_item` char40 uuid·`user_memo`) 가정으로 설계됐다. 그러나 게임 실접속 코드는 **old_sp**(`items` int uuid·`messages` username/levelAndGender/sent)를 읽는다(phase-2 proposal §1 발견, 본 조사 재확인: MySQL.cpp `FROM items`·`FROM messages`).
- **통합(A) 시 함의**: item_instance로 수렴하면 **old_sp.items·new_sp.user_item 둘 다 legacy**가 된다 — 게임은 finalcall.item_instance(읽기 VIEW `items`)로 재지향되므로 어느 물리 테이블명이었는지는 무의미해진다. 마찬가지로 **phase-2 proposal의 G3(itm_uuid char40 UK)·G0(스키마 정체성) 쟁점이 A에서 소멸**한다(item_instance엔 itm_uuid 없음, 스키마는 finalcall 단일).
- **쪽지(memo) 별건**: 아이템과 달리 memo는 item_instance 같은 웹 정본이 착수 대상이었다. 게임이 읽는 계약은 new_sp `user_memo` 컬럼명이 아니라 **old_sp `messages`의 `username`·`levelAndGender`·`sent`** 형상(MySQL.cpp L2070)이다. memo 통합도 "게임이 실제 읽는 old_sp 형상"을 계약으로 삼아야 하며, new_sp 컬럼명 기준 설계는 재대조 필요 → **별도 티켓**(본 proposal 범위 밖, 인벤 통합과 독립).
- **결론**: 통합 대상은 item_instance(웹 정본)로 확정하고, **old_sp/new_sp는 legacy 참조 덤프로만** 취급. 단 "게임이 실제 읽는 형상"의 정본은 **old_sp 계통(items/messages)** 이므로 boundary 계약 검증은 old_sp 코드 기준으로 한다.

---

## 8. 게이트1 분해안 초안 (하위 티켓·의존)

A(하이브리드) 채택 시. **IU-0(U0 식별자 확정)이 전 티켓 선결.**

| 티켓(안) | 소속 | 내용 | 의존 | 게이트 |
|---|---|---|---|---|
| **IU-0** | 조사/사용자 | **식별자 체계 확정(U0)** — 웹 bigint 정본 + 게임 int32 노출 폭(itm_id·usr_id) 상한·전용 컬럼 여부. 클라 usr_id 노출 폭(U3) 확인 | — | **게이트2**(선결) |
| **IU-1** | 웹 스키마 | item_instance 게임서빙 비정규 컬럼(`type_code`·`itm_skill_packed`) 추가 + 파생 갱신(트리거/앱) + `IN_GAME` 처리 결정 | IU-0 | **게이트2**(스키마) |
| **IU-2** | 웹 스키마 | `items` 읽기 VIEW(item_instance→itm_* 매핑, gf DATEDIFF·level−1·location 필터) | IU-1 | 게이트2(계약) |
| **IU-3** | 게임 C++ | **읽기 경로 재지향** — GetUserItems·GetEquipData·GetValidSlot 등을 VIEW/신 스키마로. 대부분 SQL 무수정 검증 | IU-2 | 자동 |
| **IU-4** | 게임 C++ | **쓰기 경로 재컴파일** — InsertNewItem·UPDATE/DELETE·ItemTransfer·usershop을 item_instance 실컬럼(template 조회·skill 분해·location·slot_no)으로 | IU-1 | **게이트2**(재작성 범위) |
| **IU-5** | 게임 C++ | boundary 번역기 — level−1·itm_skill 재패킹·gf·int32 id/usr_id 매핑을 삽입/전송 경계에 집약 | IU-1, IU-4 | 게이트2(boundary) |
| **IU-6** | 웹/게임 공용 | 동시성 규약 — 웹 TX ↔ 게임 auto-commit이 같은 item_instance 행 경합. slot_key UK + 락 정책 | IU-1, IU-4 | **게이트2**(정합성) |
| **IU-7** | 조사/사용자 | 게임 빌드 검증(U7) — VS2022 v143+boost1.86+x86로 실빌드 | — | 게이트2 |
| **IU-8** | 정리 | old_sp/new_sp legacy 강등, 배송(IN_GAME 소멸)·EPIC-ITEM-DELIVERY 재설계 영향 티켓 산출 | IU-1 | 게이트2 |
| **IU-R** | reviewer | 클라 계약 6필드 형상 보존·번역 정확성·동시성 검증 | IU-3~6 | 게이트3 |

- **병렬성**: IU-1(스키마)·IU-7(빌드검증)은 무교차 병행. IU-3(읽기)·IU-4(쓰기)는 파일 겹침 가능성 있어 순차 권장.
- **경고**: 본 분해안은 EPIC-ITEM-DELIVERY(배송)·memo와 **중첩**된다. A 채택 시 배송 phase-2(claim/우편함)는 **상당 부분 불요**(단일 인벤이라 claim 없음) → 배송 에픽 재판정이 IU-8의 산출.

---

## 9. 미해결 · 사용자 확인 필요

| # | 항목 | 확인 방법 |
|---|---|---|
| **U0(★)** | 식별자 폭 — id/owner bigint → 클라 int32 노출. 전용 int 컬럼 도입 여부·오버플로 정책 | 게이트2 결정 |
| **U3** | usr_id 클라 노출 폭 — items.itm_usr_id는 int, 코드도 int(atoi). 클라가 UserInfo 등에서 몇 바이트로 읽는지 | ServerPackets UserInfoResponse 등 직렬화 폭 + 클라 실측 |
| **U7** | 게임 재컴파일 가부 — VS2022 v143+boost1.86+x86 MySQL 커넥터 실빌드(헤드리스 미검증) | 사용자 VS2022 환경 |
| **UM1** | 마법 카드 itm_skill 재패킹(skill1 부재 시 슬롯1=skill2, reference §3) | new_sp/sp_2019 마법 개체 역산 |
| **UC1** | 클라 패킷 실측 잔여 — IDMyCard를 클라가 실사용하는지(값 안정성 요구 여부), gf 음수 클램프 외 경계 | 클라 바이너리/동적 관측 |
| **UX1** | 인코딩 경계 — 게임 세션 euckr vs finalcall utf8mb4(닉·아이템명) | 통합 시 실측 |
| **UD1** | 동시성 — 웹 TX ↔ 게임 auto-commit 같은 행 경합 규약(락·slot_key UK) | IU-6·게이트2 |
| **UD2** | 배송/memo 에픽 재판정 — A 채택 시 claim/우편함 불요분·IN_GAME 소멸 파급 | IU-8 영향 티켓 산출 |

---

## 10. 무변경 확인
- 게임 서버 소스·finalcall 코드·기존 spec: **읽기만**, 무변경.
- 신규 파일: 본 proposal 1건(`docs/spec/proposals/inventory-unification-proposal-v0.1.md`)뿐.
- 인용은 파일·함수·라인·컬럼 단위(MySQL.cpp/MySQL.h/ServerPackets.h/GameServer.cpp/erd.md/game-item-skill-format.md).
