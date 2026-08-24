# 도시에: Spring Boot 대규모 트래픽 기반(Stage 0~G)

- **영역**: 백엔드·게이트웨이 기반
- **상태**: 완료
- **기간**: `9af75d7` ~ `f6e62cb` ~ `82bae74` ~ `89ef8ff`

## 1. 개요

FinalCall은 Java 21·Spring Boot 3.5 단일 서비스와 별도 Spring Cloud Gateway를 토대로 시작했다. 공통 응답,
예외, 추적, Flyway, Redis, JWT, Testcontainers, Prometheus/Grafana/Loki를 단계적으로 쌓고 notice를 참조
구현으로 제공했다. 이후 EPIC-RESTRUCTURE에서 업무 코드를 `com.finalcall.domain.<feature>.<layer>`로
재배치했다. 초기 layer-first 설명은 역사이며 현재 구조는 feature-first다.

## 2. 해결한 기술 도전과 해법

- **스키마 드리프트**: 모든 프로파일에서 JPA `validate`, 변경은 Flyway로 관리한다.
- **직접 접근과 인증 경계**: SCG가 Redis 토큰버킷·라우팅·`X-Gateway-Token` 덮어쓰기를 담당하고 서비스가
  공유비밀과 JWT를 검증해 SecurityContext를 만든다.
- **관측성**: W3C trace, request ID MDC, JSON 로그, Actuator/Prometheus와 Grafana/Loki/Alloy를 구성했다.
- **아키텍처 부패**: `SliceArchitectureTest`·`ConventionArchitectureTest`가 feature 내부 계층방향,
  커널 무의존, 순환과 DTO/ErrorCode/Properties 위치를 강제한다.

## 3. 핵심 결정과 근거

- **분산락 자산과 정확성 분리**: Redisson `@DistributedLock`은 Stage E1 데모로 유지한다. watchdog 없는 고정
  lease와 Redis 장애 전파 때문에 입찰 정확성 수단으로는 쓰지 않고 auction 행 락과 DB CAS를 사용했다.
- **모놀리스+별도 엣지**: 인증까지 게이트웨이에 넘기지 않아 서비스 SecurityContext를 정본으로 유지했다.
- **스타일·구조 기계 강제**: Spotless/Checkstyle/ArchUnit 비용을 감수하고 리뷰를 비즈니스 규칙에 집중했다.

## 4. 아키텍처

```text
Client → SCG(:8000, rate limit·route·gateway token)
       → Service(:8080, gateway 검증·JWT·SecurityContext)
          ├─ com.finalcall.domain.<feature>.<layer>
          ├─ com.finalcall.common
          └─ com.finalcall.infra
       → MySQL 8 / Redis 7
관측: Actuator → Prometheus → Grafana, log → Alloy → Loki
```

## 5. 증거

- `backend/gateway/**`, `backend/src/main/java/com/finalcall/infra/security/**` — 엣지·서비스 인증 경계.
- `backend/src/main/resources/db/migration/**` — Flyway 이력.
- `backend/src/test/java/com/finalcall/architecture/SliceArchitectureTest.java`, `ConventionArchitectureTest.java`.
- `docs/common/proposals/layer-restructure-proposal-v0.1.md` — 내용은 v0.4 DECIDED.
- 커밋: `25693e4`, `4a3a9b4`, `05ada26`, `f6e62cb`, `82bae74`, `dccf200c`, `e8f31e9c`.
