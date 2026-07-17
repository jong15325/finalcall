# 도시에: Spring Boot 대규모 트래픽 스켈레톤 (Stage 0~G)

> 포트폴리오(케이스 스터디·이력서 불릿·소개 페이지) 재가공용 **중간 산출물**이다. 정본이 아니라
> 코드·spec·보드·결정로그에서 큐레이션한 파생 요약이다. 모든 주장은 증거(파일·커밋·테스트)로 뒷받침한다.

- **영역/에픽**: 인프라 스켈레톤 (Stage 0 → G) + SCG 엣지 게이트웨이 + 모노레포 전환
- **상태**: 완료
- **기간(커밋 기준)**: `9af75d7`(init) ~ `f6e62cb`(stage G) ~ `82bae74`(게이트웨이) ~ `89ef8ff`(모노레포 전환, D-098)
- **관련 티켓**: 스켈레톤은 티켓 보드 도입 전 단계라 `chore(skeleton): stage N` 커밋으로 추적

## 1. 개요 (한 문단)

FinalCall(게임 아이템 경매 플랫폼)의 백엔드는 "마감 직전 입찰 폭주"라는 대규모 트래픽·동시성 상황을
견디도록 설계됐다. 그 토대로, 어떤 도메인이 얹혀도 흔들리지 않는 **재사용 가능한 프로덕션 스켈레톤**을
Java 21 + Spring Boot 3.5 기준으로 단계적으로(Stage 0→G) 구축했다. 각 단계는 좁은 범위로 격리해
누적적으로 쌓았고(응답/예외 → 로깅/추적 → 관측 → 데이터 계층 → Redis 캐시·분산락 → 회복탄력성 →
JWT 인증 → 테스트 → 관측성 인프라), 마지막에 엣지 게이트웨이(SCG)와 모노레포 구조를 더했다.
스켈레톤 단계에서는 공지사항(notice)을 참조 구현으로 만들어 이후 모든 도메인이 따를 컨벤션의 본보기로 삼았다.

## 2. 해결한 기술 도전과 해법

- **마감 직전 동시성 제어의 인프라 선점**: 경매의 핵심 난제(동시 입찰 시 이중 차감·초과 홀드)를 도메인
  구현 전에 인프라로 미리 해결했다 → (1) Redisson 분산락 어노테이션 `@DistributedLock`(SpEL 동적 키,
  wait/lease 타임아웃, 데드락 방지)을 도입하고, (2) 락을 **트랜잭션보다 바깥**에 두는 순서를 Aspect
  우선순위(`@Order(HIGHEST_PRECEDENCE)`)로 강제했다 → 커밋 전 다음 스레드 진입으로 정합성이 깨지는
  전형적 함정을 구조적으로 차단(`DistributedLockAspect.java`).

- **AOP self-invocation 함정의 사전 방지**: `@Cacheable`·`@DistributedLock`·`@CircuitBreaker`·`@Retry`·
  `@ServiceLog`는 모두 프록시 기반이라 같은 클래스 내부 호출에는 적용되지 않는다 → 어노테이션 Javadoc과
  CLAUDE.md 섹션 4에 명문화해 전 도메인 공통 함정으로 상시 경계(`DistributedLock.java` 주석).

- **엣지 트래픽 방어를 서비스 밖으로 분리**: auth 무차별 대입/열거 시도(SEC-005)를 앱이 아니라 엣지에서
  막기 위해 SCG 게이트웨이를 별도 배포로 두었다 → Redis 토큰버킷(`RequestRateLimiter`, IP 키)으로 인증
  경로 rate limit + 공유비밀(`X-Gateway-Token`) 부착으로 직접접근 차단 → 앱 레벨 rate limit은 off로 두어
  관심사를 분리(`RateLimitConfig.java`, `InternalTokenGlobalFilter.java`, `GatewayAccessFilter.java`).

- **위조 헤더 유입 차단**: 게이트웨이가 하류에 붙이는 `X-Gateway-Token`을 `add`가 아니라 `set`으로
  덮어써, 클라이언트가 같은 헤더를 위조해 보내도 뒤단으로 새지 않도록 처리(`InternalTokenGlobalFilter`).

- **관측성 표준화**: W3C 트레이스 전파 + `X-Request-Id` MDC + 구조화(JSON) 로깅 + Actuator/Prometheus
  메트릭 + Grafana/Loki/Alloy 스택을 갖춰, 앱은 호스트에서 실행하고 관측 스택이 파일 로그를 tail하는
  방식으로 무거운 스택을 필요 시에만 기동하도록 분리(`docker-compose.observability.yml`).

## 3. 핵심 결정과 근거 (트레이드오프)

- **의존 방향 단방향 강제**: `api → domain → infra → common` 역방향 금지를 ArchUnit 테스트로 기계 강제
  (`LayerDependencyTest.java`). 관례가 아니라 빌드 실패로 막아 아키텍처 부패를 원천 차단. (근거: CLAUDE.md 섹션 4)

- **스키마는 Flyway 단일 관리, JPA는 전 프로파일 `validate`**: 로컬조차 `ddl-auto=validate`로 두어 엔티티가
  스키마를 몰래 바꾸지 못하게 했다. 편의(자동 DDL)를 포기하고 스키마 이력의 단일 진실원(V1~V4 마이그레이션)을
  택함(`db/migration/V*.sql`). (근거: CLAUDE.md 섹션 3 `JPA_DDL_AUTO_LOCAL=validate`)

- **인증은 서비스가 유지, 게이트웨이는 인증 전담 아님(D-065·D-068)**: 게이트웨이에 인증을 넘기지 않고
  JWT 자체검증을 서비스에 두었다. `X-User-Id` 헤더 주입 방식을 배제하고 SecurityContext를 정본으로 삼아,
  향후 MSA 확장 시에도 계약(인증 위치)이 흔들리지 않게 함. 게이트웨이는 rate limit·직접접근 차단·라우팅만.

- **시크릿 fail-fast**: 로컬은 `${ENV:기본값}`, 운영은 기본값 없는 `${ENV}`로 두어 누락 시 부팅 실패.
  HS256 secret은 256비트 미만이면 시작 시 예외(`HmacTokenProvider` — 약한 키 방지). 편의보다 안전 우선.

- **회복탄력성은 앱 레벨 rate limit off + Circuit Breaker/Retry on**: rate limit은 게이트웨이가 담당하므로
  중복을 피해 앱에서 끄고(`INCLUDE_RATE_LIMITER=false`), 하류 장애 격리(CB)·일시 실패 재시도(Retry)만 앱에 둠.

- **스타일 층 기계 강제**: Naver 핵데이 컨벤션 기반 checkstyle + spotless를 `build`에 연결(maxWarnings 0).
  스타일 논쟁을 코드리뷰에서 제거하고 빌드가 강제(config/checkstyle). (근거: CLAUDE.md 섹션 7)

## 4. 아키텍처

```
[클라이언트]
   │  /api/v1/**
   ▼
[SCG 엣지 게이트웨이 :8000]  (별도 배포, WebFlux)
   · auth 경로 Redis 토큰버킷 rate limit (IP 키)
   · X-Gateway-Token 공유비밀 set (직접접근 차단)
   · 경로 기반 라우팅
   ▼  (X-Gateway-Token 부착)
[모놀리식 서비스 :8080]
   GatewayAccessFilter(공유비밀 검증 403) → JwtAuthenticationFilter(자체검증, SecurityContext)
   └ api → domain → infra → common  (ArchUnit 단방향 강제)
        · common: 응답(ApiResponse)/예외(GlobalExceptionHandler)/로깅(@ServiceLog)/락(@DistributedLock)
        · infra:  Redis(Redisson 락·Lettuce 캐시), JWT(HmacTokenProvider), Flyway, Security
   ▼
[MySQL 8.0]  [Redis 7]
   ▲
[관측성 스택(별도 기동): Prometheus 9090 · Grafana 3000 · Loki 3100 · Alloy]
```

모노레포(D-098): `finalcall/{backend/{src,gateway}, frontend, config, docs}`.

## 5. 증거

- **핵심 파일**:
  - `backend/src/main/java/com/finalcall/common/lock/DistributedLock.java` — 분산락 어노테이션(SpEL 키·타임아웃)
  - `backend/src/main/java/com/finalcall/infra/redis/DistributedLockAspect.java` — 락-트랜잭션 순서 강제 Aspect
  - `backend/src/main/java/com/finalcall/common/response/ApiResponse.java` — 공통 성공 응답 envelope
  - `backend/src/main/java/com/finalcall/common/exception/GlobalExceptionHandler.java` — 전역 예외 처리
  - `backend/src/main/java/com/finalcall/infra/security/HmacTokenProvider.java` — HS256 JWT(약한 키 fail-fast)
  - `backend/gateway/src/main/java/com/finalcall/gateway/ratelimit/RateLimitConfig.java` — IP 키 토큰버킷
  - `backend/gateway/src/main/java/com/finalcall/gateway/filter/InternalTokenGlobalFilter.java` — 공유비밀 set
  - `backend/src/main/java/com/finalcall/infra/security/GatewayAccessFilter.java` — 직접접근 403 차단
  - `backend/docker-compose.observability.yml` — Prometheus/Grafana/Loki/Alloy 스택
- **참조 구현(컨벤션 본보기)**: `domain/notice/*` — Entity/Repository(Custom+Impl QueryDSL)/Service/Controller/DTO/ErrorCode 전형
- **테스트**:
  - `backend/src/test/java/com/finalcall/architecture/LayerDependencyTest.java` — 계층 의존 단방향 검증(ArchUnit)
  - `backend/src/test/java/com/finalcall/integration/CacheIntegrationTest.java` — Redis 캐시(Testcontainers)
  - `backend/gateway/src/test/java/com/finalcall/gateway/ratelimit/RateLimit429IntegrationTest.java` — rate limit 429
  - `backend/src/test/java/com/finalcall/integration/GatewayAccessIntegrationTest.java` — 직접접근 차단
- **커밋**:
  - `9af75d7` init commit
  - `788f0ad` chore(skeleton): stage 1~2 — 레이어 구조·의존 규율 + 프로파일·설정·로컬 인프라
  - `564b854` chore(skeleton): stage 3~4 — 공통 응답/예외 + 로깅/분산추적
  - `25693e4` chore(skeleton): stage 5~E1 — Actuator/메트릭 + 데이터 계층 + Redis 캐시/분산락
  - `fdf2189` chore(skeleton): stage E2 — 회복탄력성(Resilience4j CircuitBreaker + Retry)
  - `4a3a9b4` chore(skeleton): stage F1 — JWT 인증 뼈대(Security)
  - `05ada26` chore(skeleton): stage F2 — 테스트 전략(Testcontainers)
  - `f6e62cb` chore(skeleton): stage G — 관측성 인프라(Prometheus/Grafana/Loki/Alloy)
  - `82bae74` chore(skeleton): SCG 엣지 게이트웨이 스켈레톤(D-068) — 라우팅·rate limit·직접접근 차단
  - `89ef8ff` / `68f74be` refactor(mono): 모노레포 전환 — backend/ + frontend/ (D-098)
- **참고 자료**: `docs/backend/references/spring-skeleton-prompts.md`(단계별 실행 지시·완료 기준, 실행 지시가 아니라 참고 자료)
