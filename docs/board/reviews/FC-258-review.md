# FC-258 최종 재리뷰

- 대상 계약: `docs/spec/horizontal-app-shell-contract.md` v1.3, `docs/spec/element-detail-background-contract.md` v2.1
- 최초 구현: `c267e33`
- 재작업: `eb44888`
- 최종 판정: **passed**
- 집계: critical 0 / major 0 / minor 0

## 이전 발견 해결 확인

### Hover·explicit arbitration

- fine pointer의 hover-open 상태에서 trigger를 클릭하면 close timer, `hoverOpen`, `explicitOpen`을 모두 정리하여 즉시 닫는다.
- 닫힌 상태의 다음 click은 explicit-open하고 재클릭은 pointer가 boundary 안에 있어도 두 상태를 모두 false로 만들어 닫는다.
- 닫은 뒤 leave/re-enter하면 fine pointer hover-open이 다시 정상 동작한다.
- Enter와 Space는 native button click 경로를 공유해 현재 visible open 상태를 동일하게 toggle한다.
- ArrowDown explicit-open, 자식 방향키, Escape 후 trigger focus, outside click/focus, route change close 동작은 유지된다.

### Fine→coarse runtime cleanup

- media query change를 직접 발생시키는 테스트가 hover-only open과 pending 150ms timer를 즉시 정리하는지 검증한다.
- coarse 전환은 `hoverOpen`만 정리하므로 click/keyboard로 만든 explicit-open 의미는 보존된다.
- matchMedia listener와 timer는 route 변경 및 unmount에서 정리된다.

## 누적 `/auctions` water 계약 확인

- exact `/auctions`와 `/auctions/`만 API 없는 정적 water source를 사용한다.
- 기존 `ElementDetailBackground`의 image·CSS·Canvas engine을 `ambientOnly` mode로 한 번만 렌더하여 scene/image/Canvas/RAF owner가 하나다.
- 목록은 opaque AppShell white plane과 기존 list/card/filter surface를 유지하고 background/particle은 outer gutter에서 보인다.
- ambient-only mode는 상세용 dark surface, CTA, focus override를 목록 콘텐츠에 적용하지 않는다.
- 목록→상세 전환 시 pathname이 static source를 제거하고 상세 성공 응답 element가 유일한 theme/scene으로 적용된다.
- 목록→다른 route에서는 static theme, scene, image lifecycle, RAF 및 media/resize/visibility listener가 정리된다. `/market` 등 다른 목록은 scene/image/RAF 0이다.
- reduced motion, forced colors, coarse pointer, update slow, visibility, resize debounce, DPR 1.5, delta cap과 Canvas cleanup 계약을 동일 engine에서 유지한다.
- fixed scene은 shell 최하단에 있고 white plane, sticky chrome, footer, CompareBar, drawer/dropdown/modal stacking에 회귀가 없다.

## 테스트 적정성

- hover-open click close → click explicit-open → click close → leave/re-enter hover-open 순서를 회귀 테스트가 고정한다.
- Enter/Space toggle과 fine→coarse direct cleanup을 별도 테스트로 검증한다.
- 기존 grace 150ms, re-entry cancel, coarse hover 0, unmount timer/listener cleanup 검증이 유지된다.
- AppShell 테스트는 exact list scene 1개, 다른 route scene/image/RAF 0, 목록→상세 dynamic precedence와 목록 이탈 cleanup을 검증한다.

## 검증 결과

- `npm.cmd test -- --run`: 통과 — 95 files, 768 tests
- `npm.cmd run typecheck`: 통과
- 변경 대상 ESLint `--max-warnings=0`: 통과
- 전체 `npm.cmd run lint -- --max-warnings=0`: 변경 범위 밖 `InventoryItemCard.test.tsx` 81·94행의 기존 `react/jsx-sort-props` warning 2건으로 종료 코드 1
- 전체 테스트 stderr의 기존 `NoticeSection` key warning은 FC-258 변경 범위 밖이다.
- 최초 구현 검증의 production build 통과 결과에 영향을 주는 재작업은 HorizontalNav 상태·테스트뿐이며 typecheck와 전체 tests가 통과했다.

확정 계약을 차단하는 critical/major/minor 발견이 없어 통과 판정한다.
