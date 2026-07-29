# FC-157 리뷰 — EPIC-OAUTH (FC-153~156) 통합 보안+QA

- **판정: PASS** — critical 0 · major 0 · minor 3(권고, 비차단). Done 전이 가능.
- 리뷰어: reviewer(읽기 전용). 대조 기준: api-contract §2·§5, erd §4.1. 2026-07-29.

## 7축 확인 (전부 PASS)
1. **state/CSRF** — 프론트 생성·보관·콜백 대조(`oauth.ts` generateState→sessionStorage→`OAuthCallbackPage` state 불일치 시 백엔드 미호출). StrictMode 1회성(`ranRef`)·보관값 read 즉시 삭제. SPA 표준, 위조·고정 방어 충분.
2. **열거방지(SEC-007)** — 가입·로그인 모두 200·동일 LoginResponse. 신원키=provider 통제라 임의 열거 불가.
3. **토큰 발급 정합** — `OAuthService.issueTokens`가 `AuthService.login`과 동일 조립(TokenClaims + RefreshTokenStore.issue(userId)). 회전·재사용탐지·revokeAll 상속.
4. **콜백·code·redirect 검증** — redirectUri 정확 일치 화이트리스트(provider 호출 전 차단, open redirect 방어). 오류 매핑 AUTH_006(400)/007(401)/008(502) 계약 1:1. `@ServiceLog`가 인자 미기록 → code·secret 로그 유출 없음.
5. **스키마 파급** — login_id·password_hash nullable화가 비번 경로 우회·NPE 없음(`matches(pw, null)`=false, 소셜은 login_id NULL이라 비번 로그인 도달 불가). login_id_active UK가 NULL 제외라 마이그레이션 정확.
6. **커넥션·TX 위생(FC-151)** — 공유 풀링 RestClient(connect 3s/read 5s), 외부 HTTP가 TX 밖, find-or-create만 단일 @Transactional.
7. **QA/정합** — 형상 보존·에러코드 프론트/백 동기화·컨벤션·ArchUnit·무관 리팩터 없음·테스트 충실(전략6·서비스4·통합5·find-or-create3).

## Minor (권고 — 비차단, 후속 티켓 후보)
- **M-1 (FC-153, 동시성)** — `SocialAccountService.createSocialUser` find 후 무보호 INSERT. 동일 소셜 신원 **동시 최초 로그인**이 겹치면 (provider,provider_user_id) UK 위반→`DataIntegrityViolationException` 미포착→500. 데이터는 UK가 보호(중복·orphan 없음)하나 우아하지 않음. **권고: signup 선례처럼 예외 포착 후 find 재조회로 멱등 수렴.**
- **M-2 (FC-155)** — `oauth.ts` state가 crypto.randomUUID 미지원 시 `Math.random()` 폴백(예측 가능성). 실사용 경로 아님. 권고: 폴백도 `crypto.getRandomValues` 또는 미지원 시 비활성.
- **M-3 (info, FC-152 설계)** — 백엔드 무상태 state 미검증은 게이트2 승인 설계. 조치 불요(기록용).

## 재작업 필요
없음. M-1만 후속 개선 권고(Done 차단 아님).
