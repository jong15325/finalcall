<!-- 구조 주의: 패키지 구조는 EPIC-RESTRUCTURE(2026-07-25)로 feature-first(com.finalcall.<feature>.<layer>)로 전환됨. 이 문서는 스켈레톤 구축 당시(layer-first: api/domain/infra/common) 기록이며 그 계층 서술은 역사적 참고다. 현행 규약 = CLAUDE.md 섹션 1·3·4·5 + docs/common/proposals/layer-restructure-proposal-v0.1.md(내용 v0.2). -->

# Spring Boot 대규모 트래픽 스켈레톤 — 재사용 프롬프트 세트

Java 21 + Spring Boot 3.5 기반 신규 서비스 스켈레톤을 Claude Code로 단계적으로 구성하기 위한 프롬프트 모음입니다.
각 단계는 좁은 범위로 격리되어 있으며, 순서대로 실행하면 스켈레톤이 누적적으로 쌓입니다.

---

## 0. Claude Code 사용 계획

### 파일 구성 (2개)

- **`CLAUDE.md`** (프로젝트 루트) — 공유 변수 + 전역 원칙 + Claude Code 행동 규약.
  Claude Code가 세션 내내 자동 참조한다. **새 프로젝트는 이 파일의 변수 값만 채우면 된다.**
- **`docs/backend/references/spring-skeleton-prompts.md`** (이 문서) — 단계별 "무엇을 만들지" 실행 지시.
  변수는 정의하지 않고 CLAUDE.md 를 참조한다. 프로젝트와 무관하게 재사용된다.

### 실행 원칙

1. **하나의 Claude Code 세션에서 순서대로 진행한다.**
   `0 → 1 → 2 → 3 → 4 → 5 → D → E1 → E2 → F1 → F2 → G` 순서는 의존 관계다. 뒤 단계가 앞 산출물 위에 얹힌다.

2. **변수는 CLAUDE.md 에 모여 있다.**
   `PROJECT_NAME`, `GROUP`, `ARTIFACT` 등을 프로젝트 시작 시 CLAUDE.md 에서 한 번만 확정한다.
   각 단계 프롬프트는 CLAUDE.md 의 변수를 참조한다.

3. **각 단계 종료 시 반드시 검증 후 다음으로 넘어간다.**
   - 애플리케이션 부팅 확인
   - 해당 단계 "완료 기준" 충족 확인
   - `./gradlew test` (ArchUnit 포함) 통과 확인

4. **커밋은 사용자가 직접 한다.**
   Claude Code 는 commit/push 하지 않는다(CLAUDE.md 행동 규약). 단계마다 사용자가 커밋해
   체크포인트를 남기면 문제 시 직전 단계로 롤백할 수 있다.
   ```
   git commit -m "skeleton: stage 3 - response & exception"
   ```

5. **"이번 단계에서 하지 말 것"을 신뢰한다.**
   각 프롬프트의 범위 제한이 Claude Code가 지레짐작으로 다음 단계 코드를 만드는 것을 막는다.
   범위를 넘는 산출물이 나오면 해당 제한 항목을 다시 지목한다.

### 단계별 실행 흐름

```
[CLAUDE.md 준비: 변수 값 채우기]
        │
        ▼
[Stage 0] 프로젝트 생성 (Claude Code) ──→ 커밋
        ▼
[Stage 1] 패키지 구조 + ArchUnit ──→ 커밋
        ▼
[Stage 2] 프로파일 + docker-compose ──→ 커밋
        ▼
[Stage 3] 응답/예외 체계 ──→ 커밋
        ▼
[Stage 4] 로깅 + 트레이싱 ──→ 커밋
        ▼
[Stage 5] Actuator + Prometheus ──→ 커밋
        ▼
[Stage D] JPA + QueryDSL + Flyway ──→ 커밋 (MySQL 첫 연결)
        ▼
[Stage E1] Redis 캐시 + 분산락 ──→ 커밋 (Redis 첫 연결)
        ▼
[Stage E2] Resilience4j ──→ 커밋
        ▼
[Stage F1] JWT 인증 뼈대 ──→ 커밋
        ▼
[Stage F2] Testcontainers ──→ 커밋 (앱 완성)
        ▼
[Stage G] 관측성 인프라(Prometheus/Grafana/Loki/Alloy) ──→ 커밋 (스켈레톤 완성)
```

### 인프라 사전 조건

- **Docker**: Stage 2의 docker-compose(로컬 MySQL/Redis), Stage F2의 Testcontainers, Stage G의 관측성 스택 모두 Docker 데몬 필요.
- **Stage D부터는 로컬 인프라 기동 필요**:
  ```
  docker compose -f docker-compose.local.yml up -d
  ```
- **Stage G의 관측성 스택은 무거우므로 필요할 때만 별도 기동**:
  ```
  docker compose -f docker-compose.observability.yml up -d
  ```

---

## 1. 변수와 전역 원칙

모든 변수(`PROJECT_NAME`, `GROUP`, `ARTIFACT` 및 단계별 토글)와 전역 설계 원칙은
**`CLAUDE.md` 에 있다.** 이 문서의 각 단계는 CLAUDE.md 의 변수를 참조하며, 별도로 변수를 정의하지 않는다.

- 새 프로젝트: CLAUDE.md 섹션 3(공유 변수)의 값만 채운다.
- 전역 원칙(의존 방향, fail-fast 시크릿, `Instant` 통일, AOP self-invocation 등): CLAUDE.md 섹션 4.
- 도메인 코드 컨벤션(Entity/Repository/Service/DTO 등): CLAUDE.md 섹션 5.

각 단계 프롬프트 상단에는 그 단계에서 참조하는 변수 그룹만 표기한다.

---

## Stage 0 — 프로젝트 생성 (Claude Code 수행)

```
# 참조 변수 (CLAUDE.md): PROJECT_NAME, GROUP, ARTIFACT, JAVA_VERSION, SPRING_BOOT_VER, BUILD_DSL

# 목표
빈 작업 폴더에 Gradle 기반 Spring Boot 프로젝트 뼈대를 생성한다. 패키지 구조·의존 규율은 Stage 1에서 다룬다.
이 단계는 "프로젝트가 부팅되는 최소 뼈대"까지만 만든다.

# 생성 위치
- 현재 작업 디렉토리(리포 루트)를 프로젝트 루트로 사용한다.
- 이미 존재하는 CLAUDE.md, docs/ 는 절대 덮어쓰지 않는다.
    Initializr 산출물에 .gitignore/README.md 가 포함되면 덮어쓰지 말고 병합하거나 기존을 유지한다.

# 생성 방법 (Spring Initializr via start.spring.io)
- start.spring.io 에서 프로젝트를 받아 현재 폴더에 푼다. curl 예시:
    curl -G https://start.spring.io/starter.zip \
      -d type=gradle-project \                 # BUILD_DSL=kotlin 이면 gradle-project-kotlin
      -d language=java \
      -d javaVersion={{JAVA_VERSION}} \
      -d bootVersion=<최신 3.5.x 안정 버전> \
      -d groupId={{GROUP}} \
      -d artifactId={{ARTIFACT}} \
      -d name={{ARTIFACT}} \
      -d packageName={{BASE_PACKAGE}} \
      -d dependencies=web,lombok \
      -o starter.zip
    unzip 후 starter.zip 삭제. gradle wrapper 포함되어야 한다.
- 네트워크가 막혀 있으면 사용자에게 알리고, 대안으로 수동 생성(build.gradle/settings.gradle/wrapper/
  Application.java/디렉토리)을 제안한다. 임의로 진행하지 말 것.
- 이 단계 초기 의존성은 web, lombok 만. 나머지는 각 단계에서 추가한다.

# 생성 후 확인
- ./gradlew build 또는 ./gradlew bootRun 으로 정상 부팅 확인.
- 그룹/아티팩트/패키지가 CLAUDE.md 변수와 일치하는지 확인.
- IntelliJ 로 열 것을 전제로 하되, IDE 전용 파일(.idea 등)은 커밋 대상에서 제외되게 .gitignore 확인.

# 이번 단계에서 하지 말 것
- 패키지 구조(api/domain/infra/common) 생성 금지 — Stage 1.
- web, lombok 외 의존성 추가 금지.
- application.yml 상세 설정/프로파일 분리 금지 — Stage 2.
- 어떤 비즈니스 코드도 작성 금지.

# 완료 기준
- 현재 폴더에 Gradle + Spring Boot 프로젝트가 생성되고 정상 부팅된다.
- CLAUDE.md, docs/ 가 보존되어 있다.
- gradle wrapper(gradlew)가 동작한다.
```

---

## Stage 1 — 패키지 구조 + 의존 규율

```
# 참조 변수 (CLAUDE.md): BASE_PACKAGE, SAMPLE_FEATURE, LAYERS, COMMON_SUBPKGS, INFRA_SUBPKGS,
#                        INCLUDE_ARCHUNIT, INCLUDE_SAMPLE
# ================

# 목표
Stage 0에서 생성된 프로젝트 위에 "패키지 구조 + 의존 방향 규율"을 구성한다.
이 단계는 구조와 규율만 다룬다. "이번 단계에서 하지 말 것"을 반드시 지켜라.

# 전제 (Stage 0 완료)
- Gradle + Spring Boot 프로젝트가 생성되어 부팅된다. 그룹/아티팩트/패키지는 CLAUDE.md 변수 기준.
- 현재 의존성은 web, lombok 수준.

# 의존성 (이번 단계 추가/확인)
- spring-boot-starter-web (Stage 0에 이미 있음)
- lombok (Stage 0에 이미 있음)
- spring-boot-starter-test (없으면 추가)
- (INCLUDE_ARCHUNIT=true) com.tngtech.archunit:archunit-junit5 (test scope)
- application.yml 은 최소 설정(포트 등)만. 프로파일 분리는 다음 단계.
- MySQL/Redis/JPA/모니터링/Security 의존성은 추가하지 않는다(각 단계에서).

# 패키지 구조 (단일 모듈이지만 최상위 패키지 = 미래의 모듈 경계)
{{BASE_PACKAGE}}
  LAYERS = {{LAYERS}} 각각을 최상위 패키지로 생성:
- common : 어디에도 의존하지 않는다(미래 core). 하위: {{COMMON_SUBPKGS}}
- infra  : common 에만 의존. 하위: {{INFRA_SUBPKGS}}
- domain : common, infra 에 의존(순수 비즈니스). feature 별로 자른다. 하위: {{SAMPLE_FEATURE}}
- api    : 모든 계층에 의존(진입점). feature 별로 자른다. 하위: {{SAMPLE_FEATURE}}

# 의존 방향 규율 (가장 중요, 고정)
- 허용 방향: {{LAYERS}} 순서대로 왼→오 단방향. 역방향 절대 금지(common 이 domain 참조 불가).
- domain 은 feature 단위로 자른다(package-by-layer 아님).
- api 의 DTO 와 domain 의 Entity 를 섞지 않는다.

# [INCLUDE_SAMPLE=true] 검증용 최소 수직 슬라이스
- api.{{SAMPLE_FEATURE}}: 고정 문자열 반환 GET 엔드포인트 1개 + 응답 DTO
- domain.{{SAMPLE_FEATURE}}: 그 값을 반환하는 서비스 1개
- controller → service 흐름만 성립하면 된다(DB/Redis 없음).

# [INCLUDE_ARCHUNIT=true] ArchUnit 규칙 테스트 (필수)
LAYERS 순서에 근거해 test 코드로 강제:
1. common 은 infra/domain/api 를 의존 못 함
2. infra 는 domain/api 를 의존 못 함
3. domain 은 api 를 의존 못 함
4. 레이어 순환 참조 금지
테스트가 실제 위반을 잡아내는지 확인 후 통과 상태로 마무리.

# 이번 단계에서 하지 말 것
- 공통 응답 wrapper, ErrorCode, GlobalExceptionHandler 구현 금지(패키지만 비워둠)
- 로깅 필터/MDC 구현 금지
- MySQL/JPA/QueryDSL/Redis/Redisson 의존·설정 금지
- Actuator/Micrometer/모니터링 금지
- Security/JWT 금지

# 완료 기준
- 애플리케이션이 정상 부팅된다
- (SAMPLE) sample 엔드포인트가 응답한다
- (ARCHUNIT) ArchUnit 테스트가 통과한다
- 빈 패키지 구조가 위 트리대로 존재한다(package-info.java 로 표시 가능)
```

---

## Stage 2 — 설정·프로파일 관리

```
# 참조 변수 (CLAUDE.md): BASE_PACKAGE, PROFILES, INCLUDE_STAGING, DEFAULT_LOCAL_PROFILE, SERVER_PORT,
#                        INCLUDE_DOCKER_COMPOSE, MYSQL_VERSION, REDIS_VERSION, MYSQL_LOCAL_PORT,
#                        REDIS_LOCAL_PORT, MYSQL_LOCAL_DB
# ================

# 목표
"2단계: 설정·프로파일 관리". 프로파일 분리, 시크릿 외부화, 설정 바인딩 표준, 로컬 인프라 기동까지.

# 전제 (1단계 완료)
- {{BASE_PACKAGE}} 하위 api/domain/infra/common 존재.
- 의존성은 web/lombok/test 수준. 이번 단계에서 DB/Redis 의존 추가 금지.

# 프로파일 분리
- application.yml : 프로파일 무관 공통(server.port={{SERVER_PORT}} 등).
  spring.profiles.active 를 yml 에 하드코딩 금지. SPRING_PROFILES_ACTIVE 환경변수로만 활성화.
- {{PROFILES}} 각각 application-<profile>.yml 생성.
  (INCLUDE_STAGING=true) application-staging.yml 추가.
- application-{{DEFAULT_LOCAL_PROFILE}}.yml : 모든 값에 기본값 → 복붙 후 환경변수 없이 즉시 실행.

# 시크릿·설정 외부화 (핵심)
- 민감/환경종속 값은 yml 하드코딩 금지, ${ENV_VAR} 참조.
- 로컬: ${ENV:기본값} → 환경변수 없이도 뜬다.
- 운영(prod): ${ENV} 기본값 없음 → 누락 시 부팅 실패(fail-fast).
- 아직 DataSource/Redis 실제 연결 안 함. DB/Redis 키는 "다음 단계용 자리"로 주석과 함께 형태만 잡음.

# 설정 바인딩 표준
- @Value 산발 금지, @ConfigurationProperties + @Validated 표준.
- infra.config 에 샘플 Properties 클래스 1개(prefix "app", record 기반, @Validated + @NotBlank 등).
- @ConfigurationPropertiesScan 또는 @EnableConfigurationProperties 로 활성화.

# [INCLUDE_DOCKER_COMPOSE=true] 로컬 인프라
- 루트에 docker-compose.local.yml:
  - mysql:{{MYSQL_VERSION}} — 포트 {{MYSQL_LOCAL_PORT}}, DB {{MYSQL_LOCAL_DB}}, 로컬용 계정/비번
  - redis:{{REDIS_VERSION}} — 포트 {{REDIS_LOCAL_PORT}}
  - 데이터 볼륨, healthcheck 포함
- 이 컴포즈는 로컬 인프라 기동용. 이번 단계에서 앱이 실제 연결하지는 않는다.
- README 에 기동 명령 한 줄(docker compose -f docker-compose.local.yml up -d).

# 이번 단계에서 하지 말 것
- data-jpa/data-redis 등 DB/Redis 의존 금지
- 실제 DataSource/RedisConnectionFactory 설정·연결 금지
- 응답 wrapper/예외 핸들러/로깅 필터 금지
- Actuator/모니터링/Security 금지
- spring.profiles.active yml 하드코딩 금지

# 완료 기준
- SPRING_PROFILES_ACTIVE 없이 실행 시 {{DEFAULT_LOCAL_PROFILE}} 로 부팅.
- prod 는 필수 환경변수 누락 시 부팅 실패(하드코딩 기본값 없음).
- @ConfigurationProperties 샘플이 바인딩·검증된다.
- (DOCKER_COMPOSE) docker-compose.local.yml 로 MySQL/Redis 기동.
- 1단계 ArchUnit 통과 유지.
```

---

## Stage 3 — 공통 응답 + 예외 처리 (성공/에러 타입 분리)

```
# 참조 변수 (CLAUDE.md): INCLUDE_VALIDATION_ERRORS, TIMESTAMP_FORMAT, COMMON_CODE_PREFIX
# ================

# 목표
"3단계: 공통 응답 포맷 + 예외 처리". 성공/에러 wrapper(타입 분리), ErrorCode 체계,
BusinessException, GlobalExceptionHandler.

# 전제 (1~2단계 완료)
- common.response, common.exception 비어 있음. 여기 구현.
- 의존성: web/lombok/test. validation 위해 spring-boot-starter-validation 추가 허용.

# 1. 성공 응답 wrapper : common.response.ApiResponse<T> (성공 전용)
- 필드: boolean success(항상 true), T data, Instant timestamp
- 에러 필드(code, message, errors) 두지 않는다(ErrorResponse 의 몫).
- 정적 팩토리로만 생성: ApiResponse.success(T data), ApiResponse.success()(data null)
- 생성자 private.
- data 가 null 이어도 "data": null 로 JSON 유지(@JsonInclude 로 생략 금지).
- timestamp 는 Instant(UTC, {{TIMESTAMP_FORMAT}}).

# 2. 에러 응답 wrapper : common.response.ErrorResponse (성공과 별도 타입)
- 성공(ApiResponse)과 에러(ErrorResponse)는 독립 타입. 합치지 말 것.
- 필드: boolean success(항상 false), String code, String message,
  (옵션)List<FieldErrorDetail> errors, Instant timestamp. data 필드 없음.
- errors 에만 @JsonInclude(NON_NULL) → 없을 때 생략. 나머지는 항상 포함.
- 정적 팩토리: ErrorResponse.of(ErrorCode), ErrorResponse.of(ErrorCode, List<FieldErrorDetail>). 생성자 private.
- success, timestamp 를 공유해도 공통 부모/인터페이스로 묶지 말 것(다형성 도입 금지).

# 3. [INCLUDE_VALIDATION_ERRORS=true] common.response.FieldErrorDetail
- 필드: String field, String reason. 검증 실패 시 errors 배열로 담는다.

# 4. ErrorCode 체계 (도메인별 분산, 인터페이스 기반)
- common.exception.ErrorCode 인터페이스:
    String getCode();  // "ORDER_001"
    String getMessage();
    org.springframework.http.HttpStatus getStatus();
- common.exception.CommonErrorCode (enum, ErrorCode 구현): 도메인 무관 공통만.
    최소: INVALID_INPUT({{COMMON_CODE_PREFIX}}_001, 400), METHOD_NOT_ALLOWED(405),
          NOT_FOUND(404), INTERNAL_ERROR(..._999, 500)
- 네이밍: {DOMAIN}_{3자리}. 접두어로 도메인 식별. HTTP status 와 별개 식별자.
- 도메인별 ErrorCode 는 이번 단계에서 만들지 않는다(인터페이스만).

# 5. common.exception.BusinessException
- RuntimeException 상속. ErrorCode 를 필드로 가짐.
- 생성자: BusinessException(ErrorCode), BusinessException(ErrorCode, String customMessage).
- 우리가 의도적으로 던지는 모든 비즈니스 예외의 부모. 도메인별 예외 남발 금지.

# 6. common.exception.GlobalExceptionHandler (@RestControllerAdvice)
- 모든 핸들러 메서드는 ResponseEntity<ErrorResponse> 반환(성공 타입 ApiResponse 를 에러에 쓰지 말 것).
  1) BusinessException → ErrorCode 로 응답, status = ErrorCode.getStatus()
  2) MethodArgumentNotValidException(@Valid) → INVALID_INPUT + errors 배열
  3) 타입 불일치/파싱 등 표준 4xx → 적절한 CommonErrorCode 매핑
  4) 그 외 Exception → INTERNAL_ERROR(500).
     ★ 내부 예외 메시지/스택 응답 노출 금지. 로그에는 전체 스택, 응답엔 표준 메시지만.

# 7. common.util.Preconditions (비즈니스 검증 유틸)
- 정적 메서드 validate(boolean condition, ErrorCode errorCode):
    condition 이 false 면 throw new BusinessException(errorCode).
- 목적: `if (!condition) throw new BusinessException(...)` 보일러플레이트를 한 줄로.
    서비스 계층 비즈니스 검증에서 사용(예: Preconditions.validate(post.isOwner(userId), POST_FORBIDDEN)).
- Bean Validation(@Valid, 형식 검증)과 역할이 다르다: 이건 "비즈니스 규칙" 검증용.

# 8. 검증용 샘플(선택)
- sample 에 일부러 BusinessException 던지는 경로 1개 → 표준 에러 포맷 확인.
- Preconditions.validate 사용 예시 1개 포함.

# 이번 단계에서 하지 말 것
- 도메인별 ErrorCode/예외 구현 금지(인터페이스+CommonErrorCode 만)
- 로깅 필터/MDC/traceId 금지(단 500 로깅은 slf4j 로만)
- JPA/Redis/Actuator/Security 금지
- 응답에 스택트레이스/내부 메시지 노출 금지

# 완료 기준
- 정상 응답 {success, data, timestamp}
- BusinessException → {success=false, code, message, timestamp}
- @Valid 실패 → errors 배열 포함
- 미처리 예외 → 500 표준 에러, 내부 정보 비노출
- 1단계 ArchUnit 통과(common 이 타 레이어 미참조)
```

---

## Stage 4 — 구조화 로깅 + 분산 추적(Micrometer Tracing)

```
# 참조 변수 (CLAUDE.md): TRACE_PROPAGATION, TRACE_SAMPLING_LOCAL/DEV/PROD, INCLUDE_TRACE_EXPORT,
#                        TRACE_EXPORT_ENDPOINT, REQUEST_ID_HEADER, ACCESS_LOG_ENABLED, LOG_JSON_PROFILES,
#                        INCLUDE_SERVICE_LOG, SERVICE_LOG_SLOW_MS
# ================

# 목표
"4단계: 구조화 로깅 + 분산 추적". Micrometer Tracing 기반 traceId 전파,
프로파일별 로그 포맷(평문/JSON), 비즈니스 컨텍스트 MDC 필터, 접근 로그, 서비스 메서드 로깅(@ServiceLog).

# 전제 (1~3단계 완료)
- common.logging 비어 있음. ApiResponse/ErrorResponse/GlobalExceptionHandler 존재.
- 프로파일 local/dev/prod 존재.

# 의존성 (추가 허용)
- spring-boot-starter-actuator (트레이싱 활성화 기반)
- micrometer-tracing-bridge-otel
- (JSON 로그) logstash-logback-encoder 또는 동등 인코더
- [INCLUDE_TRACE_EXPORT=true] opentelemetry-exporter-otlp
- actuator 는 트레이싱용 최소만. 엔드포인트 노출/메트릭 상세는 5단계.

# 1. 분산 추적 — traceId 는 라이브러리가 생성/전파
- traceId/spanId 생성·MDC 주입·헤더 전파는 Micrometer Tracing 에 맡긴다. 직접 구현 금지.
- 전파 포맷: {{TRACE_PROPAGATION}} (management.tracing.propagation.type).
- 샘플링: local {{TRACE_SAMPLING_LOCAL}} / dev {{TRACE_SAMPLING_DEV}} / prod {{TRACE_SAMPLING_PROD}}
  (management.tracing.sampling.probability).
- [INCLUDE_TRACE_EXPORT=false] span export 안 함. 로그 상관관계까지만. (exporter 의존/엔드포인트 금지, 자리 주석만)
- [INCLUDE_TRACE_EXPORT=true] OTLP exporter 추가, 엔드포인트 {{TRACE_EXPORT_ENDPOINT}}.

# 2. 로그 출력 포맷 (logback-spring.xml, <springProfile> 분기)
- 평문 프로파일(LOG_JSON_PROFILES 에 없는 것, 예: local): 콘솔 패턴 + traceId/spanId 포함
  예) [%X{traceId:-}/%X{spanId:-}]
- JSON 프로파일({{LOG_JSON_PROFILES}}): JSON 한 줄. 최소 필드 timestamp, level, logger, thread,
  message, traceId, spanId, MDC 값들.
- traceId/spanId 는 Micrometer 가 MDC 에 넣어준 값을 %X{traceId} 로 참조(직접 넣지 말 것).

# 3. common.logging.MdcContextFilter (OncePerRequestFilter, 최우선순위 근처)
- 역할(traceId 생성 아님):
    a) 라이브러리가 MDC 에 넣은 traceId 를 "읽어서" 응답 헤더 {{REQUEST_ID_HEADER}} 에 실어줌.
    b) 요청 단위 비즈니스 컨텍스트 MDC 추가(httpMethod, requestUri; userId 는 인증 도입 후).
- ★ MDC 정리: 이 필터가 추가한 키만 finally 에서 제거. 라이브러리 traceId/spanId 는 건드리지 않음.
    (traceId 를 직접 MDC.put/UUID 생성 금지 — Micrometer 값과 충돌)

# 4. [ACCESS_LOG_ENABLED=true] common.logging.AccessLogFilter (별도 필터)
- MdcContextFilter 와 합치지 말고 독립 OncePerRequestFilter.
  (관심사 분리: MDC 관리 vs 접근 로그 기록)
- 요청 완료 시 method, path, status, elapsedMs 를 INFO 한 줄.
- ★ 요청/응답 바디 로깅 금지(민감정보 유출). 헤더 전체 덤프 금지.
- actuator/health 등 헬스체크성 경로 제외.

# 4-1. 필터 순서 (중요)
- MdcContextFilter 가 AccessLogFilter 보다 먼저(더 바깥) → 접근 로그에도 traceId/컨텍스트가 담김.
- 단 두 필터 모두 Micrometer 추적 필터보다는 뒤(안쪽). traceId 를 라이브러리가 먼저 넣어야 읽을 수 있음.
  → 우리 필터 order 를 HIGHEST_PRECEDENCE 로 잡지 말 것(트레이싱보다 앞서면 traceId 못 읽음).
  → HIGHEST_PRECEDENCE 보다 약간 낮은 값에서 MdcContextFilter < AccessLogFilter 순 order 부여.
- 등록은 FilterRegistrationBean 또는 @Order 중 택1로 일관되게.

# 5. [INCLUDE_SERVICE_LOG=true] @ServiceLog AOP (서비스 메서드 로깅)
- AccessLogFilter(HTTP 요청 단위)로는 못 잡는 "서비스 계층 메서드 단위" 로깅을 어노테이션으로 제공.
- common.logging 에 @ServiceLog 어노테이션 + Aspect 정의:
    속성: long slowMs (기본 {{SERVICE_LOG_SLOW_MS}}) — 이 시간 초과 시 WARN 으로 느린 메서드 경고.
    동작: 메서드 진입/종료 시각 측정, 소요시간 로깅. slowMs 초과 시 WARN, 그 외 DEBUG/INFO.
    traceId 는 이미 MDC 에 있으므로 로그에 자동 포함(별도 처리 불필요).
- ★ HTTP 진입 로그는 AccessLogFilter 가 담당하므로, 컨트롤러용 @ApiLog 같은 어노테이션은 만들지 않는다
    (필터와 중복 로깅 방지). @ServiceLog 는 서비스 계층 전용.
- ★ self-invocation 주의: AOP 프록시 기반이라 같은 클래스 내부 호출엔 적용 안 됨. 외부 빈 통해 호출.
- 이번 단계에서는 어노테이션과 Aspect 만 제공. 실제 부착 대상(도메인 서비스)은 D단계 게시판 예시에서 시연.

# 이번 단계에서 하지 말 것
- traceId/spanId 직접 생성·전파 금지(Micrometer 담당)
- 요청/응답 바디 로깅 금지, 헤더 전체 덤프 금지
- 컨트롤러용 @ApiLog 어노테이션 생성 금지(AccessLogFilter 와 중복)
- actuator 엔드포인트 노출/커스텀 메트릭/Prometheus 금지(5단계)
- Loki/Grafana 연동 금지(JSON 로그 생성까지가 범위, 수집은 G단계)
- Security 금지(userId MDC 는 자리 주석만)

# 완료 기준
- 요청 로그에 traceId/spanId 가 찍힌다(평문 프로파일로 확인).
- 같은 요청 내 여러 로그가 동일 traceId 공유.
- 응답 헤더 {{REQUEST_ID_HEADER}} 에 traceId.
- JSON 프로파일에서 JSON 한 줄 출력 + traceId 필드.
- 스레드풀 재사용 시 MDC 값이 다음 요청에 새지 않음.
- 접근 로그가 바디 없이 method/path/status/elapsed 로 남음.
- (SERVICE_LOG) @ServiceLog 어노테이션과 Aspect 가 준비되고, slowMs 초과 시 WARN 로깅된다.
- 1~3단계 산출물 정상 동작.
```

---

## Stage 5 — Actuator + Prometheus 메트릭

```
# 참조 변수 (CLAUDE.md): APP_NAME, EXPOSED_ENDPOINTS, SEPARATE_MGMT_PORT_PROD, MGMT_PORT,
#                        HEALTH_SHOW_DETAILS, INCLUDE_CUSTOM_METRIC_DEMO
# ================

# 목표
"5단계: Actuator 노출 + Prometheus 메트릭". 엔드포인트 화이트리스트, management 포트 분리(prod),
공통 메트릭 태그, 커스텀 비즈니스 메트릭 규약.

# 전제 (1~4단계 완료)
- actuator, micrometer-tracing-bridge-otel 이미 추가됨.
- spring.application.name 을 {{APP_NAME}} 로 확정.
- 4단계 AccessLogFilter 가 actuator/health 노이즈 제외 중.

# 의존성 (추가 허용)
- micrometer-registry-prometheus. 그 외 금지.

# 1. Actuator 노출 (화이트리스트)
- management.endpoints.web.exposure.include = {{EXPOSED_ENDPOINTS}} 로만 제한.
- exclude 나 '*' 금지. env/beans/heapdump/mappings/threaddump 절대 비노출.

# 2. Management 포트 분리 (프로파일별)
- [SEPARATE_MGMT_PORT_PROD=true]
    prod: management.server.port = {{MGMT_PORT}} 로 분리.
    local/dev: 앱 포트와 동일(설정 안 함).
- ★ 경고 주석 필수(prod 설정 옆):
    "management 포트는 반드시 내부망에서만 접근 가능하도록 인프라(방화벽/보안그룹/NetworkPolicy)에서
     차단해야 한다. 외부 노출 시 메트릭·헬스 상세가 유출된다."

# 3. Health 상세 노출
- management.endpoint.health.show-details = {{HEALTH_SHOW_DETAILS}}
- ★ 경고 주석 필수:
    "show-details=always 는 management 포트가 내부망 격리됐다는 전제다.
     외부에 노출하는 구성이라면 반드시 never 로 바꿔라."
- health group(liveness/readiness) 은 배포 단계 관심사. 자리 주석만.

# 4. 공통 메트릭 태그
- management.metrics.tags.application = ${spring.application.name}
- ★ 고카디널리티 경고 주석 필수:
    "userId, path variable(/orders/{id} 의 id), 요청 UUID 등 고유값을 태그로 쓰지 말 것.
     시계열 카디널리티가 폭발해 Prometheus 성능/저장에 장애를 유발한다."

# 5. [INCLUDE_CUSTOM_METRIC_DEMO=true] 커스텀 메트릭 데모
- MeterRegistry 직접 주입 방식(@Timed 어노테이션 금지).
    이유: @Timed 는 AOP 프록시라 self-invocation 에서 동작하지 않는 함정.
- sample 에 Counter 1개(호출 수 누적), Timer 1개(처리 소요시간).
- 저카디널리티 태그만(예: result=success|fail). 규약 데모임을 주석.

# 6. 4단계 접근 로그 연계 확인
- management 포트 분리 시 actuator 경로가 별도 포트로 이동 → AccessLogFilter 제외 로직 동작 확인.

# 이번 단계에서 하지 말 것
- '*' 전체 노출, env/beans/heapdump 노출 금지
- Prometheus scrape config/Grafana 대시보드/Loki 연동 금지(앱은 /actuator/prometheus 노출까지)
- @Timed 방식 금지, 고카디널리티 태그 금지
- Security 금지(health show-details 는 네트워크 격리 전제 주석 명확화)

# 완료 기준
- /actuator/health, /actuator/prometheus, /actuator/info 만 접근, 나머지 차단.
- /actuator/prometheus 가 Prometheus 텍스트 포맷 반환.
- 모든 메트릭에 application={{APP_NAME}} 태그.
- (prod) management 포트 {{MGMT_PORT}} 분리 + 격리 전제 경고 주석.
- (데모) 커스텀 Counter/Timer 가 /actuator/prometheus 에 노출.
- 1~4단계 산출물 정상 동작.
```

---

## Stage D — 데이터 계층 (JPA + QueryDSL + Flyway + Auditing)

```
# 참조 변수 (CLAUDE.md): BASE_PACKAGE, APP_NAME, MYSQL_LOCAL_PORT, MYSQL_LOCAL_DB, QUERYDSL_VERSION,
#                        AUDIT_TIME_TYPE, BASE_ENTITY_PACKAGE, JPA_DDL_AUTO_LOCAL, INCLUDE_FLYWAY,
#                        FLYWAY_LOCATION, INCLUDE_POST_EXAMPLE, POST_FEATURE
# ================

# 목표
"D단계: 데이터 계층(JPA + QueryDSL + Flyway + Auditing) + 도메인 컨벤션 참조 구현".
2단계에서 자리만 잡은 MySQL 연결 활성화, QueryDSL 빌드 설정, Flyway 마이그레이션, JPA Auditing(시각만).
그리고 지금까지 정한 모든 코드 컨벤션을 관통하는 게시판(post) CRUD 를 참조 구현으로 추가한다.
HikariCP 는 기본값 + 튜닝 주석까지만.

# 게시판(post)의 성격 (중요)
- 게시판은 "실기능"이 아니라 "참조 구현(reference implementation)"이다.
  팀원이 새 도메인을 만들 때 복사·참고하는 본보기. 지금까지 정한 컨벤션을 한 도메인에 모두 담는다.
- 단일 엔티티 CRUD 로 최소화. 댓글/좋아요/첨부 등 확장 기능 금지(컨벤션 시연이 목적).
- 이 단계까지 쓰던 무의미한 sample feature 는 게시판(post)으로 대체·통일해도 되고,
  초기 검증용으로 남겨도 무방(판단은 자유). 도메인 컨벤션의 기준은 post 로 삼는다.

# 전제 (1~5단계 완료)
- 2단계 프로파일 local/dev/prod 와 DataSource "자리"(주석) 존재. 여기서 실제 값 채움.
- docker-compose.local.yml 로 MySQL(포트 {{MYSQL_LOCAL_PORT}}, DB {{MYSQL_LOCAL_DB}}) 기동 가능.
- fail-fast: 로컬 ${ENV:기본값}, 운영 ${ENV}. DB 설정에도 동일.
- common 은 프레임워크 최소 의존(ArchUnit). JPA 는 domain/infra 에.

# 의존성 (추가 허용)
- spring-boot-starter-data-jpa
- mysql-connector-j (runtime)
- QueryDSL (반드시 jakarta 분류자):
    implementation "com.querydsl:querydsl-jpa:{{QUERYDSL_VERSION}}:jakarta"
    annotationProcessor "com.querydsl:querydsl-apt:{{QUERYDSL_VERSION}}:jakarta"
    annotationProcessor "jakarta.annotation:jakarta.annotation-api"
    annotationProcessor "jakarta.persistence:jakarta.persistence-api"
    ★ javax 분류자가 딸려오지 않도록 반드시 :jakarta 명시.
- [INCLUDE_FLYWAY=true] flyway-core, flyway-mysql
    ★ flyway-mysql 누락 금지(flyway-core 만으로 MySQL 동작 안 함).

# 1. QueryDSL 빌드 설정 (실수 잦은 지점)
- Q클래스 생성 경로 명시: build/generated/querydsl. sourceSets 등록.
- ★ .gitignore 에 Q클래스 생성 경로 추가(생성물 커밋 금지).
- clean 태스크 연계(선택). JPAQueryFactory 빈 등록(infra.config).

# 2. DataSource / JPA / Flyway 설정
- 프로파일별 DataSource:
    local: ${ENV:기본값} — jdbc:mysql://localhost:{{MYSQL_LOCAL_PORT}}/{{MYSQL_LOCAL_DB}}
    dev/prod: ${ENV} 기본값 없이(fail-fast). 하드코딩 금지.
- JPA:
    ddl-auto: 전 프로파일 validate(create/update 금지. 스키마는 Flyway 관리).
    open-in-view: false + 주석("OSIV 는 커넥션을 뷰 렌더링까지 붙들어 커넥션 고갈 위험").
    show-sql 금지(logger 레벨로 제어).
- Flyway:
    전 프로파일 활성화(spring.flyway.enabled=true), locations = {{FLYWAY_LOCATION}}.
    ★ 부팅 순서: Flyway 스키마 생성 → JPA validate 검증(Spring Boot 기본 보장, 별도 설정 불필요).

# 3. HikariCP (기본값 + 튜닝 주석만, 값 박지 않음)
- spring.datasource.hikari 아래 주요 파라미터 "자리와 주석"만:
    maximum-pool-size (주석: DB 최대 커넥션·CPU·동시성 고려. 무작정 크게 금지. 추후 튜닝)
    minimum-idle / connection-timeout / max-lifetime (주석: 각 의미 한 줄. 추후 직접 튜닝)
- ★ 구체 수치 임의 설정 금지, 튜닝 대상임을 주석으로 안내.

# 4. JPA Auditing (시각만)
- @EnableJpaAuditing (infra.config).
- {{BASE_ENTITY_PACKAGE}} 에 BaseTimeEntity(추상):
    @MappedSuperclass, @EntityListeners(AuditingEntityListener.class)
    @CreatedDate {{AUDIT_TIME_TYPE}} createdAt; (updatable=false 권장)
    @LastModifiedDate {{AUDIT_TIME_TYPE}} updatedAt;
- 작성자(createdBy/modifiedBy)는 넣지 않음(F1 에서 확장). 자리 주석만.
- 시각 타입 {{AUDIT_TIME_TYPE}} 로 관측성/응답 timestamp 와 UTC 일관.

# 4-1. [INCLUDE_FLYWAY=true] 마이그레이션 규약
- src/main/resources/db/migration 디렉토리.
- 초기 스크립트 V1__init_schema.sql:
    (INCLUDE_POST_EXAMPLE=true) 게시판 엔티티 대응 CREATE TABLE(created_at, updated_at,
     is_deleted 포함 → validate 통과).
- 네이밍(주석/README): V{버전}__{설명}.sql, 언더스코어 2개가 구분자.
- ★ 핵심 원칙(README + 디렉토리 주석):
    "이미 적용된 마이그레이션은 절대 수정하지 않는다. 변경은 항상 새 버전(V2, V3...) 추가.
     적용된 스크립트를 고치면 체크섬 불일치로 부팅 실패(의도된 안전장치)."

# 5. 도메인 코드 컨벤션 (게시판이 이 규약을 모두 구현한다)
아래는 이 스켈레톤의 도메인 코드 표준이다. 게시판(post)이 이를 모두 시연한다.

  [Entity] (domain.{{POST_FEATURE}}.Post, BaseTimeEntity 상속)
  - @Entity, @Getter, @NoArgsConstructor(access = AccessLevel.PROTECTED)
  - 생성자에 @Builder 적용(클래스가 아니라 생성자). 생성자는 private.
  - ★ @Setter 금지. 상태 변경은 도메인 메서드로만: update(...), delete().
  - Soft delete: boolean isDeleted + delete() { this.isDeleted = true; }
  - Enum 필드는 @Enumerated(EnumType.STRING).

  [Repository]
  - interface PostRepository extends JpaRepository<Post, Long>, PostRepositoryCustom
  - ★ OrThrow default 메서드 패턴:
      default Post findByIdOrThrow(Long id, ErrorCode ec) {
          return findById(id).orElseThrow(() -> new BusinessException(ec));
      }
    (Optional 반환 메서드 + orElseThrow 래핑. 복합 조건도 동일 패턴 가능)
  - 커스텀 쿼리: PostRepositoryCustom 인터페이스 + PostRepositoryImpl(QueryDSL). Custom 에도 OrThrow 정의 가능.

  [Service] (@Service, @RequiredArgsConstructor)
  - ★ 클래스 레벨 @Transactional(readOnly = true) 기본, 쓰기 메서드만 @Transactional 오버라이드.
    (읽기 전용 트랜잭션의 성능 이점: flush 스킵 등)
  - (INCLUDE_SERVICE_LOG=true, 4단계) 메서드에 @ServiceLog 부착. 느린 메서드는 @ServiceLog(slowMs=...).
  - 비즈니스 검증: Preconditions.validate(condition, PostErrorCode.XXX) (3단계 유틸).
  - 예외: throw new BusinessException(PostErrorCode.XXX).

  [Controller] (@RestController, @RequiredArgsConstructor, @RequestMapping)
  - ★ 반환 타입 항상 ApiResponse<T> (3단계). 예: ApiResponse.success(service.getPost(id)).
  - 요청 검증 @Valid. Controller 에서 try-catch 금지(GlobalExceptionHandler 전역 처리).

  [DTO] (Java record)
  - ★ Response 는 record + @Builder + static from(Entity) 팩토리 필수.
  - 네이밍: <도메인><목적>Request / <도메인><목적>Response (Dto 접미사 금지).
    예: PostCreateRequest, PostUpdateRequest, PostDetailResponse, PostListResponse.
  - Request 는 검증 어노테이션(@NotBlank, @Size 등) + 한국어 메시지.
  - 복합 응답은 내부 중첩 record(@Builder) 사용.

  [Enum] (필요 시)
  - @Getter @RequiredArgsConstructor + 한국어 description 필드 패턴.

  [도메인 ErrorCode] (첫 실제 구현)
  - domain.{{POST_FEATURE}} 에 PostErrorCode enum: 3단계 ErrorCode 인터페이스를 구현.
    (3단계에서 인터페이스만 만들었던 것의 첫 도메인 구현체 — 본보기)
    예: POST_NOT_FOUND(POST_001, 404), POST_FORBIDDEN(POST_002, 403).
    네이밍은 3단계 규약({DOMAIN}_{3자리}) 유지.

# 6. [INCLUDE_POST_EXAMPLE=true] 게시판 CRUD 참조 구현
- 단일 엔티티 Post 기준 최소 CRUD 를 위 컨벤션대로 완성한다:
    a) 생성  : POST /{{POST_FEATURE}}s              (PostCreateRequest → 저장)
    b) 단건  : GET  /{{POST_FEATURE}}s/{id}          (findByIdOrThrow → PostDetailResponse)
    c) 수정  : PUT  /{{POST_FEATURE}}s/{id}          (도메인 메서드 update())
    d) 삭제  : DELETE /{{POST_FEATURE}}s/{id}        (soft delete, delete())
- ★ 목록 조회는 오프셋/커서 두 방식 모두 시연한다:
    e) 오프셋: GET /{{POST_FEATURE}}s               (Spring Pageable → Page<PostListResponse>.
              QueryDSL 에서 content 쿼리와 count 쿼리 분리. 보편적 방식.)
    f) 커서  : GET /{{POST_FEATURE}}s/cursor         (커서(마지막 id 등) 기반.
              QueryDSL where(id.lt(cursor)) + limit 패턴. 무한 스크롤/대규모 트래픽용.
              커서 응답은 다음 커서와 hasNext 를 담는 전용 응답 형태.)
- 삭제된 글(isDeleted=true)은 조회에서 제외(복합 조건 조회로 시연).
- 이 게시판이 Entity/Repository/Service/Controller/DTO/Enum/ErrorCode 컨벤션을 모두 담는 본보기임을 주석.

# 이번 단계에서 하지 말 것
- dev/prod ddl-auto create/update 금지, DB 접속정보 하드코딩 금지
- HikariCP 구체 수치 튜닝 금지(주석만)
- open-in-view=true 금지, show-sql 금지
- Redis/Redisson/캐시 금지(E), 멀티DB/읽기쓰기분리 금지
- 작성자 Auditing(AuditorAware) 금지(F1), Security 금지
    (게시판 작성자 필드는 이번 단계에서 넣지 않거나, 넣더라도 요청 파라미터로만. createdBy 자동기록은 F1)
- 게시판에 댓글/좋아요/첨부 등 확장 기능 추가 금지(컨벤션 시연 목적의 단일 엔티티 CRUD 로 한정)
- common 에 JPA 의존 금지(ArchUnit)
- 이미 적용된 마이그레이션 수정 금지, flyway-mysql 누락 금지

# 완료 기준
- docker-compose MySQL 기동 후 local 로 DB 연결·부팅.
- Flyway 가 V1 적용 후 JPA validate 통과, flyway_schema_history 기록.
- QueryDSL Q클래스 생성, JPAQueryFactory 조회 동작.
- (POST_EXAMPLE) 게시판 CRUD 가 컨벤션대로 동작: 생성/단건/수정/삭제(soft delete),
  오프셋 목록(Page), 커서 목록 모두 응답.
- 게시글 저장 시 createdAt/updatedAt 자동 기록, 수정 시 updatedAt 갱신, 삭제 글은 조회 제외.
- findByIdOrThrow 로 없는 글 조회 시 PostErrorCode.POST_NOT_FOUND → 표준 에러 응답.
- prod 는 DB 환경변수 누락 시 부팅 실패. open-in-view=false 적용.
- 1~5단계 산출물 정상(common 이 JPA 미참조로 ArchUnit 통과).
```

---

## Stage E1 — Redis 코어 (Lettuce 캐시 + Redisson 분산락)

```
# 참조 변수 (CLAUDE.md): BASE_PACKAGE, REDIS_LOCAL_PORT, CACHE_DEFAULT_TTL_SECONDS, LOCK_DEFAULT_WAIT_MS,
#                        LOCK_DEFAULT_LEASE_MS, LOCK_ANNOTATION_NAME, INCLUDE_LOCK_DEMO, INCLUDE_CACHE_DEMO
# ================

# 목표
"E1단계: Redis 코어(캐시 + 분산락)". Redis 연결 활성화, Lettuce 기반 Spring Cache(JSON 직렬화),
Redisson 기반 @{{LOCK_ANNOTATION_NAME}} 분산락(AOP).

# 전제 (1~D단계 완료)
- docker-compose Redis(포트 {{REDIS_LOCAL_PORT}}) 기동 가능. 앱은 아직 미연결.
- fail-fast: 로컬 ${ENV:기본값}, 운영 ${ENV}. Redis 설정에도 동일.
- D단계 Instant(UTC) 사용. 캐시 JSON 직렬화가 이 타입 처리 필요.
- 락과 트랜잭션 순서가 중요.

# 의존성 (추가 허용)
- spring-boot-starter-data-redis (Lettuce, 캐시/기본 연산)
- spring-boot-starter-cache
- org.redisson:redisson-spring-boot-starter (분산락 전용)
- ★ 캐시=Lettuce, 분산락=Redisson 역할 분담. Redisson 을 캐시 백엔드로 쓰지 않는다.

# 1. Redis 연결 설정
- 프로파일별: local host/port ${ENV:기본값}(localhost:{{REDIS_LOCAL_PORT}}),
  dev/prod ${ENV} 기본값 없이(fail-fast).
- Lettuce(spring.data.redis)와 Redisson(별도 config)이 같은 Redis 를 바라보되 설정은 각각.

# 2. Spring Cache (Lettuce) : infra.config.CacheConfig
- RedisCacheManager 등록.
- 직렬화: GenericJackson2JsonRedisSerializer(JDK 직렬화 절대 금지). 키는 StringRedisSerializer.
    ★ ObjectMapper 에 JavaTimeModule 등록 → Instant/LocalDateTime 직렬화(없으면 시간 필드 캐싱 시 런타임 에러).
- TTL: 전역 기본 {{CACHE_DEFAULT_TTL_SECONDS}}초(TTL 없는 캐시 금지).
    ★ 주석: "TTL 은 데모 기본값. 데이터 변경 빈도에 맞게 캐시별 조정. 캐시 이름별 TTL 구성 열어둠."
- ★ 주석: "GenericJackson2JsonRedisSerializer 는 JSON 에 클래스 타입(@class) 저장.
    클래스 이동/서비스 분리 시 역직렬화 깨짐 → 캐시 무효화 필요."

# 3. [INCLUDE_CACHE_DEMO=true] 캐시 데모
- sample 에 @Cacheable 1개, @CacheEvict 1개. 캐시 이름 명시. 규약 데모.

# 4. Redisson 분산락 : @{{LOCK_ANNOTATION_NAME}} + AOP
- 커스텀 어노테이션 정의(common 또는 infra):
    String key(SpEL), long waitMs({{LOCK_DEFAULT_WAIT_MS}}), long leaseMs({{LOCK_DEFAULT_LEASE_MS}}),
    TimeUnit(MILLISECONDS).
- Aspect 구현:
    a) SpEL 로 파라미터 기반 동적 락 키(예: "order:" + #orderId).
    b) getLock(key) → tryLock(waitMs, leaseMs) 성공 시에만 진행.
    c) 실패 시 BusinessException + 적절한 CommonErrorCode.
    d) finally 에서 isHeldByCurrentThread() 확인 후 unlock.
- ★★ 락-트랜잭션 순서(가장 중요):
    락은 트랜잭션보다 "바깥". 순서: 락 획득 → 트랜잭션 시작 → 커밋 → 종료 → 락 해제.
    락을 트랜잭션 안에서 풀면 커밋 전에 다음 스레드 진입 → 정합성 깨짐.
    → Aspect @Order 를 트랜잭션 AOP(LOWEST_PRECEDENCE)보다 먼저 실행되도록 더 높은 우선순위(작은 값)로.
- ★ 주석: "AOP 프록시 기반이라 self-invocation 에 적용 안 됨. 외부 빈 통해 호출."

# 5. [INCLUDE_LOCK_DEMO=true] 분산락 데모
- sample 에 @{{LOCK_ANNOTATION_NAME}} 데모 1개. SpEL 키 생성 예시.
- 트랜잭션과 함께 쓰는 경우 락이 트랜잭션 바깥에서 감싸는 구조 데모.

# 이번 단계에서 하지 말 것
- JDK 직렬화 금지, JavaTimeModule 누락 금지
- TTL 없는 캐시 금지
- 락을 트랜잭션 내부에서 잡는 구조 금지
- Redisson 을 Spring Cache 백엔드로 사용 금지
- Rate limiting/Circuit Breaker 금지(E2)
- pub/sub, 분산 컬렉션 등 고급 기능 금지

# 완료 기준
- docker-compose Redis 기동 후 local 로 연결·부팅.
- @Cacheable 결과가 Redis 에 JSON 저장(redis-cli 로 읽힘), Instant 필드 정상 직렬화.
- 두 번째 호출 캐시 반환, TTL 적용, @CacheEvict 무효화.
- @{{LOCK_ANNOTATION_NAME}} 메서드가 동시 호출 시 상호배제.
- 락이 트랜잭션을 감싸는 순서(락 해제가 커밋 이후).
- prod 는 Redis 환경변수 누락 시 부팅 실패.
- 1~D단계 산출물 정상(ArchUnit 포함).
```

---

## Stage E2 — 회복탄력성 (Resilience4j: CircuitBreaker + Retry)

```
# 참조 변수 (CLAUDE.md): BASE_PACKAGE, INCLUDE_RATE_LIMITER, CB_FAILURE_RATE, CB_WAIT_OPEN_SECONDS,
#                        CB_SLIDING_WINDOW_SIZE, RETRY_MAX_ATTEMPTS, RETRY_WAIT_MS, INCLUDE_RESILIENCE_DEMO
# ================

# 목표
"E2단계: 회복탄력성(Resilience4j)". 외부 의존성 호출을 안전하게 감싸는 CircuitBreaker + Retry 규약.
Rate limiting 은 게이트웨이/인프라 담당이므로 앱 레벨 기본 제외.

# 배경/설계 근거
- 앱 레벨 Rate limiting 미도입: 폭주 방어는 앱 도달 전(게이트웨이/인프라)이 효과적이고,
  스케일아웃 시 인스턴스별 카운트 문제. (Spring Cloud Gateway 등 앞단 처리 방향)
- CircuitBreaker 는 앱 레벨이 정답: "내가 호출하는 외부 의존성" 장애를 나만 안다.
  외부 API/타 서비스 지연 시 스레드 소진→장애 전파를 막는 격리 장치.

# 전제 (1~E1단계 완료)
- 3단계 BusinessException/ErrorCode 존재(fallback 활용).
- 실제 외부 호출 대상 없음 → 규약과 데모(가짜 외부 호출) 중심.

# 의존성 (추가 허용)
- io.github.resilience4j:resilience4j-spring-boot3
- spring-boot-starter-aop (있으면 재사용)
- resilience4j-micrometer(메트릭을 5단계 Prometheus 로 노출 연계)

# 1. CircuitBreaker (resilience4j.circuitbreaker)
- failure-rate-threshold: {{CB_FAILURE_RATE}}
- wait-duration-in-open-state: {{CB_WAIT_OPEN_SECONDS}}s
- sliding-window-size: {{CB_SLIDING_WINDOW_SIZE}}, sliding-window-type: COUNT_BASED
- permitted-number-of-calls-in-half-open-state: 적절값
- ★ 주석: 상태 전이(CLOSED→OPEN→HALF_OPEN).
- record-exceptions / ignore-exceptions 규약 주석
  (예: 4xx 성격 BusinessException 은 ignore, 외부 연동 실패/타임아웃은 record).

# 2. Retry (resilience4j.retry)
- max-attempts: {{RETRY_MAX_ATTEMPTS}}, wait-duration: {{RETRY_WAIT_MS}}ms
  (지수 백오프 옵션 주석 안내, 기본 고정 간격)
- retry-exceptions / ignore-exceptions 규약 주석.
- ★★ 멱등성 경고 주석(필수):
    "Retry 는 멱등성이 보장된 호출에만. 결제/주문 생성처럼 부수효과 있는 호출을 무작정 재시도하면
     중복 처리(중복 결제 등) 발생."

# 3. 조합 순서
- ★ 기본 aspect 순서 주석: Retry 가 CircuitBreaker 보다 바깥
    (재시도가 매번 CB 를 거치고, 재시도 최종 실패가 CB 통계에 반영).
    resilience4j.*.aspect-order 로 조정 가능하나 특별한 이유 없으면 기본 따름.

# 4. Fallback 규약
- @CircuitBreaker(name, fallbackMethod) 사용.
- ★ fallback 시그니처(정확히): 원본과 동일한 파라미터 목록 + 마지막에 Throwable(또는 구체 예외) 1개 추가.
    반환 타입 동일. 어기면 fallback 을 못 찾는다.
- fallback 은 기본값/캐시값/명확한 실패 응답(3단계 표준 에러) 중 하나 반환.

# 5. [INCLUDE_RESILIENCE_DEMO=true] 데모
- "가짜 외부 호출" 컴포넌트(infra 또는 sample 하위):
    a) 일정 조건으로 실패(예외)하는 메서드.
    b) @Retry + @CircuitBreaker 적용, fallback 포함.
- 실패 누적 시 회로 OPEN + fallback 응답 흐름 확인.
- ★ 규약 예시임을 주석. self-invocation 금지 경고.

# 6. [INCLUDE_RATE_LIMITER=false] 앱 레벨 Rate limiting
- 기본 off. 관련 설정/코드 넣지 않음(게이트웨이 담당).
- true 인 경우에만 resilience4j.ratelimiter + @RateLimiter 데모(분산 환경 카운트 한계 주석).

# 이번 단계에서 하지 말 것
- 앱 레벨 전역 Rate limiting 금지(기본 off)
- Bulkhead/TimeLimiter 금지(범위 밖)
- 부수효과 있는 호출에 Retry 데모 유도 금지(멱등 호출로)
- 실제 외부 시스템 연동 금지(가짜 호출로)
- Security 금지(F)

# 완료 기준
- CircuitBreaker/Retry 가 yml 규약대로 설정.
- 데모에서 연속 실패 시 회로 OPEN, fallback 표준 응답.
- Retry 가 지정 횟수 재시도 후 실패를 CB 에 전달.
- (선택) resilience4j 메트릭이 /actuator/prometheus 노출.
- INCLUDE_RATE_LIMITER=false 상태에서 rate limiter 코드 없음.
- 1~E1단계 산출물 정상(ArchUnit 포함).
```

---

## Stage F1 — 보안 (JWT 인증 뼈대)

```
# 참조 변수 (CLAUDE.md): BASE_PACKAGE, BASE_ENTITY_PACKAGE, JWT_ALGORITHM, JWT_ACCESS_EXP_MIN,
#                        AUDITOR_TYPE, INCLUDE_TOKEN_DEMO
# ================

# 목표
"F1단계: 보안(인증 뼈대)". JWT 검증 필터 체인, stateless 설정, 표준 에러 포맷 통일,
서명 방식 추상화(HS256 시작), 미뤄둔 자리(MDC userId, AuditorAware 작성자) 연결.
로그인/회원관리 등 인증 "정책"은 넣지 않는다.

# 범위 원칙 (중요)
- 인증 "메커니즘(뼈대)"만: 토큰 검증, SecurityContext 적재, 401/403 처리.
- 인증 "정책(비즈니스)" 금지: 회원가입, 비밀번호 저장/검증, 리프레시 토큰, 소셜 로그인.
- 토큰 발급은 필터 확인용 "데모"(고정 사용자)만. 실제 로그인 아님.

# 전제 (1~E2단계 완료)
- 3단계 ErrorResponse/ErrorCode → 인증/인가 실패 응답을 이 포맷으로 통일.
- 4단계 MdcContextFilter → userId MDC 적재 자리 채움.
- D단계 BaseTimeEntity(시각만), AuditorAware 자리 주석 → 여기서 작성자 연결.

# 의존성 (추가 허용)
- spring-boot-starter-security
- JWT: io.jsonwebtoken:jjwt-api, jjwt-impl(runtime), jjwt-jackson(runtime)

# 1. JWT 서명 추상화 (확장 가능 구조 — 핵심)
- TokenProvider 인터페이스(common 또는 infra):
    String generateToken(주체/클레임...);
    검증/파싱 메서드(Authentication 또는 사용자정보 반환, 무효 시 예외).
- HmacTokenProvider({{JWT_ALGORITHM}}=HS256): 대칭키(secret) 서명/검증.
    secret 은 fail-fast 주입(local ${ENV:기본값}, prod ${ENV} 기본값 없음).
    ★ secret 하드코딩 금지. HS256 최소 256비트 요구 주석.
- ★ 확장 자리: RsaTokenProvider(RS256) 미구현, 인터페이스+설정으로 갈아끼울 수 있음 주석.
    jwt.algorithm 설정으로 Provider 선택 구조 안내.
    "MSA 로 검증 주체가 늘면 RS256(공개키 검증) 전환" 주석.

# 2. Security 설정 : infra.config.SecurityConfig
- SecurityFilterChain 빈:
    - SessionCreationPolicy.STATELESS
    - csrf 비활성(무상태 REST 기준), cors 는 필요 자리만
    - 경로: 데모 발급 엔드포인트, actuator(필요 최소), 에러 경로 permitAll, 그 외 authenticated
- JwtAuthenticationFilter 를 UsernamePasswordAuthenticationFilter 앞에 등록.

# 3. JwtAuthenticationFilter (OncePerRequestFilter)
- Authorization: Bearer 추출 → TokenProvider 검증 → 유효 시 Authentication 을 SecurityContext 설정.
  무효/부재 시 컨텍스트 비우고 체인 계속(막는 것은 EntryPoint).
- ★ 인증 성공 시 사용자 식별자를 MDC("userId") 적재(4단계 자리 연결).
    적재한 userId 는 요청 종료 시 정리(MdcContextFilter 정리 정책과 일관).

# 4. 인증/인가 실패 응답 통일 (3단계 포맷)
- AuthenticationEntryPoint(401): 인증 안 됨 → ErrorResponse(예: UNAUTHORIZED).
- AccessDeniedHandler(403): 권한 없음 → ErrorResponse(예: FORBIDDEN).
- ★ Security 기본 응답 금지. 반드시 ErrorResponse 로 직렬화해 포맷 통일.
- 필요 시 CommonErrorCode 에 UNAUTHORIZED/FORBIDDEN 추가.

# 5. AuditorAware (작성자 auditing) + BaseEntity 분리
- {{BASE_ENTITY_PACKAGE}} 에 BaseEntity(추상): BaseTimeEntity 상속 +
    @CreatedBy {{AUDITOR_TYPE}} createdBy;
    @LastModifiedBy {{AUDITOR_TYPE}} modifiedBy;
    (시각만 필요 → BaseTimeEntity, 작성자까지 → BaseEntity. 계층 분리)
- AuditorAware<{{AUDITOR_TYPE}}> 구현: SecurityContext 에서 사용자 식별자 반환.
    ★ 비인증(익명/컨텍스트 없음) 시 Optional.empty() → createdBy null.
      "SYSTEM 등 가짜 기본값 금지. null 은 '인증 컨텍스트 없이 생성됨'을 정직히 표현.
       진짜 시스템 배치는 배치 실행 컨텍스트에서 주체를 명시 주입하라." 주석.
- @EnableJpaAuditing 은 D단계 활성화됨. AuditorAware 빈만 추가 인식.

# 6. [INCLUDE_TOKEN_DEMO=true] 최소 토큰 발급 데모
- 고정 사용자(예: userId="demo")로 액세스 토큰 발급 엔드포인트 1개. 만료 {{JWT_ACCESS_EXP_MIN}}분. permitAll.
- ★ 주석: "필터 확인용 데모. 실제 로그인/비밀번호 검증/회원 조회 아님. 프로젝트가 인증 정책으로 대체."
- 이 토큰으로 authenticated 경로 접근 확인 가능.

# 이번 단계에서 하지 말 것
- 로그인/회원가입/비밀번호/리프레시 토큰/소셜로그인 금지(정책 영역)
- JWT secret 하드코딩 금지, prod 기본값 금지(fail-fast)
- RS256 구현 금지(인터페이스+확장 자리만)
- Security 기본 에러 응답 방치 금지(ErrorResponse 통일)
- 권한(Role/Authority) 상세 설계 금지 — authenticated 골격까지만

# 완료 기준
- 데모 JWT 로 authenticated 경로 접근.
- 토큰 없이 보호 경로 → 401 ErrorResponse.
- 무효/만료 토큰 거부 + 표준 에러.
- 인증 요청 로그에 userId MDC.
- 인증 시 createdBy 채워짐, 비인증 시 null.
- TokenProvider 로 서명 추상화 + RS256 확장 자리 주석.
- prod 는 JWT secret 누락 시 부팅 실패.
- 1~E2단계 산출물 정상(ArchUnit 포함).
```

---

## Stage F2 — 테스트 전략 (Testcontainers)

```
# 참조 변수 (CLAUDE.md): BASE_PACKAGE, MYSQL_VERSION, REDIS_VERSION, INCLUDE_UNIT_DEMO,
#                        INCLUDE_SLICE_DEMO, INCLUDE_REUSE_HINT
# ================

# 목표
"F2단계: 테스트 전략(Testcontainers)". 실제 MySQL/Redis 컨테이너 기반 통합 테스트 골격,
계층별 테스트 대표 예시, 인증 걸린 엔드포인트 테스트 규약. 앱 완성.

# 전제 (1~F1단계 완료)
- D단계 MySQL+Flyway, E1 Redis, F1 JWT 인증 존재.
- 1단계 ArchUnit(구조 검증) 존재. 여기에 동작 검증 추가.
- 테스트는 실제 인프라를 써야 함(H2 등 인메모리 대체 금지).
  이유: MySQL 전용 문법·Flyway·실제 인덱스 검증 실패 시 "테스트 통과, 운영 MySQL 실패" 괴리.

# 의존성 (추가 허용, 대부분 test scope)
- org.springframework.boot:spring-boot-testcontainers
- org.testcontainers:junit-jupiter
- org.testcontainers:mysql
- (Redis) testcontainers GenericContainer 또는 com.redis:testcontainers-redis
- org.springframework.security:spring-security-test
- ★ Docker 필요(로컬/CI). README 에 전제 명시.

# 1. 통합 테스트 base class (핵심) : 예) IntegrationTest
- @SpringBootTest 기반. MySQL/Redis 컨테이너를 static 필드로 선언 → 상속하는 모든 테스트가 공유
  (JVM 실행 동안 한 번만 뜸). MySQL: mysql:{{MYSQL_VERSION}} / Redis: redis:{{REDIS_VERSION}}
- 접속 정보 주입: @ServiceConnection 사용(MySQL/Redis 모두 지원).
  @DynamicPropertySource 는 미지원 특수 케이스용으로만 주석.
- Flyway 가 컨테이너 MySQL 에 마이그레이션 적용 + JPA validate 통과를 이 base 로 검증.
- [INCLUDE_REUSE_HINT=true] 주석: "로컬 반복 속도는 withReuse(true) +
    ~/.testcontainers.properties 의 testcontainers.reuse.enable=true 로 재사용 가능. CI 에서는 보통 끔."

# 2. 테스트 데이터 격리 규약 (static 공유 함정 대응)
- ★ static 공유 시 데이터가 남는다. 구분:
    a) JPA(RDB)만 관여: @Transactional 로 각 테스트 종료 시 롤백.
    b) Redis 관여: 롤백 안 됨 → @BeforeEach/@AfterEach 에서 명시적 정리(flush, 키 삭제).
       캐시/락 상태가 다음 테스트로 새지 않게.
- ★ 주석: "@Transactional 롤백은 RDB 에만 유효. Redis 는 별도 정리.
    실제 커밋 검증 테스트에서는 @Transactional 롤백이 방해될 수 있음."

# 3. 인증 걸린 엔드포인트 테스트 규약 (F1 연계)
- 두 방식 모두 예시:
    a) @WithMockUser(또는 커스텀): SecurityContext 가짜 인증 → 컨트롤러/서비스 간편 검증. 필터 미경유, 빠름.
    b) 실제 토큰: F1 데모 토큰 발급 → 진짜 JWT 를 Authorization 헤더로 요청.
       JwtAuthenticationFilter 자체 동작(검증/거부) end-to-end 검증.
- ★ 규약 주석: "필터 로직 검증은 실제 토큰으로, 그 외 인증 전제 비즈니스 검증은 @WithMockUser 로."

# 4. [INCLUDE_SLICE_DEMO=true] 슬라이스 테스트 데모
- @DataJpaTest 예시:
    ★ 반드시 @AutoConfigureTestDatabase(replace = Replace.NONE) → 실제 MySQL(Testcontainers) 사용.
      (없으면 H2 로 대체되어 MySQL 문법·Flyway 검증 무의미 — 핵심 함정)
    QueryDSL 커스텀 조회, Auditing 시각 자동 기록 검증.
- (선택) @WebMvcTest 예시: Security/필터 목킹 주석 안내.

# 5. [INCLUDE_UNIT_DEMO=true] 단위 테스트 데모
- 스프링 컨텍스트 없이 순수 객체 검증 1개(TokenProvider 생성/검증, 또는 도메인 서비스). 가장 빠른 계층 주석.

# 6. 통합 테스트로 최소 커버할 시나리오
- Flyway 적용 + JPA validate 통과(부팅 검증).
- 샘플 저장 시 Auditing(시각), 인증 컨텍스트에서 createdBy 기록.
- @Cacheable 적재/조회, @CacheEvict 무효화(E1) + Redis 정리 규약.
- @DistributedLock 상호배제(E1) — 가능 범위에서.
- 인증: 토큰 없이 401, 유효 토큰 성공(F1).

# 이번 단계에서 하지 말 것
- H2 등 인메모리 DB 로 MySQL 대체 금지(@DataJpaTest 도 replace=NONE 으로 차단)
- 실제 커밋 검증 테스트에 무분별한 @Transactional 롤백 금지
- Redis 상태를 롤백에 의존해 정리 금지(명시적 flush)
- 외부 네트워크·실서비스 의존 테스트 금지(Testcontainers 로 로컬 격리)
- CI 파이프라인(YAML) 작성 범위 밖(README 에 Docker 전제만)

# 완료 기준
- 통합 테스트가 Testcontainers MySQL/Redis 를 static 공유로 띄우고 @ServiceConnection 자동 연결.
- Flyway→validate 흐름이 컨테이너 MySQL 에서 통과.
- JPA 는 @Transactional 롤백, Redis 는 명시적 정리로 상호 비간섭.
- 인증: @WithMockUser 와 실제 토큰 두 방식 모두로 보호 엔드포인트 테스트.
- @DataJpaTest 가 실제 MySQL 사용(H2 대체 없음).
- ArchUnit 포함 전체 테스트 스위트 통과.
- 1~F1단계 산출물 모두 정상 동작.
```

---

## Stage G — 관측성 인프라 (Prometheus + Grafana + Loki + Alloy)

```
# 참조 변수 (CLAUDE.md): BASE_PACKAGE, APP_NAME, CONTAINER_PREFIX, APP_METRICS_PORT, PROMETHEUS_PORT,
#                        GRAFANA_PORT, LOKI_PORT, GRAFANA_ADMIN_USER, INCLUDE_AWS_SPEC_HINT
# ================

# 목표
"G단계: 관측성 인프라". 4·5단계에서 앱이 생성한 메트릭·traceId·JSON 로그를 실제로 수집·시각화하는
로컬 스택을 docker-compose 로 구성한다. 앱 코드는 건드리지 않는다(인프라 설정만).
아래 "하지 말 것"을 지켜라.

# 배경
- 앱은 이미 /actuator/prometheus(5단계)로 메트릭을, JSON 로그(4단계)로 로그를 "생성"만 한다.
- 이 단계는 그것을 "수집·시각화"하는 인프라: Prometheus(메트릭 스크래이핑),
  Loki(로그 저장), Grafana(대시보드), Grafana Alloy(로그 수집 에이전트).
- 앱은 컴포즈에 넣지 않는다. IDE 에서 앱을 실행하고, 컴포즈 인프라가 호스트의 앱을 바라본다.
  (단일 서비스 스켈레톤: 앱 컨테이너화는 배포 단계 관심사)

# 전제 (1~F2단계 완료)
- 5단계에서 /actuator/prometheus 노출, application 태그 부착 완료.
- 4단계에서 JSON 로그(dev/prod 프로파일) 출력 가능.
- 기존 docker-compose.local.yml(MySQL/Redis, 2단계) 존재. 관측성은 별도 파일로 분리한다.

# 1. docker-compose.observability.yml (신규, 별도 파일)
- 기존 docker-compose.local.yml 과 합치지 않는다(관측성 스택은 무거워 필요 시에만 기동).
- 서비스: prometheus, grafana, loki, alloy(Grafana Alloy — 로그 수집).
- 포트: prometheus {{PROMETHEUS_PORT}}, grafana {{GRAFANA_PORT}}, loki {{LOKI_PORT}}.
- 컨테이너/네트워크 이름은 {{CONTAINER_PREFIX}}- prefix 로.
- grafana 자격증명은 환경변수로(${GRAFANA_ADMIN_USER}, ${GRAFANA_ADMIN_PASSWORD}). 하드코딩 금지.
- restart: unless-stopped, 볼륨(prometheus/grafana 데이터) 포함.

# 2. prometheus 설정 (prometheus.yml)
- scrape config 로 앱의 /actuator/prometheus 를 긁는다.
    ★ 앱은 컴포즈 밖(호스트)에서 실행되므로, 컨테이너에서 호스트 접근은 host.docker.gateway
      (docker-compose 에서는 host.docker.internal, extra_hosts 로 host-gateway 매핑) 사용.
    target 예: host.docker.internal:{{APP_METRICS_PORT}}
- scrape_interval 은 개발용 적정값(예: 5~15s). metrics_path: /actuator/prometheus.
- ★ 주석: "prod 에서는 management 포트 분리(5단계)에 맞춰 target 포트를 조정하라."

# 3. loki + Grafana Alloy (로그 수집)
- ★ Promtail 이 아니라 Grafana Alloy 를 쓴다(Promtail 은 LTS 전환, Alloy 가 후속 권장 수집기).
- loki: 기본 로컬 설정으로 로그 저장소 기동.
- alloy: 앱의 JSON 로그를 수집해 loki 로 전송.
    수집 대상 결정(택1, 주석으로 방식 명시):
    a) 앱을 로컬 파일로 로깅하는 경우: 로그 파일 경로를 alloy 가 tail.
    b) 앱을 컨테이너로 띄우는 경우(선택 확장): Docker 로그를 라벨 기반 수집.
    스켈레톤 기본은 (a) 파일 tail 또는 표준출력 캡처 방식으로 단순하게.
- ★ JSON 로그를 구조화 필드로 파싱해 loki 라벨/필드로 넣는다(traceId 로 검색 가능하게).
    단 라벨 카디널리티 주의: traceId 는 라벨이 아니라 로그 라인 내용으로(고카디널리티 라벨 금지).

# 4. Grafana 프로비저닝 (자동 설정)
- 데이터소스 자동 연결(프로비저닝 파일): Prometheus, Loki 를 Grafana 시작 시 자동 등록.
    (수동 클릭 설정 없이 바로 쓸 수 있게)
- 기본 대시보드 1개 프로비저닝(최소): 앱 기본 메트릭(HTTP 요청률/지연, JVM) 또는 Micrometer 표준 지표.
    과하게 만들지 말 것 — "연결이 되고 데이터가 보인다"를 확인할 수 있는 수준.
- ★ traceId 로 메트릭↔로그를 오가는 상관관계(Loki 파생 필드로 traceId 링크)는 주석으로 안내(선택 확장).

# 5. [INCLUDE_AWS_SPEC_HINT=true] MySQL/Redis 운영 스펙 시뮬레이션 주석
- 기존 docker-compose.local.yml 의 MySQL/Redis 에 "운영 인스턴스 스펙 시뮬레이션" 주석을 추가한다.
    (로컬 Docker 는 호스트 리소스를 다 써서 "로컬은 되는데 작은 RDS 에선 커넥션 부족" 괴리가 생김)
- 주석으로 안내하고 기본은 "제한 없음"(프로젝트가 타깃 인스턴스에 맞게 활성화):
    MySQL: deploy.resources.limits + --max_connections / --innodb_buffer_pool_size 를 주석 예시로.
      예) db.t3.micro(1GB): max_connections≈66, buffer_pool 256M.
    Redis: --maxmemory / --maxmemory-policy allkeys-lru 를 주석 예시로.
      예) cache.t4g.micro(0.5GB): maxmemory 400mb.
- ★ 실제 값은 주석 처리, 기본은 무제한. "운영 타깃 인스턴스가 정해지면 주석을 풀어 시뮬레이션하라."

# 이번 단계에서 하지 말 것
- 앱 코드/설정 변경 금지(앱은 이미 메트릭·로그 생성 완료. 이 단계는 인프라만).
- 앱을 관측성 컴포즈에 컨테이너로 넣지 말 것(호스트 실행 앱을 바라본다).
- 관측성 스택을 기존 docker-compose.local.yml 에 병합 금지(별도 파일).
- Promtail 사용 금지(Grafana Alloy 사용).
- 고카디널리티 라벨(traceId, userId 등) 을 Loki 라벨로 쓰지 말 것(로그 내용으로).
- 분산 추적 백엔드(Tempo) 연동은 범위 밖(4단계에서 span export off). 필요 시 별도 확장.
- Grafana 자격증명 하드코딩 금지.

# 완료 기준
- docker compose -f docker-compose.observability.yml up -d 로 4개 서비스 기동.
- Prometheus 가 앱 /actuator/prometheus 를 스크래이핑(targets UP).
- Grafana 에 Prometheus/Loki 데이터소스가 자동 연결되어 있다.
- 앱 JSON 로그가 Alloy 를 통해 Loki 에 수집되고, Grafana 에서 traceId 로 검색된다.
- 기본 대시보드에서 앱 메트릭이 보인다.
- (AWS_SPEC_HINT) MySQL/Redis 에 스펙 시뮬레이션 주석이 있고 기본은 무제한.
- 앱 코드는 변경되지 않았다(1~F2 산출물 그대로 정상).
```

---

## 부록 A — 단계별 의존성 누적표

| 단계 | 추가되는 주요 의존성 |
|------|---------------------|
| 1 | web, lombok, test, archunit-junit5 |
| 2 | (없음 — 설정/컴포즈만) |
| 3 | validation |
| 4 | actuator, micrometer-tracing-bridge-otel, logstash-logback-encoder |
| 5 | micrometer-registry-prometheus |
| D | data-jpa, mysql-connector-j, querydsl(jakarta), flyway-core, flyway-mysql |
| E1 | data-redis, cache, redisson-spring-boot-starter |
| E2 | resilience4j-spring-boot3, aop, resilience4j-micrometer |
| F1 | security, jjwt(api/impl/jackson) |
| F2 | spring-boot-testcontainers, testcontainers(junit-jupiter/mysql/redis), spring-security-test |
| G | (앱 의존성 없음 — docker-compose.observability.yml + prometheus/loki/alloy/grafana 설정 파일) |

## 부록 B — 미뤄둔 "자리"가 채워지는 시점

스켈레톤은 앞 단계에서 자리만 잡고 뒤 단계에서 채우는 방식으로 설계되었다. 추적용 정리:

| 자리 | 잡은 단계 | 채우는 단계 |
|------|----------|-----------|
| DB/Redis 설정 키(주석) | 2 | D(DB), E1(Redis) |
| MDC userId | 4 | F1(JWT 인증 성공 시) |
| AuditorAware / createdBy | D(주석) | F1(SecurityContext 연결) |
| RS256 서명 | F1(인터페이스 자리) | 프로젝트별 확장 |
| health group(liveness/readiness) | 5(주석) | 배포 단계 |
| span export(Tempo 등) | 4(토글 off) | 프로젝트별 확장 |
| 역할 기반 인가(Role) | F1(authenticated 골격) | 프로젝트별 확장 |
| 메트릭/로그 수집·시각화 | 4·5(앱은 생성만) | G(Prometheus/Loki/Grafana/Alloy) |
| 게시판 작성자 createdBy | D(요청 파라미터 or 생략) | F1(AuditorAware 자동 기록) |

## 부록 C — 반복 등장하는 실무 함정 체크리스트

- **AOP self-invocation**: `@Cacheable`, `@DistributedLock`, `@CircuitBreaker`, `@Retry`, `@Timed`
  모두 같은 클래스 내부 호출 시 프록시 미경유 → 동작 안 함. 외부 빈 통해 호출.
- **QueryDSL jakarta 분류자 누락** → `javax` 버전 딸려와 컴파일 깨짐.
- **락-트랜잭션 순서**: 락이 트랜잭션 바깥이 아니면 커밋 전 다음 스레드 진입 → 정합성 붕괴.
- **캐시 JavaTimeModule 누락** → `Instant`/`LocalDateTime` 필드 캐싱 시 런타임 에러.
- **Retry + 부수효과** → 중복 결제 등. 멱등 호출에만.
- **fallback 시그니처** → 원본 파라미터 + `Throwable` 1개. 어기면 못 찾음.
- **`@DataJpaTest` H2 대체** → `replace=NONE` 없으면 실제 MySQL 검증 무의미.
- **MDC 미정리** → 스레드풀 재사용으로 값이 다음 요청에 샘.
- **flyway-mysql 누락** → flyway-core 만으로 MySQL 동작 안 함.
- **open-in-view=true(기본값)** → 커넥션 고갈. 명시적으로 false.
- **`@Setter` 남용** → 엔티티 상태를 도메인 메서드(`update()`/`delete()`)로만 변경. setter 금지.
- **`@Builder`를 클래스에** → JPA 엔티티는 생성자에 `@Builder`, 기본 생성자는 `PROTECTED`.
- **Loki 고카디널리티 라벨** → traceId/userId 를 Loki 라벨로 쓰면 인덱스 폭발. 로그 내용으로.
- **Prometheus 가 호스트 앱 못 긁음** → 컨테이너→호스트는 `host.docker.internal`(+ extra_hosts host-gateway).
- **Promtail 사용** → LTS 전환됨. 신규는 Grafana Alloy.

## 부록 D — OnRace 컨벤션에서 채택/제외 정리

기존 OnRace 프로젝트 규약 중 이 스켈레톤에 반영한 것과 의도적으로 뺀 것:

**채택 (범용 컨벤션)**
- Repository `findByIdOrThrow` default 메서드 패턴 (D단계)
- Entity 불변 규약: `@Setter` 금지 + 도메인 메서드 + 생성자 `@Builder` + soft delete (D단계)
- DTO record + `static from(Entity)` + 네이밍(`<도메인><목적>Request/Response`) (D단계)
- Service 트랜잭션: 클래스 `@Transactional(readOnly=true)` + 쓰기 오버라이드 (D단계)
- `Preconditions.validate` 비즈니스 검증 유틸 (3단계)
- `@ServiceLog` AOP(서비스 메서드 로깅, slowMs) (4단계, 옵션 토글)
- 도메인 ErrorCode enum 이 공통 인터페이스 구현(`PostErrorCode`) (D단계)
- MySQL/Redis AWS 인스턴스 스펙 시뮬레이션 주석 (G단계)

**제외 (프로젝트 고유 or 다른 결정)**
- `@ApiLog`(컨트롤러 로깅) → AccessLogFilter(4단계)와 중복이라 제외
- 예외코드 의미론식 네이밍(`EVENT_NOT_FOUND`) → 숫자식(`POST_001`) 유지 결정
- 테스트 H2 + `@ActiveProfiles("test")` → Testcontainers 실제 MySQL(F2)로 정반대 결정
- 멀티모듈 MSA 구성(gateway/auth/main/queue) → 단일 서비스 출발(1단계 결정)
- 모듈별 환경변수 프리픽스(MAIN_*, QUEUE_*) → 단일 서비스라 불필요

## 부록 E — 권장 Claude Code 스킬

이 스켈레톤 작업에 함께 쓰면 좋은 Claude Code 스킬. 핵심 원칙: 스킬은 8~12개 이내로 유지하고
(로드된 스킬은 토큰을 소비함), 안 쓰는 건 주기적으로 정리한다.

**지금 사용 — `/simplify`** (Anthropic 공식 번들)
- 최근 작성한 코드에 정리 패스: 중복 제거, 로직 명확화, 중첩 조건문 평탄화.
- 핵심 제약: 동작을 바꾸지 않고 가독성만 개선 → 머지 전 안전.
- CLAUDE.md 컨벤션을 따르므로 기존 스타일과 일관성 유지.
- 사용 타이밍: 코드량이 쌓인 단계(Stage 3, D 등) 끝, 커밋 직전. 매 작은 변경마다 X(재처리 비용).
  특히 Stage D 게시판(참조 구현)에 돌려 본보기 품질을 높인다.

**추후 도입 고려 (지금은 아님)**
- **`/code-review`** (공식 번들): diff 를 correctness/재사용/효율 관점 리뷰. `--effort`, `--fix`, `--comment`.
  → `/simplify` 에 익숙해진 뒤 커밋/PR 전 리뷰로 추가.
- **DB 마이그레이션 리뷰 스킬**: 테이블 락/데이터 손실/롤백 누락/인덱스 위험 검사(MySQL 지원).
  → Flyway V2, V3 를 실제로 추가하기 시작할 때 도입(V1 뿐인 초기엔 이르다).
- **Superpowers** (커뮤니티, TDD 방법론): Brainstorm→Spec→Plan→TDD→Review 워크플로우 강제.
  → TDD 를 팀 규율로 강제하고 싶을 때. F2 테스트 기반이 이미 있어 급하지 않음.
```
