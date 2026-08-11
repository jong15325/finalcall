# 수평 AppShell·공통 콘텐츠 평면 계약 v1.4

- 상태: **DECIDED — 경매 목록 불투명 page region 예외 승인 2026-08-11**
- 적용 범위: `AppShell` 아래 모든 공개·보호·404 route
- 제외: `AuthLayout`의 로그인·회원가입·OAuth callback, API·백엔드·DB
- 선행 계약: `element-detail-background-contract.md` v2.1 및 FC-244

> **후속 대체(2026-08-12):** 배경 관련 §1·§5.1·§6은
> `world-map-common-background-contract.md` v1.0이 우선한다. 모든 AppShell route는 단일 세계지도 scene을
> 공유하고 `/auctions` water는 별도 scene이 아니라 water 권역 accent다. AuthLayout 제외, 내비게이션과
> single content plane 계약은 유지한다.

## 1. 셸 구조

모든 AppShell route는 아래 구조를 공유한다.

```text
AppShell
├─ background layer
├─ sticky header
│  ├─ utility row (64px)
│  └─ desktop horizontal navigation (48px, xl 이상)
├─ main
│  └─ single white content plane
├─ footer
├─ CompareBar
└─ mobile navigation (xl 미만)
```

- 일반 route background layer는 기존 `surface-sunken` 정적 배경이다. 새 이미지·Canvas·RAF를 만들지 않는다.
- `/auctions/:id`, `/items/:id`는 기존 동적 속성 이미지·particle background를 유지하고, 정확한
  `/auctions`는 승인된 정적 water background 예외를 사용한다. 세 route 모두 동일한 white content plane과
  `RouteVisualThemeProvider`의 검증·cleanup 계약을 따른다. 그 밖의 route에는 이미지·particle이 없다.
- `main`은 모든 AppShell route에 동일한 outer gutter를 제공한다: 기본 `px-3 py-4`, `sm`에서
  `px-5 py-5`, `xl`에서 `px-8 py-7`이다. route별 임의 gutter 재정의는 금지한다.
- white content plane은 AppShell이 한 번만 소유한다. 각 페이지가 별도 page shell을 중복 생성하지 않는다.
  최대 폭은 1440px이며 mobile부터 white·`rounded-xl`·border·`shadow-sm`, `xl`부터 `rounded-2xl`을 쓴다.
  내부 responsive padding은 기존 AppShell 공통 padding을 유지한다.
- **경매 상세 `/auctions/:id`만 예외**로 `ElementDetailBackground`의 children 전체를 감싸는 불투명 white
  page-level content region을 하나 더 둔다. 이는 사용자가 배경 장면과 거래 콘텐츠를 명확히 분리하도록 승인한
  시각 경계이며, 뒤로가기·상태 알림·Hero·입찰 패널·입찰 이력 전부가 region 안에 있어야 한다.
- 위 예외는 `/items/:id`와 다른 route에 확장하지 않는다. 아이템 상세는 AppShell single plane과 기존
  detail theme을 유지하고, 일반 route도 중첩 page wrapper를 만들지 않는다.
- **경매 목록 `/auctions`도 별도 승인 예외**로 AppShell plane 안에 불투명 white page-level
  `auction-list-region` 하나를 둔다. 페이지 제목·설명, 필터, 정렬·결과 수, loading·error·empty, 카드 grid,
  pagination을 포함한 목록의 모든 상태와 제어가 region 안에 있어야 한다.
- `/auctions`와 `/auctions/:id` 외 route에는 page-level 중첩 region을 추가하지 않는다.
- 320px에서도 gutter 안의 usable width를 보장하고 input·주요 CTA가 잘리거나 가로 스크롤을 만들지 않는다.
  loading·error·404도 동일 plane geometry 안에서 렌더해 상태 전환 layout jump를 막는다.
- content plane에는 `overflow`, `transform`, `filter`, z-index stacking context를 만들지 않는다. full-width가
  필요한 하위 콘텐츠도 plane 안에서 처리하며 AppShell 밖으로 탈출하지 않는다.
- 상세 두 route의 fixed viewport 이미지·particle은 plane 바깥 gutter에서 계속 보여야 한다. plane을 배경
  component 안에 중첩하거나 별도 흰 veil로 viewport를 덮지 않는다.
- 앞 조항의 중첩 금지는 경매 상세의 승인된 content region에 한해 번복한다. region은 viewport veil이 아니라
  AppShell plane 안쪽의 유한한 content boundary이며 outer gutter의 이미지·particle을 가리지 않는다.
- 중첩 금지는 `auction-list-region`에도 동일하게 번복한다. 목록 region도 viewport veil이 아니며 water scene과
  outer gutter를 가리지 않는 유한한 경계다.
- 경매 content region은 `bg-surface`/`#fff`, responsive padding, mobile부터 radius·border·shadow를 사용한다.
  정확한 padding은 기존 AppShell plane 내부 여백과 합쳐 320px usable width를 해치지 않도록 구현하되,
  desktop에서 region과 AppShell plane 사이의 여백이 육안으로 구분돼야 한다.
- region에도 `overflow`, `transform`, `filter`, z-index stacking context를 만들지 않는다.
- `auction-list-region`은 opaque `bg-surface`/`#fff`, responsive padding, mobile부터 radius·border·shadow를
  사용한다. 내부 카드·필터·form은 기존 light baseline과 정보 구조를 유지한다.
- footer·CompareBar는 background 위, modal·drawer·dropdown은 모든 shell layer 위에 있어야 한다.

## 2. 반응형 내비게이션

### 2.1 PC (`xl`, 1280px 이상)

- PC Sidebar는 렌더하지 않는다. pin·hover flyout·PC용 localStorage 상태도 제거 대상이다.
- sticky header는 64px utility row + 48px horizontal navigation의 2단 구조다.
- utility row는 브랜드·페이지 문맥과 기존 계정/잔액/쪽지/알림 cluster를 유지한다.
- horizontal navigation은 홈·마켓·게시판 등 `navItems.tsx`의 그룹 구조를 표시한다. active leaf와 active
  ancestor를 모두 식별하며 `ready:false`는 클릭 가능한 링크로 위장하지 않는다.

### 2.2 모바일·태블릿 (`xl` 미만)

- 기존 Sidebar의 mobile drawer만 유지한다. hamburger·backdrop·Escape·바깥 클릭·focus 동작을 보존한다.
- `MobileBottomNav`의 5탭 순서, safe-area, active 상태, 준비중/인증 접근 의미를 유지한다.
- main의 bottom padding과 CompareBar 위치는 MobileBottomNav를 가리지 않아야 한다.

### 2.3 메뉴 단일 원천

- desktop horizontal nav와 mobile drawer는 `navItems.tsx`의 동일 `NavEntry` source를 소비한다.
- MobileBottomNav는 같은 파일의 기존 `mobileNav` source를 유지한다. 컴포넌트별 메뉴 복제는 금지한다.
- 경로 조립은 `paths.ts`를 사용하고 문자열 route를 새로 하드코딩하지 않는다.

### 2.4 PC hover·명시 조작 병행

- `xl` horizontal group은 기존 click·keyboard 동작을 유지하면서 fine pointer의 `pointerenter`로 연다.
- hover 기능은 `(hover: hover) and (pointer: fine)` 환경에서만 활성화한다. coarse/touch pointer는 hover 상태를
  만들지 않고 click·keyboard만 사용한다.
- trigger와 panel을 하나의 hover boundary로 취급한다. pointer가 전체 boundary를 떠난 뒤 150ms grace 후
  닫아 trigger-panel bridge gap과 미세한 포인터 이탈에 따른 깜빡임을 막는다. 재진입 시 timer를 취소한다.
- 상태 원인은 `hover`와 `explicit`으로 구분한다. pointerenter는 hover-open이다. click은 기존 toggle을
  유지해 closed면 explicit-open, hover/explicit-open이면 close한다. Enter/Space·ArrowDown으로 연 상태는
  explicit-open이다. pointerleave timer는 hover-open만 닫고, explicit-open은 재클릭·Escape·바깥 클릭·
  route 변경으로 닫는다.
- focus가 trigger/panel 안에 있으면 pointerleave로 닫지 않는다. keyboard 사용자가 panel을 탐색하는 동안
  DOM을 제거하지 않으며, focus가 root 밖으로 이동하면 기존 명시 close 규칙을 적용한다.
- timer와 pointer/media-query listener는 unmount·route 변경에서 cleanup한다. 여러 group panel이 영구적으로
  동시에 열린 상태가 남지 않아야 한다.

## 3. Vuexy 활용 계약

Vuexy·Bootstrap 패키지, SCSS, JS runtime과 외부 CSS는 추가하지 않는다. 현재 React 19·Tailwind 4 스택을
유지하며 Vuexy의 구조·밀도·동작을 repo-native 컴포넌트와 semantic class로 번역한다.

- 구조 어휘: `layout-wrapper`, `layout-page`, `layout-navbar`, `layout-menu-horizontal`,
  `content-wrapper`, `container-xxl` 대응 관계를 컴포넌트 역할과 문서에 유지한다.
- 재현 대상: 1440px container, 2단 sticky header, compact grouped navigation, active ancestor, dropdown의
  border·radius·shadow·간격과 responsive 전환.
- 비재현 대상: Vuexy blue/gray palette, Bootstrap utility class, jQuery/plugin behavior, 라이선스가 불명확한
  자산. 색상은 FinalCall navy·gold·orange·surface 토큰을 사용한다.

## 4. 키보드·접근성 계약

- 상단 주내비는 `<nav aria-label="주요 메뉴">`, 그룹 trigger는 native `button`, leaf는 native link다.
- 그룹 trigger는 `aria-expanded`·`aria-controls`를 제공한다. Enter/Space로 열고 Escape로 닫으며,
  방향키로 형제/자식 항목을 탐색할 수 있다. hover만을 유일한 열기 수단으로 쓰지 않는다.
- 완전한 roving tabindex를 구현하지 않으면 `menubar/menu/menuitem` role을 사용하지 않는다.
- focus가 메뉴 밖으로 이동하거나 route가 바뀌면 dropdown을 닫는다. backdrop 없는 desktop dropdown도
  바깥 클릭과 Escape에 응답한다.
- 320px부터 가로 스크롤이 없어야 하고 200% 확대에서 utility cluster·주내비·콘텐츠 CTA가 겹치거나
  사라지지 않아야 한다. 1280px 폭에서 긴 그룹명·로그인 상태 cluster를 검증한다.
- focus ring, 텍스트, active/disabled 상태는 WCAG AA 및 색 단독 전달 금지를 지킨다.

## 5. Stacking·scroll·상세 테마 계약

- sticky header는 background와 content plane 위, modal/drawer보다 아래다. 기존 dialog `z-50`, mobile drawer,
  CompareBar, MobileBottomNav의 상대 순서를 테스트로 고정한다.
- AppShell/main/content plane에 새 scroll container를 만들지 않는다. BidPanel·ComparePage sticky,
  body scroll-lock, `scrollbar-gutter: stable`, fixed dialog 위치를 보존한다.
- outer gutter·mobile frame 도입 뒤에도 주요 CTA 최소 터치 영역, 320px usable width, loading/error/404,
  sticky panel, modal focus/stacking과 body scroll-lock을 동일하게 보존한다.
- 상세 route에서 header·horizontal nav·footer·CompareBar는 기존 `detail-chrome` semantic theme을 소비한다.
  일반 route에서는 상세 selector·이미지·Canvas·네트워크 요청·RAF가 0이어야 한다.
- 경매 content region 안의 `AuctionHeroCard`·`BidPanel`·`BidHistory`는 기존 dark/glass
  `.detail-surface` 색 재정의를 소비하지 않는다. 밝은 `bg-surface`, 기본 text/line, 가벼운 border·shadow로
  region 위 정보 계층을 만든다. 기존 컴포넌트 구조·정보·CTA는 보존하고 주요 CTA는 FinalCall orange를 쓴다.
- `/items/:id`의 `.detail-surface`와 AppShell chrome theme은 변경하지 않는다.
- route 이탈 시 상세 theme·dropdown·mobile drawer 임시 상태를 cleanup한다.

## 5.1 `/auctions` 고정 water scene 예외

- 정확한 pathname `/auctions`는 API 응답과 무관한 정적 `water` route theme을 사용하고, 상세와 동일한
  `ElementDetailBackground` 이미지·CSS·단일 Canvas particle engine을 한 번만 렌더한다.
- 매칭은 `pathname === paths.auctions`와 동등한 exact 규칙이다. `/auctions/:id`·다른 prefix route에는
  정적 water source가 적용되지 않는다.
- `RouteVisualThemeProvider`는 theme source를 분리한다: 상세 성공 응답의 dynamic registration과 exact
  static route map. 해석 우선순위는 **현재 pathname과 일치하는 detail dynamic → exact static → null**이다.
- `/auctions/:id`에서는 상세 성공 응답 element가 water 정적값보다 항상 우선한다. 목록→상세 전환 중 목록
  water가 한 frame이라도 상세 theme으로 오인되지 않도록 pathname 일치를 동기 검증한다.
- static theme source는 theme token만 결정하고 이미지/Canvas를 별도로 로드하지 않는다. route별 scene owner는
  하나뿐이며 image request·Canvas·RAF loop를 중복 생성하지 않는다.
- `/auctions` 목록 콘텐츠는 기존 opaque AppShell white plane 안에 유지한다. 목록 카드·필터를 투명/glass로
  바꾸지 않으며 그 안의 `auction-list-region`에 전체 목록을 수용한다. water background/particle은 region과
  plane 바깥 gutter에서 보인다.
- 목록 이탈 시 static theme·scene DOM·image lifecycle·RAF·resize/visibility listener를 즉시 cleanup한다.
  다른 목록·route에는 water token·DOM·요청·RAF가 0이어야 한다.

## 6. 검증 계약

- 구조: xl 이상 Sidebar DOM 0, 2단 header 높이 64+48px, xl 미만 mobile drawer/BottomNav 유지.
- 메뉴: 단일 source, active leaf/ancestor, disabled, 인증 유무, keyboard/Escape/outside click.
- hover: fine pointer enter open, trigger+panel boundary leave 150ms grace close, bridge 재진입 cancel, explicit
  click/keyboard 우선, coarse pointer hover 0, timer/listener cleanup.
- 배경: 일반 route surface-sunken, 상세 두 route만 viewport 이미지/particle, 전 route single white content
  plane과 `px-3 py-4 → sm:px-5 py-5 → xl:px-8 py-7` outer gutter.
- 경매 상세: `ElementDetailBackground` 내부 opaque page region 1개, 뒤로가기·상태·Hero·Bid·History 포함,
  viewport background/particle outer 유지. 아이템 상세·다른 route에는 이 region 0개.
- 평면: mobile `rounded-xl border shadow-sm`, xl `rounded-2xl`, max 1440px. plane의
  overflow/transform/filter/z-index stacking context 0개.
- 경매 region: overflow/transform/filter/z-index context 0개, 밝은 카드 surface와 orange CTA, loading·error·404도
  동일한 시각 boundary와 폭·padding을 사용한다.
- 경매 목록: exact `/auctions` water theme·scene 1개, opaque AppShell plane 유지, 상세 dynamic precedence,
  route 이탈 및 다른 route token/DOM/request/RAF 누출 0개.
- 경매 목록 region: 제목·설명·필터·정렬/결과수·모든 데이터 상태·grid·pagination 포함, 밝은 card/form baseline,
  overflow/transform/filter/z-index context 0개, 320px·200% 확대와 sticky/pagination 동작 보존.
- 공개 route: 홈·경매·마켓·비교·게시판·충전·404의 layout/overflow/active nav.
- 보호 route: 판매·마이·주문·쪽지·인벤토리·보관·지갑·아이템상세·게시글 작성/수정과 route guard.
- 회귀: sticky, modal, dropdown, drawer, CompareBar, footer, scroll-lock, 320px·1280px·200% 확대.
- 성능: 일반 route에 신규 이미지/Canvas/RAF 0, 상세 asset/particle 상한은 선행 계약 유지.
- 전체 frontend typecheck·lint·test·build 통과.

## 7. 영향 티켓

- FC-245: 계약·디자인 정본
- FC-246: desktop horizontal navigation model
- FC-247: responsive AppShell migration
- FC-248: common background/content plane
- FC-249: public route regression
- FC-250: protected route regression
- FC-251: detail background/theme integration regression
- FC-252: final integrated review
- FC-253: common outer gutter·mobile white frame geometry change
- FC-254: geometry·sticky·modal·scroll final re-review
- FC-255: auction detail opaque page-level content region
- FC-256: auction region·surface·stacking final re-review
- FC-257: horizontal hover arbitration·auction list water scene
- FC-258: hover a11y·theme precedence·scene cleanup final re-review
- FC-259: auction list opaque page-level region
- FC-260: auction list region·scene·responsive final re-review
