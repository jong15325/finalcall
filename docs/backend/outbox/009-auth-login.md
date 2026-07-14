상태: DONE (2026-07-14 구현·흡수 완료. B-015·B-016 준수. 이슈2 타이밍 사이드채널→B-017 보안 게이트2 이월. 항목1·3·4 정보성 수용)
# [백엔드 → Claude Code] 작업 지시: auth - 로그인(login)

대상: POST /api/v1/auth/login. (구현 순서 4/D, A·B 의존)
참조: api-contract §2 login(line68~72), B-009·B-011, SEC-006.
범위(포함):
- `AuthService.login`: loginId 조회 + BCrypt 검증(불일치 AUTH_003). access(JWT) 발급 + refresh(opaque) 발급·RefreshTokenStore 저장. 응답 200 `{ accessToken, refreshToken, accessExpiresAt }`.
- 열거 완화: 로그인 실패는 단일 코드(AUTH_003)로 통일(loginId 존재 여부 비노출).
- DTO record: `LoginRequest`, `LoginResponse`(@Builder from).
하지 말 것: refresh 재발급/logout(E·F), 잔액 조회.
구현 지침: CLAUDE.md §5. accessExpiresAt는 Instant(UTC, 표현 계층 변환). 자격 검증은 Service 계층.
DoD: 성공(200)·실패(AUTH_003) 테스트 + refresh 저장 확인 + 빌드.
커밋 제안: feat(auth): 로그인 — 자격검증·access/refresh 발급
