# 게임 서버 claim 프로토콜 phase-2 조사·설계 proposal (v0.1)

상태: **v0.1 조사 초안** · 작성: 2026-08-05 (architect, EPIC-ITEM-DELIVERY phase-2 착수 조사) · 성격: **탐색·설계 초안 — 구현 아님, 게이트1/게이트2 상신용**
소유: architect(spec). 이 문서는 게임 서버(C++, `Channel32`) 소스 조사 결과로 delivery-domain-spec v1.1 §5.2·§6.2·§12.2를
게임측 실이식 관점에서 구체화한다. **finalcall 코드·기존 spec·게임 서버 코드는 무변경**(읽기 전용 조사 + 새 proposal 파일만).

근거(정본): `delivery-domain-spec.md` v1.1(§5 claim·§6.2 boundary·§7.2 스키마·§8 D-A~D-H·§12.2 phase-2·§13 게이트2 3건),
`game-db-survey.md` v0.1(new_sp 조사·U1/U3), `game-item-skill-format.md`(itm_skill 패킹·level 0-based),
`api-contract.md` §4.6(게임 claim DB 프로토콜 주). 게임 소스 = `D:\private_server\SP\gameserver\season5-250326\Channel32\`.

조사 파일: `MySQL.cpp`(DB 계층)·`MySQL.h`·`GameServer.cpp`(로그인/접속 흐름)·`ServerPackets.h`·`Channel32.vcxproj`.

---

## 0. ★ 게이트2 결정 요약 (맨 앞 · 되돌리기 어려운 결정 · 사용자 상신 대상)

phase-2는 **게임 서버 재컴파일 + (조건부) 게임 DB 스키마 변경**을 수반한다. 아래는 착수 전 확정이 필요한 되돌리기 어려운 결정이다.
**G0(스키마 정체성)이 최상위 선결**이며, 그 답에 따라 G2~G4의 형상이 갈린다.

| # | 결정 | 조사 결론(추천) | 되돌리기 비용 |
|---|---|---|---|
| **G0** | **게임이 실제로 읽는 스키마 = ?** (★최우선 선결) | 조사한 `Channel32` 코드는 **`new_sp`가 아니라 다른 스키마**(`users`/`items`/`messages`/`itemreceive`/`friends`/`cardshop`/`equipments`/`active_list`)를 참조한다(§1). 접속 DB는 런타임 `dbServer.databaseName`(ServerConfig)로 하드코딩 아님. **우편함(`item_delivery`)을 게임이 읽으려면 "게임이 붙는 스키마"와 "웹이 쓰는 스키마"가 같은 finalcall-mysql 안에서 정합해야 한다** — 현재 survey(new_sp)와 코드(`items`/`users`)가 어긋난다. **사용자 확인 필수**(§1·미해결 U0) | 매우 큼(전 쿼리 이식 대상 결정) |
| **G1** | claim 훅 위치 | **ServerJoin(접속·캐릭터 로드) 핸들러** `GameServer.cpp` L1207~L1414 — 기존 memo·item-receive 우편함을 드레인하는 바로 그 자리에 `item_delivery` claim 루프 추가(§2). 선례 = UserShop2Return 회수 루프(L1354~L1375) | 중간 |
| **G2** | materialize = **재컴파일 C++ boundary** | boundary 번역(level−1·itm_skill 재패킹·usr_id 매핑·gf 절대→상대)은 전적으로 재컴파일 게임 서버 소속(memo 선례). `InsertNewItem`(MySQL.cpp L548) 이식·확장(§3). 웹은 좌측 정본 값만 우편함에 실음 | 큼(재컴파일 필수) |
| **G3** | `itm_uuid` 폭·UK | **조사 코드의 `items.itm_uuid`는 `int`처럼 취급**(`InsertNewItem`이 `int uuid`를 `%d`로 삽입, L555)이라 char(40) UK 전제와 불일치. new_sp.user_item은 char(40)(survey §2.2). **멱등 UK는 char(40) 스키마에서만 성립** → 대상 스키마의 uuid 컬럼을 char(40)로 확정하고 UK 신설 + 게임 삽입 코드가 웹 40자 UUID를 그대로 저장하도록 재작성(§4) | 큼(스키마+코드) |
| **G4** | materialize 트랜잭션 경계 | 게임 DB 계층은 **auto-commit·단문 쿼리**(`mysql_query` 개별 실행, 명시 TX 없음). claim CAS→InsertNewItem→ack CAS를 원자 보장하려면 재컴파일 시 **명시적 트랜잭션 래핑** 도입 필요(§2.3). 미도입 시 멱등키(UK)+리스가 안전망 | 중간 |
| **G5** | 만실 회수(DEFERRED) | `GetValidSlot`(L527) 만실 시 −1 반환 → claim을 DEFERRED로 되돌림. 선례 = UserShop2Return의 "인벤 부족" 메모 + 보류(L1358~L1377). 용량 = `users.usr_nslots`(GetnSlots, 기본 24~최대 96)(§3.4) | 낮음 |
| **G6** | boundary 번역 확정 | level −1(0-based 확정), itm_skill=`percent*1e6+skill1*1e3+skill2`(reference §1, 검증 완료), **gf는 절대시각이 아니라 "일수(INTERVAL DAY)"로 삽입됨**(L555 — 신규 boundary 발견), 마법 skill1 부재 재패킹(U1 잔여)(§3.2) | 큼 |

**요지**: phase-2의 진짜 관문은 claim 알고리즘이 아니라 **G0(게임이 붙는 스키마 정체성)**다. 조사한 게임 코드가
survey된 new_sp와 테이블/컬럼명이 계통적으로 다르므로, "웹이 쓴 우편함을 게임이 어느 스키마에서 읽는가"를 먼저 확정해야 나머지가 결정된다.

---

## 1. ★ G0 — 스키마 정체성 불일치 (최우선 발견)

delivery-spec·survey는 게임이 `new_sp`의 `user_item`·`user`·`user_memo`를 읽는다고 전제한다. 그러나 **조사한 `Channel32`(season5-250326)
소스는 다른 이름의 스키마를 참조한다.** 전 쿼리를 `MySQL.cpp`에서 전수 확인했다.

| survey(new_sp) 이름 | 조사 코드(`Channel32`) 실제 참조 | 근거(MySQL.cpp) |
|---|---|---|
| `user` | **`users`** | L49 `FROM users`, L393 `GetUserInfo`, L516 `GetnSlots` |
| `user`.`usr_inventory` | **`users.usr_nslots`** | L516 `SELECT usr_nslots FROM users` |
| `user_item` | **`items`** | L458 `GetUserItems`, L555 `INSERT INTO items`, L530 `GetValidSlot` |
| `user_memo` | **`messages`** | L2049 `INSERT INTO messages`, L2070 `SELECT ... FROM messages` |
| `user_memo` 컬럼(`memo_reciever`·`memo_level_gender`·`memo_state`) | **`messages`.`username`·`levelAndGender`·`sent`** | L2070 `SELECT Num, sender, levelAndGender, msg, ... FROM messages WHERE username=? AND sent=0` |
| `user_friend` | **`friends`** | L2205 `INSERT INTO friends`, L2212 |
| `usershop_box`/`cardshop_bank` | **`cardshop`/`cardshopbank`** | L1422 `INSERT INTO cardshop`, L1923 `cardshopbank` |
| `user_active` | **`active_list`** | L68·L144 `active_list` |
| `user_equipments` | **`equipments`** | L939·L972 `equipments` |
| (gift 큐) | **`itemreceive`·`itembuylist`** | L2110·L2118·L2163 |

- **접속 DB는 하드코딩 아님**: `MySQL::MySQL()`(L9~L38)이 `mysql_real_connect(..., dbServer.databaseName, 3306, ...)`로 붙는다 —
  DB명은 `ServerConfig`의 `dbServer`가 런타임 결정. 세션 charset은 `euckr`로 고정(L28~L30) — utf8mb4인 finalcall과 인코딩 경계 문제 잠재.
- **함의**: 이 코드가 그대로 finalcall-mysql에 붙으면 `new_sp`가 아니라 `users`/`items`/`messages`… 스키마를 기대한다.
  survey가 조사한 `new_sp`(user_item char40 등)와 **코드가 기대하는 스키마가 다르다.** 둘 중 하나가 참이어야 phase-2가 성립한다:
  - **(가)** 실제 운영 대상 스키마는 `items`/`users`(코드 기준)이고 survey의 new_sp는 다른 시즌 덤프였다 → 우편함 계약의 boundary 매핑(§6.2)이 `user_item` 컬럼을 가정한 것을 `items` 컬럼으로 재작성해야 한다.
  - **(나)** 대상은 new_sp이고 이 `Channel32` 코드는 구/타 버전이라 **DB 접근 계층 전체를 new_sp 테이블/컬럼명으로 이식(재컴파일)** 해야 한다. memo 도메인이 new_sp.user_memo로 이미 구현됐다면(메모리 노트) 이 코드의 `messages`와도 어긋나므로, memo 실이식 시 이미 같은 이식이 필요했을 것 — **memo phase 실이식 실제 대상 스키마를 확인하면 G0가 풀린다.**
- **결정 필요(게이트2·사용자)**: **게임이 붙을 최종 스키마를 못박고**, 우편함 boundary 매핑을 그 스키마 컬럼명 기준으로 확정한다. 이것이 확정돼야 §3·§4가 확정된다.

> 이하 §2~§5는 **조사 코드의 실제 함수·쿼리**를 근거로 claim을 구체화하되, 컬럼명은 G0 확정 후 대상 스키마로 치환된다는 전제다(현재는 코드 실측명 `items`/`users`로 서술).

---

## 2. claim 훅 지점 (delivery-spec §5.2 discover/claim/apply/ack의 물리 위치)

### 2.1 1차 훅 = ServerJoin(접속·캐릭터 로드) 핸들러

`GameServer.cpp` L1207~L1414(ServerJoin 처리)이 **접속 시 우편함 드레인의 정본 자리**다. 이미 두 개의 "우편함"을 여기서 처리한다:

- 메모: `GetStoredMessagesCount`→루프 `GetStoredMessages(RMR, usr_name, i)`→`MemoReceiveMessage` 전송→`GetStoredMessagesSent`(sent=1) (L1334~L1345).
- 아이템 수신(gift): `GetStoredItemReceiveCount`→루프 `GetStoredItemReceive`→`ItemReceiveMessage`→`GetStoredItemReceiveSent` (L1347~L1353).
- 상점 반환 아이템 회수: `UserShop2ReturnCount`→루프에서 **빈 슬롯 확인 후 materialize**(`UserShop2ReturnTrans`=GetValidSlot+UPDATE items)→`ItemReceiveMessage`, **만실이면 "인벤토리가 부족하여…" 메모 후 보류**(L1354~L1378). → **이것이 claim+DEFERRED의 직접 선례다.**

그 뒤 `GetUserItems`(L1379)로 인벤을 다시 읽어 `ServerJoinUserDataMessage`(L1392)로 클라에 인벤 전체를 내려보낸다.
**claim 루프는 L1353(item-receive 드레인 직후)~L1379(GetUserItems 전) 사이에 삽입**하는 것이 자연스럽다 — materialize 후 GetUserItems가 새 아이템을 포함해 렌더하므로 별도 push 불요.

의사 삽입 지점:
```
... GetStoredItemReceiveSent(usr_name);              // 기존
+   ClaimPendingDeliveries(Info.usr_id, Info.usr_name, Info.nSlots);  // 신규: 우편함 claim 루프
    ... UserShop2Return 회수 ...
    GetUserItems(Info.usr_id, ...);                   // 기존: 새 아이템 포함해 렌더
    ServerJoinUserDataMessage(...);                  // 기존
```

### 2.2 2차 훅 = Redis 신호 수신 시 (접속 중 실시간)

delivery-spec §3.3의 best-effort 신호(`delivery:{recipientUserId}`)를 접속 중 받으면 즉시 claim. 단 조사 코드에는 **Redis 클라이언트가 없다**(순수 MySQL). 실시간 claim은 재컴파일 시 신규 도입 부담이 있으므로, phase-2 최소범위는 **접속 시 claim(1차 훅)만**으로도 정확성 백스톱이 성립한다(delivery-spec §3.3 "접속 시 무조건 조회"가 백스톱). Redis 실시간 훅은 phase-2 내 선택 티켓으로 분리.

### 2.3 트랜잭션 경계(G4)

`MySQL.cpp`의 모든 쓰기는 **개별 `mysql_query` auto-commit**(명시 TX·`START TRANSACTION` 없음, 예: ItemTransfer L1817이 UPDATE 단문). 따라서 claim CAS→InsertNewItem→ack CAS 3단이 원자적이지 않다. 안전 근거:
- 크래시로 CLAIM~APPLY 중단 시 → 웹 sweeper 리스 만료 재청구(delivery-spec §5.2) → 재접속 시 재materialize.
- 재청구로 두 번 INSERT돼도 → `itm_uuid` UK(G3)가 두 번째를 no-op(멱등). → **UK가 없으면 이중 지급 위험** → G3가 G4의 안전 전제.
- 강화안(선택): 재컴파일 시 claim~ack를 `mysql_query("START TRANSACTION")`/`COMMIT`으로 래핑. 권장이나 UK+리스가 있으면 필수는 아님.

---

## 3. materialize — 우편함 스냅샷 → 게임 인벤 행 (boundary 번역 확정)

정본 삽입 함수 = `MySQL::InsertNewItem`(MySQL.cpp L548~L558):
```cpp
int MySQL::InsertNewItem(MyCharInfo *Info,int item,int gf,int level,int skill,int uuid, char* first_owner, int balance_cash) {
    int validslot = GetValidSlot(Info->usr_id, Info->nSlots);
    if(validslot == -1) return validslot;                 // 만실 → −1
    if(item < 2000 && level > 8 && Info->usr_id > 10) level = 0;   // 카드 레벨 클램프(0~8)
    _snprintf(buffer,999,"INSERT INTO items VALUES (0,%d,%d,%d,DATE_ADD(NOW(), INTERVAL %d DAY),%d,%d,%d,'%s',%d,CURRENT_TIMESTAMP)",
        validslot, Info->usr_id, item, gf, level, skill, uuid, first_owner, balance_cash);
    mysql_query(connection, buffer);
    return validslot;
}
```
컬럼 순서 = (itm_id=0, itm_slot, itm_usr_id, itm_type, itm_gf, itm_level, itm_skill, itm_uuid, first_owner, ?balance_cash, create_date).
claim은 이 함수를 재사용/확장해 우편함 1행을 1 INSERT로 재료화한다.

### 3.1 boundary 매핑표 (우편함 자족 스냅샷 → InsertNewItem 인자)

| 우편함 컬럼(delivery-spec §7.2) | InsertNewItem 인자 | 변환 규칙(재컴파일 C++) | 근거 |
|---|---|---|---|
| `type_code`(INT 4자리) | `item` (=itm_type) | **1:1 직결** | reference §4·survey §2.2 |
| `level`(1-based 1~9) | `level` (=itm_level) | **`level − 1`**(0-based). 카드는 InsertNewItem 내부 클램프(≤8)와 정합 | reference §2·§6, L553 |
| `skill1_code`·`skill2_code`·`skill_percent` | `skill` (=itm_skill) | **재패킹** `itm_skill = percent*1,000,000 + skill1*1,000 + skill2` (검증: 31159372=31·159·372). 게임은 itm_skill을 **불투명 int로 저장**(C++에서 분해 안 함, 클라가 언팩) → 재패킹은 claim 코드 책임 | reference §1, MySQL.cpp 전수(분해 코드 부재) |
| `gf_expire_at`(절대 DATETIME6) | `gf` (=일수) | **★신규 발견: InsertNewItem은 gf를 "지금부터 일수"로 받아 `DATE_ADD(NOW(), INTERVAL gf DAY)` 삽입**(L555). 절대시각 아님 → claim은 `gf = DATEDIFF(gf_expire_at, NOW())` 변환, 또는 절대시각 직삽입 변형 함수 신설 | L555 |
| `item_uuid`(char40) | `uuid` (=int?!) | **★불일치(G3)**: 인자가 `int uuid`라 40자 UUID를 담지 못함 → §4 참조. char(40) 저장 경로로 재작성 필요 | L548·L555 |
| `recipient_nickname`(char16) | `Info->usr_id` | 닉네임→usr_id 매핑은 `userIdCheck`(L3250 `SELECT usr_id FROM users WHERE usr_name=?`)/`CheckId`(L2053) 재사용 | L3250 |
| (게임 슬롯) | `GetValidSlot` 반환 | 게임이 빈 슬롯 자동 배정(§3.4) | L527 |
| `first_owner` | `first_owner` | 최초 소유자 닉 스냅샷 문자열 | L555 |

### 3.2 U1 잔여 — 마법 skill1 부재 재패킹

reference §3: 마법 카드(itm_type sub 3)는 **스킬1이 구조적으로 없고 슬롯1(가운데 3자리)에 스킬2 코드가 들어간다.** 따라서 재패킹은:
- 무기·방어구(skill1 존재): `percent*1e6 + skill1*1e3 + skill2`.
- 마법(skill1 부재, `skill1_code` NULL): 슬롯1에 skill2 코드 배치 → `percent*1e6 + skill2*1e3 + 0` 형태 추정(reference §3 "슬롯1=스킬2"). **정확한 마법 재패킹은 실데이터 대조 필요(U1 잔여)** — new_sp/sp_2019 마법 개체 itm_skill 역산 또는 클라 언팩 코드 확인.

### 3.3 usr_id 폭(U3)

- 이 코드는 usr_id를 **int로 취급**: `MyCharInfo.usr_id` int, `items.itm_usr_id` int, 패킷 `ServerPackets.h` L1105(주석 구조체) `int itm_usr_id`. `Login`/`GetUserInfo`/`userIdCheck` 모두 `atoi`(int).
- 즉 **이 코드 계통 스키마에서 usr_id는 int-폭**이라 survey가 우려한 smallint(≤32767) 제약은 **이 코드에는 나타나지 않는다**(new_sp.user.usr_id smallint와는 또 다른 지점 — G0 불일치의 연장). 다만 **클라가 usr_id를 몇 바이트로 읽는지**(ServerJoinUserDataMessage/UserInfo 직렬화 폭)는 미확인 → U3 완전 해소는 클라 패킷 직렬화 확인 필요. 조사 범위에서 int 저장은 확인, 클라 노출 폭 미확인.

### 3.4 빈 슬롯 배정·용량·만실

- 빈 슬롯: `GetValidSlot(usr_id, maxslots)`(L527) — `items`에서 사용 슬롯을 뺀 첫 빈 칸, 없으면 −1.
- 용량: `GetnSlots(usr_id)`(L513 `SELECT usr_nslots FROM users`), 기본값 실패 시 96. `GetUserItems`는 96 슬롯을 순회(L463) → **최대 96**, 웹과 동일(delivery-spec §6.2).
- 만실: `GetValidSlot`=−1 → `InsertNewItem`=−1 → claim은 **DEFERRED로 CAS 되돌림**(delivery-spec §5.2 (5)). 선례 = UserShop2Return의 만실 메모+보류(L1358~L1377). 클라에는 "인벤 부족" 안내 메모 발신 재사용 가능.

---

## 4. `itm_uuid` UK 신설 판정 (G3 · 멱등 apply 전제)

- **현 상태**: `InsertNewItem`/`InsertItem`(L1408) 모두 `int uuid`를 받아 `%d`로 삽입 → 이 코드 계통의 `items.itm_uuid`는 **정수 취급**(트랜잭션 카운터 추정). 반면 survey된 new_sp.user_item.itm_uuid는 **char(40)·36자 UUID**(survey §2.2). 또 하나의 G0 불일치.
- **멱등 UK 성립 조건**: delivery-spec §5의 exactly-once 효과는 **`itm_uuid char(40)` UK + 웹 발급 40자 UUID를 게임이 그대로 저장**해야 성립한다. 정수 uuid로는 웹 UUID를 담을 수 없다.
- **판정**:
  - **가능성**: 대상 스키마의 uuid 컬럼을 **char(40)로 확정**(new_sp는 이미 char40)하고 **UK 신설**은 기술적으로 가능. 재컴파일로 삽입 코드를 `char* uuid`(40자)로 바꿔 웹 UUID를 그대로 심으면 된다.
  - **게임 코드 영향**: `InsertNewItem`/`InsertItem` 시그니처의 `int uuid`→`const char* uuid`, `%d`→`'%s'` 변경. 이 두 함수 호출부(GameServer.cpp 다수 — L4043·L4248~L4366·L5512 등, gameshop 구매·어드민 지급 경로)가 현재 int uuid를 넘기므로 **전 호출부가 40자 UUID 발급 규약으로 전환**되거나, claim 전용 오버로드(`InsertDeliveredItem(...char* uuid...)`)를 신설해 **claim 경로만 char(40) 삽입**하고 나머지는 그대로 두는 편이 안전(영향 최소화 추천).
  - **new_sp 영향**: UK 추가 = `ALTER TABLE ... ADD UNIQUE(itm_uuid)`. **기존 데이터에 uuid 중복/NULL·비UUID 값이 있으면 UK 생성 실패** → 사전 정리 필요(survey: new_sp.user_item 5행뿐이라 저위험, 단 int-계통 items 테이블은 별도 조사 필요). **게이트2·백엔드 협의 대상.**
  - **리스크**: 게임의 다른 삽입 경로(gameshop·trade·usershop)가 uuid를 계속 정수로 넣으면 char(40) 컬럼에 정수 문자열이 섞여 UK 의미가 흐려질 수 있음 → **claim이 심는 웹 UUID만 표준 36자**임을 보장하고, UK는 그 유일성만 필요로 하므로 공존은 가능하나 **일관성 위해 삽입 경로 정리 권장**.

**결론**: itm_uuid UK 신설은 **char(40) 스키마 확정을 전제로 가능**하며, 게임 코드는 claim 전용 삽입 오버로드로 영향을 최소화하는 것을 추천. 정수-uuid 계통(`items`)이 최종 대상이면 **컬럼 타입 변경(int→char40) + 데이터 정리 + 삽입 코드 재작성**이 함께 필요(게이트2).

---

## 5. 빌드·검증 방법

### 5.1 빌드 가부

`Channel32.vcxproj` 분석:
- **툴셋 v143**(VS2022), 구성 `Release|Win32`/`Debug|Win32` 중심, **MachineX86**(32비트), `CharacterSet=MultiByte`.
- 링크 의존: `libmysql.lib`·`ws2_32.lib`·`wininet.lib`(Debug). 프로젝트 참조 `..\shared\shared.vcxproj`.
- include: `..\dep\mysql\include`·`..\shared`·**boost `C:\boost_1_86_0`**. lib: `..\dep\mysql\lib\opt`·`C:\boost_1_86_0\stage\lib`.
- **레포 내 확인된 의존**(존재): `..\dep\mysql\include\mysql.h`·`..\dep\mysql\lib\opt\libmysql.lib`·`..\dep\mysql\lib\opt\libmysql.dll`·`..\shared\shared.vcxproj` 모두 present. 실행 디렉터리에 `libmysql.dll`·`iosocketdll.bin`도 present.
- **레포 밖 필요 의존**: `C:\boost_1_86_0`(빌드+stage/lib) — 레포에 없음, 로컬 설치 필요. `stlx`·Visual Leak Detector 경로는 Debug 구성 일부에만 참조(Release는 boost만).
- **판정**: **VS2022(v143) + boost 1.86(C:\ 설치) + x86 빌드**로 빌드 가능성 높음. 단 (1) boost 1.86 로컬 설치, (2) `..\shared` 프로젝트 동반 빌드, (3) x86 MySQL C 커넥터(제공된 libmysql.lib가 x86인지) 정합이 전제. **헤드리스 리눅스/현 Windows 셸에서 MSBuild 실행 검증은 미수행**(VS 설치·boost 필요) → 빌드 실검증은 사용자 환경(VS2022) 필요.

### 5.2 claim 실검증 경로

- **정적 대조(지금 가능)**: 우편함 스냅샷 컬럼 ↔ InsertNewItem 인자 매핑(§3.1)·재패킹 식(§3.2)·CAS SQL(delivery-spec §5.2)을 코드와 대조. G0 확정 전이라도 매핑 설계 검증은 가능.
- **동적 실검증(전제 필요)**: (1) G0 스키마 확정, (2) 게임 서버 x86 빌드, (3) `dbServer`를 finalcall-mysql(3306)로 설정, (4) 웹이 `item_delivery` PENDING 1행 enqueue, (5) 해당 닉으로 게임 접속 → ServerJoin claim 루프가 materialize → `items`/`user_item`에 행 생성 + 우편함 APPLIED 확인. **G0 미확정 시 스키마 불일치로 동적 실검증 불가** → 정적 대조까지가 현 단계 한계.

---

## 6. 게이트1 분해안 초안 (하위 티켓·의존 · 게임 C++ vs Java 우편함측 구분)

phase-2 = **게임 서버(C++) 조정 중심 + Java 우편함측 소량 보조**. 웹 1단계(FC-186~191)가 우편함·enqueue·상태머신을 이미 확정/구현하므로,
phase-2는 그 계약을 게임이 실제로 소비한다. **PC-0(G0 확정)이 전 티켓의 선결.**

| 티켓(안) | 소속 | 내용 | 의존 | 게이트 |
|---|---|---|---|---|
| **PC-0** | 조사/사용자 | **G0 스키마 정체성 확정** — 게임이 붙을 최종 스키마·테이블/컬럼명, uuid 폭, memo phase 실대상 스키마 대조 | — | **게이트2**(선결) |
| **PC-1** | 게임 C++ | claim 훅 삽입 — ServerJoin(L1353~L1379)에 `ClaimPendingDeliveries` 루프(discover→claim CAS→apply→ack CAS, delivery-spec §5.2) | PC-0 | 게이트2(훅 위치) |
| **PC-2** | 게임 C++ | materialize/boundary 포맷터 — InsertNewItem 확장/오버로드(level−1·itm_skill 재패킹·gf 절대→일수·usr_id 매핑·char40 uuid) | PC-0, PC-1 | 게이트2(boundary 확정) |
| **PC-3** | 게임 스키마+C++ | `itm_uuid` char(40) 확정 + UK 신설 + 삽입 코드 char40 전환(claim 오버로드) + 기존 데이터 정리 | PC-0 | **게이트2**(스키마) |
| **PC-4** | 게임 C++ | 만실 DEFERRED·리스 상호작용 — GetValidSlot=−1 시 DEFERRED CAS + 클라 안내 메모(UserShop2Return 선례) | PC-1, PC-2 | 자동 |
| **PC-5**(선택) | 게임 C++ | Redis 실시간 신호 훅(`delivery:{userId}`) 구독 — 접속 중 즉시 claim(신규 Redis 클라 도입) | PC-1 | 게이트2(신규 의존) |
| **JB-1**(보조) | Java 우편함 | enqueue 스냅샷이 **대상 스키마 boundary가 요구하는 값을 자족 충족하는지** 최종 검증(gf 절대시각·skill 분해·닉 스냅샷). 필요 시 컬럼 조정은 게이트2 별건(형상 변경) | PC-0 | 조건부 게이트2 |
| **JB-2**(보조) | Java 우편함 | 리스 만료 재청구 sweeper·APPLIED→IN_GAME reconciler가 게임 claim과 실연동되는지 통합 관측(FC-188과 중복 아니면 검증만) | PC-1~4 | 자동 |
| **PC-R**(리뷰) | reviewer | 멱등(재청구 이중 apply=UK no-op)·만실 DEFERRED·boundary 재패킹 정확성·TX 경계 검증 | PC-1~4 | 게이트3 |

- **C++ 이식 = PC-1~5**(재컴파일 필수). **Java 우편함측 보조 = JB-1·JB-2**(대개 검증·소량 조정, 큰 변경은 게이트2 별건).
- 병렬성: PC-3(스키마·UK)는 PC-1/PC-2와 파일 무교차라 병행 가능. PC-2는 PC-1 훅에 의존.

---

## 7. 미해결 · 사용자 확인 필요

| # | 항목 | 확인 방법 |
|---|---|---|
| **U0(★최우선)** | **G0 스키마 정체성** — 게임이 붙을 최종 스키마가 `new_sp`(user_item…)인가 코드 계통(`items`/`users`/`messages`…)인가. memo phase가 실제 이식한 대상 스키마가 곧 정답 | 사용자 확인 + memo 실이식 산출물 대조 |
| **U1(잔여)** | **마법 카드 itm_skill 재패킹** — skill1 부재 시 슬롯1에 skill2 코드 배치식 확정(reference §3) | new_sp/sp_2019 마법 개체 itm_skill 역산 또는 클라 언팩 코드 |
| **U3(잔여)** | **usr_id 클라 노출 폭** — 저장은 int 확인, 클라가 2바이트로 읽는지 미확인 | ServerJoinUserDataMessage/UserInfoMessage 직렬화 폭 확인 |
| **U7** | **게임 재컴파일 가부·빌드 환경** — VS2022(v143)+boost 1.86+x86 MySQL 커넥터로 실제 빌드 성공 여부. 헤드리스 미검증 | 사용자 VS2022 환경에서 빌드 시도 |
| **U8** | **TX 경계(G4)** — claim~ack 명시 트랜잭션 래핑을 도입할지, UK+리스 안전망으로 갈지 | 게이트2 결정 |
| **U9** | **인코딩 경계** — 게임 세션 charset `euckr`(L28) vs finalcall utf8mb4. 닉네임(한글)·아이템명 경계에서 깨짐 여부 | 통합 시 실측 |
| **U10** | **itm_gf 의미** — gf가 "일수"로 삽입되는데(L555) 우편함 `gf_expire_at`(절대) 변환 시 임대 아이템만인지, 영구 아이템의 gf 처리(예: 999·2000 등 큰 값 관측, L4248) | 코드·데이터 확인 |

---

## 8. 무변경 확인

- 게임 서버 소스·finalcall 코드·기존 spec: **읽기만** 수행, 무변경.
- 신규 파일: 본 proposal 1건(`docs/spec/proposals/game-claim-phase2-proposal-v0.1.md`)뿐.
- 인용은 전부 파일·함수·라인 단위(MySQL.cpp/GameServer.cpp/ServerPackets.h/Channel32.vcxproj).
