# FinalCall 포트폴리오 콘텐츠 설계서 (10페이지)

> PPT 제작 전 이야기와 주장을 확정하는 원고다. 큰 구분은 `INTRODUCTION → PROJECT → AI COLLABORATION → CONCLUSION`만 사용한다.
> 핵심 서사: AI가 코드를 대신 쓴 이야기가 아니라, AI가 복잡한 거래 도메인을 안전하게 구현하도록 맥락·역할·검증 체계를 설계하고 기술 결정과 출시 책임은 사람이 맡은 이야기다.

| 구분 | 페이지 | 독자가 얻어야 할 답 |
|---|---:|---|
| INTRODUCTION | 1~2 | 무엇을 왜 만들었고, 본인은 무엇을 책임졌는가? |
| PROJECT | 3~6 | 어떤 구조와 기술로 어떤 제품 기능을 구현했는가? |
| AI COLLABORATION | 7~9 | AI를 어떻게 활용·통제했고 어떤 판단을 직접 내렸는가? |
| CONCLUSION | 10 | 이 프로젝트가 증명한 역량과 한계는 무엇인가? |

---

## 1. INTRODUCTION — 표지

- **슬라이드 제목**: `FINALCALL`
- **목적**: 프로젝트 정체성과 포트폴리오의 관점을 한 문장으로 고정한다.
- **핵심 한 문장**: 역할별 AI 에이전트와 함께 기획부터 검증까지 운영한 게임 아이템 거래 플랫폼.
- **본문 카피**: `AI-ASSISTED ENGINEERING CASE STUDY` / `게임 아이템 경매·마켓·커뮤니케이션 플랫폼` / `AI의 생성 속도 위에 계약·검증·사람의 판단을 더했습니다.`
- **시각 자료**: 대표 경매 또는 아이템 상세 화면 1개. 기술 로고나 역할 흐름은 넣지 않는다.
- **전환 문장**: 먼저 FinalCall이 어떤 문제와 범위를 가진 프로젝트인지 설명한다.
- **근거 파일**: `AGENTS.md` §1·§8~13, `docs/portfolio/ai-development-journey.md`, `frontend/src/`.
- **삭제/통합 대상**: 역할 화살표·기술 키워드·성과 수치는 삭제하고 AI 조직 설명은 7페이지로 통합한다.

## 2. INTRODUCTION — 프로젝트 개요

- **슬라이드 제목**: `거래의 전 과정을 하나의 제품으로 연결했습니다`
- **목적**: 아키텍처나 AI 이야기 전에 제품 문제·범위·본인 역할을 이해시킨다.
- **핵심 한 문장**: 아이템 탐색부터 경매·구매·정산·사용자 소통까지 연결하고, 마감 직전 동시성과 실시간 전달을 핵심 난제로 삼았다.
- **본문 카피**:
  - **Problem**: 입찰 폭주에서도 최고가·잔액·아이템 소유권이 어긋나지 않아야 한다.
  - **Scope**: 회원, 검색, 경매·입찰·정산, 고정가 마켓, 마이페이지, 쪽지, 1:1 채팅.
  - **My Role**: 제품 범위와 우선순위, AI 개발체계, 스키마·동시성·성능 결정, 검증과 출시 판단.
  - **Positioning**: `AI 협업 개발체계를 설계하고 기술 결정과 품질 책임을 수행한 백엔드 개발자`.
- **시각 자료**: `탐색 → 거래 → 정산 → 소통` 사용자 여정. 하단에는 역할·프로젝트 성격만 짧게 표시한다.
- **전환 문장**: 이 사용자 여정을 지탱하기 위해 정본·실시간·검색·관측의 역할을 분리했다.
- **근거 파일**: `AGENTS.md` §1, `docs/spec/api-contract.md`, `docs/portfolio/auction-bid-settlement.md`, `docs/portfolio/market-quickbuy.md`, `docs/board/tickets/FC-374.md`.
- **삭제/통합 대상**: 별도 목차 페이지는 만들지 않는다. 공개 운영 사용자·운영 트래픽은 쓰지 않는다.

## 3. PROJECT — 시스템 아키텍처와 기술 스택

- **슬라이드 제목**: `정확성의 경계와 실시간 경로를 분리했습니다`
- **목적**: 뒤의 기능 세 페이지를 이해할 기술 지도를 먼저 제공한다.
- **핵심 한 문장**: MySQL을 거래 정본으로 두고 Redis는 저지연 전달, Kafka·Debezium은 내구 복구, Elasticsearch는 검색용 파생 모델로 역할을 제한했다.
- **본문 카피**:
  - **Client**: React · TypeScript · Vite
  - **Edge**: Spring Cloud Gateway — 라우팅·Redis rate limit·직접 접근 차단
  - **Application**: Java 21 · Spring Boot · Spring Security · JPA · QueryDSL
  - **Data**: MySQL — 거래 정본·트랜잭션·행 락 / Redis — 캐시·Pub/Sub·토큰 버킷
  - **Search & Event**: Elasticsearch · Kafka · Debezium — 파생 검색 모델과 outbox 복구
  - **Realtime & Ops**: STOMP WebSocket · Docker · Prometheus · Grafana · Loki
  - 원칙: `금전·재고 정합성은 DB가 보장하고, 보조 인프라 장애가 거래 정확성을 깨뜨리지 않게 설계`.
- **시각 자료**: `React → Gateway → Spring Boot → MySQL` 주 경로와 Redis·ES·Kafka/Debezium 보조 경로를 한 장에 표현한다. 로고보다 역할 라벨을 우선한다.
- **전환 문장**: 이 구조에서 가장 높은 정확성이 필요한 첫 번째 기능은 실시간 경매였다.
- **근거 파일**: `AGENTS.md` §1·§3, `docs/spec/bid-domain-spec.md` §8, `docs/spec/search-spec.md`, `docs/spec/chat-domain-spec.md` §4·§7, `backend/docker-compose.local.yml`.
- **삭제/통합 대상**: 기술별 독립 페이지·로고 월·검색 CDC 장애 상세는 삭제한다. 기술 판단의 깊이는 9페이지에 둔다.

## 4. PROJECT — 구현 기능 1: 경매

- **슬라이드 제목**: `경매의 시작부터 정산까지 한 번만 전이되게 만들었습니다`
- **목적**: 대표 기능과 핵심 백엔드 난제를 한 페이지에서 보여준다.
- **핵심 한 문장**: 동시 입찰, 즉시구매, 소프트클로즈, 자동 마감과 정산을 하나의 경매 생애주기로 연결했다.
- **본문 카피**:
  - 아이템 출품과 `SCHEDULED → ACTIVE → SOLD / UNSOLD` 상태 전이
  - 최고가·최소 증분·자기 경매·연속 입찰을 잠금 이후 재검증
  - 마감 직전 유효 입찰의 종료시간 연장과 최대 연장 상한
  - 낙찰 홀드 capture, 판매자 지급, 수수료 원장, 아이템 소유권 이전
  - 즉시구매와 자동 마감이 공통 정산 로직 재사용
- **시각 자료**: 좌측 실제 화면, 우측 `출품 → 입찰 → 소프트클로즈 → SOLD/UNSOLD → 정산` 흐름. 락 상세는 최소화한다.
- **전환 문장**: 같은 아이템 거래를 더 짧은 경로로 제공하기 위해 고정가 마켓과 자산 관리를 연결했다.
- **근거 파일**: `docs/portfolio/auction-bid-settlement.md`, `docs/spec/auction-domain-spec.md`, `docs/spec/bid-domain-spec.md`, `backend/src/main/java/com/finalcall/domain/bid/service/BidService.java`, `backend/src/main/java/com/finalcall/domain/settlement/service/CloseService.java`.
- **삭제/통합 대상**: 입찰·분산락·마감·정산의 독립 페이지를 만들지 않는다. DB 락+CAS 이유는 9페이지로 이동한다.

## 5. PROJECT — 구현 기능 2: 마켓과 마이페이지

- **슬라이드 제목**: `구매 전환과 거래 이후의 관리를 한 흐름으로 묶었습니다`
- **목적**: 경매 외 제품 범위와 프론트·백엔드 연결 완성도를 보여준다.
- **핵심 한 문장**: 고정가 상품을 탐색·구매하고, 마이페이지에서 프로필·잔액·보유 아이템·판매 상태를 관리하도록 연결했다.
- **본문 카피**:
  - **Market**: 목록·검색·카드정보 모달·즉시구매·판매자 거래횟수
  - **Purchase Safety**: 구매·정산 계약 재사용, 판매자별 집계를 페이지당 배치 1쿼리로 제한
  - **MyPage**: 프로필·닉네임, 잔액, 인벤토리, 내 판매·거래 상태
  - **Account Safety**: `/me` 주체는 SecurityContext에서 얻고 탈퇴 시 refresh 세션 폐기
- **시각 자료**: 마켓 카드정보 모달과 마이페이지/인벤토리 화면 2분할. `상품 선택 → 구매 → 보유/판매 관리`를 캡션으로 연결한다.
- **전환 문장**: 거래 이후에도 문의와 대화가 이어지도록 두 가지 소통 방식을 구현했다.
- **근거 파일**: `docs/portfolio/market-quickbuy.md`, `docs/portfolio/member.md`, `docs/spec/shop-spec.md`, `docs/spec/api-contract.md` §2.5, `frontend/src/features/shop/`, `frontend/src/features/member/`.
- **삭제/통합 대상**: N+1·카드 UI 계약·회원 보안은 독립 페이지로 만들지 않고 이 페이지의 보조 근거로 둔다.

## 6. PROJECT — 구현 기능 3: 쪽지와 실시간 채팅

- **슬라이드 제목**: `저장형 쪽지와 복구 가능한 실시간 채팅을 함께 구현했습니다`
- **목적**: 성격이 다른 두 소통 기능과 채팅의 정직한 출시 상태를 보여준다.
- **핵심 한 문장**: 쪽지는 비동기 보관형 메시지로, 채팅은 STOMP 실시간 전달과 DB 재조회·outbox 복구를 갖춘 1:1 대화로 구현했다.
- **본문 카피**:
  - **쪽지**: 발신·수신, 읽음, 사용자별 보관·삭제
  - **채팅**: 1:1 방, sequence, unread, 차단·신고, 재접속 gap 조회
  - **전달**: 커밋 후 Redis Pub/Sub fast-path → STOMP push
  - **복구**: message와 metadata-only outbox를 한 DB TX에 저장 → Debezium·Kafka 재전파
  - **상태**: `기능·복구 경로 구현 / 300 req/s 지속 통과 / 1,000 req/s burst 실패로 RELEASE BLOCKED`
- **시각 자료**: 쪽지 목록, 채팅 화면, 작은 `DB commit → Redis fast-path / outbox → Kafka recovery` 흐름. 실패 상태를 별도 배지로 표시한다.
- **전환 문장**: 이 범위를 AI와 일관되게 완성하려면 프롬프트보다 먼저 협업 방식 자체를 설계해야 했다.
- **근거 파일**: `docs/spec/chat-domain-spec.md` §4·§7·§11·§14, `docs/board/tickets/FC-318.md`, `FC-321.md`, `FC-329.md`, `FC-374.md`, `frontend/src/features/chat/`.
- **삭제/통합 대상**: 채팅 구조와 성능 검증을 분리하지 않는다. 출시 완료·운영 배포로 표현하지 않는다.

## 7. AI COLLABORATION — 나의 AI 활용 역량

- **슬라이드 제목**: `AI에게 일을 맡긴 것이 아니라, 협업 가능한 개발 환경을 설계했습니다`
- **목적**: 도구 사용법이 아니라 재사용 가능한 AI 활용 능력을 네 축으로 제시한다.
- **핵심 한 문장**: 맥락을 외부화하고 역할과 의존관계를 설계하며, 검증 장치를 두고 최종 기술 판단은 직접 수행했다.
- **본문 카피**:
  - **Context Engineering** — spec·ERD·API 계약·파일 티켓·HANDOVER를 공통 기억으로 만들어 세션과 도구가 바뀌어도 상태를 복원했다.
  - **Workflow Orchestration** — 에픽·티켓으로 분해하고 `architect → backend/frontend → reviewer`의 책임·권한·파일 경계를 설계했다.
  - **Guardrails & Verification** — 레이어 규칙, ArchUnit·테스트, 읽기 전용 reviewer, 사람의 승인 게이트로 범위 이탈과 자기검증 편향을 제어했다.
  - **Engineering Judgment** — AI 결과를 실측·실패 모델로 비교하고 스키마·동시성·성능·Done을 직접 결정했다.
- **시각 자료**: 네 역량 카드와 중앙의 `기획 → 계약 → 구현 → 리뷰 → 승인` 한 줄. Claude Code·Codex는 작은 도구 라벨로만 표시한다.
- **전환 문장**: 이 체계는 AI의 반복 한계에 대응하도록 구체적인 규칙과 검증 단계로 운영됐다.
- **근거 파일**: `AGENTS.md` §4~5·§8~13, `docs/board/HANDOVER.md`, `docs/portfolio/orchestration.md`, `docs/portfolio/ai-development-journey.md`, `docs/common/proposals/layer-restructure-proposal-v0.1.md`, `backend/src/test/java/com/finalcall/architecture/`.
- **삭제/통합 대상**: 파일 기억·contract-first·역할·게이트·레이어·Claude→Codex를 각각 한 페이지로 만들지 않는다. Karpathy 직접 적용 주장은 쓰지 않는다.

## 8. AI COLLABORATION — 한계와 대응

- **슬라이드 제목**: `AI의 한계를 규칙·정본·독립 검증으로 다뤘습니다`
- **목적**: 실제 문제와 대응 효과를 인과관계로 보여준다.
- **핵심 한 문장**: 기억 단절, 과잉 변경, 자기검증 편향을 각각 외부 기억, 코딩 규율, 독립 리뷰와 사람의 승인으로 통제했다.
- **본문 카피**:

  | 관찰한 한계 | 적용한 대응 | 확인한 효과 |
  |---|---|---|
  | 세션·도구 변경 시 맥락 단절 | spec·board·review·Git 정본 | Claude Code와 Codex가 같은 계약·티켓에서 재개 |
  | 과설계·요청 밖 변경 | Simplicity First·Surgical Changes·Goal-Driven Execution, 쓰기 범위 제한 | 역할·티켓 단위로 변경 범위 제한 |
  | 구현 결과를 낙관적으로 판단 | 읽기 전용 reviewer·테스트·라이브 검증·사람의 Done | green 테스트 뒤 즉시구매 락 순서 major 발견·재작업 |

  - `규칙 자체가 성과가 아니라, 잘못된 완료 판정을 되돌릴 수 있었던 것이 성과입니다.`
- **시각 자료**: 세 개의 `한계 → 장치 → 효과` 흐름. 규칙 전문이나 설정 화면은 싣지 않는다.
- **전환 문장**: 다음 두 사례는 이 체계가 실제 기술 결정과 출시 판단에서 작동한 증거다.
- **근거 파일**: `.agents/skills/coding-discipline/SKILL.md`, `AGENTS.md` §8~13, `docs/board/reviews/FC-089-090-review.md`, `docs/portfolio/orchestration.md`.
- **삭제/통합 대상**: 코딩 규율·레이어 템플릿·reviewer 사례를 별도 페이지로 나누지 않는다. 외부 인물 규칙의 직접 적용 귀속을 제거한다.

## 9. AI COLLABORATION — 판단과 검증 사례

- **슬라이드 제목**: `AI의 제안을 수용하는 것보다, 거절할 기준을 만들었습니다`
- **목적**: Engineering Judgment와 품질 책임을 두 가지 결정으로 증명한다.
- **핵심 한 문장**: 익숙한 기술도 실패 모델이 불명확하면 기각했고, 기능이 동작해도 성능 기준을 넘지 못하면 출시를 막았다.
- **본문 카피**:
  - **Case 1 — Redis 분산락 → DB 행 락 + 금전 CAS**: 고정 lease·watchdog 부재와 Redis 장애 전파를 확인했다. 같은 경매 경쟁은 auction 행 `PESSIMISTIC_WRITE`, 여러 경매의 사용자 자금 경쟁은 조건부 CAS로 분리해 외부 락을 정확성의 단일 보장 수단에서 제외했다.
  - **Case 2 — 실시간 전달 구현 → 출시 차단**: Redis fast-path와 outbox→Debezium→Kafka 복구를 구현했다. self-hosted 300 req/s 5분은 90,001건·drop 0·p95 59ms로 통과했지만, 1,000 req/s burst는 drop 2,243건·p95 3,799ms로 실패했다. 기능 완료와 출시 승인을 분리해 `changes-requested / release blocked`를 유지했다.
- **시각 자료**: 좌우 사례 카드에 `초기안 → 검증 → 결정`만 표시한다.
- **전환 문장**: 두 사례는 AI의 속도를 활용하되 최종 책임은 사람에게 남겨야 한다는 결론으로 이어졌다.
- **근거 파일**: `AGENTS.md` §1, `docs/spec/bid-domain-spec.md` §8, `docs/portfolio/auction-bid-settlement.md`, `docs/spec/chat-domain-spec.md` §7·§14, `docs/board/tickets/FC-329.md`, `FC-341.md`.
- **삭제/통합 대상**: 두 기술을 독립 페이지로 만들지 않는다. 최종 self-hosted 수치만 쓰고 운영 트래픽으로 표현하지 않는다.

## 10. CONCLUSION — 결과와 회고

- **슬라이드 제목**: `AI의 속도는 활용하고, 개발자의 책임은 남겼습니다`
- **목적**: 기능·기술·협업을 하나의 개발자 역량으로 회수하고 한계를 명시한다.
- **핵심 한 문장**: 복잡한 거래 제품을 만든 결과보다 더 중요한 성과는, AI가 만든 결과를 추적·검증·거절할 수 있는 개발체계를 만든 것이다.
- **본문 카피**:
  - **Built**: 경매·정산, 마켓, 마이페이지, 쪽지, 실시간 채팅과 검색 인프라를 하나의 제품 흐름으로 연결했다.
  - **Systemized**: 맥락 외부화, contract-first, 역할별 실행, 독립 리뷰, 사람의 승인으로 AI 협업을 재현 가능한 프로세스로 바꿨다.
  - **Demonstrated**: Context Engineering · Workflow Orchestration · Guardrails & Verification · Engineering Judgment.
  - **Honest Limits**: 채팅은 1,000 req/s 출시 기준 미달로 release blocked이며, 공개 운영 사용자·실트래픽·운영 배포 성과는 주장하지 않는다.
  - `좋은 AI 활용은 더 많이 생성하는 능력이 아니라, 무엇을 맡기고 무엇을 직접 판단할지 설계하는 능력이라고 배웠습니다.`
- **시각 자료**: 네 역량 키워드와 마지막 문장을 강조한다. 숫자는 검증 범위만 사용한다.
- **전환 문장**: 없음. 저장소·상세 기술 문서 QR은 선택 사항이다.
- **근거 파일**: `docs/portfolio/ai-development-journey.md`, `docs/portfolio/orchestration.md`, `docs/portfolio/auction-bid-settlement.md`, `docs/board/tickets/FC-329.md`, `docs/board/HANDOVER.md`.
- **삭제/통합 대상**: 기능·테스트·커밋 수를 무리하게 합산하지 않는다. `AI가 전부 수행`, `완전 자동화`, `운영 검증 완료`는 쓰지 않는다.

---

## 편집 단계 공통 규율

- 한 페이지에는 주장 하나만 둔다. 세부 구현은 근거 링크로 넘긴다.
- 기능·기술은 3~6페이지, AI 협업은 7~9페이지를 넘기지 않는다.
- 아키텍처는 기능보다 먼저 보여주되 기술 로고보다 역할과 데이터 흐름을 앞세운다.
- AI 역량은 프롬프트나 도구 개수가 아니라 실제 정본·게이트·리뷰·판단으로 증명한다.
- 채팅은 기능 구현과 출시 판정을 분리하고 반드시 `release blocked`를 표시한다.
- Karpathy 직접 적용을 주장하지 않고 저장소의 coding-discipline 세 원칙만 출처에 맞게 쓴다.
- 공개 운영 배포·실사용자·운영 트래픽 증거가 없으므로 만들거나 암시하지 않는다.
- OnRace 디자인 언어 차용은 이 설계서 승인 이후 PPT 제작 단계에서 적용한다.

## 원천 도시에

- [ai-development-journey.md](ai-development-journey.md)
- [orchestration.md](orchestration.md)
- [auction-bid-settlement.md](auction-bid-settlement.md)
- [market-quickbuy.md](market-quickbuy.md)
- [member.md](member.md)
- [search-cdc.md](search-cdc.md)
