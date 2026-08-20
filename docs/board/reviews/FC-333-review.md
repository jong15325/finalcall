# FC-333 / KAN-377 리뷰

## 판정

**PASSED — Done 가능.** Critical 0건, Major 0건, Minor 1건이다.

## Minor

### 1. EXPLAIN 검증이 선택된 key를 구조적으로 단언하지 않아 회귀 시 위양성 여지가 있다

- 위치: `backend/src/test/java/com/finalcall/integration/ChatOutboxRetentionIndexIntegrationTest.java:73-96`
- 재현 시나리오: JSON plan 전체 문자열에 `ix_chat_event_outbox_retention`이 포함되는지만 검사한다. MySQL JSON에는 실제 선택 key뿐 아니라 후보 key 등에도 인덱스 이름이 나타날 수 있으므로, 향후 optimizer 출력이나 통계가 바뀌어 다른 access path를 선택해도 이름 포함·`access_type != ALL`·filesort false 조합만으로 테스트가 통과할 가능성이 있다.
- 기대: JSON을 구조적으로 파싱해 실제 `key`가 `ix_chat_event_outbox_retention`인지, key parts가 `created_at,id`인지 단언하거나 `EXPLAIN ANALYZE`의 실제 iterator를 검증한다.
- 실제: 현재 MySQL 8.0.46 fresh 검증에서 신규 인덱스 선택과 filesort 부재가 확인됐고 쿼리 형상상 다른 기존 인덱스로 같은 조건·정렬을 만족하기 어려우므로 차단하지 않는다. 다만 테스트 자체의 회귀 탐지력은 한 단계 약하다.

## 마이그레이션·Flyway 확인

- `V27__chat_outbox_retention_index.sql`은 새 `(created_at,id)` secondary index만 추가한다. V25의 `(occurred_at,id)`를 DROP/RENAME하지 않아 승인된 가법 계약과 일치한다.
- V25·V26을 수정하지 않고 다음 순번 V27을 추가하여 Flyway append-only 원칙을 지킨다. fresh V1~V27 적용과 JPA validate가 통과했다.
- `ADD KEY ..., ALGORITHM=INPLACE, LOCK=NONE` 문법은 검증 대상 MySQL 8.0.46에서 성공했다. 지원되지 않는 환경에서는 silent copy/lock 강등 대신 DDL이 실패하므로 온라인 배포 계약을 보수적으로 지킨다.
- MySQL atomic DDL 특성상 인덱스 추가 실패가 반쪽 스키마로 남는 위험은 낮다. 적용 후 되돌림도 기존 migration 수정이 아니라 후속 append-only DROP migration으로 하도록 spec에 명시됐다.
- `LOCK=NONE`도 metadata lock 획득 자체를 제거하지는 않는다. spec은 장기 transaction·metadata lock·디스크·낮은 트래픽 창·단일 migration 주체 점검을 운영 전제로 명시하므로 신규 코드 결함으로 보지 않는다.

## 테스트·동시성 확인

- `SHOW INDEX`가 기존·신규 인덱스의 이름, 컬럼 순서 1/2를 전부 단언하여 기존 pipeline 인덱스 유지와 신규 계약을 검증한다.
- retention 쿼리는 production과 같은 `created_at < cutoff`, `id <= safeId`, `ORDER BY created_at,id`, `LIMIT`, `FOR UPDATE SKIP LOCKED` 형상을 사용한다.
- cutoff/safeId의 삭제 경계는 기존 `ChatRetentionServiceIntegrationTest`가 safe old만 삭제하고 unsafe old/recent를 보존하는 방식으로 보완 검증한다. 신규 테스트는 batch size 2를 별도로 확인한다.
- 동시성 테스트는 서로 다른 JDBC connection에서 auto-commit을 끄고 첫 batch lock을 유지한 채 두 번째 selection을 수행한다. 두 batch가 각각 2건이고 무교차임을 단언한 뒤 두 transaction을 rollback하므로 `SKIP LOCKED` 검증이 실제 잠금 경계를 지난다.
- `finally`에서 두 connection을 rollback하고 try-with-resources로 닫아 테스트 실패 시 lock 누출을 방지한다. 테스트 데이터 cleanup도 outbox 전용이라 타 도메인 변경을 만들지 않는다.
- purge의 선택과 삭제는 기존 서비스의 단일 `@Transactional` 경계 안에 있어 lock 반환 전 다른 node가 같은 ID를 선택하는 회귀가 없다.

## 보안·불필요 변경 확인

- 인덱스와 테스트 변경은 인증·인가·JWT·시크릿·개인정보 형상을 건드리지 않는다.
- 신규 인덱스는 metadata-only outbox의 기존 컬럼만 사용하며 데이터 복사용 애플리케이션 로직이나 외부 노출을 추가하지 않는다.
- 갱신된 chat-domain-spec/ERD는 승인된 `(created_at,id)` 추가, 기존 인덱스 유지, 운영 배포·forward rollback 조건에 직접 추적된다. 무관한 리팩터나 포맷 변경은 발견하지 못했다.

## 부록 C 적용 결과

- lock/transaction 순서: purge service의 transaction 안에서 `FOR UPDATE SKIP LOCKED` 선택 후 삭제하는 기존 경계 유지.
- Retry 멱등: migration은 Flyway 단일 version으로 관리하며 애플리케이션 retry 부수효과를 추가하지 않는다.
- 분산락·입찰 CAS·잔액·JWT는 본 변경 범위에 해당하지 않는다.
