상태: SENT
# [백엔드 → Claude Code] 작업 지시: member - V4 재가입 UK 재구성 + 리포지토리 정정 (D-081)

대상: `user` 테이블 자연키 UK를 D-081 생성 컬럼 패턴으로 재구성 + `UserRepository` 파생 쿼리 정정 +
  auth 회귀 테스트. **셋은 단일 단위다** — 쪼개면 중간 상태에서 로그인이 깨진다(D-081 동반 필수).

참조: **D-081**(정본 — management/decision-log.md, 패턴·기각 대안·동반 필수 전문), erd 1절(soft delete UK 규약),
  api-contract v1.4 §2.5(재가입 허용), domain-spec v0.5 §6.1, B-024(중복 이중 방어), B-012(Flyway 채번)

의존: **023(member 재배치) 선행 완료 후.** 023이 `UserRepository`를 `domain/member`로 옮기므로, 최종 위치에서
  한 번만 수정한다(순서를 뒤집으면 수정 후 이동이라 diff가 두 번 갈린다 — 총괄 076 권장 순서).

## 배경 (왜 하는가)
erd 1절 확정 규약 "soft delete 테이블의 자연키 유니크는 삭제 식별 컬럼을 포함"을 V3가 위반했다
(`UNIQUE KEY uk_user_login_id (login_id)`·`uk_user_nickname (nickname)` — 삭제 식별 컬럼 없음).
그 결과 계약 v1.4 §2.5 "재가입: login_id·nickname 재사용 허용"이 **동작하지 않는다**.
QA 결함 등재분이며 이 단위가 곧 FIX다.

## 범위 — 3요소 단일 단위

### 1. V4 마이그레이션 (`V4__user_natural_key_uk.sql`, 파일명 자율)
D-081 패턴 그대로:
```sql
-- 기존 단일 컬럼 UK 제거
ALTER TABLE user DROP INDEX uk_user_login_id;
ALTER TABLE user DROP INDEX uk_user_nickname;

-- 생성 컬럼 + UK (활성만 유일, 탈퇴행은 NULL → 재탈퇴 무제한)
ALTER TABLE user
    ADD COLUMN login_id_active VARCHAR(50) GENERATED ALWAYS AS (IF(is_deleted, NULL, login_id)) STORED,
    ADD COLUMN nickname_active VARCHAR(30) GENERATED ALWAYS AS (IF(is_deleted, NULL, nickname)) STORED;

ALTER TABLE user
    ADD UNIQUE KEY uk_user_login_id_active (login_id_active),
    ADD UNIQUE KEY uk_user_nickname_active (nickname_active);
```
- 컬럼 타입·길이는 원본과 일치(`login_id VARCHAR(50)`·`nickname VARCHAR(30)`, V3 확인).
- 원본 `login_id`·`nickname` 컬럼은 **그대로 둔다**(D-081 — UK만 생성 컬럼에 건다).
- Flyway append-only: 다음 미사용 버전으로 채번(V3까지 소비됨 → V4). 실제 채번 결과를 완료 보고에 명시할 것
  (기획 erd 동기화용 — B-012 선례).
- **경고**: DDL 문법·생성 컬럼 지원은 MySQL 8.0 기준. 로컬 compose MySQL 8.0에서 실제 마이그레이션 구동 확인.

### 2. `UserRepository` 파생 쿼리 정정 (D-081 동반 필수 — 생략 시 로그인 파손)
`domain/member/UserRepository`(023 이동 후 위치):
- `existsByLoginId` → `existsByLoginIdAndIsDeletedFalse`
- `existsByNickname` → `existsByNicknameAndIsDeletedFalse`
- `findByLoginId` → `findByLoginIdAndIsDeletedFalse`
  - **이유(중요)**: 재가입이 허용되면 동일 `login_id`에 탈퇴행 + 신규행이 공존한다. 필터 없는
    `findByLoginId`는 다건을 반환해 `Optional<User>` 바인딩에서
    `IncorrectResultSizeDataAccessException`으로 터진다. UK만 고치고 이걸 빠뜨리면 **로그인이 깨진다**.
- 호출부(`AuthService`) 동반 수정. 기존 `user.isDeleted()` 사후 체크(login 경로)는 쿼리 필터로 대체되므로
  중복 검사 정리 여부를 판단하되, **동작 변경 없이** 정리할 것(불확실하면 남기고 완료 보고에 이슈로 올려라).

### 3. auth 회귀 + 신규 테스트
- **회귀(필수)**: 기존 auth 테스트 전량 그린. signup 중복(AUTH_001/002)·login·refresh·logout 무변경 확인.
  `SignupConcurrencyIntegrationTest` 포함(B-024 이중 방어 — UK 제약 안전망이 생성 컬럼 UK로 바뀌어도
  동일하게 동작해야 한다. **제약명이 `uk_user_login_id`→`uk_user_login_id_active`로 바뀌므로
  `DataIntegrityViolationException` 제약명 파싱 로직이 있으면 반드시 갱신**).
- **신규(재가입 시나리오)**: 통합 테스트로 (a) 가입 → 탈퇴(soft delete 직접 세팅 또는 리포지토리 조작으로
  `is_deleted=true`) → **동일 login_id·nickname 재가입 성공**, (b) 재가입 후 **로그인 성공**(다건 파손 부재 검증).
  - `DELETE /me` 엔드포인트는 아직 없으므로(별도 유닛) 탈퇴 상태는 리포지토리·엔티티 레벨로 만든다.

- **신규 필수 — QA-S-MBR-06(활성 유일성 회귀). 총괄 083 조건 1, 실행 증거 필수.**
  **동일 `login_id`로 활성 행 2개를 만들려는 시도가 DB에서 차단되는지 단언한다.**
  - **반드시 DB 레벨로 단언하라. signup API 경유 테스트는 이 케이스의 증거가 되지 못한다.**
    사유: B-024 이중 방어에서 `existsBy` **선검사가 먼저 409를 던져 DB UK를 타지 않는다**. 따라서 (a)안
    `UNIQUE(자연키, deleted_at)`을 잘못 넣어 **DB 활성 중복이 열려 있어도 API 테스트는 초록불이다.**
    QA 지적 그대로 — MBR-01~05는 전부 통과하고 오직 MBR-06만 뚫린다(조용히 열리는 유형).
  - 구현: 리포지토리로 동일 `login_id`·`is_deleted=false` 엔티티 2개를 `saveAndFlush`(선검사 우회) →
    **두 번째에서 `DataIntegrityViolationException` 발생을 단언**. `nickname`도 동일하게 1건.
    (`flush` 없이 `save`만 하면 제약 위반이 트랜잭션 종료까지 지연돼 단언이 어긋난다 — 주의.)
  - Testcontainers MySQL 필수(생성 컬럼·UK 실동작 검증이 목적이라 인메모리 DB로 갈음 불가).
  - **`./gradlew clean build` 그린으로 갈음 불가**(083 명시). 완료 보고에 **테스트 실재 경로 + 통과 여부를
    개별 항목으로** 적어라 — 총괄이 검수 시 이 항목만 따로 확인한다. D-078의 "단순 도메인 = dev 그린 대체"는
    이 케이스에 한해 배제됐다.
- Testcontainers MySQL로 실제 DDL·UK 동작 검증(생성 컬럼은 H2 등에서 동작이 다를 수 있음).

## 하지 말 것
- `DELETE /me`·`PATCH /me`·`GET /me` 구현 — 별도 유닛(029 및 후속). 이 단위는 **스키마·리포지토리·테스트만**.
- 다른 테이블 UK 스윕 — D-081은 전 도메인 패턴이나 **이번 단위는 `user`만**. 타 테이블은 기획 erd 스윕(074) 후
  해당 도메인 착수 시 적용.
- **`uk_user_public_id`에 D-081 패턴 적용 금지**(총괄 083 조건 2 — 과적용 주의).
  D-081은 **자연키(`login_id`·`nickname`)에만** 적용한다. `public_id`는 ULID **대리키**라 재사용되지 않으므로
  삭제행-신규행 충돌이 구조적으로 없다(erd §1 "외부 노출 식별자"). 일괄 적용하면 불필요한 생성 컬럼으로
  스키마만 비대해진다 — D-081이 유발하기 쉬운 전형적 부작용이라 명시적으로 배제한다.
- `user_balance`·`charge` 등 타 테이블 스키마 변경. 원본 `login_id`·`nickname` 컬럼 제거.
- 계약·erd 임의 수정(erd 반영은 기획 소관 — 완료 보고의 실물 정보로 동기화).

## 구현 지침
- CLAUDE.md §5·§7 준수. `./gradlew spotlessApply` 후 checkstyle 통과.
- 엔티티에 생성 컬럼 매핑이 필요한지 판단: 읽기 전용 파생이라 **매핑하지 않는 쪽을 기본**으로 하되
  (JPA `insertable=false, updatable=false` 매핑은 불요), 스키마 검증(`ddl-auto: validate`)이 미매핑 컬럼을
  문제 삼지 않는지 확인. validate가 실패하면 매핑 추가 후 완료 보고에 이슈로 명시.
- **`ddl-auto: validate`(전 프로파일, CLAUDE.md §3) 하에서 부팅 성공이 DoD의 일부다.**

## DoD
- V4 마이그레이션이 로컬 MySQL 8.0에서 구동, `ddl-auto: validate` 부팅 성공.
- 재가입 시나리오 (a) 재가입 성공 · (b) 재가입 후 로그인 성공 그린.
- **QA-S-MBR-06(활성 유일성 회귀) 그린 — DB 레벨 단언. 완료 보고에 테스트 실재 경로 + 통과 여부를 개별
  항목으로 명시**(083 조건 1 — `clean build` 그린으로 갈음 불가, 총괄이 이 항목만 따로 검수).
- auth 회귀 전량 그린. `./gradlew clean build` 성공(두 모듈).
- 완료 보고에 **실제 Flyway 채번(V4) + 생성 컬럼·UK 실물**을 명시(기획 erd 동기화용, B-012 선례).
- 완료 보고에 **`뿌리 점검`** 1줄(D-085 — 결함 FIX라 필수): "같은 원인이 다른 층에도 공백을 만들었나".
- 부재·수량을 근거로 쓸 때 **탐색 방법 1구 명시**(D-086 — 예: "심볼 기준 grep + 컴파일 검증으로 0건").

## 커밋 제안 (실행은 사용자 — 단일 커밋. 분리 금지)
```
fix(member): 재가입 UK를 생성 컬럼 패턴으로 재구성 (D-081)

목적
- erd 1절 규약(soft delete 자연키 UK는 삭제 식별 컬럼 포함) 위반을 해소하고, 계약 v1.4 §2.5 재가입 허용을
  동작시킨다. UK·리포지토리·회귀는 단일 단위 — 분리 시 로그인 파손(D-081 동반 필수).

세부 내용 (영역별)
- db: V4 — login_id_active·nickname_active 생성 컬럼(IF(is_deleted, NULL, ...)) + UK, 기존 단일 UK 제거
- domain: UserRepository 파생 쿼리에 AndIsDeletedFalse 정정(exists 2종·findByLoginId) + AuthService 호출부
- test: 재가입 시나리오 신규(재가입 성공·재가입 후 로그인·활성 중복 409), auth 회귀 전량

수정 파일
  변경(M): domain/member/UserRepository.java, domain/auth/AuthService.java,
           test .../SignupConcurrencyIntegrationTest.java
  추가(A): src/main/resources/db/migration/V4__user_natural_key_uk.sql
           (테스트) 재가입 통합 테스트

검증
- 로컬 MySQL 8.0 마이그레이션 구동 + ddl-auto=validate 부팅 성공.
- 재가입 3종 + auth 회귀 그린, ./gradlew clean build 성공.

범위 밖(다음 단계)
- 타 테이블 UK 스윕(기획 erd 스윕 074 후 도메인별), GET/PATCH/DELETE /me 유닛
```
