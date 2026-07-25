# CLAUDE.md

Spring Boot 대규모 트래픽 스켈레톤 프로젝트의 Claude Code 지침이다.
**스켈레톤(Stage 0~G)은 전건 완료·커밋됐다.** 그 과정의 기록은 `docs/backend/references/spring-skeleton-prompts.md`에
있다 — **실행 지시가 아니라 참고 자료다**(부록 C 실무 함정 15건이 도메인 구현에서 유효).
이 파일은 변수, 전역 원칙, Claude Code 행동 규약을 담는다.

**모노레포다**(D-098). `finalcall/{backend/{src,gateway}, frontend, config, docs}`.
코드 경로는 `backend/src/**`·`backend/gateway/**`, 스타일 정본은 루트 `config/`, 문서는 루트 `docs/`.

**패키지 레이아웃 = feature-first**(EPIC-RESTRUCTURE, 2026-07-25 게이트2). 최상위를 기술 계층(구 `api`/`domain`)이 아니라 **도메인(feature)** 으로 분할하고, 각 feature 내부에 `controller/service/repository/entity/dto` 계층 하위패키지를 둔다 — 패키지는 `com.finalcall.<feature>.<layer>`(예: `com.finalcall.member.service.MemberService`, `com.finalcall.member.entity.User`). 횡단 인프라·공용 커널은 feature가 아니므로 `com.finalcall.common`·`com.finalcall.infra`에 제자리로 남는다. 상세 규약·목표 레이아웃·ArchUnit 규칙 스펙 = `docs/common/proposals/layer-restructure-proposal-v0.1.md`(파일명은 v0.1이나 내용은 v0.2 DECIDED). **전환 중 안내(한시적, FC-122에서 제거)**: 재구성이 feature 단위로 순차 진행 중이라, 신규 코드는 feature-first를 따르되 아직 이전되지 않은 기존 코드는 구 배치(`api/…`·`domain/…`)일 수 있다.

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
  - `bid`         : 입찰 — 마감 직전 동시성 제어의 핵심(**auction 행 비관적 락 + 금전 조건부 CAS**,
                    EPIC-BID 게이트2 승인 2026-07-18). 스켈레톤 기획 시점의 "Redis 분산락 @DistributedLock"
                    서술을 대체한다 — 실측 결과 `DistributedLockAspect`는 고정 임대(watchdog 부재)라
                    TX가 임대를 넘기면 상호배제가 깨지고, Redis 장애가 입찰 전면 중단으로 전파된다.
                    `domain-spec §8`("락은 정확성 보장 수단이 아니다")과도 정합. `@DistributedLock`
                    자산은 스켈레톤 데모(E1)에 유지된다. 근거 `docs/spec/bid-domain-spec.md`
  - `settlement`  : 낙찰 후 정산(에스크로)
  - (선택) `notification` : 낙찰/유찰/상위입찰 알림
- **비고**: 위 도메인은 스켈레톤(Stage 0~G)이 완성된 뒤 구현한다. 스켈레톤 단계에서는
  notice(공지사항)를 참조 구현으로 만들어 컨벤션의 본보기로 삼는다.

---

## 섹션 2: Claude Code 행동 규약 (필수)

- **한 번에 한 단계만 진행한다.** 순서: `0 → 1 → 2 → 3 → 4 → 5 → D → E1 → E2 → F1 → F2 → G`.
  사용자가 "다음 단계"라고 지시하기 전까지 다음 단계로 넘어가지 않는다.
- **각 단계 종료 시 "완료 기준" 충족 여부를 검증하고 사용자에게 보고한다.** 스스로 넘어가지 않는다.
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

### 구조 (Stage 1 — feature-first 재구성 반영, EPIC-RESTRUCTURE)
```
PACKAGING        = feature-first                   # 최상위=도메인(feature), com.finalcall.<feature>.<layer>
FEATURE_LAYERS   = controller > service > repository > entity   # feature 내부 계층·의존방향(왼→오 단방향). dto는 controller/service가 참조, entity에만 의존
KERNEL_PACKAGES  = common, infra                   # 횡단 커널(feature 아님·제자리). 어떤 feature도 이 둘을 역으로 의존받지 않음
SAMPLE_FEATURE   = sample                          # 새 경로: com.finalcall.sample.{controller,service,dto,...}
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

- **의존 방향(feature-first, EPIC-RESTRUCTURE)**: 세 축을 ArchUnit(`LayerDependencyTest`)이 기계 강제한다.
  (1) **슬라이스 내부 계층방향** — 한 feature 안에서 `controller → service → repository → entity`(+ `dto`) 단방향. entity/repository는 controller/service를 역참조 금지.
  (2) **커널 무의존** — `common`·`infra`는 어떤 feature도 의존하지 않는다(`common`은 프레임워크 최소 의존·가능한 순수 Java, JPA/Redis 등은 feature/`infra`에만).
  (3) **슬라이스 비순환** — feature 간 순환 참조 금지.
  규칙 스펙 = proposal v0.2 §10. **전환 중(한시적, FC-122 제거)**: 구 최상위-레이어 규칙(`api→domain→infra→common`)과 신 규칙이 병존하며, 전 feature 이전 완료(Phase 3)에 구 규칙을 제거한다.
- **시크릿 fail-fast**: 로컬은 `${ENV:기본값}`, 운영은 `${ENV}`(기본값 없음 → 누락 시 부팅 실패).
- **시간 타입**: `Instant`(UTC)로 통일. 표현 계층에서 변환.
- **AOP self-invocation 주의**: 같은 클래스 내부 호출은 프록시를 안 타므로 어노테이션 기반 기능
  (`@Cacheable`, `@DistributedLock`, `@CircuitBreaker`, `@Retry`, `@ServiceLog`)이 적용되지 않는다. 외부 빈 통해 호출.
- **설정 바인딩**: 산발적 `@Value` 대신 `@ConfigurationProperties` + `@Validated` 표준.

---

## 섹션 5: 도메인 코드 컨벤션 (Stage D 이후 모든 도메인 적용)

- **물리 배치(feature-first, EPIC-RESTRUCTURE)**: 각 클래스는 `com.finalcall.<feature>.<layer>`에 둔다 — Controller→`controller`, Request/Response 등 표현 DTO→`dto`, Service·도메인 VO→`service`, Repository(+Custom/Impl)→`repository`, Entity·귀속 enum→`entity`. `ErrorCode`·`*Properties`·도메인 예외는 feature 루트. 상세 분류표·경계 사례는 proposal v0.2 §9. 아래 네이밍·설계 규칙은 배치와 무관하게 그대로 적용된다.
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
- **적용 의무**: 코드 작성·커밋 전 `./gradlew :backend:spotlessApply` 실행 후 checkstyle 통과를 확인한다.
  게이트웨이(`backend/gateway`) 편집 시에는 `./gradlew :backend:gateway:spotlessApply`를 실행한다.
  새 세션·전 도메인 동일 적용한다(Claude Code 킥오프도 이 절을 따른다).
- **범위**: 스타일 층만 담당한다. 도메인 설계 규칙은 섹션 5, 커밋 형식은 섹션 6을 따른다.

---

## 섹션 8: 에이전트 오케스트레이션 (위임 정책)

스켈레톤 완료 후 도메인 개발은 **메인세션이 총괄로서 서브에이전트를 오케스트레이션**하는 방식으로 진행한다.

**우선순위**: 이 절부터 섹션 13까지(오케스트레이션 모드)는 섹션 1~7의 개발 규약 위에서 동작한다. **커밋·단계 진행에 관해 섹션 2·6과 충돌하면 이 절들이 우선한다**(섹션 2의 "한 단계씩·Claude Code 커밋 안 함", 섹션 6의 "커밋은 사용자 전담"은 스켈레톤 스테이징 기준이며 도메인 개발엔 섹션 13이 정본).

- **총괄 = 메인세션 자체**(서브에이전트 아님). 위임·게이트 판정·티켓 상태 전이·Jira 미러를 담당한다.
- **실행 서브에이전트 4종 + portfolio-writer(포트폴리오 큐레이션) + 컨설턴트(휴면)**:

| 에이전트 | 트리거(언제 쓰나) | 권한 | 모델 |
|---|---|---|---|
| architect | 기능 착수 시 계약/spec 확정. 구현 전 필수 선행 | 읽기 + spec/ 쓰기 | Opus 4.8 |
| backend-impl | 계약 확정 후 서버 구현·테스트 | Read/Write/Edit/Bash | Opus 4.8 |
| frontend-impl | 계약 확정 후 클라이언트 구현(디자인 흡수). 새 화면은 디자인 게이트 후 | Read/Write/Edit/Bash | Opus 4.8 |
| reviewer | 구현 후 Done 전 필수. **확인소**(보안 첫 검문소 아님) — 정합성·QA + 도메인 인가(주체=SecurityContext·/me IDOR·세션 폐기 완전성) 최종 판정 | 읽기 전용(Read/Grep/Glob/Bash) | Opus 4.8 |
| portfolio-writer | 에픽 완료(게이트3) 또는 사용자 요청 시. 코드·spec·보드·리뷰를 읽어 포트폴리오용 도시에 축적 | 읽기 + docs/portfolio 쓰기 | Opus 4.8 |
| consultant | **구조적 규약 개정 시에만** 명시적 소환. 평상시 휴면 | 읽기 + docs 규약 | Opus 4.8 |

- **에이전트 간 직접 통신 금지**. 서브에이전트는 **파일 read/write + 메인세션 반환**만 한다. 다른 에이전트를 호출하거나 대화하지 않는다.
- **무상태**: 에이전트는 세션 상태를 남기지 않는다. 모든 상태는 티켓 파일(섹션 11)에 영속한다.
- **컨설턴트 휴면**: 평상시 프로세스 규칙은 메인세션이 적용한다. 규약·프로세스 변경이 필요할 때만 소환한다. description을 좁게 걸어 오발동을 막는다.
- **보안 층은 상주 에이전트가 아니다.** 오케스트레이션되는 실행 에이전트는 위 4종 + portfolio-writer이며, 보안은 별도 도구 층(구현 중 플러그인 자동 리뷰 · 에픽 완료 온디맨드 `/security-review` · push 후 원격 CI)으로 구현한다. reviewer는 이 층들의 **확인소**로서 도메인 인가를 최종 판정하지, 유일한 보안 검문소가 아니다. 층 구성·상시값은 섹션 13.

## 섹션 9: 워크플로우

- **contract-first**: 기능 착수 시 **architect가 API 계약/spec을 먼저 확정**(게이트2 통과)한 뒤에만 구현 에이전트를 팬아웃한다. 프론트/백엔드 실시간 협상을 설계로 제거한다.
- **파이프라인**:

```
architect(계약 확정)
  → [디자인 게이트: 새 화면/주요 UI]
  → backend-impl  ∥  frontend-impl        (병렬)
  → reviewer(보안+QA+접근성)
  → Done            (reviewer 통과가 필수 선행)
  → [portfolio-writer: 에픽 완료(게이트3) 또는 사용자 요청 시 도시에 축적 — 임계경로 밖, 읽기+docs/portfolio only]
```

- **팬아웃(병행) 판정**: 두 위임을 병렬로 내는 조건은 **의존 없음 + 쓰기 파일 집합 무교차** 둘 다 충족일 때다. "같은 도메인"이 아니라 "같은 파일"로 센다.
- **에픽/티켓 경계 판단**: 총괄이 규모로 자동 판단한다.
  - **에픽** = 여러 하위 작업으로 분해됨(다수 파일 변경 · 병렬 팬아웃 가능 · 게이트2 결정 포함 중 하나 이상).
  - **티켓** = 단일 파일·단일 DoD로 닫힘.
  - 에픽 분해안은 **게이트1에서 사용자에게 제시해 조정**받는다. 하위 티켓은 자동 진행하며 개별 보고하지 않는다.
- **보안 층(경매 에픽부터 첫 적용)**: 파이프라인 골격은 불변이고 보안 층만 겹친다 — (1) 구현 중 커밋 보안 리뷰(warn-only) + 선택적 end-of-turn 리뷰, (2) reviewer가 확인소로 도메인 인가 최종 판정, (3) 에픽 완료 직전 온디맨드 `/security-review` 1회, (4) 사용자 push 후 원격 CI(정적분석·의존성 스캔), (5) 공통 위협모델 체크리스트(`.claude/claude-security-guidance.md`)를 플러그인·reviewer가 공유 참조. member/account에 소급하지 않는다.

## 섹션 10: 게이트 정책

| 게이트 | 발동 조건 | 동작 |
|---|---|---|
| **게이트1 (에픽 승인)** | 에픽 착수 시 | 총괄이 분해안(하위 티켓·의존)을 사용자에게 제시 → 승인·조정. 하위는 자동 진행 |
| **게이트2 (스키마/계약/성능)** | 스키마·API계약·성능 영향·되돌리기 큰 결정 | **자동 진행 중에도 예외적으로 멈추고** 사용자에 상신. 그 이하는 총괄 자율 |
| **디자인 게이트** | frontend-impl이 **새 화면·주요 UI** 구현 전 | 디자인 방향을 사용자에 제시 → 승인·조정 후 구현. **단순 수정은 자동** |
| **게이트3 (push + Done)** | 에픽 완료 시 | **push는 사용자가 직접 실행**(에이전트 불가, PreToolUse 훅이 차단). **Done 전이는 사용자 승인**. 커밋은 매 커밋마다 사용자 승인(섹션 13) |

- **보안 리뷰는 게이트가 아니다.** 커밋 보안 리뷰는 warn-only(비차단)이며 별도의 **보안** 차단 게이트를 신설하지 않는다 — 커밋 자체는 사용자 승인 게이트(섹션 13)를 거치되, 보안 리뷰는 그 승인 판단 자료일 뿐 커밋을 막지 않는다. 상신이 필요한 보안 결정(스키마·계약·인가 모델 변경)은 기존 **게이트2**로 수렴한다.
- **권한 집중 방지**: 프로젝트 축 결정은 게이트2로, 체계 축(규약·프로세스) 변경은 컨설턴트 소환으로, **둘 다 사용자에게 수렴**한다.
- **spec 확정 후 변경**: 사용자가 언제든 요청 가능하되, **architect가 영향받는 티켓 목록을 먼저 제시 → 사용자 확인 후 진행**(contract-first 파급 관리).

## 섹션 11: 티켓·에픽 (파일 티켓 보드)

- **canonical 진실원 = 레포 내 티켓 파일**. 위치: `docs/board/{tickets/, epics/, reviews/}`. **티켓당 파일 1개**(모놀리식 보드 금지 — 병렬 쓰기 충돌 회피).
- **스키마** — YAML 프론트매터:

```yaml
---
id: FC-014
type: task                 # task | epic
epic: EPIC-MEMBER          # 귀속 에픽(task). epic이면 삭제
derived_from: FC-012       # 직접 부모 티켓. 최초 발생이면 null
jira_key: KAN-7            # 미러 대상. 최초 생성 시 기록 후 불변
title: member 잔액 원자적 증감 구현
state: doing               # todo | doing | review | blocked | done
owner: backend-impl        # architect | backend-impl | frontend-impl | reviewer | main
depends_on: [FC-012]
blocks: [FC-016]
gate: null                 # 대기 게이트: gate2 | gate3 | design | null
review_status: pending     # pending | passed | changes-requested (게이트3 훅이 참조)
contract_ref: docs/spec/api-contract.md 4.2절
artifacts:
  - backend/src/.../UserBalance.java
  - docs/board/reviews/FC-014-review.md
---
## 목표 / DoD / 근거인용 / 검증
## 파생 경위: <파생 티켓이면 한 줄. 최초 발생이면 삭제>
```

- **에픽 파일**: `type: epic` + `children: [...]`. `state`는 하위 롤업(손으로 관리 안 함): 전부 todo면 todo, 하나라도 doing이면 doing, 전부 review 이상이면 review, **전부 done + 사용자 승인이면 done**.
- **상태 머신** — 전이 주체는 **메인세션만**(에이전트는 산출물만 반환):

```
todo ──위임──▶ doing ──구현 완료──▶ review ──reviewer 통과──▶ done*
review ──critical/major 발견──▶ doing (재작업)
doing/review ──선행 미충족·게이트2 대기──▶ blocked ──해소──▶ 직전 상태
* done 전이 = 게이트3(에픽 완료 시 사용자 승인). review_status=passed 필수 선행
```

- **reviewer 통과 표현**: `review_status` 필드로 티켓에 명시한다. 게이트3 훅이 이를 참조해 미통과 티켓의 done/push를 막는다.

## 섹션 12: Jira 미러 (사용자 대시보드)

- **파일 → Jira 단방향**. Jira(Atlassian MCP, KAN)는 **사용자 전용 읽기 미러**다. 에이전트는 **Jira를 읽지 않는다**(서브에이전트 도구셋에서 Atlassian MCP 제외).
- **트리거**: **메인세션만** 상태 전이 **때마다 즉시** 반영한다(에픽 생성·상태 전이 포함). **비차단**은 미러 실패 시 파일 작업을 멈추지 않는다는 뜻이며 — **실패 허용이지 생략 허용이 아니다**(가시성 도구, 게이트 아님).
- **매핑**: state→status(칸반 컬럼) · owner→라벨 `agent:<owner>` · epic→Jira Epic(+Epic Link) · depends_on/blocks→issue link · gate→라벨 `gate:*`.
- **역류 방지**: Jira 변경은 파일에 **영향 없음**. `jira_key`로 식별하는 **멱등 upsert**(생성 아닌 갱신). 파일과 어긋나면 **파일이 정본**, 다음 미러가 덮어쓴다.
- **드리프트 가드레일**: (계층①·자동) `state≠todo`인데 `jira_key`가 비어 있으면 "Jira 미생성" 드리프트다 — `git commit` 전 `.claude/hooks/check-mirror-drift.js`가 파일만으로 탐지해 **경고**한다(warn-only, 커밋 비차단). (계층②·수동) 보드 `done`인데 Jira 미완료 유형은 Jira 읽기가 필요해 훅/서브에이전트가 못 잡는다 → **총괄만** HANDOVER "이어받는 법"의 미러 패리티 단계에서 주기적으로 대조·보정한다.

## 섹션 13: 커밋·push 규약 (오케스트레이션 모드)

- **커밋 = 사용자 승인 후**(2026-07-24 사용자 결정). 흐름: 작업 완료 → 총괄이 커밋 메시지(섹션 6 Conventional Commits 형식) + 스테이징 파일 목록을 제안 → 사용자 승인 → 커밋. 승인 전에는 워킹트리 변경만 유지한다(에이전트는 승인 없이 커밋하지 않는다). 코드는 atomic 커밋을 유지한다.
- **push = 에픽 완료 시 사용자가 직접 실행**. 에이전트는 push 권한이 없다. **PreToolUse 훅이 `git push`를 차단하고 `git commit`은 통과**시킨다(게이트3 훅 · settings.json).
- **Done 전이 = 사용자 승인**(게이트3).

### 보안 층 구성 (경매 에픽부터)

- **커밋 보안 리뷰 = warn-only(비차단)**. 발견을 재프롬프트할 뿐 커밋을 막지 않는다. **보안 리뷰는 별도 차단 게이트가 아니다** — 커밋 자체는 사용자 승인 게이트(위)를 거치되, 보안 리뷰는 그 승인 판단 자료일 뿐이다. `block-git-push`는 push만 차단하며 무간섭이다.
  - **배선 주의(재프롬프트↔review 전이·커밋 승인 타이밍)**: 재프롬프트가 턴을 연장해 에이전트가 "구현 완료" 이후 추가 편집을 할 수 있다. 티켓 `review` 전이 시점과 커밋 메시지·스테이징 목록 제안이 이 후속 편집과 엇갈리지 않도록, 메인세션은 **후속 편집이 수렴한 뒤** review로 전이하고 커밋 승인을 상신한다.
- **end-of-turn 보안 리뷰 = 기본 off**(`ENABLE_STOP_REVIEW=0`). 경매 최고위험 티켓(입찰·정산) 구간에 한해 **한시적으로 켤 수 있다**(구간 종료 시 off 복귀).
- **에픽 완료 직전 온디맨드 `/security-review` 1회 = 상시**.
- **CI 정적분석·의존성 스캔 = post-push 원격**(사용자 push 후 GitHub Actions). 로컬 pre-push 아님 → `block-git-push`와 무간섭. 로컬=LLM 패스, 원격=정적분석·의존성 스캔으로 이중화한다(Windows 헤드리스에서 Python 정적도구 의존이 크면 그 층은 리눅스 러너로 이관).
- **플러그인 모델 = opus-4-8 핀**. 코드를 쓴 인스턴스에 자기채점을 시키지 않도록 신선 컨텍스트를 유지한다.
- **한도 폴백**: 사용량 한도 압박 시 자동 보안 층(커밋 보안 리뷰·end-of-turn 리뷰)은 끄고 온디맨드 `/security-review`만 유지한다.
- **도입 전제(Windows)**: 헤드리스에서 플러그인 실제 발동·single-shot LLM 폴백 경로를 **스모크 검증**한 뒤 가동한다.
