# FinalCall Item·Inventory Domain Spec (아이템·인벤토리 도메인 스펙)

상태: v0.2 — FC-019(EPIC-ITEM 계약/설계 확정, architect) 산출 + **게이트2 결정 반영(2026-07-18)**. 기존 정본(api-contract §4.1·§4.2, erd §4.3·§5·§6, domain-spec §7)의 **검증·구현 슬라이싱·갭 식별** 결과를 담는다. erd v0.9(G2·G3 반영)와 정합.
소유: architect (spec). 게이트2 4항목 전부 승인 완료(§9) → 구현 착수 근거.
근거: api-contract v1.5 §4.1·§4.2·§5, erd v0.8 §2(결정 플래그 B)·§4.3·§5·§6, domain-spec v0.5 §7, CLAUDE.md 섹션 5(도메인 컨벤션), D-044~047·D-062·D-066·D-067·D-073.
범위: 정본을 대체하지 않는다. **본 문서는 구현 지침(불변식·응답 필드·에러코드·슬라이싱)의 단일 참조점**이며, 스키마/계약 변경이 필요한 항목은 §7(갭)·§9(게이트2)로 분리해 상신 대상으로 표시한다.

---

## 1. 대상 엔티티·엔드포인트

- 엔티티(erd §4.3): `item_template`, `skill_definition`, `item_instance`, `item_ownership_history`, `temp_storage`.
- 엔드포인트(api-contract):
  - §4.1 `GET /item-templates`(카탈로그·offset), `GET /items/{itemInstancePublicId}`(인스턴스 상세), `GET /market-prices`(시세 — **EPIC-ITEM에서 이연**, §9-c).
  - §4.2 `GET /me/inventory`(96칸), `GET /me/temp-storage`(cursor), `POST /me/temp-storage/{itemInstancePublicId}/relocate`.
- 범위 밖: 아이템 생성 경로(게이트2-a에서 결정), 강화·합성(domain-spec §7.6), market-prices, category 별도 도메인(D-073로 item_template 축에 흡수).

---

## 2. 엔티티 정의 (필드·타입·제약)

논리 타입은 erd §4.3 기준, 물리 타입은 V3~V5 스타일(BIGINT id AUTO_INCREMENT, CHAR(26) ULID, DATETIME(6), utf8mb4)을 그대로 승계한다. 공통 컬럼(id·created_at, 갱신 대상 updated_at)은 표에서 생략.

### 2.1 item_template (마스터, 고정 시드)
| 컬럼 | 타입 | 널 | 키 | 비고 |
|---|---|---|---|---|
| main_category | INT | N | | 대분류(타입코드 천의 자리) |
| sub_group | INT | N | | 중분류(백의 자리) |
| element | INT | N | | 속성(십의 자리) |
| kind | INT | N | | 종류(일의 자리) |
| type_code | INT | N | UK | 자리값 합성 외부 식별자(035, public_id 미부여) |
| display_name | VARCHAR(100) | N | | 표시명(원게임 시드) |
- UK: `(main_category, sub_group, element, kind)` 조합 1건(D-073, 등급 축 없음) + `type_code` 단독 UK.
- soft delete 없음(마스터·불변 시드). D-081 패턴 불요.

### 2.2 skill_definition (마스터, 고정 시드)
| 컬럼 | 타입 | 널 | 키 | 비고 |
|---|---|---|---|---|
| skill_code | INT | N | UK | 원게임 스킬 ID(100~435) — 외부 식별자 |
| name | VARCHAR(50) | N | | 스킬명(시드) |
| description | VARCHAR(255) | Y | | 설명 |
- soft delete 없음. public_id 없음(skill_code가 외부 식별자).

### 2.3 item_instance (개별 아이템)
| 컬럼 | 타입 | 널 | 키 | 비고 |
|---|---|---|---|---|
| public_id | CHAR(26) ULID | N | UK | 외부 식별자 |
| template_id | BIGINT | N | FK→item_template | |
| owner_id | BIGINT | N | FK→user | 현재 소유자 |
| level | INT | N | | 1~9 |
| skill1_id | BIGINT | Y | FK→skill_definition | 슬롯1 |
| skill2_id | BIGINT | Y | FK→skill_definition | 슬롯2 |
| skill_percent | INT | N | | 발동확률(합성 결과) |
| gf_expire_at | DATETIME(6) | Y | | 골드포스 만료(활성/잔여는 파생) |
| location | ENUM(문자열) | N | | INVENTORY / TEMP / LISTED |
| slot_no | INT | Y | | INVENTORY일 때 0~95, 그 외 NULL |
- soft delete 없음(아이템은 소멸이 아니라 소유 이전·이력 보존; erd에 is_deleted 미표기).
- 불변식은 §3 참조.

### 2.4 item_ownership_history (소유 이력, append-only)
| 컬럼 | 타입 | 널 | 키 | 비고 |
|---|---|---|---|---|
| instance_id | BIGINT | N | FK→item_instance | |
| from_owner_id | BIGINT | Y | FK→user | 최초 발행 시 NULL |
| to_owner_id | BIGINT | N | FK→user | 새 소유자 |
| transfer_type | ENUM | N | | TRADE / ADMIN_GRANT / SEED |
| sale_order_id | BIGINT | Y | FK→sale_order | 거래 이전일 때만. **EPIC-ITEM 시점엔 sale_order 미존재 → §7 갭 G7** |
| transferred_at | DATETIME(6) | N | | 이전 시각 |
- append-only, updated_at 불필요(불변 이력). 최초 소유자 = instance별 첫 행(별도 캐시 컬럼 없음, erd §4.3).

### 2.5 temp_storage (임시보관, 오버플로우)
| 컬럼 | 타입 | 널 | 키 | 비고 |
|---|---|---|---|---|
| instance_id | BIGINT | N | UK, FK→item_instance | 1:1(location=TEMP일 때만 행 존재) |
| owner_id | BIGINT | N | FK→user | |
| stored_at | DATETIME(6) | N | | |
| expire_at | DATETIME(6) | Y | | 회수 규칙 미확정(이연) |

---

## 3. 핵심 불변식 (앱 + DB 강제)

### 3.1 location XOR (플래그 B, erd §2·§4.3)
`item_instance.location`이 단일 디스크리미네이터다. 상태별 정확히 하나만 참이어야 한다.

| location | slot_no | temp_storage 행 | 활성 리스팅(auction/shop) |
|---|---|---|---|
| INVENTORY | NOT NULL(0~95) | 없음 | 없음 |
| TEMP | NULL | 존재(1:1) | 없음 |
| LISTED | NULL | 없음 | 존재(참조) |

- **앱 강제**: 위치 전이는 전용 도메인 메서드로만(`ItemInstance.placeInInventory(slotNo)` / `moveToTemp()` / `markListed()`), 각 메서드가 slot_no·연계 행을 원자적으로 세팅. `@Setter` 금지(섹션 5).
- **DB 강제**:
  - INVENTORY↔slot_no 결속 + slot 유일성은 §3.2(생성 컬럼 UK).
  - TEMP↔temp_storage는 `temp_storage.instance_id` UK(1:1) + 앱 트랜잭션(행 생성/삭제와 location 전이 동일 TX).
  - LISTED↔활성 리스팅은 auction/shop 등록 시 INVENTORY→LISTED CAS(중복 출품 차단, erd §5 "부분 유니크 불요")로 보증. **EPIC-ITEM 범위 밖**(auction 에픽) — 본 스펙은 relocate·인벤토리 경로만 다루고 LISTED 전이는 auction 에픽이 소유.

### 3.2 slot 유일성 — **확정(게이트2 승인 2026-07-18, erd v0.9)**
동일 owner가 같은 slot_no에 두 아이템을 둘 수 없다(relocate INV_002의 DB 근거). D-081 생성 컬럼 UK 패턴을 위치 스코프로 응용해 DB가 최종 강제한다:
```sql
slot_key VARCHAR(40) GENERATED ALWAYS AS (IF(location='INVENTORY', CONCAT(owner_id,'-',slot_no), NULL)) STORED,
UNIQUE KEY uk_item_instance_slot (slot_key)
```
INVENTORY 행만 값을 가져 (owner, slot) 유일, 그 외 NULL(다중 허용). relocate/인벤토리 복귀 동시성의 최종 방어선을 DB가 맡는다("정합성은 DB", domain-spec §8). FC-022 마이그레이션(V8)에 반영.

### 3.3 capacity 96
- 상수(앱). slot_no 0~95 = 96칸. `used < 96`을 relocate 자동배정·명시배정에서 검증(INV_001). 스키마 컬럼 아님.

---

## 4. item_ownership_history 기록 트리거

이력은 **소유자 변경이 발생하는 모든 경로**에서 append(1행)한다. from_owner_id는 직전 owner(최초 발행이면 NULL).

| 트리거 | transfer_type | from_owner | sale_order_id | EPIC-ITEM 범위 |
|---|---|---|---|---|
| 최초 발행(시드) | SEED | NULL | NULL | **시드(FC-023) — EPIC-ITEM 유일 트리거** |
| 최초 발행(관리자 지급) | ADMIN_GRANT | NULL | NULL | 게이트2에서 **미도입 확정**. enum 값만 후속 확장 대비 존치, MVP 경로 없음 |
| 거래 이전(낙찰·구매) | TRADE | 판매자 | sale_order.id | **auction/order 에픽**(EPIC-ITEM 밖) |

- **EPIC-ITEM이 소유하는 트리거 = 최초 발행 SEED뿐이다**(진입 경로 시드-only, 게이트2). item_instance를 만드는 시드 경로(FC-023)는 동일 마이그레이션에서 첫 이력 행을 함께 기록한다. TRADE는 sale_order 존재를 전제하므로 auction/order 에픽이 소유(§7 G7).
- relocate(TEMP↔INVENTORY)는 **소유자 변경이 아니므로 이력 기록 없음**(위치 이동일 뿐).

---

## 5. API 응답 스펙 (§4.1·§4.2)

### 5.1 GET /item-templates (카탈로그)
- 인증 불요. 쿼리 필터: `mainCategory, subGroup, element, kind`(전부 optional, 화이트리스트). 페이지네이션 **offset**(§1.3, 카탈로그는 소규모·안정).
- content 항목: `{ typeCode, mainCategory, subGroup, element, kind, displayName }`.
- 정렬 화이트리스트: `typeCode`(기본 asc). (인덱스: element,kind 부분필터 + 소규모 풀스캔 허용 — §7 G1 참조)
- 소유·마스킹 없음(마스터 데이터).

### 5.2 GET /items/{itemInstancePublicId} (인스턴스 상세)
- 인증 optional. **공개 필드 + 소유자 전용 필드 이원화**.
- 공개(비인증·타인): `{ itemInstancePublicId, template:{typeCode, mainCategory, subGroup, element, kind, displayName}, level, skill1:{skillCode,name}?, skill2:{skillCode,name}?, skillPercent, goldforceExpireAt?, location, ownerMasked }`.
  - `location`은 enum 3값 그대로 노출(거래중 여부는 클라 파생). **slot_no는 공개하지 않는다**(소유자 사생활·인벤토리 배치 노출 방지).
  - `ownerMasked`: 소유자 nickname 마스킹(§3.3 목록/상세 마스킹 정책 연장 — 예: 앞 2자 + `***`). 소유자 public_id 미노출.
- 소유자 전용(요청자 == owner, 인증 시): 위 + `{ slotNo? }`(INVENTORY일 때). 소유자 여부는 SecurityContext로 판정(IDOR 방지 — X-User-Id 불신, §1.2).
- 에러: `ITEM_001` 없음(404).
- 주: 이 응답은 **live template 참조**(displayName은 현재 시드 값). §3.3의 nameSnapshot/specSnapshot은 **auction/shop 리스팅 컬럼**이지 item_instance 필드가 아니다 — 상세 조회는 스냅샷을 쓰지 않는다(혼동 주의).

### 5.3 GET /me/inventory (96칸)
- 인증 필요(SecurityContext owner). **비페이지네이션 단일 응답**(96칸 상한, cursor/offset 불요). 정렬 `slotNo,asc` 고정.
- 응답: `{ capacity:96, used, items:[ { itemInstancePublicId, slotNo, summary } ] }`.
  - `summary`(인벤토리·임시보관 공용 요약): `{ typeCode, displayName, level, skill1Code?, skill2Code?, skillPercent, goldforceExpireAt? }`.
- 조회: `owner_id=me AND location=INVENTORY`(인덱스 `(owner_id, location, slot_no)`).

### 5.4 GET /me/temp-storage (오버플로우)
- 인증 필요. 페이지네이션 **cursor**(§1.3). content: `{ itemInstancePublicId, storedAt, expireAt?, summary }`(summary = 5.3 공용).
- cursor 키: `(stored_at desc, instance_id desc)` 안정 정렬. 인덱스 `(owner_id, stored_at, instance_id)`가 커버(erd v0.9, G3 해소).
- 조회: `owner_id=me`(temp_storage 행) — location=TEMP와 정합(불변식).

### 5.5 POST /me/temp-storage/{itemInstancePublicId}/relocate
- 인증 필요(소유자). body `{ slotNo? }`(미지정=빈 슬롯 자동배정, 최소 slot_no 우선).
- 동작(단일 TX): 소유자·TEMP 검증 → 슬롯 확보(자동/명시) → `item_instance.location TEMP→INVENTORY` + slot_no 세팅 → `temp_storage` 행 삭제. 최종 정합성은 slot UK(§3.2)가 보증.
- 응답 200: `{ slotNo }`.
- 에러: `INV_001` 만실(used≥96, 409), `INV_002` 슬롯 점유(명시 slotNo 중복, 409), `ITEM_002` 소유자 아님(403). 대상이 TEMP가 아니면(이미 INVENTORY/LISTED) → `ITEM_003`(신설 권고, §6) 또는 409로 처리.

---

## 6. ErrorCode 초안 (섹션 5 네이밍 `{DOMAIN}_{3자리}`)

계약 §5 등재분과 정합. item/inventory는 별도 enum 2종(도메인 분리)으로 권고: `ItemErrorCode`, `InventoryErrorCode`.

| 코드 | 의미 | HTTP | 상태 |
|---|---|---|---|
| ITEM_001 | 아이템(인스턴스) 없음 | 404 | 계약 §5 기존 |
| ITEM_002 | 소유자 아님 | 403 | 계약 §5 기존 |
| ITEM_003 | relocate 대상이 TEMP 아님(위치 상태 불일치) | 409 | **신설 권고**(계약 미등재 → 계약 변경 절차 or 409+메시지로 흡수) |
| INV_001 | 인벤토리 만실 | 409 | 계약 §5 기존 |
| INV_002 | 슬롯 점유 | 409 | 계약 §5 기존 |

- template 카탈로그·skill은 조회 전용(공개)이라 도메인 에러 불요(빈 결과는 정상 200).
- ITEM_003은 계약 §5 미등재. 신설하려면 계약 변경(6절 절차)=게이트2. 대안: 별도 코드 없이 409 + 기존 흐름 메시지. 권고: **계약에 ITEM_003 등재**(프론트 분기 명확성). 총괄 판단.

---

## 7. 계약 ↔ ERD 정합 검증 (갭 목록)

| # | 위치 | 유형 | 내용 | 조치 |
|---|---|---|---|---|
| G1 | §4.1 /item-templates 필터 | 인덱스 | 필터 축 `mainCategory/subGroup`은 인덱스 없음(erd §5는 `(element,kind)`만). | 템플릿 소규모(수백 미만)라 풀스캔 허용. 스키마 무변경. **정합(수용)** |
| G2 | item_instance slot | UK 부재 | slot 유일성 DB 강제 수단 없음(`(owner_id,location,slot_no)` 비유니크). relocate 동시성에 이중 배정 리스크. | **해소(게이트2 승인 2026-07-18)**: erd v0.9 `slot_key` 생성 컬럼 UK 추가(§3.2). FC-022 V8에 반영 |
| G3 | §4.2 /me/temp-storage cursor | 인덱스 | cursor 안정 정렬 키 인덱스 부재(`(owner_id)`만). | **해소(게이트2 승인)**: erd v0.9 `(owner_id, stored_at, instance_id)`로 보강. FC-022 V8에 반영 |
| G4 | §4.1 /items/{id} location | 응답 명세 | "현재 위치(공개 가능한 범위)"가 모호 — slot_no 공개 여부 미정. | 본 스펙 §5.2로 확정(location 노출, slot_no 비공개). 스키마 무변경 |
| G5 | §4.1 /items/{id} skill | 응답 필드 | 계약은 "스킬1/2·발동확률"만 — skill 표시명(join skill_definition) 명시 없음. | 본 스펙 §5.2로 확정(skillCode+name). 계약 상세화(경미, 6절 후속 정리 가능) |
| G6 | §4.2 /me/inventory 요약 | 응답 필드 | "요약" 필드 미정의. | 본 스펙 §5.3 summary로 확정 |
| G7 | ownership_history.sale_order_id | FK 선후 | sale_order 테이블은 group4(auction 에픽) — EPIC-ITEM 시점 미존재. | TRADE 트리거는 auction/order 에픽 소유. EPIC-ITEM은 SEED/ADMIN_GRANT만. **정합(경계 명시)** |
| G8 | 아이템 생성 경로 | 계약 공백 | §4에 item_instance 생성 엔드포인트 없음(게임 연동 부재). 인벤토리가 영원히 빔. | **해소(게이트2)**: 시드-only 확정(관리자 지급 API 미도입, 계약 무추가). 시드가 instance 생성(§8 시드 티켓) |
| G9 | market-prices | 데이터 선후 | sale_order 누적 선행 필요 — EPIC-ITEM에 데이터원 없음. | **확정 이연(게이트2)**: EPIC-ITEM 제외. erd v0.9 §5 주석 |
| G10 | item_instance soft delete | 정합 | erd에 is_deleted 없음(소유 이전 모델). BaseEntity(soft delete 포함) 상속 시 충돌 가능. | 구현 주의: item_instance는 BaseTimeEntity(시각만) 상속 권고. 스키마 무변경 |

요약: **모든 게이트2 갭 결정 완료(2026-07-18)** — G2·G3 스키마 승인(erd v0.9 반영), G8 시드-only 확정, G9 market-prices 이연 확정. 나머지(G1/G4/G5/G6/G7/G10)는 본 스펙 확정으로 해소되거나 경계 명시. 미해결 갭 없음.

---

## 8. 티켓 슬라이싱 + 팬아웃 판정

패키지 규약: `api/item/*`(컨트롤러·Request/Response record), `domain/item/*`(엔티티·Repository·Custom·Impl·Service·enum·ErrorCode), `resources/db/migration/V*.sql`. **다음 Flyway 채번 = V6부터**(V1~V5 소비 완료).

### FC-020 — item_template + skill_definition + 카탈로그 API
쓰기 파일 집합:
- `backend/src/main/resources/db/migration/V6__item_template_and_skill.sql` (+ 시드는 §9-b 결정 후)
- `domain/item/ItemTemplate.java`, `domain/item/SkillDefinition.java`
- `domain/item/ItemTemplateRepository.java`, `ItemTemplateRepositoryCustom.java`, `ItemTemplateRepositoryImpl.java`
- `domain/item/SkillDefinitionRepository.java`
- `domain/item/ItemTemplateService.java`
- `api/item/ItemTemplateController.java`, `api/item/ItemTemplateResponse.java`
- (테스트) `domain/item/ItemTemplateRepositorySliceTest.java`

### FC-021 — item_instance + ownership_history + 상세 API
쓰기 파일 집합:
- `backend/src/main/resources/db/migration/V7__item_instance_and_ownership.sql`
- `domain/item/ItemInstance.java`, `domain/item/ItemLocation.java`(enum), `domain/item/ItemOwnershipHistory.java`, `domain/item/TransferType.java`(enum)
- `domain/item/ItemInstanceRepository.java`, `ItemInstanceRepositoryCustom.java`, `ItemInstanceRepositoryImpl.java`
- `domain/item/ItemOwnershipHistoryRepository.java`
- `domain/item/ItemErrorCode.java` (ITEM_001/002[/003])
- `domain/item/ItemInstanceService.java`
- `api/item/ItemInstanceController.java`, `api/item/ItemInstanceDetailResponse.java`(+ 소유자 마스킹 view)
- (테스트) `domain/item/ItemInstanceRepositorySliceTest.java`

### FC-022 — 인벤토리 3 API (inventory·temp-storage·relocate)
쓰기 파일 집합:
- `backend/src/main/resources/db/migration/V8__temp_storage_and_indexes.sql` (temp_storage + G2/G3 인덱스·UK)
- `domain/item/TempStorage.java`, `domain/item/TempStorageRepository.java`
- `domain/item/InventoryErrorCode.java` (INV_001/002)
- `domain/item/InventoryService.java` (relocate·조회)
- **`domain/item/ItemInstance.java` 편집**(relocate용 `placeInInventory(slotNo)`/`moveToTemp()` 도메인 메서드) — **FC-021 산출물 수정**
- `api/item/InventoryController.java`, `api/item/InventoryResponse.java`, `api/item/TempStorageResponse.java`, `api/item/RelocateRequest.java`, `api/item/RelocateResponse.java`

### 팬아웃 판정 — **병렬 불가, 순차(단일 패스 권고)**

교차·의존 근거:
1. **스키마 FK 의존 체인**: item_instance(FC-021) → item_template·skill_definition(FC-020) FK; temp_storage·인벤토리(FC-022) → item_instance(FC-021) FK. 순수 선형 의존(FC-020 → FC-021 → FC-022).
2. **Flyway 단일 채번 시퀀스**(공유 충돌점): 세 티켓 모두 `db/migration/`에 append-only로 파일 추가. 병렬 시 V6 채번 충돌 + FK 순서 보장 불가. **명시 확인: Flyway는 공유 충돌점이 맞다.**
3. **`ItemInstance.java` 교차**: FC-021이 생성, FC-022가 relocate 도메인 메서드로 **편집** → 동일 파일 쓰기 교차.
4. `ItemErrorCode`(ITEM_002)는 FC-021이 소유하나 FC-022 relocate가 참조 — 읽기 의존.

→ CLAUDE.md §9 팬아웃 조건(의존 없음 ∧ 쓰기파일 무교차)을 **둘 다 위반**. 세 티켓 병렬 팬아웃 금지.
**권고: 단일 backend-impl 에이전트가 FC-020 → FC-021 → FC-022 순차 단일 패스**(같은 `domain/item/` 패키지·Flyway·엔티티 결속이 강해 컨텍스트 연속이 이득). 티켓 3개는 보드/추적 단위로 유지하되 실행은 하나의 순차 위임으로 낸다.

### 8.1 시드 배치 — **FC-023 신설 권고 (전용 시드 티켓)**

시드는 별도 티켓 **FC-023**으로 분리하고 **단일 마이그레이션 V9**로 낸다. 근거:
- **순서 위험**: item_instance 시드는 location=INVENTORY 행이 `slot_key` 생성 컬럼 UK(V8, FC-022)를 통과해야 한다 → **instance 시드는 V8 이후에만** 안전. 따라서 시드는 FC-022 뒤(V9).
- **소유자 부재**: member(user) 시드가 전무하므로(현 마이그레이션·테스트에 user seed 없음, signup으로만 생성) 시드가 **seed user + user_balance**를 먼저 만들어야 instance owner_id FK가 성립.
- **단일 관심사**: 시드는 스키마가 아니라 데이터라 FC-020~022(스키마+API)와 분리하는 편이 원복·재현이 깨끗하다(erd §6 group5 "아이템 시드" 대응).

FC-023 쓰기 파일 집합:
- `backend/src/main/resources/db/migration/V9__item_seed.sql` — (1) seed user ~1~2 + user_balance, (2) item_template ~8, (3) skill_definition ~5, (4) item_instance ~10(location=INVENTORY, slot_no 0..n, transfer_type 근거), (5) item_ownership_history 각 instance 첫 행(from_owner NULL, transfer_type=SEED).
- depends_on: FC-020·FC-021·FC-022(전 테이블·slot_key UK 선행). 순차 체인 말미.
- 대안(비권고): 마스터(template/skill)만 FC-020 V6에 인라인하고 instance/user 시드만 V9로 — 시드가 두 파일로 쪼개져 재현·원복이 번잡. 단일 V9 권고.

---

## 9. 게이트2 결정 (승인 완료 2026-07-18)

### (a) 아이템 최초 진입 경로 = **시드-only 확정**
관리자 지급 API는 도입하지 않는다(계약·스키마 무추가). item_instance는 Flyway 시드가 owner+location=INVENTORY로 생성한다(transfer_type=SEED). 시드가 인벤토리·카탈로그·경매 공급의 단일 원천이다.

### (b) 최소 스텁 시드 범위 = **승인**
- item_template ~8건(대분류2 × 종류2 × 속성2 축 조합) + skill_definition ~5건.
- item_instance ~10건 — 소유자 배정 필요. **현재 member(user) 시드가 전무**(유저는 signup으로만 생성됨)하므로 시드가 **시드 소유자 user·user_balance 행도 함께 생성**해야 한다. instance는 SEED 이력 첫 행을 동반한다.
- 대량·정밀 실데이터는 이연(D-067).

### (c) market-prices(§4.1) = **EPIC-ITEM 제외 확정**
시세 집계는 sale_order 기준(계약 §4.1 비고). sale_order는 auction/order 에픽 이후 누적되므로 EPIC-ITEM에 데이터원이 없다. auction·order 에픽 뒤 별도 티켓으로 이연. erd v0.9 §5 인덱스 주석에 명기(집계 인덱스는 후속 대비 존치).

### (d) 스키마 갭 G2·G3 = **둘 다 승인**(erd v0.9 반영)
- G2: `item_instance.slot_key` 생성 컬럼 UK(§3.2) — slot 이중 배정 DB 차단.
- G3: `temp_storage (owner_id, stored_at, instance_id)` 인덱스 — cursor 안정 정렬.
- 둘 다 FC-022 마이그레이션(V8)에 포함. erd §4.3·§5 개정 완료(v0.9).

---

## 10. 미해결·이연

- **아이템 진입 = 시드-only**(게이트2). 런타임 지급(관리자 API)은 미도입 — 향후 필요 시 계약 추가로 확장.
- temp_storage.expire_at 회수 규칙(erd 미확정) — 이연.
- LISTED 전이(INVENTORY→LISTED CAS)·에스크로 해제 복귀 = auction 에픽 소유.
- TRADE 소유이전 트리거·sale_order 연계 = auction/order 에픽 소유.
- 아이템 시각 자산(이미지)·감정 = 범위 밖(domain-spec §7.6).
- market-prices = §9-c 이연.
