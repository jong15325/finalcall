상태: SENT (Claude Code 대상, 총괄 검토 후 착수 — auth 이후/병행)
# [백엔드 → Claude Code] 작업 지시: gateway - SCG 엣지 게이트웨이 스켈레톤(D-068)

대상: Spring Cloud Gateway 엣지 게이트웨이 스켈레톤(별도 모듈/배포). (구현 순서 7/G, auth와 독립 병행)
참조: D-068, CLAUDE.md E2(앱 레벨 rate limit off), api-contract §2 SEC-005, docs/backend/notes/onrace-reference.md(참고 패턴).
범위(포함):
- SCG 모듈/프로젝트 스켈레톤: 라우팅(단일 서비스로 프록시), Redis `RequestRateLimiter`(토큰버킷) — 인증 계열 경로(login/signup/refresh) 우선.
- 직접접근 차단: default filter로 하류에 `X-Gateway-Token`(공유 비밀) 부착 + 서비스 측 `GatewayAccessFilter`가 불일치 시 403(actuator 제외). 공유 비밀은 환경변수(${GATEWAY_INTERNAL_SECRET}).
하지 말 것: 게이트웨이 JWT 검증·X-User-Id 주입(D-065 — 인증은 서비스 전담). WaitingRoom·대기열 게이팅(현 범위 밖).
구현 지침: WebFlux 기반, 서블릿 web/JPA 제외. 시크릿 fail-fast(운영 기본값 없음).
DoD: 로컬 라우팅·rate limit·직접접근 403 동작 확인 + 빌드.
커밋 제안: chore(skeleton): SCG 엣지 게이트웨이 스켈레톤(D-068)
비고: 완료기준4(병행 여부) — auth 도메인(A~F) 우선순위가 높음. G는 auth 착수 후 여력 시 병행 권장.
