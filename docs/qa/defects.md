# QA 결함 트래킹 (QA-NNN, D-038·templates §10)

결함 티켓 누적(전 역할 열람). 심각도 Critical|Major|Minor, 상태 OPEN|FIXED|WONTFIX.
결함 티켓은 삭제하지 않는다(qa-guide §5). Critical(돈·정합성 훼손)은 발견 즉시 총괄 push.

기준: 확정 스펙 3종 **api-contract v1.4 · domain-spec v0.5 · erd v0.5(§1 규약 포함)** + ACCEPTED
결정만(qa-guide §1, 추측 금지). 검증 대상 범위: backend/outbox/019(auth 완결) · 021(게이트웨이 완결).
검증 방법: Q-001(정적 정합 검증 + 재실행 가능한 스위트) + **Q-004(기준에 erd 포함)**.

---

## 현황 요약 (2026-07-15, V4 재검증 반영)

| 심각도 | OPEN | FIXED | WONTFIX |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| Major | 0 | **1** | 0 |
| Minor | 0 | 0 | 0 |

- api-contract·domain-spec 층: G4-1 범위 위반 0건(060 판정 시점 검증 유효).
- **erd 층: 위반 1건(QA-001)** — Q-001의 기준에 erd가 없어 G4-1에서 통과된 잠복분. 기준 보완(Q-004)
  후 V3를 erd §1·§4.1 전 항목에 재대조한 결과 **위반은 QA-001 1건뿐**(네이밍·PK·FK·public_id·
  시간·컬럼 집합은 모두 정합) — 추가 잠복 없음.
- G4-1 게이트 판정은 번복하지 않는다(당시 기준으로 유효, 075). 결함 이력만 남긴다.

---

## QA-001. V3 `user` 자연키 UK가 erd §1 soft delete 규약 위반 — 재가입 불능(잠복)

심각도: Major · 상태: **FIXED**(2026-07-15 재검증, V4 `df9836c`) · 등재 2026-07-15

### 재검증 결과 (094 지시, 082 경로 발동) — FIXED 판정

FIX 실물: `V4__user_natural_key_uk.sql`. 판정 근거(전량 호스트 도구 Read·Grep, D-090):
- **D-081 패턴 정확 적용**: 기존 `uk_user_login_id`·`uk_user_nickname` DROP → 생성 컬럼
  `login_id_active`/`nickname_active` = `IF(is_deleted, NULL, 자연키)` STORED 추가 → 생성 컬럼에만 UK.
  활성 행만 값 → 유일성 보존 / 탈퇴행 NULL → 다중 NULL 허용 → 재탈퇴 무제한.
- **기각안 배제 확인(핵심)**: (a) `UNIQUE(자연키, deleted_at)`·(b) `UNIQUE(자연키, is_deleted)` 모두
  V4에 없음. 소스 정독으로 확정.
- **파급 3건 해소**: (1) 재가입 → `ReSignupIntegrationTest` 201. (2) nickname 중복 오판정 → 탈퇴행이
  활성 검사에서 제외(`UserRepositorySliceTest` 63~72) + 동일 nickname 재가입 성공. (3) 다건 로그인
  파손 → **필터 없는 `findByLoginId`가 main 전역에 부재**(Grep 전수: `AndIsDeletedFalse` 변형만 존재),
  `ReSignupIntegrationTest` 재가입 후 로그인 200.
- **회귀 무발생 확인**: V4가 UK명을 `_active`로 바꿨는데 B-024 중복 매핑(제약명 문자열 판정)도
  `uk_user_login_id_active`/`uk_user_nickname_active`로 동반 갱신됨. 테스트에 옛 UK명 잔존 없음
  (Grep: 옛 이름 0건, 전건 `_active`). `SignupConcurrencyIntegrationTest` 6스레드 → 1×201·5×409·500 0건.

증거 수준의 한계(정직 표기): **QA 독립 재실행은 수행하지 못했다** — 검증 환경에 Docker 미가용·
Java 11(프로젝트 21)이라 Testcontainers 구동 불가. 실행 증거는 백엔드 CC 보고 + 커밋 `df9836c`
검증란("로컬 MySQL 8.0 마이그레이션 구동 + ddl-auto=validate 부팅 성공, QA-S-MBR-06 그린")이다.
D-078 설계상 실행은 손(Claude Code) 소관이라 예상된 한계다.

그럼에도 FIXED로 판정하는 근거: **MBR-06의 존재 이유는 "기각안 (a) 오적용 검출"인데, 적용된 패턴이
(a)가 아님을 V4 소스로 확정했다.** 즉 이 리스크는 실행 결과와 무관하게 정적으로 닫힌다. 실행은
확인(confirmation)을 더할 뿐 판정을 뒤집을 수 없다 — 소스가 (a)가 아닌데 (a) 함정이 발현할 수는 없다.

잔여(결함 아님, 권고):
- 재탈퇴 반복 3회 이상(탈퇴행 2건+ 공존)을 단언하는 테스트 없음. 구조적으로는 닫힘(탈퇴행 전부 NULL,
  기각안 (b) 배제 확인) → 리스크 낮음. QA-S-MBR-05 케이스 4는 미단언으로 남는다.
- 탈퇴자 nickname을 `PATCH /me`로 사용하는 경로는 member 3유닛 미착수라 미실행 이월(QA-S-MBR-05 케이스 3).
  signup 경로로는 해소 입증됨.

---

### 원 등재 내용 (이력 보존, 불변)

심각도: Major · 상태: OPEN(등재 시점) · 2026-07-15

재현/조건: (현재 미발현 — 탈퇴 경로 미구현이라 API로는 도달 불가. 스키마 정적 검증으로 확인)
1. `src/main/resources/db/migration/V3__user_and_balance.sql` 확인 — `user`는 `is_deleted BIT NOT
   NULL`·`deleted_at DATETIME(6) NULL` 보유 = soft delete 테이블.
2. 동 파일 UK 정의: `UNIQUE KEY uk_user_login_id (login_id)`, `UNIQUE KEY uk_user_nickname (nickname)`
   — 자연키 유니크에 삭제 식별 컬럼이 포함되지 않음.
3. (발현 시나리오, v1.4 §2.5 `DELETE /me` 구현 후) 탈퇴 → 동일 login_id 재가입 → `AUTH_001` 409 오거부.

기대 vs 실제:
- 기대(erd §1, line 30): "soft delete 테이블의 자연키 유니크는 삭제 식별 컬럼을 포함(삭제행-신규행
  충돌 회피)". 확정 패턴은 D-081(`<자연키>_active` 생성 컬럼 + UK).
- 실제: 삭제 식별 컬럼 없는 평문 자연키 UK → 탈퇴행이 login_id·nickname을 **영구 점유**.

발현 시 파급(075 총괄 제시, QA 확인):
1. 재가입 차단 — `AUTH_001` 오거부(v1.4 §2.5 "재가입: login_id·nickname 재사용 허용" 정면 위반).
2. 탈퇴자 nickname 중복 오판정 — `PATCH /me` 시 `MEMBER_001` 오거부.
3. 재가입이 성사되는 구현으로 바뀌면 `findByLoginId` 다건 → `IncorrectResultSizeDataAccessException`
   (로그인 파손).

심각도 근거(Major, Critical 아님): 확정 스펙 위반 + v1.4 §2.5 명시 기능(재가입)을 불능화하므로
Minor 아님. 다만 현 상태는 **과잉 제약(차단)**이라 데이터 정합성이 깨지지 않고(중복 행·잔액 오류
없음), 미발현이며 FIX가 선행 단위로 진행 중 → qa-guide §5의 Critical 정의(돈·정합성 훼손: 중복
판매·잔액 오류)에 해당하지 않는다. 즉시 총괄 push 대상 아님.

분류 근거(Q-003 RETEST가 아니라 결함인 이유): erd §1은 **G2 통과 확정 스펙(2026-07-13)**이고 V3는
그 이후(07-14) 작성됐다 — 작성 시점에 규약이 이미 존재했다. Q-003이 다루는 "완료 후 계약이 바뀌어
생긴 새 요구(미착수 할당분)"가 아니라 "이미 있던 확정 스펙을 위반한 완료 주장 산출물"이므로 결함의
정의 그대로다. 규약 발동 조건은 "탈퇴가 명세되면"이 아니라 "soft delete 테이블이면"이다.

귀속(blameless, D-027): 백엔드 과실이 아니다. 스펙 공백(022)의 2차 파생 + **검증 기준 누락(Q-001에
erd 부재 — QA 소유 문서의 구멍)**이 함께 만든 결과다. 등재 이유는 지표 정직성 하나 — G4-1이
"defects 0"으로 통과했는데 확정 스펙 위반이 있었다면 그 0은 거짓이고, 거짓 지표는 다음 게이트
판정을 오염시킨다.

FIX·재검증: 백엔드 V4 선행 단위(D-081 패턴)가 FIX. 완료 보고 수신 → QA-S-MBR-04·05·06 재검증 →
FIXED 전환. 현재 V4 마이그레이션 미생성 확인(db/migration = V1·V2·V3).

관련: erd §1(line 30)·§4.1 · D-081 · api-contract v1.4 §2.5 · backend/outbox/028 · management/outbox/
073·074·075 · Q-004 · scenarios/003-member-계정생명주기.md

QA 관찰(백엔드 참고 — 패턴 과적용 주의): D-081 패턴은 **자연키(login_id·nickname)에만** 적용한다.
`uk_user_public_id`는 대상이 아니다 — public_id는 ULID 대리키로 재사용되지 않아 삭제행-신규행 충돌이
구조적으로 발생하지 않는다(erd §1 "외부 노출 식별자" 항). 일괄 적용 시 불필요한 생성 컬럼이 는다.

## 계약 질의 — 해소됨 (v1.3 확정, 065)

- CQ-1 게이트웨이 rate limit 429 응답 본문 포맷 미명세 → **해소**. 근거 확보: v1.3 §1.6·§5
  (GATEWAY_429 envelope + `Retry-After`). 기대치 확정 완료(QA-S-GW-02). → RETEST-1로 전환.
- CQ-2 게이트웨이 직접접근 차단 403 오류 코드 미명세 → **해소**. 근거 확보: v1.3 §1.6·§5
  (GATEWAY_403). 기대치 확정 완료(QA-S-GW-04). → RETEST-2로 전환.

## 재검증 대기 (RETEST — 결함 아님, 구현 미착수 할당분)

계약 v1.3가 요구하나 현 구현이 아직 충족하지 않는 델타. 백엔드에 이미 할당된 미착수 작업이므로
결함(QA-NNN)이 아니라 재검증 대기로 관리한다(Q-003). 구현 완료 보고 후 재검증 → 불일치 잔존 시
그때 결함 발번.

| ID | 항목 | 현 구현 | v1.3 기대 | 트리거 |
|---|---|---|---|---|
| RETEST-1 | rate limit 429 응답 | SCG 기본(본문 없음·Retry-After 없음) | `GATEWAY_429` envelope + `Retry-After` 헤더, errors 미포함 | 백엔드 핸들러 완료(065 B) |
| RETEST-2 | 직접접근 차단 403 코드 | `COMMON_006`(CommonErrorCode.FORBIDDEN) | `GATEWAY_403` | 백엔드 핸들러 완료(065 B) |

부수 영향(백엔드 참고): RETEST-2 반영 시 GatewayAccessIntegrationTest의 기대 코드(`COMMON_006`)도
함께 갱신 대상. RETEST-1은 429 트리거(버스트 초과) 동적 테스트가 현재 부재 — 신규 필요.

## 관찰(비결함 — 참고, 근거 인용 아님)

- OBS-1 password 최소 길이 미검증(@Size max=72만, min 없음): 계약 §2에 최소 길이 규정 없어 v1.2
  기준 정합. 보안 게이트2 이월분(B-016)과 동일 사안 — QA 결함 아님, 중복 등재 안 함.
- OBS-2 로그인 타이밍 사이드채널(B-017): 공격자 관점 → 보안 파트 소관(qa-guide §1 역할 경계). QA 비대상.
