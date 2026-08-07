# FC-218 리뷰 — 댓글 정렬 메뉴 키보드 접근성

- 판정: **PASS**
- critical: 0
- major: 0
- minor: 0
- reviewer: reviewer
- 검증일: 2026-08-07

## 확인 내용

- 메뉴 열림 시 현재 선택 항목으로 초점 이동.
- roving tabindex와 `ArrowUp`/`ArrowDown` 순환, `Home`/`End` 이동 정상.
- `Enter`/`Space` 선택과 `Escape` 종료 후 트리거 초점 복귀 정상.
- 바깥 클릭과 기존 마우스 선택 동작 유지.
- 모바일·데스크톱은 반응형 스타일만 다른 단일 메뉴 DOM으로 중복 초점 없음.
- `menu`·`menuitemradio`·`aria-expanded`·`aria-controls`·`aria-checked` 상태 정합.
- 변경 범위는 FC-218 DoD에 한정되며 무관 리팩터 없음.

## 검증

- 신규 대상 테스트 4/4 통과.
- 변경 파일 ESLint, typecheck, production build, `git diff --check` 통과.
- 전체 Vitest 700/703 통과. 실패한 `oauth.test.ts` 3건은 로컬 OAuth client ID가 주입된 환경에서 `미설정`을 전제한 기존 테스트가 깨진 것으로 FC-218과 무관.
- production build의 500kB chunk 경고와 기존 HomePage key 경고는 범위 밖.
