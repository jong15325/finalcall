# CLAUDE.md

Spring Boot 대규모 트래픽 스켈레톤 프로젝트의 Claude Code 지침이다.
단계별 실행 지시는 `docs/backend/references/spring-skeleton-prompts.md` 를 참조한다. 이 파일은 그 전 과정에서 공유되는
변수, 전역 원칙, Claude Code 행동 규약을 담는다.

**모노레포다**(D-098). `finalcall/{backend/{src,gateway}, frontend, config, docs}`.
코드 경로는 `backend/src/**`·`backend/gateway/**`, 스타일 정본은 루트 `config/`, 문서는 루트 `docs/`.

---

## 섹션 1: 프로젝트 정보

- **프로젝트명**: FinalCall (게임 아이템 경매 플랫폼)
- **개요**: 게임 아이템을 등록·경매·입찰·낙찰하는 대규모 트래픽 경매 백엔드.
  마감 직전 입찰 폭주(동시성)와 실시간 최고가 갱신이 핵심 기술 도전.
- **토폴로지(D-068)**: 모놀리식 단일 서비스 + SCG(Spring Cloud Gateway) 엣지 게이트웨이(별도 배포).
  게이트웨이 역할 = rate limit(Redis 토큰버킷 RequestRateLimiter)·직접접근 차단(공유비밀
  X-Gateway-Token)·라우팅. 인증은 서비스가 유지(JWT 자체 검증 F1, SecurityContext, D-065) —
  게이트웨이 인증 전담 아님, X-User-Id 미도입. 게이트웨이는 스켈레톤 확장 항목이며 향후 MSA 확장 시 재사용.
- **핵심 도메인** (스켈레톤 완성 후, notice 참조 구현의 컨벤션을 따라 구현):
  - `member`      : 회원 계정, 보유 잔액/포인트
  - `category`    : 게임/아이템 유형 분류
  - `item`        : 경매 대상 게임 아이템
  - `auction`     : 경매(시작가·즉시구매가·마감시각·상태: 진행/마감/유찰)
  - `bid`         : 입찰 — 마감 직전 동시성 제어의 핵심(Redis 분산락 @DistributedLock, E1 활용)
  - `settlement`  : 낙찰 후 정산(에스크로)
  - (선택) `notification` : 낙찰/유찰/상위입찰 알림
- **비고**: 위 도메인은 스켈레톤(Stage 0~G)이 완성된 뒤 구현한다. 스켈레톤 단계에서는
  notice(공지사항)를 참조 구현으로 만들어 컨벤션의 본보기로 삼는다.

---

## 섹션 2: Claude Code 행동 규약 (필수)

- **한 번에 한 단계만 진행한다.** 순서: `0 → 1 → 2 → 3 → 4 → 5 → D → E1 → E2 → F1 → F2 → G`.
  사용자가 "다음 단계"라고 지시하기 전까지 다음 단계로 넘어가지 않는다.
- **각 단계 종료 시 "완료 기준" 충족 여부를 검증하고 사용자에게 보고한다.** 스스로 넘어가지 않는다.
- 각 단계는 `docs/backend/references/spring-skeleton-prompts.md` 의 **"이번 단계에서 하지 말 것"** 범위 제한을 반드시 지킨다.
  범위를 벗어나는 코드를 만들지 않는다.
- **git commit / push 는 사용자가 직접 한다. Claude Code 는 커밋·푸시하지 않는다.
  단계 완료 시 섹션 6 컨벤션을 따른 커밋 메시지를 제안한다(실행은 사용자).**
  (역할 대화의 커밋은 `docs/common/rules.md [9.8]`을 따른다 — **사용자가 지시하면 대행한다.**
  원격 push는 `[9.3]`대로 사용자 지시로만.)
- **시크릿·`.env`·자격증명을 코드나 커밋에 넣지 않는다.** 민감값은 환경변수(`${ENV_VAR}`)로.
- 응답 언어는 한국어. 주석·에러 메시지·문서도 한국어.
- 변경 전, 관련 파일을 먼저 읽고 기존 컨벤션과 일치하는지 확인한다.

---

## 섹션 3: 공유 변수

새 프로젝트 시작 시 이 섹션의 값을 채우거나 조정한다.
`<...>` 는 반드시 채워야 하는 값, 나머지는 기본값(그대로 써도 됨).

### 프로젝트 식별 (필수)
```
PROJECT_NAME     = finalcall
GROUP            = com.finalcall
ARTIFACT         = finalcall
BASE_PACKAGE     = com.finalcall     # 단일 서비스라 중복(com.finalcall.finalcall) 회피 위해 단일화.
                                     # Stage 0 의 packageName 도 com.finalcall 로 지정할 것.
```

### 구조 (Stage 1)
```
LAYERS           = api > domain > infra > common   # 의존 방향: 왼→오 단방향
SAMPLE_FEATURE   = sample
COMMON_SUBPKGS   = response, exception, logging, util
INFRA_SUBPKGS    = config, redis, persistence
SPRING_BOOT_VER  = 3.5.x (최신 안정)
JAVA_VERSION     = 21
BUILD_DSL        = groovy                # groovy | kotlin
INCLUDE_ARCHUNIT = true
INCLUDE_SAMPLE   = true
```

### 프로파일·로컬 인프라 (Stage 2)
```
PROFILES              = local, dev, prod
INCLUDE_STAGING       = false
DEFAULT_LOCAL_PROFILE = local
SERVER_PORT           = 8080
INCLUDE_DOCKER_COMPOSE = true
MYSQL_VERSION          = 8.0
REDIS_VERSION          = 7
MYSQL_LOCAL_PORT       = 3306
REDIS_LOCAL_PORT       = 6379
MYSQL_LOCAL_DB         = {{ARTIFACT}}
```

### 응답·예외 (Stage 3)
```
INCLUDE_VALIDATION_ERRORS = true
TIMESTAMP_FORMAT          = ISO-8601     # Instant, UTC
COMMON_CODE_PREFIX        = COMMON
```

### 로깅·추적 (Stage 4)
```
TRACE_PROPAGATION      = W3C
TRACE_SAMPLING_LOCAL   = 1.0
TRACE_SAMPLING_DEV     = 1.0
TRACE_SAMPLING_PROD    = 0.1
INCLUDE_TRACE_EXPORT   = false
TRACE_EXPORT_ENDPOINT  = ${OTEL_EXPORTER_OTLP_ENDPOINT}
REQUEST_ID_HEADER      = X-Request-Id
ACCESS_LOG_ENABLED     = true
LOG_JSON_PROFILES      = dev, prod
INCLUDE_SERVICE_LOG    = true
SERVICE_LOG_SLOW_MS    = 1000
```

### Actuator·메트릭 (Stage 5)
```
APP_NAME              = {{ARTIFACT}}
EXPOSED_ENDPOINTS       = health, prometheus, info
SEPARATE_MGMT_PORT_PROD = true
MGMT_PORT               = 8081
HEALTH_SHOW_DETAILS     = always
INCLUDE_CUSTOM_METRIC_DEMO = true
```

### 데이터 계층·게시판 예시 (Stage D)
```
QUERYDSL_VERSION      = 5.1.0            # jakarta 분류자 사용
AUDIT_TIME_TYPE       = Instant
BASE_ENTITY_PACKAGE   = {{BASE_PACKAGE}}.domain.common
JPA_DDL_AUTO_LOCAL    = validate         # 전 프로파일 validate(스키마는 Flyway 관리)
INCLUDE_FLYWAY        = true
FLYWAY_LOCATION       = classpath:db/migration
INCLUDE_POST_EXAMPLE  = true             # 참조 구현(공지) 포함 여부
POST_FEATURE          = notice           # 참조 구현 도메인명(공지사항). 단순 CRUD 로 컨벤션 시연
```

### Redis (Stage E1)
```
CACHE_DEFAULT_TTL_SECONDS = 60           # 데모값, 데이터별 조정 대상
LOCK_DEFAULT_WAIT_MS      = 3000
LOCK_DEFAULT_LEASE_MS     = 10000
LOCK_ANNOTATION_NAME      = DistributedLock
INCLUDE_LOCK_DEMO         = true
INCLUDE_CACHE_DEMO        = true
```

### 회복탄력성 (Stage E2)
```
INCLUDE_RATE_LIMITER   = false           # 앱 레벨 rate limiting off(게이트웨이 담당)
CB_FAILURE_RATE        = 50
CB_WAIT_OPEN_SECONDS   = 10
CB_SLIDING_WINDOW_SIZE = 10
RETRY_MAX_ATTEMPTS     = 3
RETRY_WAIT_MS          = 500
INCLUDE_RESILIENCE_DEMO = true
```

### 보안 (Stage F1)
```
JWT_ALGORITHM         = HS256            # 시작(확장: RS256 자리 마련)
JWT_ACCESS_EXP_MIN    = 30
AUDITOR_TYPE          = String
INCLUDE_TOKEN_DEMO    = true
```

### 테스트 (Stage F2)
```
INCLUDE_UNIT_DEMO      = true
INCLUDE_SLICE_DEMO     = true
INCLUDE_REUSE_HINT     = true
```

### 관측성 인프라 (Stage G)
```
CONTAINER_PREFIX   = {{ARTIFACT}}
APP_METRICS_PORT   = 8080
PROMETHEUS_PORT    = 9090
GRAFANA_PORT       = 3000
LOKI_PORT          = 3100
GRAFANA_ADMIN_USER = admin
INCLUDE_AWS_SPEC_HINT = true
```

---

## 섹션 4: 전역 설계 원칙 (모든 단계 적용)

- **의존 방향 단방향**: `api → domain → infra → common`. 역방향 절대 금지.
  `common` 은 프레임워크 최소 의존(가능한 순수 Java). JPA/Redis 등은 `domain`/`infra` 에만.
- **시크릿 fail-fast**: 로컬은 `${ENV:기본값}`, 운영은 `${ENV}`(기본값 없음 → 누락 시 부팅 실패).
- **시간 타입**: `Instant`(UTC)로 통일. 표현 계층에서 변환.
- **AOP self-invocation 주의**: 같은 클래스 내부 호출은 프록시를 안 타므로 어노테이션 기반 기능
  (`@Cacheable`, `@DistributedLock`, `@CircuitBreaker`, `@Retry`, `@ServiceLog`)이 적용되지 않는다. 외부 빈 통해 호출.
- **설정 바인딩**: 산발적 `@Value` 대신 `@ConfigurationProperties` + `@Validated` 표준.

---

## 섹션 5: 도메인 코드 컨벤션 (Stage D 이후 모든 도메인 적용)

- **Entity**: `BaseTimeEntity`/`BaseEntity` 상속, `@NoArgsConstructor(PROTECTED)`, 생성자에 `@Builder`,
  `@Setter` 금지 → 도메인 메서드(`update()`/`delete()`), soft delete(`isDeleted`).
- **Repository**: `findByIdOrThrow(id, ErrorCode)` default 메서드 패턴, 커스텀 쿼리는
  `<Entity>RepositoryCustom` + `<Entity>RepositoryImpl`(QueryDSL).
- **Service**: 클래스 레벨 `@Transactional(readOnly = true)`, 쓰기만 `@Transactional` 오버라이드.
  `@ServiceLog` 부착, 비즈니스 검증은 `Preconditions.validate(condition, ErrorCode)`.
- **Controller**: 반환 타입 항상 `ApiResponse<T>`(예외: 상태 변경만 하고 본문이 없는 응답은 204 No Content + `void`/`@ResponseStatus` 허용 — ApiResponse 래핑 제외, B-019·D-076), 요청 검증 `@Valid`, try-catch 금지(전역 핸들러).
- **DTO**: Java `record`, Response 는 `@Builder` + `static from(Entity)`,
  네이밍 `<도메인><목적>Request/Response`(Dto 접미사 금지).
- **도메인 ErrorCode**: 공통 `ErrorCode` 인터페이스를 구현한 도메인별 enum, 네이밍 `{DOMAIN}_{3자리}`.

---

## 섹션 6: Git 컨벤션

### 커밋 메시지 (Conventional Commits, 제목은 한국어)
형식: `type(scope): 한글 제목`
- type: feat(기능), fix(버그), refactor(리팩터링), docs(문서), test(테스트), chore(잡무/설정), build(빌드/의존성)
  (docs 커밋의 상세 규약은 `docs/common/rules.md [9]`·`templates.md [9]` 참조 — scope에 역할, 코드 혼합 금지)
- scope: 선택. 도메인/영역 (auth, bid, notice, skeleton 등)
- 제목: 한국어, 간결하게.

예시:
- feat(bid): 동시 입찰 최고가 갱신에 분산락 적용
- fix(auth): 만료 토큰 401 응답 포맷 통일
- chore(skeleton): stage D - 데이터 계층 + notice 참조 구현

- 스켈레톤 구축 단계 커밋은 `chore(skeleton): stage N - 설명` 으로 통일한다.

### 커밋 본문 템플릿
단순 변경은 제목만으로 충분하다. 단계 완료·다수 파일 변경 등 의미가 큰 커밋은 아래 구조를 따른다.
섹션 순서: 목적(왜) → 세부 내용(무엇을, 영역별) → 수정 파일(M/A 구분) → 검증(증거) → 범위 밖(스코프).
해당 없는 섹션은 생략 가능. 한국어로 작성한다.

```
<type>(<scope>): <제목 — 무엇을 왜, 명령형·한국어>

목적
- <이 커밋이 이루려는 것 1~2줄>

세부 내용 (영역별)
- <영역>: <무엇을·왜>

수정 파일
  변경(M): <추적 중 수정 파일>
  추가(A): <새 파일 — 메인/테스트/기타로 묶기>

검증
- <테스트/부팅/기타 확인 결과>

범위 밖(다음 단계)
- <의도적으로 미룬 것>
```

- Claude Code 는 단계 완료 시 이 템플릿으로 채운 커밋 메시지를 제안한다(실행은 사용자).

### 브랜치 전략
- 현재(1인 + 스켈레톤 구축): main 단일 브랜치에 직접 커밋.
- 실제 도메인 개발 시: feature/<도메인> 브랜치(예: feature/bid) → PR → main(Squash and Merge).
- GitFlow 같은 무거운 전략은 규모가 커질 때 재검토.

### Claude Code 연계
- 커밋·푸시는 사용자가 직접 실행한다.
- Claude Code 는 단계·작업 완료 시 위 컨벤션을 따른 커밋 메시지를 제안한다(여러 변경이면 나눠서).
- 시크릿·.env·자격증명은 .gitignore 로 커밋 제외를 보장한다.

---

## 섹션 7: 코드 스타일 규약 (B-020, D-075)

기계가 강제하는 스타일 층이다. 섹션 5(도메인 코드 컨벤션·아키텍처)와 병존하며 스타일 포매팅만 담당한다.

- **정본(기계 강제)**: `config/checkstyle/naver-checkstyle-rules.xml`(+ `naver-checkstyle-suppressions.xml`),
  `.editorconfig`, `config/naver-eclipse-formatter.xml`. 경로·파일명은 도입 작업(B-020) 산출물과 일치시킨다.
- **기반**: Naver 캠퍼스 핵데이 Java 컨벤션(https://naver.github.io/hackday-conventions-java/).
  들여쓰기는 스페이스 4로 커스터마이즈(하드탭 미사용).
- **강제**: `build`(check)에 checkstyle·spotlessCheck 를 연결, 위반 시 빌드 실패(maxWarnings 0).
- **적용 의무**: 코드 작성·커밋 전 `./gradlew spotlessApply` 실행 후 checkstyle 통과를 확인한다.
  새 세션·전 도메인 동일 적용한다(Claude Code 킥오프도 이 절을 따른다).
- **범위**: 스타일 층만 담당한다. 도메인 설계 규칙은 섹션 5, 커밋 형식은 섹션 6을 따른다.
