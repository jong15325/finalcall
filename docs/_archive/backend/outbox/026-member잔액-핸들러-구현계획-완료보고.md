상태: ANSWERED → management/outbox/071-백엔드-026검수-B028승인-실행지시.md (검수 통과·B-028 승인·실행 지시)
회신대상: management/outbox/068-백엔드-022회신-계약공백승인-066정정.md · management/outbox/066-백엔드-도메인시퀀싱-member착수.md
주: 본 보고의 "계약 정합 리스크(MEMBER_001 잠정 사용)"는 071 지적 반영으로 철회됨 → B-029, 통지 outbox/027
# [백엔드 → 총괄] 완료 보고: member/잔액 구현 계획 — 승인 선행 2건 작업 분해 + 프롬프트 세트

결과: 068 확정 범위 기준으로 착수 가능분을 3유닛으로 분해하고 Claude Code 작업 프롬프트를 작성했다.
프로필·수정·탈퇴 3유닛은 계약 확정 전 착수 금지(D-074 선행 게이팅) — **대기 중: api-contract 회원 리소스 명세(기획 069)**.

## 작업 분해

| 유닛 | 산출물 | 의존 | 상태 |
|---|---|---|---|
| 023 member 도메인 재배치 | User·UserBalance·UserBalanceRepository `domain/auth` → `domain/member` | 없음 | 착수 가능 |
| 024 잔액 조회 `GET /api/v1/me/balance` | MemberController·MemberBalanceResponse·MemberService·MemberErrorCode | **023 선행** | 착수 가능 |
| 025 게이트웨이 엣지 오류 핸들러 | 429 envelope+Retry-After(gateway), 403 GATEWAY_403(서비스) | 없음(병행) | 착수 가능 |
| — 프로필 조회·수정·탈퇴 | `GET/PATCH/DELETE /api/v1/me` | **계약 명세(069)** | 대기 |

순서: 023 → 024(member 우선, 066·068 지정). 025는 독립이라 병행 — WebFlux 스택이라 별도 Claude Code 세션.

## 신규 발번 — B-028 (재배치)
`User`·`UserBalance`·`UserBalanceRepository`를 member 소유로 이동. auth는 인증 로직만 소유하고 `member.User` 참조.
- 근거: 계정 마스터·잔액은 member 자산이고 auth는 소비자. 존치 시 `domain/member → domain/auth` 역방향 의존이
  생기고, 화폐·bid·settlement가 전부 `auth.UserBalance`를 참조하게 되어 왜곡이 전 도메인에 전파된다.
- 시점 근거(실측): 현 참조자가 `api/auth` 4파일 + 통합테스트 1파일뿐 → 이동 비용 최소. D-074상 member가
  화폐·bid의 선행이라 **지금이 마지막 two-way door 구간**. 기능 무변경 순수 리팩터·단독 커밋.
- 068의 "구현 기법이라 백엔드 자율" 확인 하에 자율 결정, 사용자 확정(2026-07-15).

## 066 대비 범위 조정 (068 승인분 반영)
- "balance 엔티티·리포지토리 신규 생성" → **기실재**. 실작업 = 재배치 + 조회 API(068 정정 수용).
- "홀드/차감 구조적 골격" → **이미 충족**. `UserBalance`에 `getGameMoneyAvailable()`(= balance − held) 파생과
  증감 메서드 시그니처가 존재하고, 원자적 갱신(D-008)은 화폐 도메인 후속으로 주석 명시됨. 신규 작업 없음.
- `money_hold` 테이블은 bid 도메인 소관(068 확정) — 범위 밖.

## 계약 정합 리스크 1건 (024, 사전 통지)
024가 신설할 `MemberErrorCode`(`MEMBER_001` 잔액 행 부재)는 계약 §5 에러코드 표에 **미등재**다(068 — 기획이
069로 명세 중). 이번 유닛의 계약 준수 대상은 정상 경로(200, §4.4 4필드)이고 `MEMBER_001`은 방어적 내부 코드다.
회원 리소스 계약 확정 시 `MEMBER_NNN` 코드·상태값 정합을 재확인한다. 어긋나면 계약 기준으로 코드를 맞춘다
(D-028 — 먼저 구현한 쪽이 기준이 되지 않는다).

## 산출물
- backend/outbox/023-member-도메인재배치.md (Claude Code 프롬프트)
- backend/outbox/024-member-잔액조회.md (Claude Code 프롬프트)
- backend/outbox/025-gateway-엣지오류핸들러.md (Claude Code 프롬프트, 067 델타 3건 반영)
- backend/decision-log.md B-028

## 완료 기준 대비
- 066 "구현 계획(작업 단위 분해 + Claude Code 프롬프트 세트) 완료 보고": 충족(착수 가능분 한정).
- 068 "선행 2건(핸들러·잔액 조회) 진행 상황": 프롬프트 작성 완료, Claude Code 실행 대기(사용자 지시 시).
- 미충족: 프로필·수정·탈퇴 3유닛 — 계약 명세(069) 확정 전 착수 금지라 분해 보류. 확정·전파 시 즉시 착수 가능.

## 다음 단계 제안
1. 023 → 024 순차, 025 병행으로 Claude Code 실행(사용자 지시 대기).
2. 025 완료 시 **"QA RETEST-1·2 트리거"** 통지(067 의무) → 총괄이 QA 재검증 지시.
3. 069 계약 확정·전파 시 프로필·수정·탈퇴 분해 착수.

회신: 불요 (이견 시에만)
신규 발번 ID: B-028 (계정·잔액 엔티티 소유 도메인 — auth → member 이동, ACCEPTED)
