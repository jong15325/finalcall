# FC-278 프론트 UI 시스템 최종 재리뷰

- 대상: `EPIC-FRONTEND-UI-SYSTEM`, `docs/spec/frontend-ui-system-contract.md` v1.0, 전체 재작업 후 현재 working tree diff
- 판정: **passed**
- 집계: critical 0 / major 0 / minor 2
- 범위 주의: 사용자 소유 `frontend/src/features/member/components/InventoryItemCard.test.tsx` 변경과 해당 파일의 lint warning 2건은 구현자 변경/발견 집계에서 제외했다.

## Minor 1 — `ListFrame`의 live region이 ready 목록 전체를 감싼다

- 위치: `frontend/src/components/common/ListFrame.tsx:90`
- 재현: cursor 목록에서 다음 페이지를 추가하거나 loading에서 ready로 전환한다. `aria-live="polite"` 컨테이너 안에서 전체 grid와 카드가 변경된다.
- 기대: 짧은 loading/error 상태 메시지만 live announcement로 전달하고 큰 ready 목록은 일반 list/region으로 탐색하게 한다.
- 실제: 보조기기가 카드 전체의 대량 변경을 live update로 발표할 가능성이 있다. `aria-busy`와 상태·목록 시맨틱 자체는 정상이라 minor로 판정한다.

## Minor 2 — 핵심 경계의 자동 회귀 테스트가 충분하지 않다

- 위치: `frontend/src/components/common/ListFrame.test.tsx`, `frontend/src/features/item/components/ItemCardComposition.test.tsx`, `frontend/src/components/layout/AppShell.test.tsx`
- 재현: 테스트 목록을 확인한다. `CursorPagination`의 `hasNext`/disabled/keyboard 호출 전용 테스트, `/market/:id` 성공 응답의 실제 element accent 등록 통합 테스트, coarse pointer/reduced-motion과 compare·flip sibling 구조 테스트가 없다.
- 기대: 계약 §8.2의 dynamic route 4종, keyboard pagination, coarse pointer/reduced-motion/card hit-area 경계를 자동 테스트가 직접 보호한다.
- 실제: 현재 구현은 정적 검토와 기존 상호작용 테스트상 계약을 충족하지만 해당 경계를 다시 깨뜨리는 변경을 테스트가 직접 검출하지는 못한다.

## 남은 major 2건 해소 확인

1. **ListFrame 전체 구조 이관 — 해소:**
   - `OrdersPage`는 heading과 두 filter tablist를 각각 `heading`·`filters` slot으로 주입한다.
   - `MyShopsSection`은 목록 heading과 primary action을 `heading` slot으로 옮겼다.
   - Home 마감 임박 preview는 `HomeSectionHeading`을 분리해 `ListFrame.heading`이 소유한다.
   - ready/loading grid는 전 소비자에서 `ListGrid` preset resolver를 공유하고 cursor pagination은 공통 `CursorPagination`을 사용한다.
2. **정적 guard false pass — 해소:**
   - `frontend/scripts/check-ui-system.mjs:77-102`가 대상 소비자별 필수 `heading`/`filters` slot을 `ListFrame` 구성 블록 안에서 검사한다.
   - 구성 블록 누락과 직접 `grid-cols-*` 복제를 실패 처리해 단순 import/이름 포함만으로 통과하던 경로를 닫았다.
   - 기존 built-in/legacy palette, raw color, token 중복, 구 API, chrome selector, 카드 표시 순수성, 상태 대비 검사도 유지된다.

## 전체 계약 확인

- `TopNavbar`, `HorizontalNav`, mobile drawer, `MobileBottomNav`, `AppFooter`, `CompareBar`는 `app-chrome`과 고정 commerce semantic token을 사용하며 route accent 후손 selector는 0건이다.
- route accent는 world-map과 명시적 content scope에 격리되고 `/market/:id` 성공 경로도 응답 element를 등록한다.
- footer density/content plane/static accent는 `routeUi.ts` pathname metadata로만 결정된다.
- 삭제된 `AppFooterContext`, `RouteVisualThemeContext`, `ItemCard`, `ItemCardGrid`, `ItemCardTile`의 production 참조는 0건이다.
- cursor 목록은 sentinel과 별도로 native “더 보기” button을 제공하고 fetch 중 disabled/status를 노출한다.
- compare는 44px secondary-action sibling으로 flip trigger와 분리됐으며 card action은 link/button 단일 주 행동, Escape는 flip focus subtree로 제한된다. dialog focus trap·Escape·body lock·trigger focus 복귀도 유지된다.
- `success-ink`/`danger-ink`와 soft 배경 조합은 guard의 4.5:1 하한을 통과한다.
- tracked diff 124개 기존 파일의 대량 변경은 semantic token 치환, 구 API 제거, 계약상 목록·카드 이관과 문서 동기화로 추적된다. 사용자 소유 테스트를 제외한 무관한 대량 리팩터·포맷 변경은 확인되지 않았다.

## 검증 결과

- `npm.cmd run check:ui-system`: 통과
- `npm.cmd run typecheck`: 통과
- `npm.cmd run lint`: 오류 0, 사용자 소유 `InventoryItemCard.test.tsx` warning 2건
- `npm.cmd run test`: 98 files / 760 tests 통과. `HomePage.test.tsx`의 기존 `NoticeSection` key warning 1건 출력
- `npm.cmd run build`: 통과. 단일 JS chunk 경고(`665.63 kB`, gzip `179.94 kB`)
- `git diff --check`: whitespace error 0

## 최종 판정

critical/major가 0건이고 전체 프론트 검증이 통과했다. minor 2건은 후속 보강 대상으로 남기되 FC-278의 `review_status`는 **passed**다.
