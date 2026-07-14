상태: READY (계약 v1.1 확정으로 해금 — mgmt/044, 2026-07-14. /refresh 응답 refreshToken+회전 §2 line76~81 반영 완료)
# [백엔드 → Claude Code] 작업 지시: auth - 토큰 재발급(refresh)

대상: POST /api/v1/auth/refresh. (구현 순서 5/E, A·B 의존)
참조: api-contract §2 refresh(line74~78), B-011, SEC-006.
범위(포함):
- `AuthService.refresh`: body `{ refreshToken }` 검증(RefreshTokenStore.validate). 유효 시 access 재발급 + refresh 회전(신규 저장·구 폐기). 재사용 탐지(제시 토큰≠저장분) 시 해당 세션 무효화 + AUTH_004. 만료·무효 AUTH_004(401).
- DTO record: `RefreshRequest`, `RefreshResponse`.
**계약 정합 확정(D-070, (a) 채택)**: /refresh 응답 = `{ accessToken, refreshToken, accessExpiresAt }`(회전분 전달). 기획 api-contract §2 v1.1 갱신 대기(mgmt/outbox/042). 이 단위는 v1.1 확정 후 최종화(그 전 착수 보류).
하지 말 것: 계약 임의 변경(6절 절차), logout.
구현 지침: CLAUDE.md §5. 재사용 탐지·회전은 원자적 처리(경쟁 시 단일 승자).
DoD: 성공·만료·재사용 탐지(AUTH_004) 테스트 + 빌드. (계약 정합 회신 반영 후 최종화)
커밋 제안: feat(auth): 토큰 재발급 — refresh 회전·재사용 탐지
