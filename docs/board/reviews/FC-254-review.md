# FC-254 독립 리뷰

- 대상 계약: `docs/spec/horizontal-app-shell-contract.md` v1.1
- 대상 커밋: `9f4005d`
- 판정: **changes-requested**
- 집계: critical 0 / major 2 / minor 1

## Major

### 1. `sm`~`xl` 미만에서 MobileBottomNav 보호용 하단 여백이 사라진다

- 위치: `frontend/src/components/layout/AppShell.tsx:96`
- 재현: 640px 이상 1279px 이하 viewport에서 긴 AppShell route를 맨 아래까지 스크롤한다. `main`의 `pb-16`과 `sm:py-5`가 동시에 적용되며, `sm:py-5`가 padding-bottom을 20px로 덮는다. 고정 MobileBottomNav의 약 56px 높이와 safe area보다 작아 마지막 CTA/콘텐츠가 내비게이션 뒤에 가려질 수 있다.
- 기대: `xl` 미만 전 구간에서 MobileBottomNav 높이 이상의 하단 여백을 유지하면서 계약의 top gutter `py-4 → sm:py-5`를 적용해야 한다.
- 실제: 320px 기본 구간은 `pb-16`이 유효하지만 tablet 구간에서는 responsive `py` shorthand와 충돌한다. 계약의 `<xl MobileBottomNav 유지`, 주요 CTA 가림 방지, scroll 회귀 조건을 위반한다.

### 2. BidPanel sticky offset이 112px 데스크톱 헤더보다 작아 패널 상단이 가려진다

- 위치: `frontend/src/features/auction/components/BidPanel.tsx:77`
- 재현: 1280px 이상에서 경매 상세의 긴 입찰 내역을 스크롤해 BidPanel을 sticky 상태로 만든다. 패널은 `lg:top-24`(96px)에 고정되지만 TopNavbar 64px와 HorizontalNav 48px의 합은 112px다.
- 기대: sticky 패널의 상단이 두 sticky header 아래에서 완전히 보여야 한다.
- 실제: 패널 상단 16px가 horizontal navigation 아래로 들어간다. navigation은 `z-20`이라 시각·클릭 영역을 덮을 수 있으며, v1.1의 BidPanel sticky 보존과 layer 계약을 충족하지 않는다.

## Minor

### 1. class 존재만 확인해 responsive cascade와 sticky 실제 위치 회귀를 검출하지 못한다

- 위치: `frontend/src/components/layout/AppShell.test.tsx:103`, `frontend/src/pages/AuctionDetailPage.test.tsx:33`
- 재현: 현재 `AppShell` 테스트는 `pb-16`, `sm:py-5`, `xl:pb-7` class가 각각 있는지만 검사한다. `sm:py-5`가 실제 computed bottom padding을 덮는 것은 검출하지 못한다. Auction 상세 테스트는 BidPanel을 `sticky z-10` mock으로 대체해 실제 `top-24`도 검증하지 않는다.
- 기대: 320px뿐 아니라 `<xl` tablet에서 실제 하단 여백을, 1280px에서 실제 sticky top이 112px 이상임을 검증해야 한다.
- 실제: 두 Major 회귀가 전체 761개 테스트를 통과한다.

## 확인된 계약 충족 사항

- 모든 AppShell route의 outer gutter source는 한 곳이며 `px-3/py-4 → sm:px-5/sm:py-5 → xl:px-8/xl:py-7`을 선언한다.
- single white content plane은 mobile부터 border, `rounded-xl`, `shadow-sm`를 사용하고 `xl:rounded-2xl`, max 1440px를 적용한다.
- content plane에 `overflow`, `transform`, `filter`, `z-index`가 없고 AppShell/main에도 새 scroll container가 없다.
- Auction 상세에는 별도 max-width/page shell wrapper가 없으며 loading, success, transport error, 404가 모두 AppShell plane 안에 남는다.
- 상세 fixed image/particle scene은 viewport에 유지되어 plane 바깥 gutter에서 보이고, id/route 전환 시 theme·image·Canvas listener/RAF cleanup이 유지된다.
- 실제 Bid/Purchase dialog는 `fixed z-50`, focus 처리와 body scroll-lock 복원을 유지하며 plane이 새 fixed containing block이나 stacking context를 만들지 않는다.
- footer, CompareBar, MobileBottomNav 및 AuthLayout 분리에 이번 변경의 구조적 회귀는 없다.
- 320px 기본 구간은 좌우 12px gutter와 `pb-16`을 유지하고 content plane 내부 CTA는 `min-width: 0` 및 full-width 흐름을 유지한다.

## 검증 결과

- `npm.cmd test -- --run`: 통과 — 95 files, 761 tests
- `npm.cmd run typecheck`: 통과
- 변경 대상 ESLint `--max-warnings=0`: 통과
- `npm.cmd run build`: 통과 — 기존 500kB 초과 chunk 경고
- 전체 `npm.cmd run lint -- --max-warnings=0`: 변경 범위 밖 `InventoryItemCard.test.tsx` 81·94행의 기존 `react/jsx-sort-props` warning 2건으로 종료 코드 1
- 전체 테스트 stderr의 기존 `NoticeSection` key warning은 FC-254 변경 범위 밖이다.

Critical은 없으나 Major 2건이 있어 통과할 수 없다.
