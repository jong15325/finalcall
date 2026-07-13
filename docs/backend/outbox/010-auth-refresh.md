상태: SENT (Claude Code 대상, 총괄 검토 후 착수 — 계약 정합 이슈 회신 대기)
# [백엔드 → Claude Code] 작업 지시: auth - 토큰 재발급(refresh)

대상: POST /api/v1/auth/refresh. (구현 순서 5/E, A·B 의존)
참조: api-contract §2 refresh(line74~78), B-011, SEC-006.
범위(포함):
- `AuthService.refresh`: body `{ refreshToken }` 검증(RefreshTokenStore.validate). 유효 시 access 재발급 + refresh 회전(신규 저장·구 폐기). 재사용 탐지(제시 토큰≠저장분) 시 해당 세션 무효화 + AUTH_004. 만료·무효 AUTH_004(401).
- DTO record: `RefreshRequest`, `RefreshResponse`.
**미해결 가정(총괄 회신 대기)**: 계약 §2 refresh 응답이 `{ accessToken, accessExpiresAt }`로 refreshToken을 포함하지 않는데, SEC-006은 "재발급 시 회전(이전 refresh 폐기)"을 요구한다 → 회전한 신규 refresh를 클라이언트가 받을 수 없는 모순. 가정: 응답에 `refreshToken` 추가(회전분 전달). 총괄/기획의 6절 계약 정합 회신 전까지 이 단위는 조건부 보류(구현 시 가정 표기). 대안: refresh 회전을 매 재발급이 아닌 임계시점만 수행.
하지 말 것: 계약 임의 변경(6절 절차), logout.
구현 지침: CLAUDE.md §5. 재사용 탐지·회전은 원자적 처리(경쟁 시 단일 승자).
DoD: 성공·만료·재사용 탐지(AUTH_004) 테스트 + 빌드. (계약 정합 회신 반영 후 최종화)
커밋 제안: feat(auth): 토큰 재발급 — refresh 회전·재사용 탐지
