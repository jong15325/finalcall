상태: DONE (2026-07-14 구현·흡수 완료. 이슈1 라우팅→B-015, 이슈3 password→B-016. 이슈2 데모개명·이슈4 UserBalanceRepository 수용)
# [백엔드 → Claude Code] 작업 지시: auth - 회원가입(signup)

대상: POST /api/v1/auth/signup. (구현 순서 3/C, A 의존 — B와 병행 가능)
참조: api-contract §2 signup(line61~66), erd user·user_balance, SEC-007, B-004, CLAUDE.md §5.
범위(포함):
- `AuthController.signup` + `AuthService.signup(@Transactional)`: loginId/nickname 중복 검사(AUTH_001/002, Preconditions.validate), BCrypt 해시, `User` 생성 + `UserBalance`(0,0,0) **단일 트랜잭션** 생성, public_id ULID 생성. 응답 201 `{ userPublicId, nickname }`.
- SEC-007 열거 방지: 가입 실패 응답 사유 최소화(구체 노출 금지). nickname 중복은 표시용이라 유지.
- DTO record: `SignupRequest`(loginId/password/nickname, @Valid 검증·한국어 메시지), `SignupResponse`(@Builder + static from).
하지 말 것: 토큰 발급(signup은 토큰 미발급), 로그인·프로필 조회.
구현 지침: CLAUDE.md §5 — Controller(ApiResponse<T>·@Valid·try-catch 금지), Service(@Transactional 쓰기), DTO record. `BCryptPasswordEncoder` 빈 등록.
DoD: 계약 준수 + 단위·슬라이스 테스트(중복 AUTH_001/002·성공 201) + 빌드 성공.
커밋 제안: feat(auth): 회원가입 — 중복검증·BCrypt·잔액 동시 생성
