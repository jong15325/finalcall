# FC-252 리뷰

- 대상 계약: `docs/spec/horizontal-app-shell-contract.md` v1.0
- 대상 커밋: `f71147d`
- 판정: **changes-requested**
- 집계: critical 0 / major 3 / minor 2

## Major

### 1. 닫힌 모바일 drawer가 키보드 포커스 순서에서 제거되지 않는다

- 위치: `frontend/src/components/layout/Sidebar.tsx`의 `aside`와 내부 `nav`
- 재현: 1280px 미만에서 drawer를 닫은 상태로 `Tab`을 반복한다. 화면 밖으로 이동된 Sidebar 안의 링크와 버튼에도 포커스가 들어간다.
- 기대: 닫힌 drawer는 DOM에서 제거하거나 `inert`/동등한 포커스 억제를 적용하여 키보드 탐색 대상이 아니어야 한다. 열 때 drawer로 포커스를 옮기고, 닫을 때 트리거로 복원하는 수명주기도 보장해야 한다.
- 실제: 컨테이너에 `aria-hidden`과 `translate-x-full`만 적용된다. 자식 링크·버튼은 계속 포커스 가능하며, 열기/닫기 포커스 이동·복원도 없다. 이는 보이지 않는 컨트롤로 포커스가 이동하는 접근성 회귀이며 계약의 drawer focus 요구를 충족하지 않는다.

### 2. 데스크톱 horizontal nav의 최상위 형제 방향키 탐색이 구현되지 않았다

- 위치: `frontend/src/components/layout/HorizontalNav.tsx`의 최상위 링크/그룹 trigger 키보드 처리
- 재현: 데스크톱에서 `홈`, `마켓`, `게시판` 중 하나에 포커스를 둔 뒤 `ArrowLeft` 또는 `ArrowRight`를 누른다.
- 기대: 계약대로 방향키로 형제 항목을 이동하고, 그룹 안에서는 위/아래 방향키로 자식 항목을 순환해야 한다.
- 실제: 그룹 trigger는 `ArrowDown`만 처리하고 최상위 형제의 `ArrowLeft`/`ArrowRight` 처리가 없다. 자식 위/아래 및 Escape 복원은 구현됐지만 전체 키보드 계약은 미완성이다.

### 3. 아이템 상세 route에서 `마켓` 활성 조상이 표시되지 않는다

- 위치: `frontend/src/components/layout/HorizontalNav.tsx`의 `active` 계산 및 `frontend/src/components/layout/navItems.ts`의 route 매핑
- 재현: `/items/:id`에 직접 진입하거나 목록에서 아이템 상세로 이동해 데스크톱 horizontal nav를 확인한다.
- 기대: 상세 route에서도 소속 최상위 메뉴인 `마켓`이 활성 상태로 표시되어 현재 위치의 정보 구조를 전달해야 한다.
- 실제: 그룹 활성 여부는 자식 target(`/market`, `/auctions`, `/sell`) prefix만 검사한다. `/items/:id`는 어느 target에도 매칭되지 않아 활성 조상이 없다.

## Minor

### 1. 공통 content plane의 계약상 시각 토큰이 누락됐다

- 위치: `frontend/src/components/layout/AppShell.tsx`의 `data-testid="app-content-plane"`
- 재현: 일반·상세 route를 1280px/1440px에서 확인한다.
- 기대: 계약에 명시된 공통 white plane의 border·radius·shadow·responsive padding 토큰이 일관되게 적용되어야 한다.
- 실제: 흰 배경·최대 너비·padding은 있으나 border·radius·shadow가 없다. 단일 plane 구조는 맞지만 확정된 surface 표현을 온전히 재현하지 않는다.

### 2. 핵심 회귀를 막는 테스트가 부족하다

- 위치: `frontend/src/components/layout/HorizontalNav.test.tsx`, `Sidebar.test.tsx`, `AppShell.test.tsx`
- 재현: 현재 테스트에서 닫힌 drawer의 실제 tab 순서, 최상위 좌우 방향키, `/items/:id` 활성 조상, 실행 중 breakpoint 전환을 변이시켜도 일부는 검출되지 않는다.
- 기대: FC-252의 핵심 상호작용과 runtime breakpoint 계약을 사용자 관점으로 계측한다.
- 실제: desktop Sidebar DOM 0, 자식 ArrowDown/Escape, outside close, plane class는 검증하지만 위 결함과 breakpoint change listener의 실제 전환은 검증하지 않는다.

## 확인된 계약 충족 사항

- `xl` 이상에서 Sidebar는 실제 DOM 0이며, TopNavbar 64px + HorizontalNav 48px의 2단 sticky 구조다.
- `xl` 미만에서는 drawer와 MobileBottomNav가 유지되고, `matchMedia` change listener 등록·해제 및 desktop 전환 시 drawer close가 구현됐다.
- pin UI/state와 `localStorage` 사용은 제거됐다.
- Sidebar·HorizontalNav·MobileBottomNav는 동일 `navItems`를 사용하고, 준비 중 항목은 native disabled button으로 노출된다.
- AppShell route에는 `surface-sunken` 배경과 단일 white content plane이 적용되고 AuthLayout은 분리돼 있다. content plane에 금지된 `overflow`·`transform`·`filter`·`z-index`는 없다.
- 상세 두 route의 이미지/particle 배경과 기존 modal·sticky·CompareBar·footer·body scroll-lock 구조는 유지됐다.
- Vuexy/Bootstrap 의존성은 추가되지 않았다.

## 검증 결과

- `npm.cmd test`: 통과 — 95 files, 758 tests
- `npm.cmd run typecheck`: 통과
- 변경 대상 8개 파일 ESLint `--max-warnings=0`: 통과
- `npm.cmd run build`: 통과 — 기존 500kB 초과 chunk 경고만 존재
- 전체 `npm.cmd run lint -- --max-warnings=0`: 실패 — 변경 범위 밖 `InventoryItemCard.test.tsx`의 기존 `react/jsx-sort-props` warning 2건(81, 94행)

Critical은 없으나 Major가 있으므로 통과할 수 없다.
