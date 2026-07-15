# QA 결함 트래킹 (QA-NNN, D-038·templates §10)

결함 티켓 누적(전 역할 열람). 심각도 Critical|Major|Minor, 상태 OPEN|FIXED|WONTFIX.
결함 티켓은 삭제하지 않는다(qa-guide §5). Critical(돈·정합성 훼손)은 발견 즉시 총괄 push.

기준: api-contract **v1.3** · domain-spec v0.4 · ACCEPTED 결정만(qa-guide §1, 추측 금지).
검증 대상 범위: backend/outbox/019(auth 완결) · 021(게이트웨이 완결).
검증 방법: Q-001(계약 기준 정적 정합 검증 + 재실행 가능한 시나리오 스위트).

---

## 현황 요약 (2026-07-14, G4-1 검증 / v1.3 델타 반영)

| 심각도 | OPEN | FIXED | WONTFIX |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| Major | 0 | 0 | 0 |
| Minor | 0 | 0 | 0 |

auth 4종(signup·login·refresh·logout)·게이트웨이(rate limit·직접접근 차단·라우팅)는 검증 범위
계약 조항 대비 정합. G4-1 범위에서 계약 위반 결함은 발견되지 않았다(G4-1 통과 확정, 060).

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
