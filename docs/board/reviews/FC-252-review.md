# FC-252 최종 재리뷰

- 대상 계약: `docs/spec/horizontal-app-shell-contract.md` v1.0
- 최초 구현: `f71147d`
- 재작업: `8f7bbdf`
- 최종 판정: **passed**
- 집계: critical 0 / major 0 / minor 0

## 이전 발견 해결 확인

### 닫힌 drawer DOM·focus 제거 및 포커스 수명주기

- `AppShell`이 `!desktop && mobileOpen`일 때만 `Sidebar`를 렌더하므로 닫힌 drawer는 DOM과 tab 순서에서 모두 제거된다.
- drawer mount 후 첫 번째 사용 가능한 메뉴 링크로 포커스가 이동한다.
- Escape, backdrop, 닫기 버튼, 메뉴 이동으로 닫을 때 다음 animation frame에 hamburger로 포커스가 복원된다.
- desktop breakpoint로 전환할 때는 drawer 상태를 정리하되 이미 숨겨지는 hamburger로 포커스를 보내지 않는다.
- breakpoint `matchMedia` change listener는 hook unmount 때 동일 listener로 제거된다.

### HorizontalNav 키보드·활성 조상

- 최상위 준비 완료 항목에 공통 `data-horizontal-root`가 부여됐고, `ArrowLeft`/`ArrowRight`가 disabled 항목을 제외해 순환 이동한다.
- 기존 click, native Enter/Space, 자식 ArrowUp/ArrowDown, Escape 후 trigger 복원, outside focus/click 및 route 변경 close 동작이 유지된다.
- `/items/:id`를 `/market`의 명시적 상세 경로로 포함하여 `마켓` 활성 조상이 표시된다.

### 공통 content plane

- white plane에 desktop 공통 `border-line`, `rounded-xl`, `shadow-sm`가 추가됐다.
- responsive padding과 최대 폭 1440px가 유지된다.
- plane에는 금지된 `overflow`, `transform`, `filter`, `z-index`가 없다.

### 테스트 보강

- 닫힌 drawer DOM 0, 열림 직후 첫 메뉴 포커스, Escape 후 hamburger 복원, runtime mobile→desktop 전환을 검증한다.
- 최상위 좌우 방향키 순환과 `/items/:id` 마켓 활성 조상을 검증한다.

## 누적 계약 회귀 확인

- `xl` 이상 실제 Sidebar DOM 0, TopNavbar 64px + HorizontalNav 48px 2단 sticky 구조를 유지한다.
- `xl` 미만 drawer와 MobileBottomNav를 유지하며 runtime breakpoint 변경을 반영한다.
- pin UI/state 및 `localStorage` 사용은 없다.
- Sidebar·HorizontalNav·MobileBottomNav는 동일 `navItems` source를 소비하고 준비 중 항목은 disabled 상태다.
- 모든 AppShell route는 `surface-sunken` 배경과 AppShell 소유 단일 white plane을 사용하며 AuthLayout은 분리돼 있다.
- `/auctions/:id`, `/items/:id`의 이미지·particle 배경과 route cleanup 계약이 유지된다.
- footer·CompareBar·sticky·dropdown·drawer·modal 계층 및 기존 body scroll-lock에 새 stacking context나 scroll container 회귀가 없다.
- 320px/mobile과 1280px 이상 desktop 전환, 긴 라벨 truncation, 200% 확대를 저해하는 고정 content width나 새 overflow가 없다.
- Vuexy/Bootstrap 의존성은 추가되지 않았다.

## 검증 결과

- `npm.cmd test -- --run`: 통과 — 95 files, 761 tests
- `npm.cmd run typecheck`: 통과
- 변경 대상 ESLint `--max-warnings=0`: 통과
- 전체 `npm.cmd run lint -- --max-warnings=0`: 변경 범위 밖 `InventoryItemCard.test.tsx` 81·94행의 기존 `react/jsx-sort-props` warning 2건으로 종료 코드 1. FC-252 변경 파일에는 error/warning이 없다.
- 전체 테스트 stderr의 `NoticeSection` key 경고는 기존 범위 밖이며 이번 변경의 회귀가 아니다.

확정 계약을 차단하는 critical/major 및 후속 minor가 없어 통과 판정한다.
