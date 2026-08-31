# FinalCall 7페이지 포트폴리오 제작 브리프 — Codex 앱 전달본

> 목적: Codex 앱이 저장소를 다시 파악해 7페이지 포트폴리오 문서 또는 프레젠테이션을 제작할 수 있도록
> 콘텐츠, 페이지 구성, 근거 경로와 사실성 경계를 한곳에 모은 파생 요약이다. 정본은 코드·`docs/spec/`·
> `docs/board/`·리뷰·Git 이력이다. 작성 기준일은 2026-08-31이다.

## 0. 제작 방향

- **독자**: 백엔드·플랫폼 엔지니어 채용 담당자 또는 기술 면접관.
- **읽기 시간**: 3~5분. 페이지마다 주장 하나, 근거 3~5개만 남긴다.
- **총 7페이지**: 프로젝트 설명 2쪽 + 기능 1쪽 + AI 개발 원칙 1쪽 + 문제·해결 2쪽 + AI 협업 한계 1쪽.
- **핵심 서사**: “AI가 프로젝트를 대신 만들었다”가 아니라, **복잡한 거래 도메인을 AI와 개발하면서도
  정확성의 경계·계약·검증·출시 판단을 사람이 통제하도록 개발체계를 설계했다.**
- **시각 방향**: 기존 OnRace 참고 기록의 검정·민트·카드·큰 타이포 체계를 차용하되 FinalCall 콘텐츠는
  독립적으로 편집한다. 어두운 배경, 민트 포인트 1색, 얇은 회색 선, 큰 숫자와 짧은 문장, 카드형 근거 박스를
  권장한다. 기술 로고 월이나 장식용 아이콘 나열은 피한다.
- **OnRace 자료 상태**: 저장소에는 `docs/backend/references/onrace-reference.md`와 OnRace 디자인을 분석했다는
  FC-391 기록이 있지만, 원본 포트폴리오 PDF/PPTX는 없다. 따라서 원본의 세부 레이아웃을 보았다고 꾸미지 말고,
  정본에 남은 **검정·민트·카드·타이포·페이지 체계**만 시각 힌트로 사용한다.

---

## 1페이지 — 프로젝트와 문제

### 페이지 메시지

**게임 아이템 탐색부터 경매·구매·정산·소통까지, 거래의 전 과정을 하나의 플랫폼으로 연결했습니다.**

### 완성형 콘텐츠 초안

FinalCall은 게임 아이템을 등록하고 경매·입찰·낙찰하거나 고정가로 거래하는 플랫폼입니다. 회원과 잔액,
아이템 인벤토리, 경매와 고정가 마켓, 검색, 정산, 아이템 지급, 쪽지와 1:1 채팅까지 거래 전후의 흐름을
하나의 제품으로 연결했습니다.

이 프로젝트의 핵심 난제는 단순 CRUD가 아니었습니다. 마감 직전 요청이 몰려도 최고가·가용 잔액·홀드·
아이템 소유권이 서로 어긋나지 않아야 했고, 검색과 실시간 메시지는 빠르게 전달하되 거래의 정본을 침범하지
않아야 했습니다.

**나의 역할**은 제품 범위와 우선순위를 정하고, AI 협업 개발체계를 설계하며, 스키마·API·동시성·성능처럼
되돌리기 큰 결정을 승인하고 테스트와 리뷰 결과를 바탕으로 Done과 출시 여부를 판단하는 것이었습니다.

### 하단 요약

- Java 21 · Spring Boot 3.5 · React/TypeScript
- MySQL · Redis · Elasticsearch · Kafka/Debezium
- Spring Cloud Gateway · STOMP WebSocket · Docker/Prometheus/Grafana/Loki
- 핵심 도메인: 회원 · 아이템 · 경매 · 입찰 · 정산 · 마켓 · 검색 · 배송 · 채팅

### 권장 도표/레이아웃

- 좌측 60%: `탐색 → 거래 → 정산 → 지급/소통` 사용자 여정.
- 우측 40%: `Problem / Scope / My Role` 3개 카드.
- 화면 캡처는 필수가 아니다. 제품 여정과 역할을 먼저 이해시키고 기술 스택은 하단 한 줄로 제한한다.

### 근거

- `AGENTS.md` 섹션 1·8~13
- `docs/spec/domain-spec.md` 섹션 2~7
- `docs/spec/api-contract.md`
- `docs/portfolio/README.md`
- `backend/src/main/java/com/finalcall/domain/`, `frontend/src/features/`

---

## 2페이지 — 현재 아키텍처·도메인·ERD

### 페이지 메시지

**정확성이 필요한 거래 경로와, 속도·검색·복구를 담당하는 보조 경로의 책임을 분리했습니다.**

### 완성형 콘텐츠 초안

FinalCall은 Spring Boot 모놀리식 애플리케이션과 별도 배포하는 Spring Cloud Gateway로 구성됩니다. Gateway는
라우팅, Redis 토큰 버킷 기반 rate limit, 공유 비밀을 통한 직접 접근 차단을 담당하고, JWT 인증과 도메인 인가는
애플리케이션이 직접 수행합니다.

업무 코드는 `com.finalcall.domain.<feature>.<layer>`의 feature-first 구조로 배치했습니다. 각 feature 내부는
`controller → service → repository → entity` 단방향을 따르며 DTO는 표현·서비스 계약 경계에 둡니다. 공용 응답,
예외, 보안·Redis·영속성 어댑터는 업무 feature와 분리해 `common`·`infra`에 둡니다. 이 경계는 ArchUnit과
ConventionArchitectureTest로 기계적으로 검사합니다.

데이터 모델의 중심은 `user`·`user_balance`, `item_template`·`item_instance`, `auction`·`bid`·`money_hold`,
`sale_order`·`platform_revenue_ledger`입니다. 하나의 아이템 인스턴스는 경매 또는 고정가 판매에 진입하고,
거래가 끝나면 주문·금전 원장·소유권 이전이 같은 정합성 경계에서 기록됩니다. 채팅은 `chat_room`·
`chat_room_member_state`·`chat_message`·`chat_event_outbox`를 별도 경계로 두어 거래 실패와 분리했습니다.

MySQL은 금전·재고·주문의 진실원입니다. Redis는 캐시와 실시간 fan-out, Elasticsearch는 재구축 가능한 검색
파생 모델, Kafka·Debezium은 outbox 사건의 내구 전달과 복구를 맡습니다. **보조 인프라가 느리거나 실패해도
거래 정합성은 DB 트랜잭션과 CAS가 보장한다**는 원칙을 유지했습니다.

### 권장 아키텍처 도표

```text
React / TypeScript
        │
Spring Cloud Gateway ── Redis rate limit
        │
Spring Boot Application
  ├─ member / item / auction / bid / settlement / shop
  ├─ search / delivery / chat / board / memo
  └─ common + infra
        │
        ├─ MySQL ── 거래·금전·재고 정본
        ├─ Redis ── cache / PubSub fast-path
        ├─ Debezium → Kafka ── outbox 복구·내구 전달
        └─ Elasticsearch ── 검색 파생 모델
```

### 권장 축약 ERD

```text
User 1─1 UserBalance
User 1─N ItemInstance N─1 ItemTemplate
ItemInstance 1─0..1 Auction 1─N Bid N─1 User
Bid 1─1 MoneyHold ── UserBalance
Auction/FixedSale 1─0..1 SaleOrder 1─1 PlatformRevenueLedger
SaleOrder 1─0..1 ItemDelivery

ChatRoom 1─2 ChatRoomMemberState
ChatRoom 1─N ChatMessage 1─1 ChatEventOutbox
```

### 편집 주의

- 전체 ERD를 축소해 붙이지 않는다. 거래 정합성 경로와 채팅 경계를 보여주는 핵심 관계만 다시 그린다.
- `common`·`infra`를 `domain` 아래에 그리지 않는다.
- Redis 분산락을 입찰 정확성 경로에 넣지 않는다. 저장소의 `@DistributedLock`은 스켈레톤 데모 자산이다.

### 근거

- `docs/spec/erd.md`
- `docs/spec/domain-spec.md`
- `docs/common/proposals/layer-restructure-proposal-v0.1.md` — 파일명은 v0.1이지만 내용은 v0.4 DECIDED
- `backend/src/test/java/com/finalcall/architecture/`
- `backend/src/main/java/com/finalcall/domain/`, `common/`, `infra/`
- `docs/spec/chat-domain-spec.md` 섹션 4~7

---

## 3페이지 — 핵심 기능

### 페이지 메시지

**경매 생애주기를 중심으로, 탐색·구매·정산·지급·소통을 실제 제품 흐름으로 완성했습니다.**

### 완성형 콘텐츠 초안

1. **탐색과 검색** — 카테고리·아이템 속성·가격 조건으로 상품을 탐색하고 Elasticsearch 기반 검색과
   카드 정보에서 거래에 필요한 상태를 확인합니다. 홈에서는 신규·마감 임박·검증 판매자라는 근거를 함께
   공개하는 비개인화 추천을 제공합니다.
2. **경매와 입찰** — 출품, 예약 시작, 최고가와 최소 증분 검증, 자기 경매·연속 입찰 방지, 마감 직전
   소프트클로즈, 낙찰·유찰까지 상태를 전이합니다.
3. **고정가 마켓과 즉시구매** — 한정된 재고를 원자적으로 선점하고 경매 즉시구매와 고정가 구매가 공통
   정산 꼬리를 재사용합니다.
4. **정산과 아이템 지급** — 낙찰 홀드를 capture하고 판매자 지급·수수료 원장·소유권 이전·주문을 한
   트랜잭션으로 기록합니다. 게임 지급은 내구 우편함과 멱등 claim 경계로 연결했습니다.
5. **회원과 거래 관리** — 인증, 잔액, 인벤토리, 내 경매·판매·구매 내역, 프로필과 판매자 정보를 제공합니다.
6. **커뮤니케이션** — 비동기 쪽지와 1:1 실시간 채팅, unread·차단·신고·재접속 gap 복구를 구현했습니다.

### 권장 도표/레이아웃

- 중앙의 `아이템`에서 여섯 기능 카드가 뻗는 허브형 레이아웃 또는 `탐색 → 거래 → 정산 → 지급 → 관리/소통`
  가로 여정.
- 화면은 넣지 않는다. 각 기능은 제목 1줄 + 가치 1줄로 제한한다.
- 기능 수치나 공개 사용자 수 대신 구현 범위와 상태 전이를 보여준다.

### 근거

- `docs/portfolio/auction-bid-settlement.md`
- `docs/portfolio/market-quickbuy.md`, `docs/portfolio/shop.md`
- `docs/portfolio/search-cdc.md`, `docs/portfolio/item-delivery.md`
- `docs/portfolio/member.md`, `docs/portfolio/fe-member.md`
- `docs/spec/chat-domain-spec.md`
- `docs/spec/shop-spec.md` 섹션 12, `docs/board/epics/EPIC-HOME-MARKET-RECOMMEND.md`

---

## 4페이지 — AI로 개발하며 중시한 가치와 규칙

### 페이지 메시지

**프롬프트를 잘 쓰는 것보다, AI가 판단을 넘지 못하는 개발 환경을 만드는 데 집중했습니다.**

### 완성형 콘텐츠 초안

FinalCall에서 AI 활용의 목표는 코드 생성량이 아니라 **맥락을 잃지 않고, 책임을 분리하며, 검증 가능한
결과를 반복 생산하는 것**이었습니다.

- **Context Engineering** — `AGENTS.md`, domain spec, ERD, API 계약, 파일 티켓과 HANDOVER에 맥락을
  외부화해 세션과 도구가 바뀌어도 같은 상태를 복원했습니다.
- **Contract First** — architect가 스키마·API·불변식·성능 기준을 먼저 확정한 뒤 backend와 frontend가
  교차하지 않는 파일 범위에서 구현하도록 했습니다.
- **역할과 권한 분리** — `architect → backend/frontend → reviewer`로 책임을 나누고 reviewer는 읽기 전용으로
  두어 코드를 작성한 주체가 스스로 통과 판정을 내리지 않게 했습니다.
- **사람의 승인 게이트** — 에픽 범위, 되돌리기 큰 기술 결정, 디자인, Done과 commit을 사용자가 승인하고
  push는 사용자가 직접 수행하도록 했습니다.
- **기계적 규율** — feature-first 의존 방향, DTO·ErrorCode·Properties 위치, Checkstyle·Spotless, ArchUnit,
  실 DB 동시성 테스트로 문서 규칙이 희망사항에 머물지 않게 했습니다.
- **사실 중심 기록** — 파일 보드를 정본으로 두고 Jira는 단방향 미러로 운영했습니다. 리뷰의 major와 실패한
  성능 기준도 삭제하지 않고 포트폴리오 근거로 남겼습니다.

Claude Code에서 역할별 에이전트와 파일 보드 체계를 시작한 뒤, 같은 정본을 Codex의 `AGENTS.md`와 역할 정의로
이식했습니다. 도구를 교체한 것이 아니라 **도구와 무관하게 재현되는 개발 운영체계**로 발전시킨 과정입니다.

### 권장 도표/레이아웃

```text
사용자: 범위·계약·성능·Done 승인
                    │
architect → backend/frontend → reviewer → 재작업/통과
                    │
      spec + file board + tests + reviews
```

- 상단에 네 키워드: `맥락 외부화 / 계약 우선 / 책임 분리 / 증거 기반 승인`.
- 하단에 Claude Code → 공통 정본 → Codex 이식의 짧은 타임라인.

### 근거

- `AGENTS.md` 섹션 8~13
- `docs/portfolio/ai-development-journey.md`
- `docs/portfolio/orchestration.md`
- `docs/common/rules.md`, `docs/common/templates.md`
- `docs/board/HANDOVER.md`, `docs/board/epics/`, `docs/board/reviews/`
- Git: `fdd88d5b`, `b125456b`, `4fe2e4df`, `0b8455ab`, `92ae82b2`, `839a2d70`

---

## 5페이지 — 문제와 해결 ① 동시 입찰·정산

### 페이지 메시지

**분산락을 정확성 수단에서 제외하고, DB 행 락과 금전 CAS로 경합의 두 축을 분리했습니다.**

### 문제

마감 직전 여러 사용자가 동시에 입찰하면 같은 경매의 최고가 경쟁뿐 아니라, 한 사용자가 서로 다른 경매에
동시에 입찰해 같은 잔액을 중복 사용하려는 경쟁도 발생합니다. 기존 스켈레톤의 Redis 분산락은 고정 lease에
watchdog이 없어 트랜잭션이 lease를 넘으면 상호배제가 깨질 수 있고, Redis 장애가 입찰 전체 중단으로
전파되는 문제가 있었습니다.

낙찰 시에는 홀드 차감, 판매자 지급, 수수료 수익, 아이템 소유권과 주문이 모두 한 번만 반영되어야 합니다.
각 테이블의 값만 맞추는 것으로는 게임머니 총량 보존을 증명할 수 없었습니다.

### 해결

- **경매 축**: 항상 존재하는 `auction` 행을 `PESSIMISTIC_WRITE(FOR UPDATE)`로 잠가 동일 경매의 입찰을
  직렬화하고, 잠금 획득 후 최고가·최소 증분·종료시각을 다시 판정했습니다.
- **금전 축**: `user_balance`의 가용 금액을 조건부 UPDATE하는 CAS로 서로 다른 경매 사이의 중복 지출을
  차단했습니다. 직전 최고입찰 홀드 RELEASE와 신규 홀드 생성도 같은 상위 트랜잭션에 묶었습니다.
- **단일 트랜잭션**: `MoneyHoldService`에 `MANDATORY` 전파를 적용해 입찰 TX 밖에서 금전 변경이 실행되지
  않도록 구조적으로 제한했습니다.
- **멱등 마감**: 마감 워커가 경매 행을 잠근 뒤 최신 `end_at`을 재검증하고 상태 CAS로 SOLD/UNSOLD 전이의
  단일 승자를 만들었습니다.
- **총량 보존**: `낙찰가 = 판매자 정산액 + 수수료`를 강제하고, 수수료를 소멸시키지 않고
  `platform_revenue_ledger`에 기록해 사용자 잔액과 플랫폼 수익을 합친 총량을 검증했습니다.

### 결과와 증거

- EPIC-BID 리뷰: 실 MySQL 기반 12개 클래스 69건 통과, 불변식 I1~I10 직접 검증,
  critical 0·major 0 (`docs/board/reviews/FC-035-review.md`).
- 즉시구매 리뷰에서 잔액 락 순서의 AB-BA 데드락 가능성을 major로 발견했고, `user_id` 오름차순 잠금과
  교차구매·purchase×bid 회귀 테스트로 수정한 뒤 backend 281건 통과
  (`docs/board/reviews/FC-089-090-review.md`, 커밋 `b44aea03`).
- “Redis가 정확성 경계가 아니다”라는 결정을 구현·스펙·테스트가 같은 방향으로 고정했습니다.

### 권장 도표/레이아웃

```text
입찰 TX
Auction FOR UPDATE ── 경매별 순서·최고가 재검증
        │
UserBalance CAS ───── 사용자별 가용 잔액 경쟁 차단
        │
Bid + MoneyHold + soft-close 갱신

마감 TX
Hold CAPTURE → Seller Credit + Fee Ledger → Ownership → SaleOrder
               낙찰가 = 정산액 + 수수료
```

### 근거

- `docs/spec/bid-domain-spec.md` 섹션 4·8·10
- `docs/spec/closing-domain-spec.md` 섹션 3~7
- `docs/spec/fee-policy-spec.md`
- `backend/src/main/java/com/finalcall/domain/bid/service/BidService.java`
- `backend/src/main/java/com/finalcall/domain/currency/service/MoneyHoldService.java`
- `backend/src/main/java/com/finalcall/domain/settlement/service/CloseService.java`
- `backend/src/main/java/com/finalcall/domain/settlement/service/SettlementRecorder.java`

---

## 6페이지 — 문제와 해결 ② 실시간 채팅의 정확성과 출시 기준

### 페이지 메시지

**빠른 전달과 유실 복구를 함께 구현했지만, 목표 burst를 통과하지 못한 기능은 출시 완료로 선언하지 않았습니다.**

### 문제

Redis Pub/Sub만 사용하면 빠르지만 구독 노드 장애나 연결 공백에서 메시지가 유실될 수 있습니다. 반대로 모든
전달을 동기 DB·Kafka 경로에 묶으면 응답 지연과 가용성 결합이 커집니다. 메시지 순서, 중복 요청의 멱등성,
읽음 위치, 차단·신고 인가를 유지하면서 멀티 인스턴스 fan-out과 재접속 복구를 함께 설계해야 했습니다.

또한 기능 테스트가 통과해도 목표 부하에서 DB connection pool이 포화되면 출시 가능한 실시간 기능이라고
말할 수 없었습니다.

### 해결

- 메시지와 metadata-only `chat_event_outbox`를 **같은 MySQL 트랜잭션**에 기록하고 DB의 room sequence를
  권위 있는 순서로 사용했습니다.
- 커밋 이후 Redis Pub/Sub → STOMP를 **fast-path**로 사용해 낮은 지연을 확보했습니다. 이 경로의 실패는
  메시지 저장 실패로 역전하지 않습니다.
- Debezium이 outbox 변경을 Kafka로 전달해 fast-path 유실을 재전파하고, 클라이언트는 마지막 sequence 이후
  gap 조회로 최종 수렴합니다.
- `clientMessageId` 멱등, room membership·차단 상태의 DB 재검증, unread cursor를 계약과 테스트로 고정했습니다.
- 성능 병목을 숨기지 않고 send 응답의 후속 사용자 조회를 제거하고 connection pool·timeout을 조정했지만,
  사전에 정한 종료선은 그대로 유지했습니다.

### 결과와 정직한 판정

- 채팅 기능·복구 경로와 전역 unread 수렴은 구현됐습니다.
- 저장소 기록상 300 req/s 지속 부하는 통과했지만 1,000 req/s burst 목표는 실패했습니다.
- 따라서 **기능 구현 완료와 운영 출시 판정을 분리해 `RELEASE BLOCKED`로 기록**했습니다. 이 사례의 성과는
  실패를 성공처럼 포장한 것이 아니라, AI가 만든 기능에도 사전 SLO와 중단 기준을 적용했다는 점입니다.

### 권장 도표/레이아웃

```text
POST message
   └─ MySQL: message + outbox commit
          ├─ Redis Pub/Sub → STOMP        빠른 경로
          └─ Debezium → Kafka → fan-out   복구 경로
Client reconnect → afterSequence gap query

검증: 300 req/s 지속 PASS │ 1,000 req/s burst FAIL │ RELEASE BLOCKED
```

### 근거

- `docs/spec/chat-domain-spec.md` 섹션 4·6·7·10·11·14~17
- `docs/board/tickets/FC-318.md`, `FC-321.md`, `FC-329.md`
- `docs/portfolio/portfolio-outline.md` 6페이지 감사 메모
- `backend/src/main/java/com/finalcall/domain/chat/`
- `frontend/src/features/chat/`
- 관련 최신 수정: `cba05829`, `2b6a9e27`, `c0d36bdd`, `cd54cd6c`

---

## 7페이지 — AI 협업의 한계와 내가 유지한 책임

### 페이지 메시지

**AI는 속도를 높였지만, 맥락·자기검증·실환경·책임의 한계를 없애지는 못했습니다.**

### 완성형 콘텐츠 초안

1. **긴 맥락은 자동으로 보존되지 않는다.** 세션이 바뀌면 결정 이유와 진행 상태가 사라지고, Jira 미러가
   파일 보드와 조용히 갈라진 사례도 있었습니다. 그래서 spec·티켓·리뷰·HANDOVER를 공통 기억으로 만들고,
   미러 누락을 경고하는 훅과 인수 시 패리티 점검을 추가했습니다.
2. **코드를 작성한 AI의 자기검증은 충분하지 않다.** 구현 테스트가 모두 green이어도 reviewer가 즉시구매의
   잔액 락 순서에서 교차거래 데드락 표면을 major로 발견했습니다. 읽기 전용의 신선한 reviewer와 실제 경합
   테스트를 분리한 이유입니다.
3. **문서 규칙은 자동으로 코드가 되지 않는다.** feature-first, DTO·ErrorCode·Properties 위치, 스타일을
   ArchUnit·ConventionArchitectureTest·Checkstyle·Spotless로 옮겨야 세션마다 다른 해석을 막을 수 있었습니다.
4. **실환경 검증은 대체할 수 없다.** 정적 리뷰와 단위 테스트만으로 채팅 burst, CDC connector, Redis/Kafka
   장애 경로를 증명할 수 없습니다. Docker 기반 통합·부하·장애 테스트를 별도로 실행하고 실패한 출시 기준은
   blocked로 남겼습니다.
5. **최종 책임은 사람에게 남는다.** AI가 대안을 만들고 구현·리뷰를 수행해도 제품 범위, 스키마·동시성·성능
   결정, 위험 수용, Done·commit·push는 사람이 승인했습니다.

### 마무리 문장

**FinalCall을 통해 증명한 것은 AI 사용량이 아니라, AI의 생성 속도를 계약·검증·사람의 판단으로 제어해
복잡한 거래 시스템을 끝까지 설명하고 책임지는 엔지니어링 역량입니다.**

### 권장 도표/레이아웃

- 좌측: `한계 → 대응` 5행 표.
- 우측: 사용자 승인 게이트가 둘러싼 AI 파이프라인.
- 마지막 한 문장을 큰 민트 타이포로 배치한다.

### 근거

- `docs/portfolio/process-log.md` 항목 1·2
- `docs/portfolio/orchestration.md`
- `docs/board/reviews/FC-089-090-review.md`
- `docs/spec/chat-domain-spec.md` 섹션 14~17
- `.codex/hooks/check-mirror-drift.js`, `docs/board/HANDOVER.md`
- `AGENTS.md` 섹션 10~13

---

## 정본 읽기 우선순위와 주장별 경로

Codex 앱은 아래 순서로 읽는다. 하위 문서가 상위 정본과 충돌하면 상위 정본과 실제 코드를 우선한다.

### 1순위 — 현재 규칙과 상태

1. `AGENTS.md` — 프로젝트 구조, 도메인 컨벤션, AI 오케스트레이션·게이트·커밋 규율.
2. `docs/portfolio/README.md` — 도시에 인덱스와 완료/진행 상태 감사 메모.
3. `docs/board/HANDOVER.md` — 현재 세션·배포·진행 작업 상태.
4. `docs/board/epics/EPIC-PORTFOLIO-BUILD.md`, `docs/board/tickets/FC-391.md` — 기존 포트폴리오 제작 상태.

### 2순위 — 아키텍처·도메인·ERD

1. `docs/spec/domain-spec.md`
2. `docs/spec/erd.md`
3. `docs/spec/api-contract.md`
4. `docs/common/proposals/layer-restructure-proposal-v0.1.md`
5. 실제 패키지: `backend/src/main/java/com/finalcall/{domain,common,infra}/`

### 3순위 — 대표 기술 판단

| 주장 | 우선 근거 |
|---|---|
| 분산락 배제, auction 행 락+금전 CAS | `docs/spec/bid-domain-spec.md`, `docs/board/reviews/FC-035-review.md` |
| 멱등 마감·정산·총량 보존 | `docs/spec/closing-domain-spec.md`, `fee-policy-spec.md`, `auction-bid-settlement.md` |
| 즉시구매 락 순서 major와 재작업 | `docs/board/reviews/FC-089-090-review.md` |
| 채팅 fast-path+outbox 복구 | `docs/spec/chat-domain-spec.md` 섹션 4·7·11 |
| 채팅 성능·출시 보류 | `docs/spec/chat-domain-spec.md` 섹션 14~17, `portfolio-outline.md` 6페이지 |
| AI 역할·사용자 게이트 | `AGENTS.md` 섹션 8~13, `orchestration.md` |
| Jira 드리프트와 보안층 개선 | `docs/portfolio/process-log.md` |

### 4순위 — 실제 코드·테스트·Git

- 입찰: `backend/src/main/java/com/finalcall/domain/bid/`, 관련 integration test.
- 정산: `backend/src/main/java/com/finalcall/domain/settlement/`.
- 채팅: `backend/src/main/java/com/finalcall/domain/chat/`, `frontend/src/features/chat/`.
- 구조 검사: `backend/src/test/java/com/finalcall/architecture/`.
- 커밋은 문서에 적힌 짧은 해시를 `git show <hash>`로 확인한 뒤 인용한다.

---

## 과장·위조 방지와 현재 상태 주의사항

- **공개 운영 성과를 주장하지 않는다.** 실제 사용자 수, 매출, 운영 트래픽, 장애율, 비용 절감 수치가 없다.
- 테스트 개수는 각 리뷰 시점의 선택 실행 또는 해당 에픽 회귀 수치다. 현재 저장소 전체 테스트 총계처럼 쓰지 않는다.
- 채팅은 기능과 복구 경로가 구현됐지만 기록상 `1,000 req/s burst`가 실패했다. “대규모 트래픽 검증 완료”,
  “운영 출시 완료”로 표현하지 않는다.
- 아이템 지급은 1단계 우편함·claim 경계까지 구현됐다. 게임 서버 실이식 phase-2는 미구현이다.
- Redis `@DistributedLock`은 스켈레톤 데모다. 입찰 정확성 보장에 사용했다고 쓰지 않는다.
- Elasticsearch와 Kafka/Debezium은 파생 검색·복구 경로다. 금전·재고의 정본으로 표현하지 않는다.
- OnRace 원본 포트폴리오 파일은 현재 저장소에 없다. 검정·민트·카드·타이포라는 보드 기록 이상으로
  구체적인 디자인을 “재현했다”고 단정하지 않는다.
- AI 도구별 코드 기여 비율을 산정하지 않는다. Git 작성자만으로 Claude Code/Codex의 개별 산출을 판정할 수 없다.
- “AI가 전 과정을 자율 수행”이라고 쓰지 않는다. 사용자가 게이트2, 디자인, Done, commit을 승인하고 push를
  직접 수행한다.
- `EPIC-PORTFOLIO-BUILD`는 작성 기준일에 `doing`, FC-391은 `review/pending`이다. 기존 PPTX/PDF가 최종
  검수 완료됐다고 쓰지 않는다.
- 홈 “오늘의 추천 마켓”은 게이트3 Done 완료 기능이다. 다만 행동 기반 개인화·인기순·가격 매력 추천은
  범위 밖이며 신규·마감 임박·검증 판매자라는 공개 근거만 사용한다.
- 경로 또는 상태가 달라졌다면 Codex 앱은 `docs/board/HANDOVER.md`와 해당 epic/ticket의 최신 frontmatter를
  다시 확인한다.

---

## Codex 앱에 넣을 최종 제작 요청 프롬프트

아래 블록을 그대로 복사해 사용한다.

```text
FinalCall 저장소를 근거로 한국어 7페이지 포트폴리오를 제작해 주세요.

가장 먼저 다음 파일을 읽고 사실과 현재 상태를 확인하세요.
1) AGENTS.md
2) docs/portfolio/codex-app-portfolio-production-brief.md
3) docs/portfolio/README.md
4) docs/board/HANDOVER.md
5) docs/spec/domain-spec.md, erd.md, api-contract.md
6) docs/spec/bid-domain-spec.md, closing-domain-spec.md, chat-domain-spec.md
7) docs/board/reviews/FC-035-review.md, FC-089-090-review.md
8) 실제 backend/frontend 코드와 관련 테스트

총 7페이지 구성은 고정합니다.
- 1~2쪽: 프로젝트 문제·범위·현재 아키텍처·도메인·축약 ERD
- 3쪽: 핵심 기능 소개. 화면 이미지는 넣지 않습니다.
- 4쪽: AI 개발에서 중시한 가치, 세운 규칙, 발전 방향
- 5쪽: 문제/해결 ① Redis 분산락 배제 → auction 행 비관적 락+금전 CAS,
  멱등 마감·정산·게임머니 총량 보존
- 6쪽: 문제/해결 ② 채팅의 Redis fast-path+DB outbox/Kafka 복구와
  1,000 req/s burst 실패에 따른 RELEASE BLOCKED 판정
- 7쪽: AI 협업의 한계와 사람에게 남긴 책임

독자가 3~5분 안에 구조와 기술적 판단을 이해하도록 페이지마다 주장 하나만 남기고,
긴 문단보다 도표·흐름·짧은 근거 카드를 사용하세요. OnRace 참고 기록의 검정·민트·카드·큰 타이포를
시각 힌트로 삼되 원본 PDF/PPTX가 저장소에 없으므로 세부 디자인을 보았거나 완전히 재현했다고 꾸미지 마세요.

기술 로고를 나열하지 말고 각 기술의 책임을 표시하세요. MySQL은 거래 정본, Redis는 cache/PubSub,
Elasticsearch는 검색 파생 모델, Kafka/Debezium은 outbox 복구라는 경계를 명확히 표현하세요.
전체 ERD를 축소해 붙이지 말고 User/UserBalance, ItemInstance, Auction/Bid/MoneyHold,
SaleOrder/PlatformRevenueLedger, ChatRoom/Message/Outbox 중심의 축약 ERD를 다시 그리세요.

과장하지 마세요. 공개 운영 사용자·매출·트래픽은 주장하지 않고, 에픽별 테스트 수를 전체 테스트 수로
표현하지 마세요. 채팅은 기능 구현과 300 req/s 지속 통과까지만 쓰고 1,000 req/s burst 실패 및
RELEASE BLOCKED를 반드시 함께 표시하세요. 아이템 지급의 게임 서버 실이식 phase-2는 미구현입니다.
Redis 분산락을 입찰 정확성 수단으로 쓰지 않았습니다. 홈 추천은 완료 기능이며 신규·마감 임박·검증 판매자라는
근거가 공개되는 비개인화 추천으로만 표현하세요. 행동 기반 개인화·인기순·가격 매력 추천으로 확장해 쓰지 마세요.

핵심 관점은 “AI가 대신 개발했다”가 아니라 “AI가 복잡한 거래 도메인을 안전하게 구현하도록
맥락·계약·역할·검증 체계를 설계했고, 스키마·동시성·성능·Done의 최종 판단은 사람이 맡았다”입니다.

먼저 페이지별 제목, 핵심 문장, 본문, 도표 설명, 각 주장에 대응하는 저장소 근거 경로를 제시한 뒤
최종 문서를 제작하세요. 근거가 충돌하거나 현재 상태가 불명확하면 구현 완료라고 추정하지 말고
해당 보드/spec/코드를 다시 확인해 “진행 중” 또는 “검증되지 않음”으로 표기하세요.
```

## 인도 전 최종 체크리스트

- [ ] 정확히 7페이지인가.
- [ ] 첫 2페이지에서 제품 문제, 역할, 아키텍처와 축약 ERD가 이해되는가.
- [ ] 기능 소개가 화면 없이 1페이지에 끝나는가.
- [ ] AI 페이지가 도구 자랑이 아니라 맥락·계약·검증·책임을 설명하는가.
- [ ] 문제/해결 두 페이지에 선택 이유, 기각한 대안, 테스트/리뷰 증거가 있는가.
- [ ] 채팅의 RELEASE BLOCKED와 phase-2 미구현을 숨기지 않았는가.
- [ ] 모든 숫자와 상태가 경로 또는 리뷰에 연결되는가.
- [ ] OnRace 시각 언어를 참고했지만 원본을 보았다고 위조하지 않았는가.
- [ ] 마지막 페이지가 AI 한계를 말하면서도 사용자의 구체적인 통제·판단을 증명하는가.
