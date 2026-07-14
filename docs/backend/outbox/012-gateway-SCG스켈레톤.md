상태: DONE (2026-07-14 완결 — clean build BUILD SUCCESSFUL 두 모듈, 61 tests 전건·checkstyle maxWarnings0·spotless 통과, jar 2개. 설계 B-026·B-027. 429·후속=020 결정요청. 총괄 완료 보고 021)
# [백엔드 → Claude Code] 작업 지시: gateway - SCG 엣지 게이트웨이 스켈레톤(D-068)

대상: Spring Cloud Gateway 엣지 게이트웨이 스켈레톤(별도 배포 모듈). auth와 독립 인프라, 계약 무관.
참조: D-068·D-065, mgmt/outbox/051(착수 지시), CLAUDE.md 섹션1 토폴로지·섹션3 E2(앱 레벨 rate limit off)·섹션7 스타일,
      api-contract §2 SEC-005, docs/domain-spec.md §8, docs/backend/notes/onrace-reference.md(참고 패턴).

## 범위(포함)
- 모듈 구조: 멀티모듈 서브프로젝트 `:gateway`(settings.gradle 등록), WebFlux(reactive) 기반. 서블릿 web/JPA 제외.
  단일 서비스와 별도 빌드 산출물(별도 배포).
- 라우팅: 단일 서비스로 경로 기반 프록시.
- rate limit: Redis `RequestRateLimiter`(토큰버킷) — 인증 계열 경로(login/signup/refresh) 우선 적용.
- 직접접근 차단: gateway default filter로 하류 요청에 `X-Gateway-Token`(공유 비밀) 부착 + 서비스 측
  `GatewayAccessFilter`가 헤더 불일치 시 403(actuator·health 제외). 공유 비밀은 환경변수(${GATEWAY_INTERNAL_SECRET}).

## 하지 말 것
- 게이트웨이 JWT 검증·X-User-Id 주입(D-065 — 인증은 서비스 전담).
- WaitingRoom·대기열 게이팅(범위 밖). 다음 도메인(member/item/auction/bid 등) 착수.

## 구현 지침
- WebFlux(reactive) 스택. 시크릿 fail-fast(운영 기본값 없음, ${GATEWAY_INTERNAL_SECRET}).
- 서비스 측 `GatewayAccessFilter`는 기존 SecurityConfig 체인과 정합(actuator·health 제외, auth 필터와 순서 조정).
- CLAUDE.md §5 컨벤션 + §7 스타일: gateway 모듈도 checkstyle·spotless 적용(멀티모듈 상속). 수정 후 `./gradlew spotlessApply` 후 통과.

## DoD
- 로컬에서 라우팅·rate limit·직접접근 403 동작 확인.
- `./gradlew clean build` 그린(gateway 모듈 포함, checkstyle·spotless·test 통과).
- 완료 시 총괄 완료 보고(회신대상 mgmt/outbox/051).

## 커밋 제안
- `chore(skeleton): SCG 엣지 게이트웨이 스켈레톤(D-068) — 라우팅·rate limit·직접접근 차단`
