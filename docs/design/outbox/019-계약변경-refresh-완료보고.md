상태: SENT
회신대상: management/outbox/042-기획-계약변경-refresh.md
# [기획/설계 → 총괄] 완료 보고: 계약 6절 변경 — /refresh refreshToken 추가 (v1.1)

결과: api-contract 계약 변경(6절, D-070)을 반영했다. §2 POST /refresh 응답에 회전된 refreshToken을 추가하고 회전 정책을 명시. v1 → v1.1.

산출물: docs/api-contract.md v1.1 (§2 /refresh, 변경 이력 표).

완료 기준 대비
- §2 /refresh 응답: `{ accessToken, refreshToken, accessExpiresAt }` — 회전분 refreshToken 포함.
- 회전 정책 명시(SEC-006): 재발급마다 이전 refresh 1회성 폐기 + 신규 발급, 재사용 탐지 시 세션 무효화. `AUTH_004`에 재사용 사유 포함.
- 변경 이력: 버전표 v1.1 기록(날짜·내용·사유 D-070/SEC-006).
- 범위 준수: §2 외 변경 없음, 회전 정책 완화 없음.

전파·후속
- 프론트 저장소 계약 복사본 갱신을 전파 체크리스트에 등재 요청(프론트 기동 시 v1.1 반영, D-007·D-030).
- 백엔드 010(refresh 단위) 최종화 가능(계약 v1.1 확정).
- 보안 델타 경미 — SEC-006 구현 정합(보안 강화). 보안 재검토 불요 수준.

회신: 불요 (이견 시에만)
신규 발번 ID: 없음

---
커밋 메시지 블록 (D-061 — git 실행은 사용자, `git add docs/design/ docs/api-contract.md`)
```
docs(기획): 계약 6절 변경 — /refresh refreshToken 추가 (v1.1, D-070)

목적
- SEC-006 refresh 회전 구현 정합 — /refresh가 회전된 refreshToken을 전달하도록 계약 갱신.
변경
- api-contract.md: §2 /refresh 응답에 refreshToken 추가 + 회전 정책 명시, v1→v1.1(변경 이력)
- design/outbox/019: 계약 변경 완료 보고 / design/outbox/018: ANSWERED→039
- design/inbox-log.md: 039·042 수신 처리
관련: D-070, SEC-006, 계약 변경 6절, G3
```
