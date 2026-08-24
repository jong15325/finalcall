# 도시에: AI 에이전트로 기획부터 도메인 완성까지

- **영역**: Claude Code·Codex 공통 AI-assisted engineering 여정
- **상태**: 개발 체계 운영 중, 대표 도메인 완료

## 1. 개요

FinalCall은 AI로 코드를 빠르게 생성한 프로젝트가 아니라, AI가 참여하는 개발 조직을 설계하고 실제 복잡한
도메인에 적용한 프로젝트다. Claude Code와 Codex에 architect·backend·frontend·reviewer·portfolio-writer
역할을 두고 파일 보드와 spec을 공통 기억으로 사용했다. 사용자는 제품 범위, 계약·동시성·인가 결정, 디자인,
리뷰 수용과 Done을 승인했다. 그 결과 회원에서 시작해 경매·입찰·정산·검색·배송·채팅까지 확장하면서도 결정과
검증 근거를 레포 안에 남겼다.

## 2. 실제 진행 서사

1. **기획·분해**: 메인세션이 요구를 에픽과 하위 티켓으로 분해하고 사용자가 게이트1에서 범위·의존을 승인했다.
2. **contract-first**: architect가 domain spec·ERD·API 계약과 불변식을 확정하고 스키마·성능 결정은 게이트2로
   상신했다. 입찰에서는 Redis 분산락 대신 auction 행 락+금전 CAS를 승인했다.
3. **구현**: 파일 집합이 겹치지 않을 때 backend와 frontend를 병렬 실행했다. 검색은 ES/CDC와 q API,
   프론트 검색 UI를 분리했고, 공유 파일이 겹친 입찰은 순차화했다.
4. **디자인**: 새 화면은 실제 프론트 정본을 재사용한 dev-only 워크벤치에서 모바일·데스크톱·overflow·대비를
   확인한 뒤 운영 route에 반영했다.
5. **독립 리뷰**: reviewer가 보안·QA·접근성과 동시성을 읽기 전용으로 검수했다. 즉시구매의 AB-BA 잔액 락
   순서를 major로, 검색의 CDC/enrichment 런북 비동작을 major로 발견했다.
6. **수정·재검증**: 즉시구매는 user_id 오름차순으로 락 단계를 정렬하고 실경합 테스트를 추가했다. 검색은 CDC
   필드와 enrichment를 수정하고 라이브 스택에서 다시 확인했다.
7. **완료·증거화**: review_status 통과 후 사용자가 Done을 승인하고, portfolio-writer가 코드·테스트·커밋을
   도시에로 큐레이션했다. push는 사용자가 직접 수행한다.

## 3. 역할과 책임의 경계

| AI 에이전트가 수행 | 사용자가 책임·승인 |
|---|---|
| 요구 분석, 티켓 초안과 의존 관계 제안 | 제품 목표, 에픽 범위와 우선순위 |
| spec·ERD·API 계약 후보와 대안 비교 | 스키마·API·성능·인가·동시성의 최종 선택 |
| 백엔드·프론트 구현과 자동 테스트 | 위험 수용 여부, 디자인 방향, Done |
| 읽기 전용 리뷰와 심각도 판정 | major 수정 우선순위와 최종 완료 판단 |
| 근거 수집과 포트폴리오 파생 문서 | 외부 공개 문구와 본인 기여 설명 |

Git 작성자나 생성 로그만으로 특정 코드가 Claude/Codex 중 어느 도구의 산출인지 과장해 귀속하지 않는다. 포트폴리오
가치는 도구별 코드량이 아니라 **동일한 규율을 이식하고 판단·검증 가능한 결과를 만든 운영 역량**에 둔다.

## 4. 대표 에픽으로 본 검증 루프

- **입찰**: architect의 5개 게이트2 결정 → 순차 백엔드 구현 → reviewer가 12클래스 69건과 I1~I10 검증,
  minor와 RR 잠금읽기 함정을 기록 → 완료([auction-bid-settlement.md](auction-bid-settlement.md)).
- **즉시구매**: 구현 테스트가 green이어도 reviewer가 교차거래 데드락 표면을 major로 판정 → `b44aea03` 수정과
  재검 백엔드 281건 통과. AI 리뷰 분리의 실효성을 보여준다.
- **검색**: 정적 reviewer 이후 실제 Docker 스택에서 CDN·버전·매핑 장애가 드러남 → 수정 후 5,040건 재색인과
  한글 결과를 확인. 코드리뷰와 런타임 검증이 서로 대체 불가능함을 보여준다([search-cdc.md](search-cdc.md)).
- **아이템 지급**: reviewer 2라운드에서 apply~IN_GAME 지연창의 재판매 구멍과 테스트 격리 오염을 major로 찾아
  2중 방어와 격리로 수정([item-delivery.md](item-delivery.md)).

## 5. 아키텍처와 증거

```text
아이디어 → 에픽/티켓 → 계약·불변식 → backend ∥ frontend
   ↑          │              │               │
사용자 승인 ─┴─ 게이트1 ─── 게이트2        디자인 게이트
                                              ↓
                                     reviewer → 수정 → 재검
                                              ↓
                                  사용자 Done → 도시에 축적
```

- 운영 정본: `AGENTS.md`·`CLAUDE.md`, `.codex/agents/`, `.claude/agents/`, `docs/board/**`.
- 실제 여정: `EPIC-MEMBER.md`, `EPIC-BID.md`, `EPIC-SEARCH.md`, `EPIC-ITEM-DELIVERY.md`.
- 리뷰: `FC-035-review.md`, `FC-089-090-review.md`, `FC-109-review.md`, `FC-157-review.md`.
- 프로세스 커밋: `fdd88d5`, `daab1b7`, `fdab535`, `1fcb39bb`, `5845906a`.

### 포트폴리오 표현 원칙

“AI가 기획부터 배포까지 전부 수행”이라고 쓰지 않는다. 확인 가능한 표현은 “역할별 AI 에이전트로 기획·계약·
백엔드·프론트·리뷰 흐름을 운영하고, 사람이 핵심 결정을 승인하며 테스트와 라이브 검증으로 도메인을 완성했다”다.
