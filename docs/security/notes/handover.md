# 보안 handover (2026-07-14)

진행 중: 없음(액티브 작업 없음). 보안 게이트 1 종료 — 조건부 통과(S-001) → 계약 v0.2
델타 재확인 후 최종 통과(S-002). G3 통과(mgmt/039).

대기 중(게이트 2, 도메인 구현 완료 시 착수): 아래 4건 구현 표본 검사.
- SEC-005: SCG 엣지 게이트웨이(D-068) rate limit(Redis 토큰버킷)·직접접근 차단
  (X-Gateway-Token) 실구현 검증.
- SEC-008: 홀드·차감·잔액 조건부 원자 갱신(UPDATE ... WHERE available>=amt) 코드 표본.
- SEC-011: /admin/** 인가(@PreAuthorize·URL 패턴 필터) 적용 실태 표본.
- 공통(security-guide 4절): 시크릿 하드코딩 grep·fail-fast, IDOR 표본, 검증 우회 경로.
- 수용/정보성: SEC-010(ULID 시각 노출) WONTFIX.

휘발성 맥락(파일에 없는 판단):
- 게이트 1 최우선은 SEC-002(충전 confirm)였고 계약 v0.2에서 인증+소유자검증+토스 서버-투-
  서버 재조회로 해소됨. 구현이 이 설계를 벗어나면(클라 amount 신뢰) 즉시 Critical.
- SEC-005는 원래 D-065 게이트웨이 제거의 부작용 발견 → D-068로 게이트웨이 재도입되며
  해소. 게이트 2에서 "게이트웨이가 실제로 rate limit을 거는지"가 핵심 확인점.
- 비차단 관찰: api-contract §5 에러코드 표에 신규 4종(AUCTION_008·009·SHOP_006·
  CHARGE_003) 미등재 — 기획이 v1 보강 예정(039). 게이트 2 때 반영 여부 확인만.

규약 변경 적용(D-082~085, mgmt/079 — 2026-07-14):
- D-083 이의 제기는 의무: 총괄 지시가 진행 중 작업과 충돌하면 따르기 전에 말한다. 침묵은
  규약 위반. 진행 중 작업은 완주가 기본값이고 중단·선점은 총괄이 근거를 제시해야 성립.
- templates 4 `뿌리 점검` 필드 신설: 공백·결함 처리 시 필수. SEC 발견은 결함 처리이므로
  게이트 2 완료 보고에 "같은 원인이 다른 층에도 공백을 만들었나" 1줄 반드시 포함.
- D-082: 착수 지시에 `근거(인용)`(확정 스펙 직접 인용)이 없으면 이의 대상. 게이트 2 착수
  지시 수신 시 근거 인용 유무를 먼저 확인한다.
- D-084: 파트 내 유닛 순서는 파트 자율 — 게이트 2 검사 항목 순서·범위 판정은 보안 자율
  (총괄이 유닛 단위 순서를 지정하면 이의 대상).
- 미해결: D-082~085가 decision-log(정본)에 미등재 — 관찰 발신(outbox/003). 게이트 2 재개
  시 정본 등재 여부 확인 후 근거 인용.

재개 필독(순서):
1. docs/security/findings.md (SEC 상태 — FIXED/OPEN게이트2/WONTFIX)
2. docs/security/threat-model.md · checklist.md (게이트 2 섹션)
3. docs/security/decision-log.md (S-001·S-002)
4. docs/api-contract.md v1 · docs/erd.md · docs/management/decision-log.md(D-068 등)
5. 게이트 2 착수 지시가 오면 inbox-log 확인 후 구현 코드 리뷰.
