상태: DONE (2026-07-14 구현·흡수 완료. auth 수직 006~011 완결. 이슈2 204 vs ApiResponse→B-019(계약 우선, void+@ResponseStatus 승인). 항목1 revoke 소유자검증·3 멱등·4 블랙리스트 미도입 수용)
# [백엔드 → Claude Code] 작업 지시: auth - 로그아웃(logout)

대상: POST /api/v1/auth/logout. (구현 순서 6/F, A·B 의존)
참조: api-contract §2 logout(line80~82), B-011, SEC-006.
범위(포함):
- `AuthService.logout`: 인증 필요(SecurityContext userId). refresh 무효화(RefreshTokenStore.revoke — 저장분 폐기 필수). 응답 204.
- 가정(경미): 계약이 무효화 대상 세션을 명시하지 않음 → body `{ refreshToken }`로 해당 세션 폐기. 필요 시 사용자 전체 세션 폐기 옵션은 후속. (총괄 회신 시 조정)
하지 말 것: access 블랙리스트(무상태 유지), 타 사용자 세션 조작.
구현 지침: CLAUDE.md §5. logout 후 동일 refresh 재사용은 AUTH_004로 차단됨을 테스트로 확인.
DoD: 무효화 성공(204) + 무효화 후 refresh 차단 테스트 + 빌드.
커밋 제안: feat(auth): 로그아웃 — refresh 무효화
