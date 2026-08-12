# 총괄 세션 핸드오버

> 갱신: 2026-08-12 / 월드맵 AppShell·푸터·짧은 페이지 sticky footer 작업 완료

## 현재 결론

- 모든 AppShell 페이지에 `world-map-game-sources-a-v2` 기반 공통 월드맵 배경과 단일 Canvas 효과가 적용돼 있다.
- PC는 2단 수평 내비게이션, 모바일은 drawer + 하단 내비게이션을 유지한다.
- 공통 흰 콘텐츠 plane의 stacking 깨짐, 모바일 가로 overflow, 비-portal 모달 계층 문제를 수정했다.
- Maple Planet 하단 정보 구조를 참고한 장터 공통 푸터를 적용했다.
- 짧은 오류·빈 상태·404 화면은 compact footer, 정상 목록·상세는 default footer를 사용한다.
- AppShell은 `100vh` fallback 뒤 `100dvh`가 우선되는 sticky-footer 구조다. main이 남은 높이를 채우며 content plane에는 전역 `min-h-full`이 없다.
- 최신 독립 리뷰 결과: critical 0 / major 0 / minor 0.

## 최근 핵심 커밋

- `607672f` 월드맵 공통 배경 scene 통합
- `76bc0bc` 월드맵 모바일 parity와 Canvas 강등 보완
- `5f0bf6d` 월드맵 셸 레이어와 반응형 프레임 복구
- `b1c0cc2` 모바일 경매 폭과 모달 계층 복구
- `4c4c8a9` 공통 서비스 푸터 추가
- `7e17b6a` 푸터 브랜드 표기 통일
- `40cdd32` 푸터 변경 파일 포맷 정렬
- `ce9a8e9` 짧은 페이지 footer 높이 배분 정리
- `4e564a0` 짧은 상태 footer 적용 범위 보완
- `59103c8` 판매 화면 무관 formatting diff 정리

현재 HEAD는 `59103c8`, `origin/master`는 `29cf296`이며 로컬은 origin보다 98커밋 앞서 있다. push는 수행하지 않았다.

## 검증 상태

- 프론트 전체 테스트: 98 files / 774 tests 통과
- TypeScript typecheck 통과
- production build 통과
- 변경 파일 ESLint 오류 0
- 전체 lint의 `InventoryItemCard.test.tsx` jsx-sort-props 경고 2건은 사용자/기존 변경으로 범위 밖
- 짧은 페이지 최종 reviewer PASS: findings 0
- 서비스: backend 8080, frontend 5173 listen 상태를 2026-08-12에 확인

## 파일 보드 상태

- `EPIC-ELEMENT-DETAIL-BACKGROUND`: review
- `EPIC-WORLD-MAP-BACKGROUND`: review
- `EPIC-HORIZONTAL-APP-SHELL`: review, gate3
- 최신 델타: FC-267(계약) → FC-268(구현) → FC-269(리뷰)
- FC-267/268/269는 모두 review이며 FC-268/269 `review_status: passed`.
- 사용자가 게이트3/Done 전이를 아직 명시적으로 승인한 것으로 처리하지 않았다. 다음 세션은 상태를 임의로 done으로 만들지 말고 확인한다.

## Jira 미러 — 최우선 복구

사용자는 Jira 연결을 승인했다. 그러나 직전 메인 세션의 `ALL_TOOLS`에는 Jira/Atlassian 도구가 0개로 노출되어 실제 upsert를 호출할 수 없었다. 이는 승인 거절이 아니라 **현재 세션에 커넥터 도구가 주입되지 않은 상태**다.

- 파일 보드에서 `jira_key: null` 총 42개를 확인했다.
- 그중 todo가 아닌 미러 누락은 직전 스캔 기준 31개였다(최근 보드 갱신 후 다시 전수 스캔할 것).
- Jira는 읽어서 정본을 판단하지 않는다. 파일 보드가 canonical이며 Jira는 단방향 미러다.

다음 세션 첫 작업:

1. 사용 가능한 도구에서 `jira`/`atlassian`을 직접 검색한다.
2. 도구가 없으면 사용자에게 커넥터가 새 세션에 노출되지 않았음을 즉시 보고한다. 생략하지 않는다.
3. 도구가 있으면 `jira_key: null` 전수 스캔 후 에픽부터 멱등 upsert한다.
4. task 생성/갱신, Epic Link, state→status, `agent:<owner>`, `gate:*`, depends_on/blocks 링크를 반영한다.
5. 발급된 키를 각 파일의 `jira_key`에 기록하고 불변으로 유지한다.
6. `state != todo && jira_key == null`이 0인지 재검사한다.
7. Jira 완료 상태와 파일 상태의 패리티를 메인세션이 수동 대조한다.

## 작업 트리 주의

현재 의도된 미커밋 문서:

- `docs/spec/horizontal-app-shell-contract.md`
- `docs/board/epics/EPIC-HORIZONTAL-APP-SHELL.md`
- `docs/board/tickets/FC-267.md`
- `docs/board/tickets/FC-268.md`
- `docs/board/tickets/FC-269.md`
- 이 `docs/board/HANDOVER.md`

사용자/비소유 변경이므로 건드리지 말 것:

- `frontend/src/features/member/components/InventoryItemCard.test.tsx`
- `backend/logs/`
- `docs/AI-KICKOFF-PROMPT.md`

## 새 세션 이어받는 순서

1. `AGENTS.md` 섹션 8~13, `docs/PROJECT-HANDOFF.md`, 이 파일을 읽는다.
2. `git status --short`, `git log --oneline -12`, `git rev-list --count origin/master..HEAD`를 확인한다.
3. Jira/Atlassian 도구 노출 여부를 메인세션이 직접 검사하고 위 미러 복구 절차를 수행한다.
4. 보드 문서 변경을 검증하고 atomic docs 커밋한다. 사용자/비소유 파일은 커밋하지 않는다.
5. 사용자에게 Jira 패리티 결과와 게이트3 승인 대상 에픽 3개의 상태를 보고한다.
6. 사용자가 Done/push를 승인할 때만 에픽·하위 티켓 done 전이 후 사용자가 직접 push한다.

## 다음 사용자 결정

- Jira 미러 복구 후 `EPIC-ELEMENT-DETAIL-BACKGROUND`, `EPIC-WORLD-MAP-BACKGROUND`, `EPIC-HORIZONTAL-APP-SHELL`을 gate3 Done으로 전환할지 확인.
- push는 사용자가 직접 수행한다.
