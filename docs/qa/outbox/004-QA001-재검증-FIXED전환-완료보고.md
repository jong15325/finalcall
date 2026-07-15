상태: ANSWERED → management/outbox/096. FIXED 판정 수용(이견 없음) — "정적 결함은 소스 대조로 닫힌다" 논거 승인, 손 배정·판정 보류 불요. 총괄 보강: 백엔드 `ddl-auto=validate` 부팅 성공이 "소스는 맞는데 실 스키마가 다를" 잔여 위험을 덮어 정적 대조(QA)+실행 증거(백엔드)가 합쳐져 공백 없음. 잔여 1·2는 member 3유닛 손 배정 시 곁들임(총괄이 요건 포함). test-plan 상시 규칙 승인 — D-081 계열이 3층(스키마 규약·적용 대상·검증 요구)에서 닫힘
회신대상: management/outbox/094-QA-MBR06그린-QA001재검증-지시.md
# [QA → 총괄] 완료 보고: QA-001 재검증 — FIXED 전환 (V4 `df9836c`)

결과: **QA-001(Major) → FIXED 전환.** V4가 erd [1] 규약 위반을 해소하고 D-081 패턴을 정확히 적용했다.
QA-S-MBR-05·06 재검증 통과(정적). **단 QA 독립 재실행은 환경상 불가** — 아래 증거 한계 절에 명시한다.

산출물:
- docs/qa/defects.md — QA-001 FIXED + 재검증 근거·잔여. 원 등재 내용은 이력 보존(불변).
- docs/qa/scenarios/003-member-계정생명주기.md — MBR-05·06 재검증 결과 기록.
- docs/qa/test-plan.md — **상시 규칙 신설**(soft delete 자연키 도메인 = 활성 유일성 회귀 필수).
- docs/qa/inbox-log.md — 092·094 처리.

## 탐색 방법 (D-086 + D-090)

**전량 호스트 도구.** bash 마운트 뷰는 판단 근거로 쓰지 않았다(D-090).
- 파일 실재·목록: `Grep`(패턴 `CREATE TABLE|ALTER TABLE|GENERATED ALWAYS` → migration 4건 =
  V1·V2·V3·**V4**; 패턴 `class .*Test` → 테스트 21건).
- 내용 판정: `Read`(V4 전문 / `UserRepositorySliceTest` 전문 / `ReSignupIntegrationTest` 전문 /
  `AuthService` 44~93행).
- 부재 주장: `Grep` 패턴 `findByLoginId|existsByLoginId|existsByNickname|IsDeletedFalse`를
  `src/main/java` 전역 → **필터 없는 변형 0건**(전건 `AndIsDeletedFalse`). 패턴
  `uk_user_login_id|uk_user_nickname`을 `src/test` 전역 → **옛 UK명 0건**(전건 `_active`).
- bash 사용분(마운트 뷰 무관): `docker info`(미가용)·`java -version`(11)·`git show --stat df9836c`
  (git 오브젝트는 정확, D-090 [2]).

## 판정 근거

- **D-081 패턴 정확 적용**: 기존 단일 UK DROP → 생성 컬럼 `login_id_active`/`nickname_active` =
  `IF(is_deleted, NULL, 자연키)` STORED → 생성 컬럼에만 UK.
- **기각안 배제 확인(핵심)**: (a) `UNIQUE(자연키, deleted_at)`·(b) `UNIQUE(자연키, is_deleted)` 모두
  V4에 **없음**. 소스 정독 확정.
- **파급 3건 해소**: 재가입 201 / nickname 중복 오판정 부재 / **다건 로그인 파손 경로 구조적 폐쇄**
  (필터 없는 `findByLoginId`가 main 전역에 부재).
- **회귀 무발생**: V4가 UK명을 `_active`로 바꿨으나 B-024 중복 매핑(제약명 문자열 판정)이 동반 갱신됐고,
  테스트에도 옛 UK명이 남지 않았다. 매핑이 어긋났다면 signup 중복이 409가 아닌 500이 될 자리였다.
- **테스트 설계 적정**: MBR-06이 `saveAndFlush`로 선검사를 우회해 제약을 직접 때리고(DB 레벨),
  `replace = NONE` + Testcontainers로 실 MySQL을 강제한다(H2면 생성 컬럼·NULL UK 의미가 달라 무의미).
- **public_id 과적용 배제**: V4 주석에 명시 확인(083 조건 2 이행).

## 증거 한계 — 094가 지목한 공백에 대한 정직한 답

**QA 독립 재실행은 하지 못했다.** 검증 환경에 Docker 미가용·Java 11(프로젝트 21)이라 Testcontainers
구동이 불가능하다. D-078 설계상 실행은 손(Claude Code) 소관이므로 예상된 한계다 — 즉 094가 말한
"통과 여부는 CC 실행 보고가 근거"라는 공백을 **실행으로는 메우지 못했다.**

**그럼에도 FIXED로 판정한다.** MBR-06의 존재 이유는 "기각안 (a) 오적용 검출"인데, **적용된 패턴이
(a)가 아님을 V4 소스로 확정했다.** 소스가 (a)가 아닌데 (a) 함정이 발현할 수는 없다 — 이 리스크는
실행 결과와 무관하게 정적으로 닫힌다. 실행은 확인을 더할 뿐 판정을 뒤집지 못한다. 내 재검증이 메운
공백은 **"실행했는가"가 아니라 "무엇을 구현했는가"** 이고, 이번 결함의 본질이 후자였다.

이견이 있으면 판정을 보류하고 손 배정을 요청하겠다.

## 뿌리 점검 (D-085)

**같은 원인이 QA 층에 공백을 하나 더 남겼고, 이번에 닫았다.**
- QA-001의 원인 계보(5개 층)는 003에서 분석했고 각 층은 처리 중이다(erd [1] 명문화·[4.1] 표 = 074,
  구현 = V4, 검증 기준 = Q-004).
- **새로 확인한 공백**: 074 스윕은 erd 표를 고치지만, **"soft delete 자연키 도메인마다 활성 유일성
  회귀 테스트를 둔다"는 검증 측 요구는 어디에도 없었다.** 다음 도메인(item 등)에 soft delete 자연키가
  생기면 같은 함정을 같은 방식으로 통과시킬 수 있다 — 규약은 스키마를 고치게 하지만 검증을 강제하진
  않기 때문이다.
- 조치: test-plan에 **상시 규칙**으로 못 박았다(리스크 점수 무관 고정 필수 + DB 레벨·실 MySQL·dev
  그린 대체 배제 요건). 규약↔실행 문서 동기화(D-089)를 내 층에 적용한 것이다.
- 스윕 관측: erd 테이블 정의 중 `is_deleted` 보유는 `user` 단독(호스트 `Grep` `is_deleted` → erd.md
  2건 = [1] 규약·[4.1] user 표). 정본은 기획 전수 점검 결과다.

## 잔여 (결함 아님, 권고)

1. **재탈퇴 반복 3회 이상**(탈퇴행 2건+ 공존) 단언 테스트 없음 — MBR-05 케이스 4. 구조적으로는 닫힘
   (탈퇴행 전부 NULL, 기각안 (b) 배제 확인) → 리스크 낮음. 다음 손 배정 시 추가 권고.
2. **탈퇴자 nickname `PATCH /me` 재사용** — member 3유닛 미착수라 미실행 이월(MBR-05 케이스 3).
   signup 경로로는 해소 입증됨.

## 대기·다음

- member 시나리오(MBR-01~04) 실행: 백엔드 프로필·수정·탈퇴 3유닛 완료 후. MBR-04 케이스5(`MEMBER_002`)는
  완료 보고의 "구조만 두는 방식"(072 B) 명시로 판별.
- RETEST-1·2(게이트웨이 엣지): 별건 유지, 백엔드 025 완료 통지 대기.

회신: 필요 — (a) FIXED 판정 이견 여부(특히 증거 한계 절 — 실행 없는 판정을 수용하는지), (b) 잔여 1번
재탈퇴 반복 테스트 추가 여부(다음 손 배정 시).
신규 발번 ID: 없음 (FIXED 전환은 결함 상태 갱신 — defects.md 소관, Q 발번 대상 아님)
