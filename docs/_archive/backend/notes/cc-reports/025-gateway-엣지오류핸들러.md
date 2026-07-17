# [Claude Code → 백엔드] 완료 보고: gateway - 엣지 오류 envelope 핸들러

작업 지시: `docs/backend/outbox/025-gateway-엣지오류핸들러.md` (계약 v1.3 [1.6], 현행 v1.4)
회신 필요 여부: **회신 불요**(정보 공유 + 이슈 2건 흡수 요망)

## 결과 요약

엣지 오류(429·403)를 계약 [1.6] envelope로 통일했다. 델타 3건 전부 처리:

- **델타 1 (429, gateway/WebFlux)**: SCG `RequestRateLimiter`의 본문 없는 429에 `{success,code,message,timestamp}` 4필드 envelope 본문과 `Retry-After` 헤더를 주입하는 전역 필터 신설. 서비스 `ErrorResponse` 미의존, 게이트웨이 자체 동형 DTO 사용(B-026 독립 2앱).
- **델타 2 (403, service/서블릿)**: `GatewayAccessFilter`의 직접접근 차단 코드를 `COMMON_006` → `GATEWAY_403`으로 정정. `ErrorCode` 구현 신규 enum `GatewayErrorCode` 신설, `ErrorResponse.of(ErrorCode)` 기존 팩토리 그대로 사용(envelope 포맷·`ErrorResponse`·`CommonErrorCode`·도메인 enum 무변경).
- **델타 3 (429 동적 테스트)**: 버스트 초과로 실제 429를 유발하는 Testcontainers(Redis) 통합테스트 신설. 상태 429 + envelope 4필드 + `errors` 부재 + `Retry-After` 존재 + 필드 순서까지 검증.

**QA RETEST-1·2 트리거**: 본 델타로 QA-S-GW-02(429 envelope+Retry-After)·QA-S-GW-04(403 code=GATEWAY_403, errors 미포함) 재검증(RETEST-1·2)을 트리거한다. (067 총괄 지정 의무 명시)

## 산출물 (경로)

### gateway 모듈 (WebFlux)
- 추가(A): `gateway/src/main/java/com/finalcall/gateway/response/GatewayErrorResponse.java`
  — 계약 [1.6] 동형 envelope record(필드명·순서·타입 일치: success→code→message→timestamp, Instant=ISO-8601 UTC).
- 추가(A): `gateway/src/main/java/com/finalcall/gateway/filter/RateLimitResponseGlobalFilter.java`
  — 응답 데코레이트 `GlobalFilter`. `ServerHttpResponseDecorator.setComplete()`를 가로채 429일 때만 본문·`Retry-After` 주입. 순서 `HIGHEST_PRECEDENCE`(rate limiter 바깥). Spring 관리 `ObjectMapper` 주입으로 Instant ISO-8601 직렬화.
- 추가(A): `gateway/src/test/java/com/finalcall/gateway/ratelimit/RateLimit429IntegrationTest.java`
  — Testcontainers Redis + `@SpringBootTest(RANDOM_PORT)` + WebTestClient. 버스트 초과 → 429 유발 → envelope 4필드·errors 부재·Retry-After·필드순서 검증.
- 변경(M): `gateway/build.gradle` — test 의존성에 `spring-boot-testcontainers`, `testcontainers:junit-jupiter` 추가(버전 BOM 관리).

### service 모듈 (서블릿)
- 추가(A): `src/main/java/com/finalcall/infra/security/GatewayErrorCode.java`
  — `ErrorCode` 구현 enum. `DIRECT_ACCESS_BLOCKED("GATEWAY_403", FORBIDDEN, ...)`.
- 변경(M): `src/main/java/com/finalcall/infra/security/GatewayAccessFilter.java`
  — `writeForbidden()`이 `GatewayErrorCode.DIRECT_ACCESS_BLOCKED` 반환(import `CommonErrorCode` 제거). javadoc 갱신.
- 변경(M): `src/test/java/com/finalcall/integration/GatewayAccessIntegrationTest.java`
  — 기대 코드 `COMMON_006` → `GATEWAY_403`. `errors` 미포함 검증 1줄 추가, DisplayName 갱신.

## DoD 대비 충족

- **계약 [1.6] + QA 기대치**: 429/403 응답 본문이 정확히 4필드(success·code·message·timestamp), `errors` 미포함. 429는 `Retry-After` 동반. 403 code 정확히 `GATEWAY_403`. actuator·`/error` 차단 제외(현행 `shouldNotFilter` 유지, 무변경). ✅
- **빌드**: `./gradlew build`(두 모듈) **BUILD SUCCESSFUL**. checkstyle·spotlessCheck 통과(maxWarnings 0). ✅
  - service `GatewayAccessIntegrationTest`: tests=4, failures=0(GATEWAY_403 반영 확인).
  - gateway `RateLimit429IntegrationTest`: tests=1, failures=0, skipped=0(실제 429 트리거·실행 확인).
- **429 동적 테스트 포함**: ✅ (Testcontainers Redis)
- 커밋 전 `./gradlew :gateway:spotlessApply`·root `spotlessApply` 실행 후 checkstyle 통과 확인. ✅

### 검증 방식 주기(투명성)
- `clean build`는 로컬 환경 문제로 완주 불가였다: ① QueryDSL 생성물 clean-vs-compile 레이스(기존 알려진 현상, 내 변경 무관), ② `build/` 디렉터리를 점유한 잔여 java 프로세스(6:13 기동분, 추정 IDE/기동 서비스)로 인해 `clean`이 `test-results` 삭제 실패. 대신 **증분 `build`(두 모듈)**로 compile + 전 테스트 + checkstyle + spotlessCheck를 완주해 그린 확인했다(clean 없이도 QueryDSL은 재생성됨). 클린 재현이 필요하면 잔여 프로세스 종료 후 재실행 권장.

## 이슈 (백엔드 흡수 요망)

1. **Retry-After 값 결합도** — `Retry-After: 1`을 상수로 두고, 라우트 `replenishRate=5`(초당 5토큰 → 다음 토큰까지 ceil(1/5)=1초, HTTP 정수 초 최소 단위) 기준임을 주석에 명시했다. 정책값(replenishRate)은 손대지 않았다(범위 제한 준수). **replenishRate를 1/s 미만으로 낮추면 이 값이 계약과 어긋난다** — 향후 정책 조정 시 이 상수 재검토가 필요하다. 정책·헤더값을 한 곳에서 파생시키려면 `@ConfigurationProperties`화가 필요한데, 이는 "정책값 변경 금지·common 신설 금지" 범위와 맞닿아 임의 판단하지 않고 이슈로 올린다.
2. **429 필터 구현 방식 근거** — 지시의 힌트대로 `GlobalFilter`(응답 데코레이트)를 채택했다. `RequestRateLimiter`가 예외가 아니라 `response.setComplete()`로 상태만 세팅·마감하므로 `ErrorWebExceptionHandler`로는 못 잡는다. 데코레이터에서 `setComplete()`를 오버라이드해 429일 때만 본문/헤더를 주입하는 것이 SCG 정석 패턴이라 그대로 따랐다(다른 접근 대비 우위 확인). 별도 판단 이슈는 아니며 근거 기록 목적.

## 다음 단계 제안

- QA에 RETEST-1·2(QA-S-GW-02·04) 재검증 요청 전달.
- (선택) Retry-After 정책 결합도(이슈 1) 처리 방향 확정 — 상수 유지 vs 설정 파생. 백엔드 판단.
- 범위 밖 유지: rate limit 정책값·라우팅·공유 common 모듈 신설·member 도메인(023·024 별개).

## 신규 발번 ID

- 없음(신규 결정·계약 변경 없음. 계약 [1.6]·[5] 기존 명세 이행만 수행). 발번 필요 항목 발견 시 위 "이슈"로 회부.

## 커밋 메시지 제안 (실행은 사용자 — 2커밋 분리)

지시서(025) 말미의 2커밋 제안을 그대로 따른다. 실제 수정 파일과 대조해 아래로 확정한다.

```
feat(gateway): 엣지 429 응답에 GATEWAY_429 envelope·Retry-After 추가

목적
- 엣지 rate limit 오류를 계약 v1.4 [1.6] envelope 로 통일(클라이언트 단일 포맷).

세부 내용 (영역별)
- gateway: 429 응답 데코레이트 GlobalFilter — envelope 본문 + Retry-After 주입(HIGHEST_PRECEDENCE)
- gateway: 동형 envelope DTO(서비스 ErrorResponse 미의존, B-026 독립 2앱)
- test: 버스트 초과 429 트리거 동적 테스트(Testcontainers Redis)

수정 파일
  추가(A): gateway .../response/GatewayErrorResponse.java, gateway .../filter/RateLimitResponseGlobalFilter.java,
           gateway test .../ratelimit/RateLimit429IntegrationTest.java
  변경(M): gateway/build.gradle (testcontainers 의존성)

검증
- ./gradlew build 그린. 429 본문 4필드·errors 부재·Retry-After·필드순서 확인(동적 테스트).

범위 밖(다음 단계)
- rate limit 정책값·라우팅(무변경), 관측성 게이트웨이 타깃(Stage G 확장)
```

```
fix(gateway): 직접접근 차단 403 코드를 COMMON_006 에서 GATEWAY_403 으로 정정

목적
- 계약 v1.4 [1.6] 이 직접접근 차단을 GATEWAY_403 으로 명세 — 서비스측 필터 응답을 계약에 정합시킨다.

세부 내용 (영역별)
- infra/security: GatewayErrorCode(ErrorCode 구현) 신설, GatewayAccessFilter 가 GATEWAY_403 반환
- test: GatewayAccessIntegrationTest 기대 코드 갱신(COMMON_006 → GATEWAY_403) + errors 미포함 검증

수정 파일
  변경(M): src/main/java/com/finalcall/infra/security/GatewayAccessFilter.java,
           src/test/java/com/finalcall/integration/GatewayAccessIntegrationTest.java
  추가(A): src/main/java/com/finalcall/infra/security/GatewayErrorCode.java

검증
- ./gradlew build 그린. CommonErrorCode·도메인 ErrorCode·ErrorResponse 무변경.

범위 밖(다음 단계)
- 없음
```
