# 프론트 UI 시스템 계약 v1.0

- 상태: **DECIDED — 게이트2 사용자 승인 2026-08-12**
- 적용 범위: `frontend/src/**`, `frontend/tailwind.config.cjs`, AppShell 아래 공개·보호·404 route
- 제외: API wire contract, 백엔드, DB 스키마, `AuthLayout`의 독립 레이아웃 구조
- 목적: 디자인 토큰, AppShell chrome, 목록 프레임, 아이템 카드의 단일 계약을 확정해 route·페이지별 시각/상호작용 포크를 막는다.
- 선행 계약: `horizontal-app-shell-contract.md` v1.5, `world-map-common-background-contract.md` v1.0,
  `element-detail-background-contract.md` v2.2

## 1. 승인 결정과 우선순위

게이트2에서 아래를 확정했다.

1. **navy/gold/orange를 FinalCall 공식 브랜드 팔레트로 승격**한다.
2. AppShell의 header, desktop/mobile navigation, footer, CompareBar는 route와 무관한 **고정 commerce
   chrome**이다. route accent가 이 영역을 재색하지 않는다.
3. route accent는 AppShell이 소유한 world-map 장식과 route가 명시한 content subtree에서만 소비한다.
4. shell/footer 정책은 페이지 effect가 부모 상태를 변경하는 방식이 아니라 route metadata로 선언한다.
5. 목록은 `ListFrame`이 header·filter·상태·grid·pagination의 공통 구조를 소유하고 ready와 skeleton이 같은
   layout preset을 소비한다.
6. 카드는 `ItemCardView`(표시), controlled flip(선택 상호작용), `ItemCardActionSurface`(이동/열기)를 분리한다.
   dialog·router·mutation 상태를 표시 컴포넌트에 넣지 않는다.
7. 변경은 호환 adapter를 둔 단계적 이관으로 수행하고, 각 단계는 독립적으로 되돌릴 수 있어야 한다.

이 문서는 위 범위에서 최상위 UI 구현 계약이다. `PRODUCT.md`와 `DESIGN.md`는 제품/도구 입력 요약이고,
`docs/ux/design-system.md`는 디자인 참고 자료다. 토큰 값·소비 경계·컴포넌트 책임이 어긋나면 이 계약이 우선한다.

## 2. 토큰 단일 정본 계약

### 2.1 정본과 소비면

- **설계 정본은 이 문서 [2]**다. 같은 의미의 값이나 역할을 다른 문서·컴포넌트가 재정의하지 않는다.
- 런타임 단일 값 파일은 `frontend/src/styles/tokens.css`로 이관한다. 이 파일은 [2.2]~[2.5]를 기계적으로
  옮긴 배포 표현이며 독립적인 결정 원천이 아니다.
- `frontend/src/index.css`는 `tokens.css`를 한 번 import하고 base/component layer만 소유한다. 브랜드 값과
  컴포넌트별 색 램프를 재선언하지 않는다.
- `frontend/tailwind.config.cjs`는 semantic utility 이름을 CSS custom property에 매핑한다. hex·rgb 값을
  다시 쓰지 않는다.
- 컴포넌트 TSX/CSS는 semantic token만 소비한다. raw color는 아래 예외 외에는 금지한다.
  - `tokens.css`의 승인 registry
  - 원본 게임 아트의 크로마키/픽셀 재현과 골드포스 프레임처럼 `ItemFrame` 내부에 격리된 asset token
  - 카카오·네이버 등 외부 브랜드 공식색
  - 색 계산·fixture를 검증하는 테스트 데이터
- 기존 `navy-*`, `gold-*`, `orange-*`, `gray-*` palette utility는 이관 기간의 호환 alias다. 새 코드가 직접
  소비하지 않으며 최종 단계에서 제거한다.

### 2.2 공식 팔레트

| 계열 | 토큰 | 값 | 역할 |
|---|---|---:|---|
| navy | `brand-navy` | `#16213A` | 브랜드 구조색, 고정 chrome 배경 |
| navy | `brand-navy-900` | `#101A2E` | footer·강한 chrome |
| navy | `brand-navy-800` | `#1B2A47` | chrome hover/raised |
| navy | `brand-navy-700` | `#223458` | chrome border/selected |
| gold | `brand-gold` | `#C8A028` | 브랜드 강조·가격 보조 신호 |
| gold | `brand-gold-bright` | `#DFC447` | dark chrome 위 hover/focus 보조 |
| gold | `brand-gold-deep` | `#8B6100` | light surface 위 gold 전경 |
| gold | `brand-gold-soft` | `#F6EDCD` | gold 선택·안내 배경 |
| orange | `action` | `#EF8A2C` | 주요 CTA·활성 조작 |
| orange | `action-hover` | `#D9741A` | CTA hover/pressed |
| orange | `action-soft` | `#FDEFE0` | 선택·hover 보조 면 |
| surface | `surface` | `#FFFFFF` | 카드·콘텐츠·입력 표면 |
| surface | `surface-sunken` | `#F4F5F8` | 앱 canvas·함몰 면 |
| border | `line` | `#E4E7EE` | 장식 경계·구분선 |
| text | `fg` | `#171A20` | light surface의 제목·본문 |
| text | `fg-muted` | `#4D5461` | 보조 본문·메타 |
| text | `fg-subtle` | `#6B7484` | 캡션·placeholder |

상태색은 `success #16A34A`, `danger #E11D48`, `warning #A0510A`, `info #1D4ED8`를 사용하고 각
`*-soft`는 `tokens.css`에서 한 번만 정의한다. 상태색은 정보 의미에만 쓰며 CTA·route accent를 대신하지 않는다.

게임 element 색과 브랜드 gold는 이름과 소비 경계를 분리한다. `element-*`, `item-goldforce-*`는 아이템 아트,
속성 라벨, 프레임 안에서만 사용한다. `brand-gold-*`와 서로 alias하지 않는다.

### 2.3 semantic alias

컴포넌트는 palette 이름 대신 다음 역할 이름을 우선 사용한다.

| semantic token | 매핑 | 허용 소비자 |
|---|---|---|
| `app-canvas` | `surface-sunken` | AppShell main 바탕 |
| `content-surface` | `surface` | content plane·card·form |
| `chrome-bg` | `brand-navy` | header·nav·mobile nav·CompareBar |
| `chrome-bg-strong` | `brand-navy-900` | footer |
| `chrome-fg` | white | chrome 본문·아이콘 |
| `chrome-muted` | 승인된 light neutral | chrome 보조 문구 |
| `control-action` | `action` | primary action |
| `control-action-hover` | `action-hover` | primary action hover/pressed |
| `control-focus` | `brand-gold-bright` | dark chrome focus 또는 light surface에서 검증된 focus ring |
| `content-fg` | `fg` | light content 제목·본문 |
| `content-muted` | `fg-muted` | light content 보조 정보 |
| `content-line` | `line` | light content 경계 |

`text-body`처럼 typography utility와 충돌하는 color 이름을 만들지 않는다. 색 utility는 `text-fg`,
`text-fg-muted`, `bg-content-surface`, `bg-chrome`처럼 역할이 드러나야 한다.

### 2.4 typography·geometry·motion

- font: Pretendard → Noto Sans KR → system-ui fallback. 외부 font load 실패가 기능을 막지 않는다.
- 수치: 금액·잔액·카운트다운·수량은 `font-num`과 `tabular-nums`를 사용한다.
- 역할형 크기: `label 11`, `micro 12`, `body 13`, `value 17`, `figure 28`, `title 34`, `figure-xl 44px`.
- spacing: 4px 기반. 임의 1px 보정은 border·광학 보정 외 금지한다.
- radius: `sm 4`, `md 6`, `lg 8`, `xl 12px`, pill만 full.
- motion: fast 120ms, base 200ms, slow 320ms. layout을 지속 애니메이션하지 않고 transform/opacity를 우선한다.
- breakpoint는 현 `xs 576`, `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536px`를 유지한다.

### 2.5 토큰 변경 절차

- 토큰 추가는 기존 역할로 표현할 수 없다는 소비 사례와 WCAG 대비 계산이 있어야 한다.
- 한 컴포넌트만을 위한 이름은 global token으로 승격하지 않는다. 두 번째 독립 소비자가 생기기 전에는 component
  local variable로 둔다.
- 기존 토큰의 값·의미·삭제는 UI 계약 변경이며 게이트2 대상이다. 호환 alias 제거는 모든 소비자 이관과 정적
  검증 통과 뒤에만 한다.

## 3. AppShell chrome·route accent 계약

### 3.1 불변 chrome 경계

다음은 route, API 응답 element, loading/error 상태와 무관하게 [2]의 commerce token만 소비한다.

- `TopNavbar`
- `HorizontalNav`
- mobile drawer의 navigation chrome
- `MobileBottomNav`
- `AppFooter`
- `CompareBar`

위 DOM에는 `app-chrome` 또는 각 컴포넌트의 명시적 class를 사용한다. `detail-chrome`처럼 route selector가
후손의 text/background/border utility를 포괄 재정의하는 class는 제거 대상이다.

금지 예시는 다음과 같다.

```css
[data-route-accent] .app-chrome { /* 금지 */ }
[data-detail-theme] .detail-chrome [class*='text-'] { /* 금지 */ }
```

chrome 안의 dropdown·drawer도 같은 commerce 계열을 쓴다. modal은 자신의 feature/content surface 계약을 따르되
route accent가 자동 상속되지 않는다.

### 3.2 route accent 경계

route accent source는 기존 우선순위를 유지한다.

1. 현재 pathname과 일치하는 상세 성공 응답의 검증된 element
2. exact `/auctions`의 static water accent
3. neutral

accent는 다음 두 위치에만 전달한다.

1. AppShell 단일 `WorldMapBackground`의 장식 밀도·광원
2. route가 직접 렌더한 `<RouteAccentScope accent={...}>` subtree

`RouteAccentScope`는 content 안에 명시적으로 놓고, 내부에서 `--route-accent`와 장식용 파생 token만 제공한다.
CTA·상태·focus·본문 색을 재정의하지 않는다. 페이지 전체 content plane, AppShell root, `body`/`html`에 scope를
두지 않는다.

`RouteVisualThemeProvider`는 이관 중 이름을 유지할 수 있으나 최종 책임은 `RouteAccentProvider`로 축소한다.
반환 값은 `accent`와 상세 응답 등록 API뿐이고 `routeThemeStyle()`처럼 chrome token bundle을 반환하지 않는다.

### 3.3 scene·성능 불변식

- `WorldMapBackground` owner, image, Canvas, RAF loop는 AppShell당 각각 최대 1개다.
- route 전환은 scene을 재생성하지 않고 accent state만 바꾼다.
- chrome 고정으로 인해 새로운 backdrop blur, filter animation, Canvas 또는 image request를 추가하지 않는다.
- reduced motion, update slow, forced colors, visibility cleanup과 particle/DPR 상한은
  `world-map-common-background-contract.md` v1.0을 그대로 따른다.

## 4. 선언형 shell/footer metadata 계약

### 4.1 metadata 정본

`frontend/src/app/routeUi.ts`에 pathname pattern별 `RouteUiMetadata`를 한 번 정의하고 AppShell이 현재 pathname으로
해석한다. 페이지 컴포넌트가 effect로 AppShell 상태를 변경하지 않는다.

```ts
type FooterDensity = 'default' | 'compact'

interface RouteUiMetadata {
    footer: FooterDensity
    contentPlane: 'default' | 'auction-list' | 'auction-detail'
    staticAccent?: 'water'
}
```

- metadata는 URL·API 계약이 아니라 UI registry다. route path는 `paths.ts`를 참조하고 문자열을 중복하지 않는다.
- 동적 route는 `matchPath`로 해석한다. first-match가 아니라 우선순위가 명시된 exact/dynamic registry를 사용한다.
- footer density는 route 의미로 고정한다. DOM 높이, viewport 추정, ResizeObserver로 판정하지 않는다.
- loading/error/empty/ready 전환이 footer density를 바꾸지 않는다. 목록의 짧은 상태는 `ListFrame` 안에서 안정된
  최소 구조를 제공하고 footer는 route 기본값을 유지한다.
- `useAppFooterVariant`와 setter Context는 모든 route 이관 후 제거한다.

### 4.2 compact footer

compact는 404, 준비 중, 완료 확인처럼 route 자체가 짧은 경우에만 등록한다. 동일 `<footer>` landmark, 서비스 링크,
정책 링크와 법적 고지는 유지하고 padding·그룹 간격만 줄인다. 별도 DOM 복제나 링크 숨김은 금지한다.

## 5. 목록 프레임 계약

### 5.1 책임

`ListFrame`은 다음 순서를 단독 소유한다.

```text
ListFrame
├─ heading / description / primary action
├─ filters
├─ result summary / sort
├─ state region
│  ├─ loading: 동일 grid preset + skeleton item
│  ├─ error: 오류 설명 + retry
│  ├─ empty: 빈 이유 + 가능한 next action
│  └─ ready: 동일 grid preset + item children
└─ pagination / infinite-scroll fallback
```

페이지는 서버 query를 상태 union으로 변환하고 도메인 copy·filter·item renderer만 주입한다. 별도의 loading grid,
empty wrapper, pagination 간격, footer variant effect를 다시 만들지 않는다.

### 5.2 공개 API

구현 API는 아래 의미를 보존한다. 이름의 기계적 조정은 허용하지만 책임을 합치거나 page로 되돌리지 않는다.

```ts
type ListFrameState =
    | { kind: 'loading'; count: number }
    | { kind: 'error'; message: string; onRetry: () => void }
    | { kind: 'empty'; title: string; description?: string; action?: ReactNode }
    | { kind: 'ready' }

type ListLayoutPreset =
    | 'catalog'       // 2 / 3 / 6열
    | 'auction'       // 1 / 2 / 3열
    | 'inventory'     // catalog 열 + 고밀도 gap
    | 'preview'       // 2 / 3 / 6열 preview
    | 'two-column'    // 주문 등 1 / 2열

interface ListFrameProps {
    state: ListFrameState
    layout: ListLayoutPreset
    label: string
    as?: 'section' | 'ul'
    heading?: ReactNode
    filters?: ReactNode
    resultBar?: ReactNode
    pagination?: ReactNode
    renderSkeleton: (index: number) => ReactNode
    children?: ReactNode
}
```

- layout preset 이름은 도메인 권한이 아니라 geometry를 나타낸다. 같은 geometry는 같은 preset을 쓴다.
- ready와 loading은 하나의 `ListGrid` resolver를 공유한다. skeleton이 grid class를 복제하지 않는다.
- `count`는 예상 viewport를 안정적으로 채우는 유한값이며 API 결과인 척하는 문구·가짜 가격을 렌더하지 않는다.
- loading skeleton은 `aria-hidden`; state region은 전환 시 적절한 `aria-busy`; error/empty는 제목과 행동의
  접근 가능한 이름을 갖는다.
- cursor 목록은 sentinel만 두지 않고 keyboard용 “더 보기” fallback을 제공한다.

### 5.3 목록별 이관 범위

우선 소비자는 `AuctionListPage`, `MarketPage`, `InventorySlotGrid`, `HomePage` preview다. 이어 `OrdersPage`,
`MyShopsSection`과 같은 반복 목록을 동일 state/layout 계약으로 이관한다. 게시글·메모처럼 카드 geometry가 다른
목록은 `ListFrame` state shell은 공유하되 item/card preset을 억지로 합치지 않는다.

## 6. 아이템 카드 composition 계약

### 6.1 책임 분리

| 구성요소 | 소유 책임 | 금지 책임 |
|---|---|---|
| `ItemCardView` | 아트·제목·메타·스킬·가격·badge/footer slot의 순수 표시 | router, dialog open state, mutation, global listener, flip state |
| `ItemCardFlip` | 앞/뒤 면과 controlled `flipped` 상태의 표현·키보드 조작 | item 데이터 매핑, modal 열기, route 이동 |
| `ItemCardActionSurface` | link 또는 button 하나의 주 행동과 접근 가능한 이름 | dialog 렌더, mutation, 다른 interactive child 덮기 |
| feature adapter | API summary→view model, flip/open state, dialog·route·mutation 조립 | 카드 chrome·grid class 재작성 |
| `CardInfoDialog` | controlled dialog shell·focus trap·Escape·scroll lock | 구매/판매 mutation과 도메인 query 소유 |

### 6.2 표시 API

```ts
interface ItemCardViewModel {
    name: string
    typeLabel: string
    level: number
    element: ElementKey | null
    artUrl: string | null
    skills: readonly ItemSkillView[]
    price?: { amount: number | null; label?: string }
    seller?: string
    goldforceExpireAt?: string | null
}

interface ItemCardViewProps {
    item: ItemCardViewModel
    density?: 'regular' | 'compact'
    artworkOverlay?: ReactNode
    badge?: ReactNode
    footer?: ReactNode
}
```

`ItemCardView`는 `Date.now()`를 매 렌더에서 직접 읽지 않는다. 시간 파생이 필요한 경우 adapter가 목록 공통 `now`를
주입하거나 파생 view model을 만든다. `variant='market'`이 시각·flip·가격 유무를 한꺼번에 결정하는 방식은
호환 기간 뒤 제거한다. 가격 부재는 데이터 부재이고, flip은 interaction composition이며, density는 geometry다.

### 6.3 controlled flip

```ts
interface ItemCardFlipProps {
    flipped: boolean
    onFlippedChange: (next: boolean) => void
    front: ReactNode
    back: ReactNode
    label: string
}
```

- flip은 스킬 뒷면이 실제로 있는 카드에만 조립한다.
- Escape 처리는 focus가 flip control 안에 있을 때만 적용한다. 카드마다 `window` keydown listener를 등록하지 않는다.
- hover는 보조 신호다. touch·keyboard에는 명시적 native button이 있고 `aria-expanded`·`aria-controls`를 제공한다.
- reduced motion에서는 3D transition을 제거하고 즉시 면을 교체한다.

### 6.4 action surface

```ts
type ItemCardAction =
    | { kind: 'link'; to: string; label: string }
    | { kind: 'button'; label: string; onPress: () => void }
```

- 한 카드의 주 action은 link 또는 button 중 하나다. `div` click과 중첩 interactive element를 사용하지 않는다.
- 전체 `absolute inset-0` 버튼이 flip, compare, badge action, footer action을 덮지 않아야 한다. 주 action 영역과
  보조 action 영역을 DOM상 형제로 분리한다.
- modal을 여는 button은 `aria-haspopup="dialog"`를 제공하고 dialog가 닫힐 때 trigger로 focus를 복귀시킨다.
- compare, 판매 취소, 배송 action 같은 보조 행동은 named slot으로 주입하지만 action surface보다 높은 z-index에
  의존해 충돌을 숨기지 않는다. DOM hit area 자체가 겹치지 않아야 한다.

### 6.5 과일반화 경계

- 가로 `AuctionCard`, 주문 행, 임시보관 행은 별도 형태로 유지한다. `ItemCardView`에 거대한 layout switch를 넣지 않는다.
- 공통화 대상은 `ItemFrame`, `ItemSkillSummary`, 금액/상태 표시와 list state shell이다.
- 구매·판매·배송 mutation을 item 카드 커널로 올리지 않는다.
- boolean prop을 추가해 기능을 조합하지 않는다. 서로 독립인 축은 data, geometry, interaction component, slot으로
  분리한다.

## 7. 단계적 마이그레이션·되돌리기

| 단계 | 변경 | 완료 기준 | 되돌리기 |
|---|---|---|---|
| 1 | token registry와 semantic Tailwind mapping 추가 | 기존 화면 무변경, raw token 이중 선언 제거 | 호환 alias 유지 상태로 registry 제거 |
| 2 | AppShell chrome 고정 + route metadata | 일반/상세 chrome 동일, accent는 scene/content scope만 | 구 provider adapter 복원 |
| 3 | `ListFrame`/`ListGrid` 추가 후 목록별 이관 | ready/loading geometry 동일 | 페이지를 구 wrapper로 복귀 |
| 4 | `ItemCardView`·controlled flip·action surface 추가 | 표시와 interaction 테스트 독립 통과 | 구 `ItemCard` adapter 유지 |
| 5 | market/inventory/home/shop 소비자 순차 이관 | modal·compare·flip·판매/배송 회귀 없음 | 소비자별 adapter 복귀 |
| 6 | 구 API·palette utility·context 제거 | 소비자 0건, 정적 guard 통과 | 직전 alias 커밋 복원 |

- 단계 사이에 구·신 정본을 동시에 직접 수정하지 않는다. 호환 adapter는 신 정본을 호출해야 한다.
- API response·query key·URL·backend contract는 바꾸지 않는다.
- 새 dependency, CSS-in-JS, component library를 추가하지 않는다. React 19·Tailwind 4·현 테스트 스택을 유지한다.
- atomic commit 단위는 위 단계 또는 한 소비자군이다. 시각 회귀가 발견되면 전체 이관을 되돌리지 않고 해당 소비자
  adapter만 복귀할 수 있어야 한다.

## 8. 검증 계약

### 8.1 정적 검증

- `tokens.css`와 승인 예외 외 production TSX/CSS raw hex 0건.
- token custom property 중복 정의 0건, Tailwind config raw color 0건.
- `[data-route-accent] .app-chrome`, `[data-detail-theme] .detail-chrome` 같은 chrome 후손 재색 selector 0건.
- `useAppFooterVariant` 소비자와 setter Context 0건.
- ready와 skeleton의 grid class 직접 복제 0건; 둘 다 같은 preset resolver 사용.
- 카드 표시 컴포넌트의 router/dialog/store import, `window` listener, mutation hook 0건.
- 카드 주 action과 보조 interactive target의 중첩·hit-area 겹침 0건.

### 8.2 동작·접근성

- route 이동과 상세 element 변경에서 world-map accent만 바뀌고 header/nav/footer/mobile nav/CompareBar의 computed
  commerce color는 변하지 않는다.
- exact `/auctions` static water, 상세 dynamic 4종, neutral 우선순위와 cleanup을 검증한다.
- compact/default footer는 metadata로만 결정되고 loading/error/empty/ready 전환에서 흔들리지 않는다.
- 목록 loading→ready에서 grid 열·gap·outer geometry와 pagination 위치가 유지된다.
- 키보드만으로 카드 주 action, flip, compare, dialog 열기/닫기와 focus 복귀를 완주한다.
- 색만으로 element·상태를 전달하지 않고 label/icon을 병기한다.
- 320px, 390px, 768px, 1280px, 1536px와 200% 확대에서 가로 overflow·CTA 겹침이 없다.
- reduced motion, forced colors, coarse pointer, screen reader landmark/list/dialog를 검증한다.

### 8.3 성능·회귀

- AppShell scene DOM·image·Canvas·RAF는 각각 최대 1개이며 chrome 격리로 추가 작업을 만들지 않는다.
- 목록의 공통 `now`와 stable callback을 유지해 대량 카드가 매초 전량 rerender되지 않는다.
- modal body scroll-lock, sticky header/panel, dropdown/drawer stacking, MobileBottomNav safe area, CompareBar offset을 보존한다.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`를 통과한다.

## 9. 선행 계약 대체 범위

이 문서는 다음 조항을 해당 범위에서 대체한다. 나머지 조항은 유지한다.

1. `element-detail-background-contract.md` v2.2 [2.1]
   - **대체:** Sidebar·TopNavbar·footer·CompareBar·MobileBottomNav가 상세 route의 반투명/속성 chrome token을
     소비한다는 조항.
   - **대체:** `[data-detail-theme]`가 chrome의 text/background/focus/CTA를 포괄 재정의하는 구현.
   - **유지:** 상세 성공 응답 element 검증, accent 등록 수명, content subtree의 명시적 장식, 접근성·성능 상한.
2. `horizontal-app-shell-contract.md` v1.5 [5]
   - **대체:** 상세 route에서 header·horizontal nav·footer·CompareBar가 `detail-chrome` theme을 소비한다는 조항.
   - **유지:** shell geometry, stacking, body 단일 scroll, content plane, 경매 opaque region.
3. `horizontal-app-shell-contract.md` v1.5 [5.2]
   - **구체화/대체:** 페이지 hook·상태 effect로 footer variant를 전달하는 구현. route metadata만 정본이다.
   - **유지:** `100dvh`, normal-flow footer, compact footer의 landmark·링크·safe-area 계약.
4. `world-map-common-background-contract.md` v1.0 [2]·[4]
   - **유지·구체화:** AppShell 단일 scene과 accent 우선순위는 유지한다. accent가 commerce chrome으로 확장되지
     않는다는 경계를 이 문서 [3]이 추가로 강제한다.

`docs/ux/design-system.md`의 black CTA/purple accent와 라이트 표면 token handoff는 이 게이트2에서 공식
구현 정본이 아니게 됐다. 디자인 원리·접근성 근거는 참고할 수 있으나 브랜드 값과 매핑은 이 문서 [2]를 따른다.
`docs/frontend/rules.md [9.3]`의 variant 중심 카드 규약은 같은 형태 재사용·단방향 의존 원칙은 유지하되,
표시·flip·action을 한 `variant`가 함께 결정하는 부분은 이 문서 [6]이 우선한다. 규약 문서 동기화는 별도 영향
티켓이며 이 계약 작성에서 다른 소유 문서를 수정하지 않는다.

## 10. 영향 티켓

기존 완료 티켓은 감사 이력으로 수정하거나 재개하지 않는다. 아래 신규 델타 티켓으로 추적한다.

| 티켓 | owner | 내용 | 의존 |
|---|---|---|---|
| `FC-270` | architect | 본 UI 시스템 계약 확정·선행 계약 supersede 연결 | 없음 |
| `FC-271` | frontend-impl | 공식 token registry·semantic Tailwind mapping·호환 alias | FC-270 |
| `FC-272` | frontend-impl | 고정 commerce chrome·RouteAccentScope·선언형 route UI metadata | FC-271 |
| `FC-273` | frontend-impl | `ListFrame`·공통 state/grid/skeleton/pagination 기반 | FC-271 |
| `FC-274` | frontend-impl | `ItemCardView`·controlled flip·`ItemCardActionSurface` 기반 | FC-271 |
| `FC-275` | frontend-impl | 공개 목록·market/home/auction 소비자 단계 이관 | FC-272, FC-273, FC-274 |
| `FC-276` | frontend-impl | 보호 목록·inventory/sell/orders 소비자 단계 이관 | FC-272, FC-273, FC-274 |
| `FC-277` | frontend-impl | 구 theme/footer/card API와 palette alias 제거·정적 guard | FC-275, FC-276 |
| `FC-278` | reviewer | 토큰·chrome 격리·목록·카드·접근성·성능 통합 리뷰 | FC-277 |
| `FC-279` | main/consultant | 디자인/프론트 규약의 새 정본 참조 동기화 | FC-270 |

- `FC-272`, `FC-273`, `FC-274`는 `FC-271` 뒤 쓰기 파일 집합이 겹치지 않을 때 병렬 가능하다.
- `FC-275`와 `FC-276`도 공개/보호 소비자 파일 집합을 분리하면 병렬 가능하다.
- 직접 영향 이력: FC-180~184(카드 시스템), FC-239~244(상세 theme/chrome), FC-245~269(AppShell·scene·footer).
- 비영향: API contract, ERD, backend, item element wire 값, 경매/구매/배송의 도메인 동작과 데이터 스키마.

