# FinalCall Auction Domain Spec (경매 도메인 스펙)

상태: v0.2 — FC-025(EPIC-AUCTION 계약/설계 확정, architect) 산출 + **게이트2 결정 반영(2026-07-18, 전건 승인)**. 기존 정본(api-contract §3.1·§3.3·§5, erd §4.2·§5·§6, domain-spec §3·§4·§5)의 **검증·구현 슬라이싱·갭 식별**을 담는다. EPIC-ITEM 산출(item-domain-spec v0.2) 및 실구현(`domain/item/*`)과 정합.
소유: architect (spec). 게이트2 6항목(a~f + G6) 전부 승인 완료(§9) → 구현 착수 근거.
근거: api-contract v1.7 §3.1·§3.3·§5, erd v0.9 §2(결정 플래그 B)·§4.2·§5·§6, domain-spec v0.5 §3·§4·§5, item-domain-spec v0.2(LISTED 전이 경계), CLAUDE.md 섹션 5(도메인 컨벤션), D-004·D-005·D-008·D-045.
범위: 정본을 대체하지 않는다. **본 문서는 EPIC-AUCTION 구현 지침(엔티티·FSM·에스크로 전이·응답 필드·에러코드·슬라이싱)의 단일 참조점**이며, 스키마/계약 변경이 필요한 항목은 §7(갭)·§9(게이트2)로 분리해 상신 대상으로 표시한다.

**EPIC-AUCTION 경계(게이트1 승인 2026-07-18)**: 등록·목록·상세·판매자취소 + FSM 전이 **SCHEDULED/ACTIVE/CANCELLED만** 소유. 입찰(`/bids`)=EPIC-BID, 즉시구매(`/purchase`)·마감·정산·주문=EPIC-CLOSING, 고정가(shop)=EPIC-SHOP. SOLD/UNSOLD 전이·resultType 세팅은 본 에픽 밖이다.

---

## 1. 대상 엔티티·엔드포인트

- 엔티티(erd §4.2): `auction`(신규). `bid`·`money_hold`·`sale_order`는 **미도입**(각 EPIC-BID·EPIC-CLOSING).
- 엔드포인트(api-contract §3.1):
  - `POST /auctions`(등록 — 인증 필요), `GET /auctions`(목록 — cursor, 불요), `GET /auctions/{auctionPublicId}`(상세 — 불요), `POST /auctions/{auctionPublicId}/cancel`(판매자 취소 — 인증 필요).
  - **범위 밖(본 에픽 제외)**: `POST /auctions/{id}/bids`·`GET /auctions/{id}/bids`(EPIC-BID), `POST /auctions/{id}/purchase`(EPIC-CLOSING), `POST /admin/auctions/{id}/force-cancel`(관리자, 백로그).
- 교차 도메인: item(EPIC-ITEM done) — 등록/취소가 `item_instance.location`을 INVENTORY↔LISTED로 전이(에스크로). item-domain-spec §3.1은 이 LISTED 전이 소유를 **auction 에픽**으로 명시했다.

---

## 2. auction 엔티티 정의 (필드·타입·제약)

논리 타입은 erd §4.2 기준, 물리 타입은 item 도메인 스타일(BIGINT id AUTO_INCREMENT, CHAR(26) ULID, DATETIME(6) UTC, ENUM은 VARCHAR + `@Enumerated(STRING)`)을 승계한다. 공통 컬럼(id·created_at, 갱신 대상 updated_at)은 표에서 생략(BaseTimeEntity 상속 — auction은 상태 변경이 있어 updated_at 필요, soft delete 없음).

| 컬럼 | 타입 | 널 | 키 | 비고 / 출처 |
|---|---|---|---|---|
| public_id | CHAR(26) ULID | N | UK | 외부 식별자(B-004). 서버 발급 |
| seller_id | BIGINT | N | FK→user | 판매자 = 등록자(SecurityContext 주체) |
| item_instance_id | BIGINT | N | FK→item_instance | 출품 아이템(에스크로 대상) |
| start_price | BIGINT | N | | 시작가. 요청 body |
| buy_now_price | BIGINT | Y | | 즉시구매가(선택, > start_price). 요청 body. **본 에픽은 저장만**(구매 로직=EPIC-CLOSING) |
| status | ENUM(VARCHAR 20) | N | | SCHEDULED/ACTIVE/SOLD/UNSOLD/CANCELLED. 본 에픽 세팅값 = SCHEDULED·ACTIVE·CANCELLED |
| result_type | ENUM(VARCHAR 20) | Y | | BID/BUYNOW(SOLD일 때). **본 에픽 미사용**(항상 NULL) |
| highest_bid_amount | BIGINT | Y | | 현재 최고가(비정규화). **본 에픽 항상 NULL**(입찰=EPIC-BID) |
| highest_bidder_id | BIGINT | Y | FK→user | 현재 최고입찰자. **본 에픽 항상 NULL**. cancel "입찰 0건" 판정 앵커(§9-e) |
| start_at | DATETIME(6) | Y | | 예약 시작. NULL이면 즉시 ACTIVE 생성 |
| end_at | DATETIME(6) | N | | 마감 시각(소프트클로즈로 갱신 — 갱신은 EPIC-BID/CLOSING) |
| base_end_at | DATETIME(6) | N | | 최초 마감(연장 기준). 등록 시 = end_at |
| max_end_at | DATETIME(6) | N | | 총연장 상한(D-004 필수). 요청 body |
| soft_close_window_sec | INT | N | | 트리거 윈도우. 요청 body(optional) → 미지정 시 서버 기본(§9-c) |
| soft_close_extend_sec | INT | N | | 연장폭. 요청 body(optional) → 미지정 시 서버 기본(§9-c) |
| extension_count | INT | N | | 누적 연장 횟수. 등록 시 0. **본 에픽 갱신 안 함** |
| item_name_snapshot | VARCHAR(100) | N | | 등록 시점 표시명 스냅샷(D-045) = template.displayName |
| item_spec_snapshot | VARCHAR(255) | N | | 등록 시점 핵심 스펙 요약 스냅샷(§2.1) |

- soft delete 없음(경매는 CANCELLED 종료 상태로 보존, 이력 삭제 아님) → D-081 패턴 불요. `BaseTimeEntity` 상속(item_instance 선례, G10 대칭).
- `@Setter` 금지(섹션 5). 상태 전이는 전용 도메인 메서드(§4.2)로만.

### 2.1 스냅샷 파생 규칙 (D-045)
등록 시점 item_instance·template에서 서버가 스냅샷을 채운다(이력 정합 — 이후 시드/템플릿 개편에도 등록 당시 표시 고정).
- `item_name_snapshot` = `template.displayName`.
- `item_spec_snapshot` = 인스턴스 핵심 스펙 요약 문자열(예: `"Lv.{level} / skill1={skillCode?}/skill2={skillCode?} / {skillPercent}% / GF={gfExpireAt?}"`). 구체 포맷은 backend-impl 자율(255자 이내). live 값(현재 소유자 등)은 스냅샷에 넣지 않는다.
- 주(혼동 방지, item-spec §5.2 대칭): 목록/상세 응답의 item 블록은 **live template·instance join**(typeCode·level·skill 등)과 **auction의 nameSnapshot/specSnapshot**을 함께 싣는다. snapshot은 auction 컬럼이고 나머지는 조인이다.

---

## 3. 상태 머신 (domain-spec §5) — 본 에픽 소유 전이

경매 FSM 전체(domain-spec §5):
```
SCHEDULED --(startAt 도달)--> ACTIVE
ACTIVE --(마감 & 유효 입찰)--> SOLD (resultType=BID)      [EPIC-CLOSING]
ACTIVE --(즉시구매)---------> SOLD (resultType=BUYNOW)    [EPIC-CLOSING]
ACTIVE --(마감 & 입찰 없음)--> UNSOLD                      [EPIC-CLOSING]
SCHEDULED | ACTIVE --(취소)--> CANCELLED                  [EPIC-AUCTION]
SOLD / UNSOLD / CANCELLED = terminal
```

**EPIC-AUCTION이 소유하는 전이(구현 대상):**
| 전이 | 트리거 | 소유 | 방식 |
|---|---|---|---|
| (생성) → SCHEDULED | 등록 & startAt이 미래 | EPIC-AUCTION | INSERT status=SCHEDULED |
| (생성) → ACTIVE | 등록 & startAt NULL 또는 ≤ now | EPIC-AUCTION | INSERT status=ACTIVE |
| SCHEDULED → ACTIVE | startAt 도달 | **본 에픽=lazy 파생**(§9-a) / 영속 전이=EPIC-CLOSING 워커(domain-spec §9 예약시작) | 조회 시 파생. 마감 워커 미구현이라 본 에픽은 DB 영속 전이 안 함 |
| SCHEDULED\|ACTIVE → CANCELLED | 판매자 취소(입찰 0건 & SCHEDULED\|ACTIVE) | EPIC-AUCTION | CAS UPDATE(§4.2) |

- **취소 허용 조건(게이트2 G6 결정, 2026-07-18)**: "입찰 0건 & (SCHEDULED | ACTIVE)"에서. domain-spec §5 문언("SCHEDULED|ACTIVE→CANCELLED")과 정합하도록 계약을 정밀화했다(계약 v1.7 §3.1 — 종전 "ACTIVE만" 폐기). 예약 경매(SCHEDULED)도 startAt 도달 전에 판매자가 취소해 에스크로 아이템을 회수할 수 있다(잠김 해소). 판정 = `status IN (SCHEDULED, ACTIVE) AND highest_bidder_id IS NULL`(§9-e). 종료 상태(SOLD/UNSOLD/CANCELLED) 취소 시도 → AUCTION_006(409). 입찰 존재 시 → AUCTION_007(409). **G6 해소.**

---

## 4. item 에스크로 전이 (INVENTORY↔LISTED) — 교차 도메인 핵심

item-domain-spec §3.1이 LISTED 전이 소유를 auction 에픽에 위임했다. 실구현 정합을 위해 EPIC-ITEM 코드를 검증했다.

### 4.1 등록: INVENTORY → LISTED (CAS 단일 승자)

**검증 결과 — `ItemInstance.markListed()`(실코드 line 118~122)는 CAS가 아니다.** dirty-checking으로 `location=LISTED`만 세팅하는 PK UPDATE라, 두 트랜잭션이 같은 INVENTORY 아이템을 동시에 읽고 각자 LISTED로 쓰면 **양쪽 다 성공**한다(중복 출품 미방지). erd §5는 "활성 리스팅 부분 유니크 인덱스 불요 — INVENTORY→LISTED CAS 단일 승자로 보증"이라 명시했으므로, **조건부 CAS UPDATE가 필수**다.

- **구현 지침(FC-026)**: `ItemInstanceRepository`에 `@Modifying` 조건부 UPDATE 추가 —
  ```sql
  UPDATE item_instance SET location='LISTED', slot_no=NULL
   WHERE id = :id AND location='INVENTORY'
  ```
  영향 행 수로 판정: **1이면 선점 성공, 0이면 실패**(이미 LISTED 또는 TEMP). `markListed()`(dirty-checking)에 의존하지 않는다.
- **선검사(CAS 전, 명확한 에러 매핑용)**: 소유자 검증(`isOwnedBy(sellerId)`, SecurityContext 주체) → 실패 시 AUCTION_001(§6). item not found → AUCTION_001(§9-f 결정 종속).
- **CAS 실패(0행) 후 원인 분기**: item location 재조회 —
  - `LISTED` → AUCTION_002(이미 출품중, 409).
  - `TEMP` → AUCTION_001(미보유 — 인벤토리에 없음. §9-f 결정 종속).
- **`@DistributedLock`(E1)**: CAS가 DB 단일 승자를 보증하므로 등록엔 앱락 불요("정합성은 DB", domain-spec §8). 락은 경합 완화 수단일 뿐(백엔드 자율).
- **동일 TX**: auction INSERT + item CAS UPDATE + 스냅샷 채움이 한 트랜잭션. CAS 실패 시 auction INSERT도 롤백.

### 4.2 취소: LISTED → INVENTORY(만실 시 TEMP)

계약 §3.1: "아이템 에스크로 해제(인벤토리 복귀, 만실 시 임시보관)". item-domain-spec §5.5의 relocate(TEMP→INVENTORY)와 **방향이 반대**이며, 만실 시 TEMP로 가는 오버플로우 분기가 추가된다 → EPIC-ITEM에 없는 신규 경로다.

- **동작(단일 TX, cancel과 동일)**:
  1. auction 상태 CAS: `UPDATE auction SET status='CANCELLED' WHERE id=? AND status IN ('SCHEDULED','ACTIVE') AND highest_bidder_id IS NULL`(G6 결정). 0행이면 원인 분기(종료됨→AUCTION_006 / 입찰존재→AUCTION_007).
  2. item 에스크로 해제: 판매자 인벤토리 여유 확인 —
     - `used < 96` → 빈 슬롯 자동 배정 후 `location LISTED→INVENTORY` + slot_no 세팅. slot 유일성은 DB slot_key UK(item-spec §3.2)가 최종 방어. flush 후 UK 위반은 재시도/슬롯 재배정(동시성 방어, InventoryService 선례).
     - `used ≥ 96`(만실) → `location LISTED→INVENTORY` 대신 **TEMP**: `moveToTemp()` + `temp_storage` 행 생성(owner_id, stored_at). 만실 오버플로우는 상한 없음(item-spec §2.5).
- **item 도메인 메서드 재사용/추가**: `ItemInstance.placeInInventory(slotNo)`·`moveToTemp()`는 이미 존재(재사용). 빈 슬롯 탐색(`resolveSlot`)·capacity(96) 상수·flush 매핑은 `InventoryService`에 있으나 **private**이며 TEMP→INVENTORY 전용이다. LISTED→INVENTORY/TEMP 해제 경로는 신규 → **item 도메인에 재사용 가능한 public 메서드 추가 필요**(§7 G3, 파일 교차 → FC-028이 item 파일 편집).
- **주체 인가**: 판매자 본인만(`auction.seller_id == SecurityContext 주체`). 아니면 취소 불가(계약 §3.1, 관리자 강제취소는 별도 API=백로그). 정합성 판정=SecurityContext(IDOR 방지, B-009).

---

## 5. API 응답 스펙 (§3.1·§3.3)

### 5.1 POST /auctions (등록)
- 인증 필요(판매자=주체). body: `{ itemInstancePublicId, startPrice, buyNowPrice?, startAt?, endAt, softCloseWindowSec?, softCloseExtendSec?, maxEndAt }`.
- **요청 검증(@Valid + 서비스, SEC-009 → AUCTION_008 422)**:
  - `startPrice > 0`, `buyNowPrice`(있으면) `> startPrice` → 위반 시 AUCTION_003(422).
  - `endAt > now`, `startAt ≤ endAt`(startAt 있으면), `maxEndAt ≥ endAt`, `softCloseWindowSec·softCloseExtendSec` 양수·상한 이내(§9-c) → 위반 시 AUCTION_008(422).
- 동작: §4.1 CAS 에스크로 + auction INSERT(스냅샷 §2.1) + status 결정(§9-a).
- 응답 201: `{ auctionPublicId, status, endAt }`.
- 에러: AUCTION_001(미소유·미보유), AUCTION_002(이미 출품중 409), AUCTION_003(422), AUCTION_008(422).

### 5.2 GET /auctions (목록, cursor)
- 인증 불요. 쿼리: 공통 목록 필터(§3 intro: `mainCategory, subGroup, element, kind, minLevel/maxLevel, skill1/skill2, goldforceActive, minPrice/maxPrice, status`) + cursor 페이징 + 정렬 화이트리스트 `price, endAt, createdAt, highestBidAmount`.
- content 항목 = **AuctionSummary**(§3.3):
  ```
  { auctionPublicId, status, item, startPrice, buyNowPrice?,
    highestBidAmount?, bidCount, startAt?, endAt, sellerNickname }
  ```
  - `item` 블록(§3.3 공통) = live join(item_instance+template+skill): `{ typeCode, mainCategory, subGroup, element, kind, level, skill1?, skill2?, skillPercent, goldforceExpireAt?, nameSnapshot, specSnapshot }`. nameSnapshot/specSnapshot은 auction 컬럼, 나머지는 조인.
  - `sellerNickname` = 판매자 nickname(마스킹 안 함 — 리스팅 고유 정보). `highestBidderMasked`는 상세에만.
  - **본 에픽 값**: `highestBidAmount` = null(입찰 미구현 → 필드 생략/null), `bidCount` = 0(§9-b·§9-e). `status`는 §9-a 파생 적용.
- cursor 키·정렬: 기본 `endAt asc, id`(마감 임박 순) 권고. `highestBidAmount` 정렬은 본 에픽 전건 null이라 무의미하나 화이트리스트 유지(EPIC-BID 대비). 인덱스는 §7 G5.
- 조회 범위: 기본 노출 = 진행 가능 경매(SCHEDULED·ACTIVE). `status` 필터로 종료분 조회 허용.

### 5.3 GET /auctions/{auctionPublicId} (상세)
- 인증 불요. 응답 200 = **AuctionDetail**(§3.3) = AuctionSummary + `{ resultType?, highestBidderMasked?, extensionCount, maxEndAt, createdAt }`.
  - **본 에픽 값**: `resultType` = null, `highestBidderMasked` = null(입찰 없음), `extensionCount` = 0.
  - `highestBidderMasked`(EPIC-BID 활성 시): nickname 마스킹(§3.3, item-spec §5.2 ownerMasked 규약 대칭 — 앞 2자 + `***`). public_id 미노출.
  - "남은 시간"은 클라 파생(endAt − now) 권고, 서버 미산출.
- 에러: AUCTION_004(없음, 404).

### 5.4 POST /auctions/{auctionPublicId}/cancel (판매자 취소)
- 인증 필요(판매자 본인). 동작: §4.2(auction CANCELLED CAS + item 에스크로 해제).
- 응답 200: `{ status }`(= "CANCELLED"). 대상 상태 = SCHEDULED|ACTIVE(G6 결정).
- 에러: AUCTION_006(이미 종료 409), AUCTION_007(입찰 존재로 취소 불가 409). 판매자 아님(주체≠seller_id) → AUCTION_001(403, §9-f — 미소유 통일, 열거 방지).

---

## 6. AuctionErrorCode 초안 (섹션 5 네이밍 `{DOMAIN}_{3자리}`)

계약 §5 등재분과 정합. EPIC-AUCTION 사용분만 정의(005·009는 EPIC-CLOSING/BID). ErrorCode 인터페이스 구현 enum(item `ItemErrorCode` 선례).

| enum 상수(권고) | code | HTTP | 의미 | 상태 |
|---|---|---|---|---|
| AUCTION_ITEM_NOT_SELLABLE | AUCTION_001 | **403**(§9-f 결정) | 아이템 미소유·미보유·미존재(출품 불가) | 계약 v1.7 §5 = 403 단일 확정 |
| AUCTION_ALREADY_LISTED | AUCTION_002 | 409 | 이미 출품중(item LISTED) | 계약 §5 기존 |
| AUCTION_INVALID_BUY_NOW_PRICE | AUCTION_003 | 422 | buyNowPrice ≤ startPrice | 계약 §5 기존 |
| AUCTION_NOT_FOUND | AUCTION_004 | 404 | 경매 없음 | 계약 §5 기존 |
| AUCTION_ALREADY_CLOSED | AUCTION_006 | 409 | 이미 종료(취소 대상 아님) | 계약 §5 기존 |
| AUCTION_HAS_BIDS | AUCTION_007 | 409 | 입찰 존재로 취소 불가 | 계약 §5 기존 |
| AUCTION_INVALID_TIME_PARAM | AUCTION_008 | 422 | 시간 파라미터 위반(SEC-009) | 계약 §5 기존 |

- AUCTION_005(즉시구매 미설정)·AUCTION_009(자기구매)는 EPIC-CLOSING/purchase 소유 — 본 enum 미포함(해당 에픽에서 추가).
- **AUCTION_001 = 403 단일 확정(§9-f 게이트2)**: 계약 v1.7 §5에서 "403/409" → 403 단일로 정밀화 완료. 미소유(not-owner)·미보유(owned-but-TEMP)·미존재(item-not-found)를 403으로 통일(enum code↔status 1:1 준수 + SEC-007 열거 방지). "이미 출품중"(LISTED)만 AUCTION_002/409.

---

## 7. 계약 ↔ ERD ↔ domain-spec 정합 검증 (갭 목록)

| # | 위치 | 유형 | 내용 | 조치 |
|---|---|---|---|---|
| G1 | §3.1 body vs erd auction | nullable | `softCloseWindowSec?·softCloseExtendSec?`는 계약 optional인데 erd NOT NULL. maxEndAt은 계약 required·erd NOT NULL(정합). | 미지정 시 **서버 기본값**(§9-c)으로 NOT NULL 충족. 스키마 무변경. **정합(수용)** |
| G2 | §3.1 body vs erd auction | 파생 컬럼 | `base_end_at·item_name_snapshot·item_spec_snapshot·extension_count`는 body에 없음(서버 파생/기본). | 서버 세팅(§2.1: base_end_at=end_at, snapshot=template/instance, extension_count=0). 스키마 무변경. **정합** |
| G3 | §4.2 item 에스크로 해제 | 코드 교차 | LISTED→INVENTORY(만실 TEMP) 경로는 EPIC-ITEM에 없음. `InventoryService`의 슬롯 탐색·capacity·flush 매핑은 private·TEMP→INVENTORY 전용. | **item 도메인에 재사용 public 메서드 추가**(FC-028이 item 파일 편집). 스키마 무변경. 팬아웃 판정(§8)에 반영 |
| G4 | §4.1 markListed() | 동시성 | `ItemInstance.markListed()`는 dirty-checking(PK UPDATE)이라 중복 출품 CAS 아님. | **조건부 @Modifying CAS UPDATE 필수**(§4.1). item Repository 편집(FC-026). erd §5 "CAS 단일 승자" 정합. 스키마 무변경 |
| G5 | §3.3 정렬 `highestBidAmount` | 인덱스 | 목록 정렬 화이트리스트에 `highestBidAmount` 있으나 erd auction 인덱스에 없음(있는 것: status,end_at / status,start_at / seller_id,status / item_instance_id). | 본 에픽 전건 null이라 무영향. EPIC-BID에서 정렬 실사용 시 인덱스 추가 검토(이연). `endAt/createdAt` 정렬은 기존 인덱스로 커버. 스키마 무변경(수용) |
| G6 | §3.1 cancel vs domain-spec §5 | FSM 경계 | domain-spec §5는 "SCHEDULED\|ACTIVE→CANCELLED", 계약은 ACTIVE만. SCHEDULED 취소 경로 부재로 예약 경매 에스크로가 묶일 수 있음. | **해소(게이트2 승인 2026-07-18)**: 계약 v1.7 §3.1 취소 대상을 "SCHEDULED\|ACTIVE & 입찰0"으로 정밀화. §3·§9-e 반영 |
| G7 | §3.1 AUCTION_001 | 에러코드 | HTTP "403/409" 이중 status, enum은 1:1. | **해소(게이트2 승인 2026-07-18)**: 계약 v1.7 §3.1·§5 AUCTION_001 = 403 단일. §6 반영 |
| G8 | §3.3 item 블록 vs item-spec §5.2 | 응답 필드 | 목록/상세 item 블록(§3.3)은 nameSnapshot/specSnapshot 포함, item 상세(§4.1)는 live-only. 혼동 위험. | §2.1 주로 명시(snapshot=auction 컬럼, 나머지=조인). **정합(명시)** |
| G9 | Flyway 채번 | 순서 | auction은 erd §6 group4(판매·거래). item(V6~V9) 소비 완료 → **V10**. | FC-026이 `V10__auction.sql` 단일 채번. bid/shop/sale_order는 후속 에픽(V11+). 정합 |
| G10 | 목록 status 필터 | 검증 | 필터 `status` 값이 FSM enum과 1:1인지. | AuctionStatus enum 전체(§9-d) 정의로 커버. 화이트리스트 검증. 정합 |

요약: 스키마 변경 갭 **없음**(auction 테이블·인덱스는 erd v0.9로 완비). **모든 게이트2 갭 결정 완료(2026-07-18)** — G6(SCHEDULED 취소 허용)·G7(AUCTION_001 403 단일) 계약 v1.7 반영 해소. G3·G4는 구현 지침(코드 교차·CAS)으로 해소(스키마 무변경). 미해결 갭 없음.

---

## 8. 티켓 슬라이싱 + 팬아웃 판정

패키지 규약: `api/auction/*`(컨트롤러·Request/Response record), `domain/auction/*`(엔티티·enum·Repository·Custom·Impl·Service·ErrorCode), `resources/db/migration/V10__auction.sql`. **다음 Flyway 채번 = V10**(V1~V9 소비 완료). item 교차 편집은 `domain/item/*`.

### FC-026 — auction 엔티티 + status enum(FSM) + 등록 API + Flyway V10
쓰기 파일 집합:
- `backend/src/main/resources/db/migration/V10__auction.sql` (auction 테이블 + 인덱스 4종 + FK 2종)
- `domain/auction/Auction.java`(엔티티 + 상태 전이 도메인 메서드 `cancel()` 등)
- `domain/auction/AuctionStatus.java`(enum, §9-d 전체), `domain/auction/AuctionResultType.java`(enum BID/BUYNOW — 저장만)
- `domain/auction/AuctionRepository.java`(+ `AuctionRepositoryCustom.java`·`AuctionRepositoryImpl.java` 골격)
- `domain/auction/AuctionErrorCode.java`(§6)
- `domain/auction/AuctionRegisterCommand`(선택 내부 DTO), `domain/auction/AuctionService.java`(register)
- `api/auction/AuctionController.java`(POST), `api/auction/AuctionRegisterRequest.java`, `api/auction/AuctionRegisterResponse.java`
- **편집(item 교차, G4)**: `domain/item/ItemInstanceRepository.java` — INVENTORY→LISTED 조건부 CAS `@Modifying` 메서드 추가
- (테스트) `domain/auction/AuctionRepositorySliceTest.java`, 등록 서비스 테스트

### FC-027 — 목록 + 상세 API
쓰기 파일 집합:
- `api/auction/AuctionController.java`(**편집** — GET 2종 추가) ← FC-026과 교차
- `api/auction/AuctionSummaryResponse.java`, `api/auction/AuctionDetailResponse.java`, `api/auction/AuctionItemView.java`(item 블록 record)
- `domain/auction/AuctionService.java`(**편집** — list/detail) ← FC-026과 교차
- `domain/auction/AuctionRepositoryCustom.java`·`AuctionRepositoryImpl.java`(**편집** — cursor 검색·필터·fetch join) ← FC-026과 교차
- `domain/auction/AuctionSearchCondition.java`, `domain/auction/AuctionCursor.java`, `domain/auction/AuctionSlice.java`
- (테스트) 목록/상세 슬라이스·QueryDSL 테스트

### FC-028 — 판매자 취소
쓰기 파일 집합:
- `api/auction/AuctionController.java`(**편집** — cancel) ← FC-026·FC-027과 교차
- `domain/auction/AuctionService.java`(**편집** — cancel + 에스크로 해제 오케스트레이션) ← 교차
- `domain/auction/AuctionRepository.java`(**편집** — CANCELLED CAS `@Modifying`) ← FC-026과 교차
- **편집(item 교차, G3)**: `domain/item/*` — LISTED→INVENTORY/TEMP 에스크로 해제 재사용 메서드(InventoryService에 public 메서드 추가 또는 신규 EscrowService). backend-impl 자율, item 파일 편집 확정
- (테스트) 취소 서비스 테스트(입찰0·만실 TEMP·주체 인가)

### 팬아웃 판정 — **병렬 불가, 순차(단일 패스 권고)**

교차·의존 근거:
1. **엔티티·enum·ErrorCode 선형 의존**: FC-027·FC-028은 FC-026의 `Auction`·`AuctionStatus`·`AuctionErrorCode`·Repository를 전제(읽기+쓰기 의존).
2. **Flyway 단일 채번**(공유 충돌점): auction 스키마는 V10 단일 파일. FC-026이 소유하고 FC-027/028은 스키마 추가 없음 → 병렬 시 무의미하나, V10 완결이 27/28 슬라이스·QueryDSL 검증의 선행.
3. **`AuctionController.java`·`AuctionService.java` 교차**: 세 티켓 모두 동일 컨트롤러·서비스 파일을 편집(POST/GET/cancel 메서드 추가) → 쓰기 파일 집합 교차.
4. **`AuctionRepositoryCustom/Impl` 교차**: FC-027(검색)·FC-028(CAS)이 편집.
5. **item 파일 교차**: FC-026(ItemInstanceRepository CAS)·FC-028(에스크로 해제)이 `domain/item/*` 편집 — 서로 다른 파일이나 EPIC-ITEM 산출 편집.

→ CLAUDE.md §9 팬아웃 조건(의존 없음 ∧ 쓰기파일 무교차)을 **의존·교차 양쪽 위반**. 세 티켓 병렬 팬아웃 금지.
**권고: 단일 backend-impl 에이전트가 FC-026 → FC-027 → FC-028 순차 단일 패스**(같은 `domain/auction/` 패키지·Controller·Service·Flyway 결속이 강해 컨텍스트 연속이 이득 — EPIC-ITEM(FC-020→021→022) 선례 동일). 티켓 3개는 보드/추적 단위로 유지하되 실행은 하나의 순차 위임으로 낸다. FC-029(reviewer)는 3티켓 구현 수렴 후 통합 리뷰.

---

## 9. 게이트2 결정 (승인 완료 2026-07-18, 전건 채택)

### (a) SCHEDULED→ACTIVE 활성화 방식 — **lazy 파생 확정**
- 상황: 영속 전이(SCHEDULED→ACTIVE) 트리거는 domain-spec §9의 지연 인덱스 워커이며 **EPIC-CLOSING 소유**(마감·예약시작·만료 통합). EPIC-AUCTION엔 워커가 없다.
- **권고**: **lazy 파생** — status는 등록값(SCHEDULED)으로 영속하되, 조회(목록/상세) 응답의 `status`를 `(status=SCHEDULED AND start_at ≤ now) ? ACTIVE : status`로 파생 노출. DB 영속 전이는 EPIC-CLOSING 워커가 담당. 근거: 워커 없이 SCHEDULED가 startAt 경과 후에도 SCHEDULED로 고여 목록·입찰에서 비활성 보이는 문제 방지. "DB가 진실, 인덱스는 재구축"(domain-spec §9)과 정합(파생은 표시층).
- 대안(비권고): 등록 시 startAt이 있어도 무조건 ACTIVE 생성(SCHEDULED 미지원) — 계약 body `startAt?`·erd `start_at`·domain-spec §5 예약시작을 사장. 이연 비용 큼.
- 파급: (b)·(G6) 연동. lazy면 SCHEDULED 경매의 취소(G6) 판정도 파생 status 기준으로 결정 필요.

### (b) 상세/목록 현재최고가·최고입찰자 — **null/0 처리 확정**
- 상황: 입찰=EPIC-BID 미구현. `highest_bid_amount`·`highest_bidder_id` 전건 null.
- **권고**: `highestBidAmount` = null(응답 필드 생략 또는 null), `bidCount` = 0, `highestBidderMasked` = null. `startPrice`는 그대로 시작가 노출(현재가 대체 아님 — 입찰 없음을 0/null로 정직 표현). 프론트는 "입찰 없음/시작가 {startPrice}" 표시. EPIC-BID 진입 시 실값으로 자연 대체(스키마·계약 무변경).

### (c) 소프트클로즈 config 컬럼 — **V10에 저장만 + 서버 기본값 확정**
- 상황: erd auction은 `soft_close_window_sec·extend_sec`(NOT NULL)·`base_end_at`·`max_end_at`·`extension_count` 보유. 연장 로직은 EPIC-BID(입찰 시 연장)·EPIC-CLOSING(마감).
- **권고**: 컬럼 **전부 V10에 포함**(후속 ALTER 회피). 등록 시 저장만: base_end_at=end_at, extension_count=0. body 미지정 시 서버 기본 `softCloseWindowSec=30`·`softCloseExtendSec=30`(domain-spec §4 "기본 T-30초/+30초"), 상한 = config(예: window·extend 각 ≤ 300초, maxEndAt−endAt ≤ 총연장 상한 config). 상한 초과 → AUCTION_008(422). 연장 판단·extension_count 증가는 본 에픽 미구현.

### (d) status enum 정의 범위 — **전체 정의 + 전이만 부분 구현 확정**
- **권고**: `AuctionStatus` enum은 **전체 5값(SCHEDULED/ACTIVE/SOLD/UNSOLD/CANCELLED)** + `AuctionResultType`(BID/BUYNOW) 정의. DB ENUM·domain-spec §5·목록 status 필터(G10)가 전 5값을 요구하므로 부분 정의 시 후속 enum 마이그레이션 발생. **전이(상태 변경 메서드)만 본 에픽 소유분(→ACTIVE, →CANCELLED)** 구현하고 SOLD/UNSOLD 전이 메서드는 EPIC-BID/CLOSING에 이연. 근거: enum 값 존재 ≠ 전이 구현.

### (e) cancel "입찰 0건" 판정 — **highest_bidder_id IS NULL 앵커 확정**
- 상황: `bid` 테이블 미존재(EPIC-BID). "입찰 0건" 실판정 불가.
- **권고**: auction의 `highest_bidder_id IS NULL`을 "입찰 0건" 앵커로 사용. 본 에픽 전건 null → 항상 취소 가능(SCHEDULED|ACTIVE면). EPIC-BID가 입찰 시 highest_bidder_id를 채우면 **판정이 자동으로 정확해짐**(재작업 0). cancel CAS = `... WHERE status IN ('SCHEDULED','ACTIVE') AND highest_bidder_id IS NULL`(G6 결정, 0행이면 종료됨 or 입찰존재 → 재조회 분기).
- 대안(비권고): `bid_count` 컬럼 신설 — erd에 없는 비정규화 컬럼 추가(스키마 변경) + highest_bidder_id와 이중 진실. highest_bidder_id 재사용이 스키마 무변경·정합.

### (f) AUCTION_001 HTTP status 단일화 — **403 단일 확정** (계약 v1.7 반영)
- 상황: 계약 §5 AUCTION_001 = "403/409" 이중. ErrorCode enum은 code↔status 1:1(계약 §5 규칙). 한 상수가 두 status 불가(G7).
- **권고**: **AUCTION_001 = 403 단일**. 미소유(not-owner)·미보유(owned-but-TEMP·item-not-found)를 403으로 통일 — (1) 1:1 규칙 준수, (2) 403 vs 409 차이가 "그 아이템을 내가 소유/보유하는지"를 누설하는 열거면(SEC-007 정신)이라 403 통일이 유리. "이미 출품중"(LISTED)만 AUCTION_002/409로 분리(상태 충돌은 노출 무해). 계약 §5의 "403/409"는 AUCTION_001(403)+AUCTION_002(409) 가족으로 읽고, §5 표를 "AUCTION_001 = 403"으로 정밀화(6절 계약 변경 절차).
- 대안: 409 단일(상태 충돌 관점) — 그러나 not-owner는 인가 실패라 403이 REST 정합. 403 권고.

### (G6) SCHEDULED 취소 허용 — **확정** (계약 v1.7 반영)
- 상황: domain-spec §5는 "SCHEDULED|ACTIVE→CANCELLED"이나 계약 종전 문언은 "ACTIVE만" → 예약 경매(SCHEDULED)의 에스크로 아이템이 startAt 도달 전까지 회수 불가.
- **결정**: 취소 대상 상태를 **"SCHEDULED | ACTIVE & 입찰0(highest_bidder_id IS NULL)"**로 정밀화. 계약 v1.7 §3.1·§5 반영, 본 스펙 §3·§4.2·§5.4의 CANCELLED CAS를 `WHERE status IN ('SCHEDULED','ACTIVE') AND highest_bidder_id IS NULL`로 통일. domain-spec §5와 정합. G6·G7 해소.

---

## 10. 미해결·이연

- SCHEDULED→ACTIVE 영속 전이·마감·소프트클로즈 연장·UNSOLD = EPIC-CLOSING/EPIC-BID.
- 입찰(bid·money_hold)·최고가 갱신·highestBidderMasked 실값 = EPIC-BID.
- 즉시구매·SOLD·resultType·sale_order·정산·소유이전(TRADE 이력) = EPIC-CLOSING.
- 관리자 강제취소(`POST /admin/auctions/{id}/force-cancel`) = 백로그(별도 관리자 에픽).
- 고정가(shop) = EPIC-SHOP.
- `highestBidAmount` 정렬 인덱스(G5) = EPIC-BID 실사용 시 검토.
