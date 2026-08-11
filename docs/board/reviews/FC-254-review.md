# FC-254 최종 재리뷰

- 대상 계약: `docs/spec/horizontal-app-shell-contract.md` v1.1
- 최초 구현: `9f4005d`
- 재작업: `5e756e0`
- 최종 판정: **passed**
- 집계: critical 0 / major 0 / minor 0

## 이전 발견 해결 확인

### `<xl` MobileBottomNav 하단 여백

- `main`에 `pb-16 sm:pb-16 xl:pb-7`을 명시하여 `sm:py-5`가 tablet 하단 여백을 덮지 않는다.
- 최종 padding-bottom은 320px 64px, 640px 64px, 1279px 64px, 1280px 28px다.
- 따라서 MobileBottomNav가 존재하는 전체 `<xl` 구간에서 마지막 콘텐츠와 CTA의 보호 공간이 유지되고, nav가 사라지는 `xl`부터 계약의 28px vertical gutter로 전환된다.

### BidPanel sticky offset

- BidPanel의 desktop sticky offset이 `lg:top-28`(112px)로 변경됐다.
- TopNavbar 64px + HorizontalNav 48px = 112px 관계를 충족하여 sticky 패널이 두 헤더 아래에 놓이고, horizontal nav와 겹치지 않는다.

### 회귀 테스트

- AppShell 테스트가 320/640/1279/1280 네 경계의 최종 bottom padding 관계를 고정한다.
- 실제 BidPanel 테스트가 `lg:top-28` 및 `112 >= 64 + 48` 관계를 검증한다. 이전처럼 Auction page mock만으로 sticky 계약을 우회하지 않는다.

## 누적 v1.1 계약 확인

- 모든 AppShell route의 공통 gutter는 `px-3 py-4 → sm:px-5 sm:py-5 → xl:px-8 xl:py-7`이며 route별 중복 gutter가 없다.
- single white content plane은 mobile부터 border, `rounded-xl`, `shadow-sm`, max 1440px를 사용하고 `xl:rounded-2xl`로 전환된다.
- Auction 상세에 중첩 max-width/page shell이 없고 loading, success, transport error, 404가 동일 plane에 containment된다.
- content plane과 main에 `overflow`, `transform`, `filter`, `z-index` 또는 새 scroll container가 없다.
- 상세 두 route의 fixed image/particle scene은 plane 바깥 gutter에서 보이며 theme·image·Canvas/RAF/listener cleanup이 유지된다.
- 320px에서 12px outer gutter와 usable content width, full-width CTA, 64px bottom-nav 보호 공간을 유지한다.
- 실제 Bid/Purchase modal은 `fixed z-50`, focus lifecycle 및 body scroll-lock 복원을 유지하며 plane이 fixed containing block이나 stacking context를 만들지 않는다.
- footer, CompareBar, MobileBottomNav, desktop 2단 sticky header, AuthLayout 분리에 회귀가 없다.
- 일반 route는 surface-sunken만 사용하며 상세 image/Canvas/RAF를 만들지 않는다.

## 검증 결과

- `npm.cmd test -- --run`: 통과 — 95 files, 762 tests
- `npm.cmd run typecheck`: 통과
- 변경 대상 ESLint `--max-warnings=0`: 통과
- 전체 `npm.cmd run lint -- --max-warnings=0`: 변경 범위 밖 `InventoryItemCard.test.tsx` 81·94행의 기존 `react/jsx-sort-props` warning 2건으로 종료 코드 1. FC-254 변경 파일에는 error/warning이 없다.
- 전체 테스트 stderr의 기존 `NoticeSection` key warning은 FC-254 변경 범위 밖이다.

확정 계약을 차단하는 critical/major 및 후속 minor가 없어 통과 판정한다.
