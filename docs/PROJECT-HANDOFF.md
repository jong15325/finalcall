# FinalCall(장터) 완전 인수인계 문서 (AI 이관용)

> **목적**: 이 프로젝트를 처음 이어받는 AI/개발자가 **이 문서 하나 + 레포**만으로 전체 맥락(제품·코드·아키텍처·이력·규칙·에이전트 운영·Jira·환경·운영 교훈)을 파악하고 작업을 재개할 수 있게 한다.
> **작성 기준**: 2026-08-07 · origin/master=`37089df`(+미푸시 문서 커밋 `10b0575`) · 커밋 821개 · 에픽 33개 전건 done/superseded.
> **정본 관계**: 이 문서는 요약·지도다. 충돌 시 정본은 각 원본 파일(`CLAUDE.md`·`docs/common/rules.md`·`docs/spec/*`·`docs/board/*`).
> ⚠️ **자동 메모리 주의**: 원 작업 AI(Claude Code)는 `~/.claude/.../memory/`에 25개 운영 교훈 메모리를 갖고 있었다. 이 메모리는 **레포와 함께 이동하지 않으므로** 그 핵심을 이 문서 섹션 12에 전부 흡수했다. 새 환경에서는 이 문서가 그 메모리를 대체한다.

---

## 0. 30초 요약

- **제품**: **장터** — 게임(Survival Project) 아이템을 등록·경매·입찰·낙찰·정산·즉시구매·거래하는 **대규모 트래픽 경매 플랫폼**. 코드명은 `finalcall`, 브랜드명은 **장터**.
- **핵심 기술 도전**: 경매 마감 직전 **동시 입찰 폭주(동시성 제어)** + 실시간 최고가 갱신.
- **스택**: 백엔드 Spring Boot 3.5 / Java 21 / MySQL·Redis·Elasticsearch·Kafka·MinIO, 엣지 SCG 게이트웨이. 프론트 React 19 + Vite + TS + Tailwind + react-query.
- **상태**: 스켈레톤(Stage 0~G) + 33개 에픽(회원·인증·OAuth·아이템·경매·입찰·마감정산·화폐·마켓·검색·배송·메모·게시판·댓글·디자인·구조개편) **전건 완료**. 워킹트리 clean.
- **개발 방식**: **1인(사용자) + AI 오케스트레이션**. 메인세션(총괄)이 서브에이전트(architect/backend-impl/frontend-impl/reviewer/portfolio-writer/consultant)를 지휘. 파일 티켓 보드(`docs/board/`) + Jira 미러(KAN).
- **다음 수**: 신규 에픽 선택 대기(유력: **관리자 게시판 CRUD UI**).

---

## 1. 제품 (무엇을·왜)

- **한 줄**: 게임 아이템 거래를 "게임 안 놀이"가 아니라 **믿을 수 있는 거래처에서의 안전한 상거래**로 만든다.
- **사용자**: 게임 아이템을 사고파는 거래 이용자(구매자·판매자 양측 모두 1차). 실제 돈에 준하는 캐시·게임머니로 입찰·즉시구매·등록·정산.
- **포지셔닝**: "마감 폭주에도 밀리지 않는 실시간 신뢰 경매." 마감 직전 동시 입찰이 몰려도 최고가·잔여 시간이 정확·공정하게 보인다는 것이 모든 화면이 강화할 단 하나의 주장.
- **브랜드 톤**: 신뢰·침착·프리미엄. 무신사식 미니멀 커머스 + 마켓컬리 프리미엄 감각(감각만 참조, 자산·hex 미복제). **게임 감성은 아이템 카드라는 단 하나의 "창"에서만** 새어 나온다(이원 구조).
- **금기(anti-pattern)**: 가짜 긴급성·다크패턴·과장 배너 금지. "게임 사이트"처럼 보이기 금지(네온·판타지 크롬). 제네릭 SaaS 룩·퍼플→블루 그라디언트 히어로 금지.
- **접근성**: WCAG 2.1 AA 정본(본문 4.5:1 / 대형·UI 3:1). 색만으로 정보 전달 금지. `:focus-visible` 링, `prefers-reduced-motion` 존중.
- **정본 문서**: `PRODUCT.md`, `DESIGN.md`, `docs/ux/`(design-system·accessibility).

**게임 연동 모델(중요·섹션 12에 상세)**: 장차 finalcall DB가 게임 DB를 대체한다는 방향이나, **실게임 연동은 2026-08-06 사용자 보류**. 현재는 웹 우편함(item_delivery)·임시보관함으로 대체 운영 중.

---

## 2. 아키텍처 & 스택

### 토폴로지
- **모놀리식 단일 서비스**(Spring Boot, 8080) + **SCG(Spring Cloud Gateway) 엣지 게이트웨이**(별도 배포, 8000).
- 게이트웨이 역할 = **rate limit**(Redis 토큰버킷 RequestRateLimiter) · **직접접근 차단**(공유비밀 헤더 `X-Gateway-Token`) · 라우팅.
- **인증은 서비스가 유지**(JWT 자체 검증, SecurityContext). 게이트웨이는 인증 전담 아님, `X-User-Id` 미도입. (근거 D-065/D-068)

### 스택 상세
| 층 | 기술 |
|---|---|
| 언어/런타임 | **Java 21** (Microsoft OpenJDK 21.0.11) |
| 프레임워크 | Spring Boot **3.5.x**, Spring Security, Spring Data JPA, **QueryDSL 5.1.0**(jakarta) |
| 게이트웨이 | Spring Cloud Gateway (WebFlux, Spring Cloud 2025.0.0), Redisson(rate limit) |
| DB | **MySQL 8.0** + **Flyway** 마이그레이션(`db/migration`, `V1`~`V24`대) |
| 캐시/락 | **Redis 7** (Lettuce 캐시 + Redisson 코어 — `@DistributedLock`은 데모용) |
| 검색 | **Elasticsearch** (+ Kafka Connect CDC로 MySQL→ES 동기화, EPIC-SEARCH) |
| 스토리지 | **MinIO**(로컬)/S3(운영) — 이미지 첨부, presigned URL, 비공개 버킷(`infra/storage` StoragePort) |
| 인증 | JWT HS256(RS256 확장 자리 마련), Access 30분. OAuth: 네이버·카카오 |
| 관측성 | Micrometer + Prometheus + Grafana + Loki + Alloy (Stage G, 선택 기동) |
| 회복탄력성 | Resilience4j (CircuitBreaker·Retry) |
| 빌드 | Gradle (Groovy DSL), 멀티모듈 `:backend`·`:backend:gateway` |
| 프론트 | **React 19 + Vite + TypeScript + TailwindCSS + react-query + zustand + react-router** |
| 테스트 | JUnit5 + **Testcontainers**(실 MySQL/Redis 컨테이너, H2 미사용) + ArchUnit. 프론트 Vitest |

### 모노레포 레이아웃 (D-098)
```
finalcall/
├── backend/
│   ├── src/            # 메인 서비스 (com.finalcall.**)
│   ├── gateway/        # SCG 엣지 게이트웨이 (별도 모듈)
│   ├── docker/         # search(ES/Kafka Connect) 인프라
│   ├── observability/  # Prometheus/Grafana/Loki/Alloy
│   └── docker-compose.local.yml / .observability.yml
├── frontend/           # React/Vite SPA
├── config/             # 코드 스타일 정본(Naver checkstyle·formatter·.editorconfig)
├── docs/               # 모든 문서(아래 섹션 8·9·10)
├── CLAUDE.md           # Claude Code 지침(정본 규약)
├── AGENTS.md           # Codex 지침(CLAUDE.md와 동일 골자, 도구명만 다름)
├── PRODUCT.md / DESIGN.md / README.md
└── settings.gradle
```

---

## 3. 백엔드 코드 구조 (feature-first)

**패키지 = feature-first**(EPIC-RESTRUCTURE, 2026-07-25 확정). 최상위를 기술 계층이 아니라 **도메인(feature)** 으로 분할.

```
com.finalcall
├── common/          # 횡단 커널(feature 아님). response, exception(ErrorCode 중앙화), lock, logging, security, util, entity(BaseEntity/BaseTimeEntity)
├── infra/           # 인프라 어댑터(feature 아님). config, redis, security(게이트웨이), storage(MinIO/S3), mail, persistence
├── domain/          # 업무 feature 그룹
│   ├── <feature>/
│   │   ├── controller/   # @RestController, 반환 ApiResponse<T>
│   │   ├── service/      # @Transactional, @ServiceLog, 서비스 내부 계산 VO(record)
│   │   ├── repository/   # findByIdOrThrow default + <E>RepositoryCustom/Impl(QueryDSL)
│   │   ├── entity/       # BaseEntity 상속, @Builder ctor, soft delete, 도메인 메서드
│   │   ├── dto/          # record, Request/Response/CursorResponse<T>
│   │   └── config/       # feature 전용 @ConfigurationProperties
│   └── ... (아래 도메인 목록)
└── support/         # 테스트 지원 등
```
- 349개 Java 파일 / 104개 테스트.
- **feature 목록**: `auth`, `member`, `currency`, `item`, `auction`, `bid`, `settlement`, `shop`, `search`, `delivery`, `memo`, `board`, `mail`, `sample`(스켈레톤 예시).

### 의존 규율 (ArchUnit 기계 강제)
1. **슬라이스 내부 계층방향**: `controller → service → repository → entity`(+`dto`) 단방향. entity/repository는 controller/service 역참조 금지.
2. **커널 무의존**: `common`·`infra`는 어떤 feature도 의존하지 않는다(`common`은 프레임워크 최소 의존·순수 Java 지향).
3. **슬라이스 비순환**: feature 간 top-level 순환 금지.
- 규칙 스펙: `docs/common/proposals/layer-restructure-proposal-v0.1.md`(파일명 v0.1이나 내용 v0.4).

### 주요 도메인 (핵심 로직·결정)
| feature | 내용 | 핵심 결정 |
|---|---|---|
| `auth` | 로그인/가입/refresh/OAuth(네이버·카카오)/닉네임·아이디 라이브 중복확인 | 세션 격리(FC-174 계정전환 오염 수정). 신규 permitAll 경로는 게이트웨이 rate-limit predicate 등재 필수(섹션 12) |
| `member` | 회원 프로필·수정·탈퇴, 재가입 UK | 계약 §2.5 |
| `currency` | 캐시 잔액 원자적 증감 + 캐시↔게임머니 교환 | 계약 §4.4 |
| `item` | item_template·item_instance·인벤토리·소유이력 | 카드 시스템 통합(EPIC-CARD-SYSTEM) |
| `auction` | 경매 등록·목록·상세·판매자취소 + 상태 FSM(진행/마감/유찰) | |
| **`bid`** | **입찰 — 동시성의 핵심** | **auction 행 비관적 락 + 금전 조건부 CAS**(EPIC-BID 게이트2, 2026-07-18). 게임머니 홀드 에스크로 + 소프트클로즈 연장. ⚠️ 스켈레톤의 "Redis @DistributedLock" 서술을 **폐기**(고정 임대·watchdog 부재로 상호배제 깨짐). 근거 `docs/spec/bid-domain-spec.md` |
| `settlement` | 낙찰 후 정산(에스크로), 수수료 | 음수 정산 방지 클램프(FC-176). `docs/spec/fee-policy-spec.md` |
| `shop` | 고정가 마켓 — 즉시 판매·구매·판매관리(내리기) | |
| `search` | 마켓·경매 검색 = **Elasticsearch**(Kafka Connect CDC) | EPIC-SEARCH |
| `delivery` | 게임 아이템 지급 = **웹 우편함 다리**(게임 실연동 보류) | EPIC-ITEM-DELIVERY |
| `memo` | 메모/쪽지(게임 호환 네이티브) | 28바이트 게임 포맷 보존(섹션 12) |
| `board` | **커스텀 게시판**(참조 구현 승계) — 레지스트리·게시글·댓글v2·이미지 | 아래 섹션 참조 |

### 게시판/댓글 시스템 (가장 최근·참조 구현)
- **게시판**: `Board` 레지스트리(slug · write_policy `ADMIN_ONLY`/`AUTHENTICATED` · allow_comments · board_type). 시드 3개(notice·community·event)=Flyway. `Post`·`Comment`·`PostImage`. 이미지=`infra/storage` StoragePort(presigned GET, 비공개 버킷).
- **댓글 v2**: 대댓글 1단계 평탄화(parent=루트 · mentioned_nickname 스냅샷 · @멘션) · `comment_reaction`(유저당 1행 UK · 원자 카운트 · comment FOR UPDATE + 잠금 read 수렴) · 정렬 LATEST(기본)/OLDEST/LIKES · tombstone(답글 보유 루트 마스킹). **BEST 기능은 만들었다가 사용자 요청으로 제거**(정렬 LIKES는 유지).
- **notice 도메인은 board로 흡수·제거**됨(board가 참조 구현 승계). ⚠️ `CLAUDE.md`/`AGENTS.md`에 아직 "notice 참조구현" 잔재 서술이 있으나 board로 대체됨.
- 계약: `docs/spec/{board-domain-spec v1.2, api-contract v1.25, erd v1.9}`.

---

## 4. 프론트엔드 구조

`frontend/src/`:
```
├── app/          # 앱 셸·라우팅
├── pages/        # 라우트 페이지(28개): Home, AuctionList/Detail, Market/Detail,
│                 #   Inventory, Sell, ItemDetail, Compare, Login, Signup, OAuthCallback,
│                 #   Me, Wallet/Charge, Orders, Messages, TempStorage,
│                 #   BoardHub, BoardPostList, PostDetail, PostWrite, NotFound ...
├── features/     # 도메인별: auction, auth, board, delivery, home, item, member, memo, order, shop
│   └── <f>/{components, lib, ...}  # lib에 순수 로직(테스트 대상: bidAmount, auctionPhase, buyNow ...)
├── components/   # brand, common, layout, route(가드)
├── lib/          # api(HTTP 클라이언트), queries(react-query)
├── store/        # zustand
├── constants/ configs/ types/ utils/ auth/ test/
```
- **패턴**: feature 내부 `components`(뷰) + `lib`(순수 로직, `.test.ts` 다수). 페이지는 feature 컴포넌트를 조립.
- **공유 카드 컴포넌트 원칙**(사용자 강한 요구): 반복 UI(카드·카드정보 모달·그리드)는 **정본 공유 컴포넌트 재사용**, 페이지마다 재구현 금지(섹션 12).
- **디자인 정본**: 색 = 실제 shipping `frontend/src/index.css`(**네이비 `#16213a` · 골드 `#c8a028` · 오렌지 `#ef8a2c`**(주 CTA/focus)). ⚠️ 목업 HTML(`docs/ux/mockups/*`)의 **퍼플/블랙은 stale — 복제 금지**(섹션 12 `palette-source-of-truth`).
- **브랜드 자산**: `docs/game_ui/common/`(logo.png/logo2.png/logo_full.png), 게임 아트 941+개.

---

## 5. 데이터베이스

- **Flyway 관리**(`backend/src/main/resources/db/migration`, `V1`~`V24`대). `ddl-auto=validate`(전 프로파일).
- 시간 타입 = **`Instant`(UTC)** 통일, 표현 계층에서 변환.
- ERD 정본: `docs/spec/erd.md`(현재 v1.9).
- **게임 DB 통합 모델**(중요): finalcall DB가 장차 게임 DB(`old_sp`/`new_sp`, MySQL 3306)를 대체하는 방향. `user.nickname` == 게임 계정명. 실연동은 보류 상태. 상세 = 섹션 12 + `docs/spec/proposals/{game-item-delivery,game-claim-phase2,inventory-unification}-*.md`.

---

## 6. 개발 이력 (에픽 타임라인)

821 커밋. 스켈레톤(Stage 0~G) 완료 후 도메인 에픽을 순차 진행. **33개 에픽 전건 done**(2개 superseded).

**대략의 순서**(git log 기준):
1. **스켈레톤 0~G**(2026-07-10~14): 프로젝트·패키지·프로파일·응답/예외·로깅/추적·Actuator·데이터계층·Redis·Resilience4j·JWT·Testcontainers·관측성 + SCG 게이트웨이. (상세 = 섹션 12 stage-progress)
2. **회원/인증**: EPIC-MEMBER, EPIC-FE-MEMBER, EPIC-OAUTH(네이버·카카오), EPIC-EMAIL-VERIFY(+FE), EPIC-EMAIL-TEMPLATE, EPIC-NICKNAME-UX, EPIC-LOGINID-CHECK.
3. **거래 핵심**: EPIC-ITEM, EPIC-AUCTION, **EPIC-BID**(동시성), EPIC-CLOSING(마감·정산), EPIC-CURRENCY, EPIC-PURCHASE, EPIC-SHOP, EPIC-SHOP-MANAGE, EPIC-MARKET-DATA, EPIC-MARKET-QUICKBUY, EPIC-SEARCH.
4. **구조/컨벤션**: EPIC-RESTRUCTURE(feature-first 전환), EPIC-CONVENTION-V2(DTO 어휘·ErrorCode 중앙화·Properties 배치).
5. **프론트/디자인**: EPIC-FE-REBUILD, EPIC-CARD-SYSTEM, EPIC-DESIGN-TEMPLATE, EPIC-FE-AUCTION, EPIC-FE-CARDFLIP. (superseded: EPIC-FE-ECME, EPIC-FE-REDESIGN — 템플릿 접근 폐기)
6. **게임 호환/기타**: EPIC-MEMO, EPIC-ITEM-DELIVERY.
7. **최근**: EPIC-BOARD(게시판), EPIC-COMMENT-V2(네이버식 댓글) + UI 다듬기 라운드(FC-205·213~217).

- 전체 에픽 상태는 `docs/board/epics/EPIC-*.md`의 프론트매터 `state`로 확인.
- 케이스 스터디(포트폴리오): `docs/portfolio/{skeleton,member,fe-member,shop,market-quickbuy,item-delivery,orchestration}.md` + 상시 프로세스 로그 `docs/portfolio/process-log.md`.

---

## 7. 코드 컨벤션 (섹션 5 of CLAUDE.md)

### 물리 배치 (V2)
- 각 클래스는 `com.finalcall.domain.<feature>.<layer>`. `*ErrorCode`는 **`com.finalcall.common.exception`(중앙화)**, feature 전용 `*Properties`는 feature `config/`, 도메인 예외(`*Exception`)만 feature 루트.

### 클래스별 규칙
- **Entity**: `BaseTimeEntity`/`BaseEntity` 상속, `@NoArgsConstructor(PROTECTED)`, 생성자 `@Builder`, **`@Setter` 금지** → 도메인 메서드(`update()`/`delete()`), soft delete(`isDeleted`).
- **Repository**: `findByIdOrThrow(id, ErrorCode)` default 패턴, 커스텀 쿼리는 `<E>RepositoryCustom` + `<E>RepositoryImpl`(QueryDSL).
- **Service**: 클래스 레벨 `@Transactional(readOnly=true)`, 쓰기만 `@Transactional` 오버라이드. `@ServiceLog` 부착, 검증은 `Preconditions.validate(condition, ErrorCode)`. 구조 = 오케스트레이션 `*Service` + 협력 빈(`*Worker`/`*Calculator`/`*Recorder` 등). 서비스 내부 계산 VO(`*Decision`/`*Metrics`)는 `service/`의 record.
- **Controller**: 반환 **항상 `ApiResponse<T>`**(예외: 본문 없는 상태변경은 204 + void). `@Valid`, **try-catch 금지**(전역 핸들러).
- **DTO**: Java `record`. Response는 `@Builder` + `static from(Entity)`. 네이밍 `<도메인><목적>Request/Response`. **허용 접미사 = `Request`·`Response`·`CursorResponse<T>`뿐**(`*View`·`*Detail`·`*Slice` 폐지). `*Command`·`*Result`는 **bid·settlement에서만**.
- **ErrorCode**: 공통 `ErrorCode` 인터페이스 구현 도메인별 enum, 네이밍 `{DOMAIN}_{3자리}`, 위치 `common.exception`.

### 전역 원칙
- **시크릿 fail-fast**: 로컬 `${ENV:기본값}`, 운영 `${ENV}`(기본값 없음 → 누락 시 부팅 실패). **공통 yml 시크릿에 기본값 절대 금지.**
- **AOP self-invocation 주의**: 같은 클래스 내부 호출은 프록시 미경유 → `@Cacheable`/`@DistributedLock`/`@CircuitBreaker`/`@Retry`/`@ServiceLog` 미적용. 외부 빈 통해 호출.
- **설정 바인딩**: `@Value` 대신 `@ConfigurationProperties` + `@Validated`.

### 코드 스타일 (기계 강제)
- 정본: `config/checkstyle/naver-checkstyle-rules.xml`(+suppressions), `.editorconfig`, `config/naver-eclipse-formatter.xml`. 기반 = Naver 핵데이 Java 컨벤션, 들여쓰기 스페이스 4.
- **커밋 전 필수**: `./gradlew :backend:spotlessApply` 후 checkstyle 통과 확인(위반 시 빌드 실패, maxWarnings 0). 게이트웨이는 `./gradlew :backend:gateway:spotlessApply`.

---

## 8. AI 에이전트 오케스트레이션 (개발 운영 방식)

> 정본: `CLAUDE.md` 섹션 8~13. 이 방식이 이 프로젝트의 핵심 운영 모델이다.

### 총괄(메인세션) + 서브에이전트
- **총괄 = 메인세션 자체**(사람 아님·서브에이전트 아님). 위임·게이트 판정·티켓 상태 전이·커밋 제안·Jira 미러 담당. **총괄은 코드를 직접 검증하지 않는다**(빌드·테스트·리뷰는 reviewer에 위임).
- **서브에이전트 6종**(정의: `.claude/agents/*.md`):

| 에이전트 | 트리거 | 권한 |
|---|---|---|
| **architect** | 기능 착수 시 계약/spec 확정(구현 전 필수 선행) | 읽기 + `spec/` 쓰기 |
| **backend-impl** | 계약 확정 후 서버 구현·테스트 | Read/Write/Edit/Bash |
| **frontend-impl** | 계약 확정 후 클라이언트 구현(디자인 흡수) | Read/Write/Edit/Bash |
| **reviewer** | 구현 후 Done 전 필수. 정합성·QA·도메인 인가 최종 판정(**읽기 전용**) | Read/Grep/Glob/Bash |
| **portfolio-writer** | 에픽 완료/사용자 요청 시 케이스 스터디 축적 | 읽기 + `docs/portfolio` 쓰기 |
| **consultant** | **구조적 규약 개정 시에만** 소환(평상시 휴면) | 읽기 + docs 규약 |

- **에이전트 간 직접 통신 금지**. 서브에이전트는 파일 read/write + 메인세션 반환만. **무상태**(모든 상태는 티켓 파일에 영속).

### 워크플로우 (contract-first)
```
architect(계약 확정, 게이트2)
  → [디자인 게이트: 새 화면/주요 UI]
  → backend-impl ∥ frontend-impl  (병렬: 의존 없음 + 쓰기 파일 무교차일 때)
  → reviewer(보안+QA+접근성)
  → Done (reviewer 통과 필수 선행)
  → [portfolio-writer: 에픽 완료 시]
```
- **병행 판정**: "같은 도메인"이 아니라 **"같은 파일"**로 센다(의존 없음 + 쓰기 집합 무교차 → 병렬).

### 게이트 정책
| 게이트 | 발동 | 동작 |
|---|---|---|
| **게이트1**(에픽 승인) | 에픽 착수 | 총괄이 분해안(하위 티켓·의존)을 사용자에 제시 → 승인·조정. 하위는 자동 진행 |
| **게이트2**(스키마/계약/성능) | 스키마·API·성능·되돌리기 큰 결정 | 자동 진행 중에도 멈추고 사용자 상신 |
| **디자인 게이트** | 새 화면·주요 UI 구현 전 | 디자인 방향 제시 → 승인. 단순 수정은 자동 |
| **게이트3**(push+Done) | 에픽 완료 | **push는 사용자 직접**(훅 차단). Done 전이·**커밋도 사용자 승인**(아래) |

### 커밋·push 규약 (★ 메모리 오버라이드 반영)
- ⚠️ **커밋 = 사용자 승인 후**(2026-07-24 사용자 결정). 흐름: 작업 완료 → 총괄이 커밋 메시지(Conventional Commits) + 스테이징 파일 목록 제안 → **사용자 승인** → 커밋. 승인 전엔 워킹트리 변경만.
  - **이것은 `CLAUDE.md`/`AGENTS.md` 섹션 13의 "커밋=자동" 서술을 오버라이드한다**(문서 미갱신 상태, 이 규칙이 정본).
  - 관련 UI가 여러 문서면 **묶어서 한 커밋·한 번 승인**(쪼개기 비선호).
- **push = 에픽 완료 시 사용자 직접 실행**. 에이전트 push 권한 없음(PreToolUse 훅이 `git push` 차단, `git commit`은 통과).
- **커밋 메시지**: `type(scope): 한글 제목`(feat/fix/refactor/docs/test/chore/build). 큰 커밋은 본문 템플릿(목적→세부→수정파일 M/A→검증→범위밖). 상세 = `CLAUDE.md` 섹션 6.

### 보안 층 (경매 에픽부터)
- 커밋 보안 리뷰 = warn-only(비차단). reviewer = 도메인 인가 확인소. 에픽 완료 직전 온디맨드 `/security-review` 1회. push 후 원격 CI(정적분석·의존성). 공통 위협모델 = `.claude/claude-security-guidance.md`.
- end-of-turn 리뷰 기본 off(`ENABLE_STOP_REVIEW=0`).

---

## 9. 티켓/에픽 보드 + Jira 미러

### 파일 티켓 보드 (canonical 진실원)
- 위치: `docs/board/{tickets/(214개), epics/(33개), reviews/}`. **티켓당 파일 1개**(모놀리식 금지 — 병렬 쓰기 충돌 회피).
- 스키마 = YAML 프론트매터(`id`, `type`, `epic`, `jira_key`, `title`, `state`, `owner`, `depends_on`, `blocks`, `gate`, `review_status`, `contract_ref`, `artifacts`) + 본문(목표/DoD/근거인용/검증).
- **상태 머신**(전이 주체 = 메인세션만): `todo → doing → review → done`(critical/major 발견 시 review→doing 재작업, 선행 미충족 시 blocked). `done` 전이 = 게이트3(사용자 승인) + `review_status=passed` 필수.
- 에픽 파일: `type: epic` + `children: [...]`, `state`는 하위 롤업.

### Jira 미러 (사용자 대시보드)
- **파일 → Jira 단방향**. Jira(Atlassian MCP, KAN 프로젝트)는 **사용자 전용 읽기 미러**. 에이전트는 Jira를 읽지 않음(서브에이전트 도구셋에서 Atlassian MCP 제외, **메인세션만** 미러).
- ⚠️ **미러 규율**: 상태 전이 **때마다 즉시** 반영. "비차단"은 실패 허용이지 **생략 허용 아님**. jira_key 없으면 생성 후 프론트매터 기록(불변), 있으면 전이.
- **좌표**: KAN 프로젝트(팀관리형), cloudId `aa1e251d-04f2-43ee-bbe6-4ca5195150ca`. 전이 ID: 21=진행중, 31=검토중, 41=완료. 링크타입 Blocks(depends_on/blocks). 매핑: state→status, owner→라벨 `agent:<owner>`, epic→Jira Epic, gate→라벨 `gate:*`.
- **인수 시 백필**: `state≠todo`인데 `jira_key: null`인 티켓을 스캔해 백필.
- **드리프트 가드**: `git commit` 전 `.claude/hooks/check-mirror-drift.js`가 warn(비차단).

---

## 10. 이중 프로세스 체계 (중요·혼동 주의)

이 레포에는 **두 개의 프로세스 문서 체계**가 병존한다. 목적이 다르다:

1. **오케스트레이션 모드**(`CLAUDE.md` 섹션 8~13) — **현재 실제 개발 운영 방식**. 메인세션 + 서브에이전트. **이것이 코드 작업의 정본.**
2. **역할 기반 체계**(`docs/common/rules.md` + `templates.md`) — 총괄(D)·컨설턴트(C)·기획(P)·백엔드(B)·프론트(F)·QA(Q)·보안(S)·디자인(U) 8역할이 outbox/inbox 파일버스로 소통하는 **더 무거운 조직 시뮬레이션**. 결정 로그(`decision-log.md`)·게이트(G1~G4)·확정 스펙 변경 절차의 근거가 여기 있다. 결정 ID(D-xxx/C-xxx/B-xxx…)는 이 체계 산물.

- **관계**: rules.md의 결정 로그·spec 소유·게이트 개념이 프로젝트의 "왜"를 담고, CLAUDE.md 오케스트레이션이 "지금 어떻게 실행하나"를 담는다. **커밋·단계 진행 충돌 시 CLAUDE.md 섹션 8~13(+ 섹션 12 메모리)이 우선.**
- 새 AI가 Claude Code/Codex가 아니면, rules.md의 무거운 버스 절차를 그대로 흉내 낼 필요는 없다 — **오케스트레이션 모드 + 파일 티켓 보드 + Jira 미러**가 실질 운영 뼈대다.

---

## 11. 하네스 구성 (`.claude/` — Claude Code 전용)

새 AI가 Claude Code면 그대로 동작. 다른 플랫폼이면 아래를 참고해 등가 구현:

- **에이전트 정의**: `.claude/agents/{architect,backend-impl,frontend-impl,reviewer,portfolio-writer,consultant}.md`.
- **훅**(`.claude/settings.json`):
  - PreToolUse(Bash): `block-git-push.js`(git push 차단 — 에픽 완료 시 사용자만), `check-mirror-drift.js`(Jira 미러 드리프트 warn).
  - Stop: `stop-security-review.js`(end-of-turn 보안 리뷰, 기본 off).
- **스킬**(`.claude/skills/`): `coding-discipline`(과설계 방지), `concurrency-review`(동시성/분산락/JWT 체크리스트 + 실무 함정 15건), `jpa-convention`(엔티티·리포·서비스·DTO 패턴), `impeccable`(프론트 디자인 감사·개선 — 방대한 도구셋).
- **보안 가이드**: `.claude/claude-security-guidance.md`(공통 위협모델 체크리스트).
- **Codex용**: 루트 `AGENTS.md`(CLAUDE.md와 골자 동일, 도구명만 Codex로). `.codex/`·`.agents/`도 존재.

---

## 12. ★ 운영 교훈 (원 AI의 자동 메모리 — 레포와 함께 이동하지 않으므로 여기 흡수)

> 이 섹션은 원 작업 AI가 축적한 25개 메모리의 핵심이다. **새 환경에서 이것이 메모리를 대체한다.** 사용자 선호·환경 함정·재발 방지 규칙이 담겨 있다.

### 사용자 협업 선호 (feedback)
- **커밋은 반드시 사용자 승인 후**. 자동 커밋 금지. 커밋 메시지 + 파일 목록 제안 → 승인 → 커밋. (섹션 8 반영)
- **커밋 묶기**: 논리적으로 하나인 작업(문서 여러 개 등)은 쪼개지 말고 **한 커밋으로 묶어 한 번 승인**. 코드는 atomic 유지.
- **모든 답변 끝에 "작업 보고" 섹션**: 한 일 / 산출물·변경(파일·커밋·티켓·Jira) / 상태 / 다음. 대화형 응답에도 최소형.
- **완료 보고 + 백엔드 설계 전달용 보고**: 작업 완료 시 커밋 메시지 + 별도 "설계 전달용 보고"(구조 결정·계약 영향·열린 질문·이월)를 같이. 리뷰/검수 응답도 끝에 "백엔드 설계 전달용 보고" 섹션.
- **게이트2/기술 결정 상신은 평이한 제품 언어로**: 백엔드 전문용어(CAS·비관락·UK·스키마) 금지. 제품/비즈니스 언어 + 구체 숫자 예시. 사용자는 **제품·돈 흐름 결정만** 하고 순수 기술 선택은 architect 추천에 위임. (예: "100만에 팔면 수수료 4만, 판매자 96만. 그 4만이 (A)소멸 (B)운영자")
- **선택지는 HTML 목업으로**: 시각·디자인 선택지는 표·글로 묻지 말고 **HTML 목업을 만들어 보여준 뒤** 고르게 한다(자체완결, 외부 CDN 금지, 실제 콘텐츠). Artifact로 게시.
- **디자인은 목업 먼저**: 새 화면은 실 `frontend/` 코드부터 고치지 말고 목업(HTML) 선제작 → 디자인 게이트 승인 → 실구현. "실구현이 정본" 접근은 사용자가 거부함.
- **사용자 목업은 그대로 구현**: 사용자가 가져온 목업이 정본. 우리 디자인 판단·대안 제시 금지, 실제 오류·이슈만 수정. **단 색은 예외** — 구조/레이아웃/치수는 목업대로, **색은 장터 브랜드 팔레트**(index.css의 navy/gold/orange).
- **반응형은 별도 설계**: 데스크톱을 좁혀 접는 방식 금지. 웹은 웹, 모바일은 모바일에 맞게 정보구조·상호작용을 각각 설계. (예: 경매 상세 모바일은 입찰정보+카드정보 동시 노출 필수.)
- **공유 카드 컴포넌트**: 반복 UI는 정본 공유 컴포넌트 재사용. 페이지마다 재구현 금지("똑같이"가 매번 다르게 나오는 문제 방지). variant/slot으로 흡수, feature 경계 넘는 복제 지양.
- **총괄은 직접 검증 안 함**: 빌드·테스트·코드리뷰는 reviewer에 위임. 총괄은 위임·게이트·전이·커밋·미러만. (단 라이브 수용검증은 총괄이 몬다.)
- **라이브 검증은 멀티계정으로**: 단일 계정 해피패스로 끝내지 말 것. 인증 필요 도메인은 계정 A→B 전환 후 **신원 격리**까지 검증(남의 데이터 안 보이나 / 내 행동이 내 신원으로 기록되나 / 캐시 purge). FC-174 세션 오염 버그가 이걸 안 봐서 발생.
- **하드코딩 비선호**: 수정될 값·환경 종속 값은 `@ConfigurationProperties` + env화. 방식 = IntelliJ EnvFile 플러그인으로 `.env` 주입. **단 dev/prod fail-fast(시크릿 기본값 없음)는 불변**. 목록/중첩 구조(입찰 증분·수수료 구간표)는 yml 유지.

### 프로세스 규율 (feedback)
- **출근/마감**: 사용자 "출근" → `docs/board/HANDOVER.md` 읽고 "다음 수"부터 재개. 마감 지시 → 총괄이 HANDOVER 전면 갱신(덮어씀) + Jira 패리티 전수 검토 + 미push 목록 명시.
- **Jira 미러 규율**: 상태 전이마다 즉시. 비차단=실패 허용이지 생략 아님. 인수 시 백필. (섹션 9)
- **포트폴리오 프로세스 로그**: 개선·트러블슈팅·논의(결정+미결 모두)를 `docs/portfolio/process-log.md`에 상시 축적. 미결(OPEN)은 "채택됨"으로 쓰지 말고 재개 가능하게 근거·다음 절차까지.
- **git mv 선스테이징 누출**: 서브에이전트가 `git mv`로 파일 이동하면 rename이 인덱스에 선-스테이징됨. "문서만" 커밋하면 rename이 딸려가 깨진 커밋. **커밋 직전 `git diff --cached --name-only`로 스테이징 목록 눈으로 확인**. 분리 커밋은 경로 명시.
- **게이트웨이 auth 경로 rate-limit**: 앱은 `INCLUDE_RATE_LIMITER=false`(게이트웨이 전담). 신규 permitAll auth 엔드포인트는 `backend/gateway/src/main/resources/application.yml`의 `auth-rate-limited` 라우트 `Path=` predicate에 등재해야 스로틀됨(안 하면 무제한 노출). **2회 누락 이력** → 신규 permitAll auth 경로 DoD에 "게이트웨이 predicate 등재" 명문화. (2026-07-30 등재: `/auth/login,/signup,/refresh,/nickname/availability,/oauth/**,/login-id/availability`)

### 환경 함정 (reference) — ⚠️ 개발 머신 특성
- **JDK**: `JAVA_HOME` 전역 미설정, `java` PATH 없음. **매번 명시**: `C:\Users\howee\.jdks\ms-21.0.11`(MS OpenJDK 21.0.11). 실행: `$env:JAVA_HOME="C:\Users\howee\.jdks\ms-21.0.11"; .\gradlew.bat build --no-daemon --console=plain`. bash면 `JAVA_HOME=/c/Users/howee/.jdks/ms-21.0.11`.
  - PowerShell에서 native exe(java/gradlew) stderr는 NativeCommandError로 빨갛게 보여도 실패 아님 — 최종 `BUILD SUCCESSFUL`로 판단.
- **Windows Git Bash `python`은 MS Store 스텁** — stdin 스크립트 실행 안 됨, `jq` 미설치. 셸 스크립트는 순수 `curl`+`grep`/`sed`로.
- **`.env` CRLF 함정**: PowerShell `Get-Content`가 CR 섞이면 채워진 키를 놓쳐 "비어있음" 오탐. **검증·로딩은 bash 정본**(`grep -E '^KEY=.+' file | wc -l`). 먼저 정규화 `sed -i 's/\r//g' backend/.env frontend/.env`. gradle 직접 실행 시 빈 값은 export skip(yml 더미 기본값 살려 @NotBlank 부팅 통과). 값 노출 금지(마스킹 `[N자]`).
- **로컬 메일 셋업**(네이버 SMTP): IntelliJ EnvFile "Enable EnvFile" 마스터 체크 필수. `.env` 재시작해야 반영. 값 줄 인라인 주석 금지(535 유발). 네이버 앱 비번은 2단계인증 ON + POP3/SMTP 사용함 전제. 진단: `curl smtps://smtp.naver.com:465`로 235/535 판별. **⚠️ 진범 흔함: 엉뚱한 프로젝트의 Run Configuration에 env 적용** — "설정했는데 안 먹힘"이면 지금 실행 구성이 진짜 그 프로젝트 것인지부터 확인.
- **git push/네트워크 실패 = 소켓 고갈**: `git push`/`curl`이 `getaddrinfo thread failed`, Chrome `ERR_NO_BUFFER_SPACE`(WSAENOBUFS 10055)면 네트워크 다운 아니라 **백엔드 Java의 TCP 연결 누수**(의존성에 연결 안 닫고 재시도 폭주). 해결: 백엔드 프로세스 kill(`Stop-Process -Id <8080 PID> -Force`) → 연결수 급감 → git 정상. push는 IntelliJ Push로 우회 가능. **후속: 백엔드 커넥션 누수 근본수정 필요(미해결 OPEN)**.

### 브랜드/디자인 (project)
- **서비스명 = 장터**(2026-07-20 확정). finalcall은 코드명. 로고 `docs/game_ui/common/`(경매봉+SP 앤빌). 팔레트 네이비 `#16213a`/골드/오렌지 `#ef8a2c`. 종전 퍼플 팔레트(PRODUCT.md·DESIGN.md 잔재)는 무효.
- **색 정본 = shipping `frontend/src/index.css`**(navy/gold/orange). 목업 HTML의 퍼플/블랙은 stale, 복제 금지.
- 주 CTA = 오렌지(과거엔 블랙 논의됐으나 shipping은 오렌지). OAuth(카카오 `#FEE500`/네이버 `#03C75A`)는 외부 브랜드 규격 예외.

### 게임 연동 (project·reference) — 보류 중이나 향후 재개 시 필수
- **finalcall DB가 장차 게임 DB 대체**. 게임 기능은 별도 스키마 원격 연동 말고 **finalcall 네이티브 도메인으로 재구성**(형상 계승, 컬럼 자유, **클라 호환 제약만 정확 보존**).
- **계정 연결**: `user.nickname` == 게임 `usr_name`(게임은 닉네임+비번 로그인 → nickname UK의 진짜 이유). 게임 `char(16)` vs finalcall `VARCHAR(30)` 길이 불일치 정합 필요.
- **서버 재컴파일 가능·클라 수정 불가**. 클라 고정 계약(28바이트 메모 포맷·`char(16)`·`level*100+gender` 패킹)은 DB 제약이 아니라 **boundary 포맷터**로 흡수.
- **메모 28바이트 포맷**: 게임 클라가 본문을 28 게임바이트 폭 줄로 렌더. 바이트 계산(숫자·영문=1, 한글 등=2, 표시폭). 발신 시 4토막 앞 3개를 28바이트 패딩. `memo_level_gender = usr_level×100 + usr_gender`. 컬럼 = `user_memo`(memo_sender/reciever char(16) 등).
- **실게임**: C++ 서버 `D:\private_server\SP\gameserver\...Channel32`, 실접속 DB `old_sp`(3306, root/root). 게임 아이템 테이블 `items`, native 우편함 `itemreceive` 존재. **방향 결정(deep-research)**: 게임 지급은 통합(A) 아니라 **B(게임서버가 유일 writer + 우편함 claim)=업계 표준**(TrinityCore·Steam·PlayFab). **2026-08-06 사용자 보류** — 현행 웹 우편함(item_delivery)·임시보관함 유지. 상세 `docs/research/web-game-inventory-integration-research.md`, `docs/spec/proposals/*`.

---

## 13. 환경·빌드·실행 (런북)

### 실행 방법
```bash
# 1) 로컬 인프라 기동 (Docker Desktop 필요)
docker compose -f backend/docker-compose.local.yml up -d
#    → finalcall-mysql(3306) · redis(6379) · elasticsearch · minio(9000/9001) · kafka
#    (검색용 ES/Kafka Connect는 backend/docker/search/*, MinIO는 이미지 첨부)

# 2) 백엔드 (JAVA_HOME 명시 필수)
#    PowerShell:
$env:JAVA_HOME="C:\Users\howee\.jdks\ms-21.0.11"
.\gradlew.bat :backend:bootRun --args='--spring.profiles.active=local'
#    (env는 backend/.env — CRLF 정규화·빈값 skip 로딩. 섹션 12 env-verify 참고)

# 3) 게이트웨이 (선택, 8000)
.\gradlew.bat :backend:gateway:bootRun

# 4) 프론트 (5173)
npm --prefix frontend run dev

# 테스트 (Testcontainers → Docker 필요)
.\gradlew.bat :backend:test
```

### 포트·계정
- 백엔드 8080 · 프론트 5173 · 게이트웨이 8000 · MySQL 3306 · Redis 6379 · MinIO 9000/9001 · Prometheus 9090 · Grafana 3000.
- 게이트웨이 공유비밀(로컬): `GATEWAY_INTERNAL_SECRET=finalcall-local-gateway-shared-secret-change-me`. 직접 curl 시 `X-Gateway-Token` 헤더 필요.
- **데모 계정**: demo1~demo10 / `demo1234!`. 관리자 테스트는 `is_admin=1` 승격(검증 후 원복). 관리자 = `User.isAdmin` JWT 클레임 · ROLE_ADMIN.

### 프로파일
- `local`(기본, 모든 값 기본값 → env 없이 실행) / `dev`·`prod`(시크릿 `${ENV}` 기본값 없음 → 누락 시 fail-fast).

### 관측성(선택)
- `docker compose -f backend/docker-compose.observability.yml up -d` → Grafana localhost:3000(admin/admin). 앱을 dev 프로파일 JSON 로그로 띄워 `backend/logs/app.log`에 남기면 Alloy가 tail.

---

## 14. 현재 상태 & 다음 수

### Git
- **origin/master = `37089df`**. 로컬 HEAD = `10b0575`(세션 마감 HANDOVER 문서 커밋, **미push** — 코드 아님). 워킹트리 clean.
- 브랜치: master 단일(1인 개발). Dependabot 브랜치 다수(origin). 향후 도메인은 `feature/<도메인>` → PR → Squash 권장.

### 완료 (전건)
- 스켈레톤 0~G + 33개 에픽. 최근 = EPIC-BOARD(게시판) + EPIC-COMMENT-V2(댓글) + UI 라운드(FC-205·213~217, BEST 제거).

### 다음 수 (재개 지점)
1. **⭐ 신규 에픽 선택 → 게이트1**. 유력 후보:
   - **관리자 게시판 CRUD UI**(FC-116 계열): 게시판을 런타임 생성/삭제/설정하는 관리자 화면. EPIC-BOARD가 "시드로만 정의, 관리 UI는 다음 에픽"으로 남긴 부분. 데이터 모델(Board 레지스트리)은 이미 런타임 CRUD 견디게 설계됨. admin 인가 기반 존재 → 진입장벽 낮음.
   - 그 외: 게임 지급 phase-2 재개(보류 중)·다른 경매 도메인·이월 minor.
2. **이월 minor**(비차단): FC-211 반응 연타 가드·정렬 메뉴 키보드 roving focus·본인판정 닉 스냅샷 엣지. FC-194 테스트 위생. 백엔드 커넥션 누수 근본수정(섹션 12).
3. **백엔드 재기동 필요**: 직전 세션에서 FC-217(BEST 제거) 이후 백엔드 미재기동 → 실행 인스턴스에 폐지된 `/comments/best`가 아직 살아있음(프론트 미호출이라 무해). 재기동하면 완전 반영.

### 상세 인수 지점
- `docs/board/HANDOVER.md`(세션 간 상태 스냅샷 — 사용자 "출근" 시 여기부터).
- 미러 패리티: KAN-222~245 done, KAN-220(FC-194) backlog. 드리프트 없음.

---

## 15. 핵심 정본 문서 지도

| 알고 싶은 것 | 파일 |
|---|---|
| 개발 규약·에이전트 운영·게이트·커밋(정본) | `CLAUDE.md`(섹션 8~13 핵심) · `AGENTS.md`(Codex판) |
| 역할 기반 프로세스·결정 로그 근거 | `docs/common/rules.md` · `templates.md` |
| 도메인 규칙·계약·스키마 | `docs/spec/{domain-spec, erd, api-contract}.md` + feature별 `*-domain-spec.md` |
| 제품·디자인·접근성 | `PRODUCT.md` · `DESIGN.md` · `docs/ux/*` |
| 티켓·에픽·리뷰 | `docs/board/{tickets,epics,reviews}/` |
| 세션 인수 스냅샷 | `docs/board/HANDOVER.md` |
| 케이스 스터디·프로세스 로그 | `docs/portfolio/*` |
| 스켈레톤 구축 기록·실무 함정 | `docs/backend/references/spring-skeleton-prompts.md`(부록 C 함정 15건) |
| 구조 재편·컨벤션 근거 | `docs/common/proposals/layer-restructure-proposal-v0.1.md` |
| 게임 연동 연구 | `docs/research/*` · `docs/spec/proposals/*` |

---

## 16. 새 AI를 위한 킥오프 프롬프트

아래를 새 AI 세션의 첫 메시지로 그대로 붙여넣으면 된다(이 문서가 레포 `docs/PROJECT-HANDOFF.md`에 있다는 전제).

```
너는 지금부터 "FinalCall(브랜드명: 장터)" 프로젝트의 개발 총괄(메인세션)을 이어받는다.
게임(Survival Project) 아이템을 등록·경매·입찰·낙찰·정산·거래하는 대규모 트래픽 경매 플랫폼이며,
Spring Boot 3.5 / Java 21 백엔드 + React/Vite 프론트의 모노레포다.

[먼저 읽어라 — 이 순서로]
1. docs/PROJECT-HANDOFF.md  ← 전체 맥락·이력·규칙·환경·운영 교훈의 단일 인수 문서(필독, 특히 섹션 12 운영 교훈)
2. CLAUDE.md 섹션 8~13      ← 에이전트 오케스트레이션·게이트·티켓·커밋 규약(개발 운영 정본)
3. docs/board/HANDOVER.md   ← 직전 세션 상태 스냅샷과 "다음 수"
4. docs/spec/ 의 domain-spec.md · erd.md · api-contract.md ← 도메인 계약 정본
5. git log --oneline -15 와 git status 로 현재 상태 확인

[운영 방식 — 반드시 지킬 것]
- 너는 총괄이다: 위임·게이트 판정·티켓 상태 전이·커밋 제안·Jira 미러만 한다. 코드는 직접
  검증하지 않고(빌드/테스트/리뷰는 reviewer 역할에 위임), 구현은 architect(계약 선확정)→
  backend-impl / frontend-impl(병렬)→reviewer→Done 파이프라인으로 진행한다.
- contract-first: 기능 착수 시 계약/spec을 먼저 확정한 뒤에만 구현을 시작한다.
- 게이트: 에픽 착수 시 분해안을 나에게 제시(게이트1), 스키마·계약·성능·되돌리기 큰 결정은 멈추고
  상신(게이트2), 새 화면/주요 UI는 디자인 방향 승인 후 착수(디자인 게이트), push·Done은 내 승인(게이트3).
- 커밋은 자동으로 하지 마라. 커밋 메시지(Conventional Commits, 한글 제목)와 스테이징 파일 목록을
  제안하고 내 승인을 받은 뒤에만 커밋한다. 관련 문서 변경은 쪼개지 말고 한 커밋으로 묶어라.
- push는 내가 직접 한다(에이전트 금지).

[협업 선호]
- 응답은 한국어. 주석·문서·에러 메시지도 한국어.
- 기술 결정을 나에게 물을 때는 전문용어 대신 평이한 제품 언어 + 구체적 숫자 예시로. 순수 기술
  선택(락 방식 등)은 네가 추천하고 진행하되 이견 있으면 말하라고 해라.
- 시각/디자인 선택지는 표·글이 아니라 HTML 목업을 만들어 보여준 뒤 고르게 하라. 새 화면은 목업 먼저.
- 색은 shipping frontend/src/index.css의 브랜드 팔레트(navy #16213a / gold / orange #ef8a2c)가 정본.
  목업 HTML의 퍼플/블랙은 stale이니 복제하지 마라.
- 반복 UI(카드 등)는 공유 컴포넌트를 재사용하라(페이지마다 재구현 금지).
- 매 응답 끝에 "작업 보고"(한 일 / 변경 / 상태 / 다음)를 붙여라.

[환경 함정 — docs/PROJECT-HANDOFF.md 섹션 12·13 참고]
- JAVA_HOME 전역 미설정. gradle 실행 시 C:\Users\howee\.jdks\ms-21.0.11 명시.
- Windows python은 MS Store 스텁(스크립트는 curl로). .env는 CRLF 정규화 후 bash로 검증.
- git push/네트워크 실패는 백엔드 소켓 누수 신호일 수 있다(백엔드 kill로 해소).

[상태 파악 규율]
- 티켓 보드는 docs/board/(파일이 정본), Jira(KAN)는 사용자 전용 읽기 미러다. 상태 전이 때마다
  Jira 미러를 즉시 반영하되, 미러 실패는 파일 작업을 멈추지 않는다(하지만 생략하지는 마라).

먼저 위 문서들을 읽고, 현재 상태 요약 + 다음 수 후보를 나에게 보고한 뒤 내 지시를 기다려라.
지금은 "관리자 게시판 CRUD UI" 에픽이 유력한 다음 수다.
```

---

*이 문서는 이관 시점 스냅샷이다. 이후 변경은 git 이력과 위 정본 문서들을 따른다.*
