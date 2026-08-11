# FC-258 독립 리뷰

- 대상 계약: `docs/spec/horizontal-app-shell-contract.md` v1.3, `docs/spec/element-detail-background-contract.md` v2.1
- 대상 커밋: `c267e33`
- 판정: **changes-requested**
- 집계: critical 0 / major 1 / minor 1

## Major

### Hover-open trigger click이 계약상 close가 아니라 explicit-open 고정으로 동작한다

- 위치: `frontend/src/components/layout/HorizontalNav.tsx:110`
- 재현:
  1. fine pointer에서 `마켓` trigger에 pointer를 올려 hover-open한다.
  2. trigger를 클릭한다.
  3. 또는 클릭으로 explicit-open한 상태에서 pointer가 trigger 안에 있어 `hoverOpen`도 true인 채 trigger를 다시 클릭한다.
- 기대: v1.3 §2.4의 기존 toggle 계약대로 closed에서만 explicit-open하고, hover-open 또는 explicit-open 상태의 클릭은 두 원인을 모두 정리해 즉시 close해야 한다.
- 실제: `hoverOpen && !explicitOpen`이면 `explicitOpen=true`로 바꿔 hover 메뉴를 고정한다. `explicitOpen && hoverOpen`에서 재클릭하면 explicit만 false로 바뀌고 hover가 남아 계속 열린다. 실제 fine-pointer 사용자는 같은 trigger 클릭으로 메뉴를 닫을 수 없거나 예상과 반대로 고정되며, click/hover arbitration 계약을 위반한다.

## Minor

### Hover 회귀 테스트가 확정 계약과 반대 동작을 정답으로 고정한다

- 위치: `frontend/src/components/layout/HorizontalNav.test.tsx:12`
- 재현: `fine pointer hover는 grace close와 재진입을 지원하고 click으로 고정한다` 테스트를 확인한다. hover-open 뒤 click 및 leave 150ms 후에도 open일 것을 기대한다.
- 기대: hover-open trigger click 직후 close를 검증하고, explicit-open 재클릭은 pointer가 boundary 안에 있어도 close되는지 검증해야 한다. fine→coarse runtime 전환도 hover-only close와 explicit 유지 두 경우를 직접 검증해야 한다.
- 실제: 계약과 반대인 “click으로 고정”을 테스트해 Major 동작이 전체 테스트를 통과한다. media listener 제거는 검증하지만 runtime fine→coarse 상태 전환은 직접 호출하지 않는다.

## 확인된 계약 충족 사항

### Hover·키보드·수명주기

- hover는 `(hover: hover) and (pointer: fine)` matchMedia가 true일 때만 활성화되고 coarse 환경에서는 hover-open이 생성되지 않는다.
- trigger와 absolute panel은 동일 `li` boundary에 있으며 leave 후 150ms grace, 재진입 timer 취소가 구현됐다.
- pointerleave는 focus가 trigger/panel 안에 있을 때 닫지 않아 keyboard 탐색 중 DOM 제거를 막는다.
- 기존 native click/Enter/Space, ArrowDown, 자식 방향키, Escape 후 trigger focus, outside click/focus 및 route close는 유지된다.
- fine→coarse 변경 시 timer와 hover state를 정리하며 explicit state는 보존한다. media listener와 timer는 route 변경/unmount에서 정리된다.

### `/auctions` 정적 water scene

- exact `/auctions`와 `/auctions/`만 정적 `element={1}` water source를 사용하며 API 의존은 없다.
- 기존 `ElementDetailBackground` 이미지·CSS·Canvas 엔진을 `ambientOnly` mode로 한 번만 렌더해 scene/image/Canvas/RAF 소유자가 하나다.
- 목록은 기존 opaque AppShell white plane과 원래 카드/필터 surface를 유지하고, ambient-only selector가 상세용 dark surface/CTA/focus override를 적용하지 않는다.
- fixed scene은 plane 뒤 viewport를 채우므로 background/particle이 outer gutter에서 보이며 새 scroll/stacking context를 만들지 않는다.
- 목록→상세 전환 시 exact static wrapper가 제거되고 상세 응답 element registration이 현재 pathname에서 우선한다. scene은 한 개이며 water frame 잔류가 없다.
- 목록→다른 route에서는 scene, theme token, image lifecycle, RAF/listener가 정리되고 `/market` 등 다른 목록에는 scene/image/RAF가 없다.
- 기존 reduced motion, coarse pointer, update slow, forced colors, visibility, resize debounce, DPR/delta 및 unmount cleanup을 동일 엔진에서 재사용한다.

## 검증 결과

- `npm.cmd test -- --run`: 통과 — 95 files, 766 tests
- `npm.cmd run typecheck`: 통과
- 변경 대상 ESLint `--max-warnings=0`: 통과
- `npm.cmd run build`: 통과 — 기존 500kB 초과 chunk 경고
- 전체 `npm.cmd run lint -- --max-warnings=0`: 변경 범위 밖 `InventoryItemCard.test.tsx` 81·94행의 기존 `react/jsx-sort-props` warning 2건으로 종료 코드 1
- 전체 테스트 stderr의 기존 `NoticeSection` key warning은 FC-258 변경 범위 밖이다.

Critical은 없으나 Major 1건이 있어 통과할 수 없다.
