# 도시에: 파일 티켓 보드 기반 멀티에이전트 오케스트레이션

> 포트폴리오(케이스 스터디·이력서 불릿·소개 페이지) 재가공용 **중간 산출물**이다. 정본이 아니라
> CLAUDE.md·보드·에이전트 정의·훅에서 큐레이션한 파생 요약이다. 모든 주장은 증거(파일·커밋)로 뒷받침한다.

- **영역/에픽**: AI 협업 개발 프로세스 설계 (멀티에이전트 오케스트레이션 체계)
- **상태**: 완료·운영 중 (EPIC-MEMBER를 이 체계로 완주, EPIC-CURRENCY 진행 중)
- **기간(커밋 기준)**: `fdd88d5`(에이전트 5종·CLAUDE.md 절) ~ `daab1b7`(보드 스캐폴드) ~ `c367906`(portfolio-writer)
- **관련 산출물**: CLAUDE.md 섹션 8~13, `.claude/agents/*.md`, `.claude/hooks/block-git-push.js`, `docs/board/`

## 1. 개요 (한 문단)

FinalCall은 코드뿐 아니라 **"AI 에이전트로 소프트웨어를 개발하는 프로세스 자체"**를 하나의 설계 대상으로
삼았다. 메인세션이 총괄(오케스트레이터)로서 역할별 서브에이전트(architect·backend-impl·frontend-impl·
reviewer + 휴면 consultant)를 지휘하고, 모든 상태는 세션 메모리가 아니라 **레포 내 파일 티켓 보드**에
영속한다. 계약을 먼저 확정하고(contract-first) 구현을 팬아웃하며, 되돌리기 큰 결정에서만 사람에게
멈춰 상신하는(게이트) 규율을 세웠다. 이는 "LLM에게 큰 작업을 통째로 던지기"의 한계(상태 유실·범위
폭주·검증 누락)를 프로세스 설계로 제거하려는 시도이며, 회원 도메인(EPIC-MEMBER)을 이 체계로 완주해
동작을 검증했다.

## 2. 해결한 기술 도전과 해법

- **에이전트의 무상태성 → 파일 티켓 보드**: 서브에이전트는 세션 상태를 남기지 않는다는 제약을, 티켓당
  파일 1개(모놀리식 보드 금지 — 병렬 쓰기 충돌 회피)로 해결했다. YAML 프론트매터에 `state`·`owner`·
  `depends_on`·`blocks`·`review_status`·`gate`를 담아 canonical 진실원으로 삼음(`docs/board/tickets/FC-*.md`).

- **실시간 협상 제거 → contract-first**: 프론트/백엔드가 구현 중 API를 협상하면 병렬성이 깨진다 →
  architect가 spec(`docs/spec/api-contract.md`·`erd.md`·`domain-spec.md`)을 **먼저 확정**한 뒤에만 구현
  에이전트를 팬아웃하도록 파이프라인을 고정. 실제로 FC-001(계약 검증) → FC-002∥FC-003 → FC-004 순으로 진행.

- **병렬성 판정 기준의 정밀화**: "같은 도메인"이 아니라 **"같은 파일"**로 팬아웃을 센다 — 의존 없음 +
  쓰기 파일 집합 무교차 둘 다 충족일 때만 병렬. 공유 파일(MemberController/MemberService)을 건드리는
  FC-004는 직렬로 처리(FC-004 티켓 명시).

- **에이전트의 권한 이탈 차단 → 게이트3 push 훅**: 에이전트가 원격에 반영(push)하지 못하도록 PreToolUse
  훅이 `git push`만 정규식으로 차단하고 `git commit`은 통과시킨다. 커밋 메시지 안의 "push" 문자열
  오탐을 피하도록 `git`의 하위명령이 push일 때만 매칭(`block-git-push.js`).

- **에이전트 간 통신 부재 → 파일 read/write + 메인세션 반환**: 에이전트끼리 직접 대화·호출하지 않고
  파일과 메인세션 반환만으로 협업. 상태 폭주·순환 호출을 구조적으로 배제.

- **사용자 가시성 → Jira 단방향 미러**: 파일 보드가 정본, Jira(KAN)는 사용자 전용 읽기 미러. 메인세션만
  상태 전이 시 `jira_key`로 멱등 upsert하며, Jira 변경은 파일에 역류하지 않는다(파일이 정본).

## 3. 핵심 결정과 근거 (트레이드오프)

- **총괄 = 메인세션 자체(서브에이전트 아님)**: 위임·게이트 판정·상태 전이·Jira 미러를 메인세션이 직접
  수행. 총괄을 별도 에이전트로 두는 계층을 포기하는 대신, 상태 전이 주체를 하나로 단일화해 경합을 제거.
  (근거: CLAUDE.md 섹션 8·11 — "전이 주체는 메인세션만")

- **게이트로 사람 개입을 최소·집중**: 항상 멈추지 않고 **되돌리기 큰 지점에서만** 멈춘다.
  게이트1(에픽 분해안 승인)·게이트2(스키마/API계약/성능)·디자인 게이트(새 화면)·게이트3(push+Done 승인).
  그 이하는 총괄 자율 → 속도와 통제의 균형. 실제로 FC-004는 게이트2(탈퇴 주체 401 등 3건)를 상신·승인받음.

- **커밋은 자동·게이트 없음, push·Done만 사람**: atomic 커밋은 자동으로 흘리되 원격 반영과 완료 선언은
  사람이 쥔다. 개발 속도(커밋)와 되돌리기 비용(push)을 분리. (근거: CLAUDE.md 섹션 13)

- **오케스트레이션 절이 스켈레톤 규약을 국소 override**: 섹션 2·6의 "한 단계씩·사용자만 커밋"은 스켈레톤
  기준이며, 도메인 개발에서는 섹션 8~13이 우선한다고 명문화 → 규약 충돌을 우선순위로 해소.

- **consultant는 평상시 휴면**: 프로세스 규칙 변경이 필요할 때만 소환(description을 좁게 걸어 오발동
  방지). 권한을 프로젝트 축(게이트2)과 체계 축(consultant)으로 갈라 **둘 다 사용자에게 수렴**시킴.

- **reviewer 필수 선행**: `review_status=passed` 없이는 게이트3 훅이 done/push를 막는다. 리뷰 누락으로
  인한 완료를 구조적으로 봉쇄. (근거: CLAUDE.md 섹션 11 상태 머신)

## 4. 아키텍처

```
[사용자]  ── 게이트1/2/디자인/게이트3 상신·승인 ──▶  [메인세션 = 총괄]
                                                      │  위임 / 상태 전이 / Jira 미러
        ┌──────────────────────┬──────────────────────┼───────────────────────┐
        ▼                      ▼                       ▼                       ▼
   [architect]           [backend-impl]          [frontend-impl]           [reviewer]
   spec/ 확정            서버 구현·테스트          클라 구현(디자인)         읽기전용 통합리뷰
   (contract-first)     (∥ 무교차 시 병렬)                                 (보안+QA+접근성)
        └──────────────────────┴───────────────────────┴──────────────────────┘
                 모두 파일 read/write + 메인세션 반환만 (직접 통신 금지)
                                      │
                                      ▼
        [파일 티켓 보드 docs/board/{epics,tickets,reviews}]  ← canonical 진실원
                                      │  메인세션만 단방향 미러
                                      ▼
                        [Jira KAN — 사용자 전용 읽기 미러]

파이프라인: architect(계약) → [디자인 게이트] → backend ∥ frontend → reviewer → Done(게이트3)
상태 머신: todo → doing → review → done*  (review에서 critical/major면 doing 재작업, 선행 미충족은 blocked)
게이트3 훅: git push 차단 / git commit 통과 (.claude/hooks/block-git-push.js)
```

## 5. 증거

- **핵심 파일**:
  - `CLAUDE.md` 섹션 8~13 — 에이전트 5종·워크플로우·게이트 정책·티켓 스키마·Jira 미러·커밋 규약
  - `.claude/agents/architect.md`·`backend-impl.md`·`frontend-impl.md`·`reviewer.md`·`consultant.md`·`portfolio-writer.md` — 역할·권한·도구셋 정의
  - `.claude/hooks/block-git-push.js` — 게이트3 push 차단 훅(PreToolUse, exit 2)
  - `docs/board/epics/EPIC-MEMBER.md` — 에픽 분해안(게이트1 승인)·children 롤업
  - `docs/board/tickets/FC-001.md`~`FC-010.md` — 티켓 파일(YAML 프론트매터 상태 머신)
  - `docs/board/reviews/FC-005-review.md` — reviewer 판정 기록(critical 0·major 0·minor 3, passed)
  - `docs/board/HANDOVER.md` — 총괄 세션 교체용 상태 스냅샷
- **운영 증거(실제 적용)**:
  - EPIC-MEMBER(FC-001~005) 전건 done + 게이트3 승인 → 원격 push 완료
  - FC-004 게이트2 3건(탈퇴 주체 401·닉네임 경쟁 409 안전망·세션 폐기 경쟁창) 상신·사용자 승인
  - FC-006 파생 티켓(리뷰 minor → 별도 위생 티켓 분리)로 파생 경위 추적
- **커밋**:
  - `fdd88d5` feat(orchestration): CLAUDE.md 오케스트레이션 절 + 실행 에이전트 5종
  - `fdab535` feat(orchestration): 게이트3 훅 — 에이전트 원격반영 차단(commit 통과)
  - `daab1b7` feat(orchestration): 작업 보드 스캐폴드 + 스킬 3종 + 에이전트 참조 연결
  - `c367906` feat(orchestration): portfolio-writer 에이전트 추가 (도입 중)
