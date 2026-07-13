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

재개 필독(순서):
1. docs/security/findings.md (SEC 상태 — FIXED/OPEN게이트2/WONTFIX)
2. docs/security/threat-model.md · checklist.md (게이트 2 섹션)
3. docs/security/decision-log.md (S-001·S-002)
4. docs/api-contract.md v1 · docs/erd.md · docs/management/decision-log.md(D-068 등)
5. 게이트 2 착수 지시가 오면 inbox-log 확인 후 구현 코드 리뷰.
