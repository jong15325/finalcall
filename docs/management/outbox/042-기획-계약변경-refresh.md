상태: SENT
# [총괄 → 기획/설계] 작업 지시: 계약 변경(6절) — /refresh 응답에 refreshToken 추가 (D-070)

배경: 백엔드 auth 구현 중 계약 정합 이슈 — api-contract §2 POST /refresh 응답이 refreshToken
미포함인데 SEC-006 refresh 회전은 신규 refresh 전달이 필요. 총괄 (a) 채택(D-070). 계약 v1 확정
후 첫 6절 변경.

작업(6절 절차):
1. api-contract §2 POST /refresh 응답에 refreshToken 추가:
   `{ accessToken, refreshToken, accessExpiresAt }`. 회전 정책(재발급마다 이전 refresh 폐기·
   재사용 탐지) 1줄 명시(SEC-006 정합).
2. 버전 v1 → v1.1, 변경 이력(버전·날짜·내용·사유=D-070/SEC-006) 기록.
3. 프론트 저장소 계약 복사본 갱신은 전파 체크리스트 등재(프론트 기동 시 반영).
4. 보안 통지: 본 변경은 SEC-006 구현 정합(보안 강화). 보안 델타 경미.
의존: 없음(D-070 ACCEPTED).
하지 말 것: §2 외 변경, 회전 정책 완화.
관련: docs/api-contract.md §2, decision-log D-070, docs/security/findings.md SEC-006.

회신: 필요 — 계약 v1.1 갱신 완료 보고(백엔드 010 최종화 트리거).
