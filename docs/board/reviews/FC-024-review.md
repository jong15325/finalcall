# FC-024 — EPIC-ITEM 통합 리뷰 (reviewer)

- 대상: EPIC-ITEM(FC-020~023) 백엔드 구현 — 39 main + 5 test + V6~V9 + SecurityConfig + 시드-cleanup 테스트 4건
- 기준: item-domain-spec v0.2 · api-contract §4.1/4.2(v1.6) · erd v0.9
- 방식: 정적 리뷰(앱 :8080 부팅 미수행 — 사용자 IntelliJ 점유 회피)
- 판정일: 2026-07-18

## 최종 판정: PASSED (통과)

**critical 0 · major 0 · minor 3(비차단).** review_status=passed 전이 가능.

## 축별 판정

### 1. 도메인 인가 (IDOR·마스킹) — PASS
- `/me/inventory`·`/me/temp-storage`·relocate 모두 경로에 사용자 식별자 없이 주체를 `SecurityContextHolder`(내부 PK)에서 해석(`InventoryService.currentUserId()`). 타인 접근/조작 경로 구조적 부재.
- relocate: `instance.isOwnedBy(userId)` → ITEM_002(403). 통합테스트로 검증.
- `GET /items/{id}`: public permit이나 `slotNo`는 `viewerIsOwner && location==INVENTORY`일 때만 노출(`ItemInstanceDetailResponse.from`), 소유 판정은 SecurityContext. 비인증/타인은 `ownerMasked`(닉 앞 2자+`***`)만 — 실식별자·slot_no 미노출. 양방향 통합테스트 검증.

### 2. 동시성 — PASS (검증 강도 높음)
- 이중배정 방어 3중: 앱 선검사 + `slot_key` 생성컬럼 UK + commit-time flush의 `DataIntegrityViolationException`→INV_002 매핑. losing TX rollback으로 temp_storage 행·location 전이 함께 원복.
- `InventoryRelocateConcurrencyIntegrationTest`(실 MySQL·비-TX·6스레드 동일 슬롯): success==1, slotConflict==5, 최종 DB 1건 — 정확히 1승자 실증.
- XOR 불변식: 앱은 전용 도메인 메서드(`placeInInventory`/`moveToTemp`/`markListed`, @Setter 없음)로만 전이. DB는 slot_key UK(INVENTORY) + temp_storage.instance_id UK(TEMP). LISTED는 auction 에픽 소유(정당한 범위 밖).

### 3. 계약 정합 — PASS
- 에러코드 ITEM_001/002/003·INV_001/002 계약 §5·§4.2와 1:1. ITEM_003 v1.6 등재 반영.
- 페이지네이션: 카탈로그 offset(sort typeCode asc 하드코딩·외부 sort 미신뢰), temp-storage cursor(opaque base64·손상→400 COMMON_001). 정렬키 `(stored_at desc, instance_id desc)` erd v0.9 인덱스 정합.
- Flyway V6→V9 채번·FK 순서 정확. slot_key UK가 instance 시드 이전(V8) 배치 → 시드 slot 유일성 안전. FK 자연키 서브쿼리로 auto_increment 비의존.

### 4. QA/경계 — PASS
- 만실 96칸(INV_001)·명시 슬롯 점유(INV_002)·non-TEMP(ITEM_003)·소유자 아님(ITEM_002)·없는 id(ITEM_001 404)·자동/명시 happy 전부 테스트.
- 시드: 카탈로그 8건, seed_seller 인벤토리 10건(capacity 96/used 10) 확인.

## 총괄 판단 항목 판정
- **#3 (V9 시드↔기존 테스트 cleanup 교체) — PASS**: 4개 테스트 diff는 정리 로직만 `deleteAllInBatch()`→`SeedTestSupport.deleteNonSeedUsers()` 교체, assert 무변경. 어느 단언도 user 테이블 공백을 전제하지 않음. 시드 login_id(seed_seller/buyer)가 테스트와 무충돌. **커버리지 약화 없음.**
- **#4 (BaseCreatedEntity 신설) — PASS**: temp_storage·ownership_history는 insert/delete만·갱신 생애 없음. spec §2.4 append-only + erd §4.3 근거. validate 통과 위해 updated_at 미매핑 base 필수. 죽은 컬럼 강제 안 하는 정당한 변형. **컨벤션 위반 아님.**

## Minor (비차단, 후속 권고)
- **[minor] 자동배정 relocate 경합 INV_002 시맨틱**: 자동배정 경로 경합 시 패자가 "이미 사용 중" INV_002 수신 — 슬롯 미지정 요청엔 오해 소지(안전성 무결). 패자 1회 재시도 or 전용 메시지 권고. `InventoryService.java:97-114·120-127`.
- **[minor] temp-storage `size` 무경계**: `@Min/@Max` 없어 음수 size→500 가능(계약은 400). 단 기존 `NoticeController.getByCursor`와 동일 구조 → notice와 함께 후속 일괄 개선(에픽 고유 결함 아님).
- **[minor] 카탈로그 max page size 미지정**: Spring 기본 2000 의존. 마스터 소규모라 실질 무해(G1 수용 정합).

## 불필요 변경 점검 — 통과
backend 변경 전부 에픽 추적됨(SecurityConfig 아이템 public permit·시드 FK 보존 테스트·item 신규). 무관 리팩터/포맷 없음.
