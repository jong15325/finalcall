# 도시에: 파일 보드 기반 AI 에이전트 오케스트레이션

- **영역**: AI 협업 개발 프로세스
- **상태**: 완료·운영 중
- **기간**: `fdd88d5`(Claude 역할 체계) 이후 Codex 역할 정의와 `AGENTS.md`로 확장

## 1. 개요

FinalCall은 기획·계약·백엔드·프론트·리뷰를 서로 다른 책임으로 분리했다. Claude Code와 Codex 모두 같은
spec과 파일 티켓 보드를 읽어 도구나 세션이 바뀌어도 상태를 복원한다. 메인세션만 위임·상태 전이·Jira
미러를 담당하고 사용자는 에픽 분해, 계약·성능 결정, 디자인과 Done을 승인한다. 회원에서 시작한 체계는
경매·입찰·정산·검색·배송·채팅까지 실제 도메인에 적용됐다.

## 2. 해결한 기술 도전과 해법

- **세션 상태 유실**: 티켓당 파일 하나에 상태·의존·owner·review_status·gate를 기록했다. Jira는 대시보드일
  뿐 파일이 정본이고, `jira_key` 멱등 upsert와 드리프트 훅으로 누락을 감시한다.
- **구현 중 계약 협상**: architect가 spec·ERD·API 계약을 먼저 확정한 뒤, 의존 없음과 쓰기 파일 무교차가
  모두 성립할 때만 백엔드와 프론트를 병렬화했다.
- **AI 자기검증 편향**: 구현자와 읽기 전용 reviewer를 분리했다. EPIC-PURCHASE에서는 reviewer가 잔액 락
  순서 위반을 major로 잡아 재작업 후 통과시켰다.
- **UI 완성 판정**: 실제 AppShell·토큰을 쓰는 dev-only 워크벤치에서 390/1280px, overflow, 대비와
  production residue를 확인하는 디자인 게이트를 두었다.
- **권한 이탈**: push는 훅으로 차단하고 사용자가 직접 수행한다. 현재 커밋도 변경 보고와 사용자 승인 후 수행한다.

## 3. 핵심 결정과 근거

- **공통 파일 정본**: 도구 간 내부 세션 호환 대신 spec·board·review를 교환 형식으로 삼았다. 문서 유지 비용을
  지불하는 대신 도구 종속성과 기억 손실을 줄였다.
- **사람 개입 집중**: 게이트1(에픽), 게이트2(스키마/API/성능/인가), 디자인, 게이트3(Done)를 두고 그 아래는
  자동 진행해 속도와 책임을 함께 유지했다.
- **파일 무교차 병렬화**: 같은 도메인인지보다 실제 쓰기 파일을 기준으로 판단했다. 공유 서비스·Flyway 채번이
  겹치면 순차화해 충돌과 계약 흔들림을 피했다.
- **Jira 단방향**: 양방향 편집 편의보다 정본 충돌 방지를 택해 파일→Jira만 허용했다.

## 4. 아키텍처

```text
[사용자: 범위·계약·디자인·Done 승인]
                 │
        [메인세션: 총괄·상태 전이]
 architect → [디자인] → backend ∥ frontend → reviewer → Done
                 └── docs/spec + docs/board + reviews ──┘
                                      │
                               Jira 단방향 미러

Claude Code: .claude/agents/*.md + CLAUDE.md
Codex:       .codex/agents/*.toml + AGENTS.md
공통 상태:   docs/board/**, docs/spec/**, Git/tests
```

## 5. 증거

- `AGENTS.md` §8~13, `CLAUDE.md` 대응 절 — 역할·워크플로·게이트·상태 머신·Jira·커밋 규약.
- `.claude/agents/portfolio-writer.md`, `.codex/agents/portfolio-writer.toml` — 같은 산출 위치와 쓰기 경계.
- `docs/board/epics/EPIC-BID.md`, `EPIC-SEARCH.md`, `EPIC-ITEM-DELIVERY.md` — 실제 분해와 완료 기록.
- `docs/board/reviews/FC-035-review.md` — 입찰 12클래스 69건, 불변식과 minor 9건.
- `docs/board/reviews/FC-089-090-review.md` — major 발견, `b44aea03` 수정 후 재검 통과.
- 커밋: `fdd88d5`, `fdab535`, `daab1b7`, `c367906`, `1fcb39bb`, `5845906a`.
