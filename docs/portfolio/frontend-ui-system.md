# 도시에: 프론트 공통 UI 시스템과 AppShell 시각 일관성 (EPIC-FRONTEND-UI-SYSTEM)

> 포트폴리오(케이스 스터디·이력서 불릿·소개 페이지) 재가공용 **중간 산출물**이다. 정본이 아니라
> 코드·spec·보드·리뷰·결정로그에서 큐레이션한 파생 요약이다. 모든 주장은 증거(파일·커밋·테스트)로
> 뒷받침한다 — 과장·미구현을 구현으로 쓰지 않는다.

- **영역/에픽**: EPIC-FRONTEND-UI-SYSTEM (브랜드 토큰·AppShell·목록·아이템 카드 공통 UI 시스템)
- **상태**: 완료 · 게이트3 승인(Done)
- **기간(커밋 기준)**: `4ee3ef4`(2026-08-13, UI 시스템 통합) ~ `a837eb4`(2026-08-13, 모바일 배경·CTA 대비 최종 보정)
- **관련 티켓**: FC-270(계약) · FC-271~277·279(구현/이관/정본 동기화) · FC-278(통합 리뷰) · FC-280~282(사용자 피드백 기반 회귀 보정)
- **Jira 미러**: EPIC=KAN-303 · FC-270~282=KAN-304~316

## 1. 개요 (한 문단)

페이지마다 달랐던 브랜드 색, 상세 route의 속성색이 공통 header/footer까지 번지는 문제, 목록마다 복제된
loading·empty·grid 구조, 표시와 라우팅·모달·flip 상태가 한 컴포넌트에 결합된 아이템 카드를 하나의 UI
계약으로 재구성했다. 게이트2에서 **navy=고정 commerce chrome, gold=브랜드 강조/focus, orange=주요 행동**을
공식 역할로 확정하고, 런타임 토큰→Tailwind semantic utility→컴포넌트의 단방향 소비 구조를 만들었다. 이후
AppShell 정책을 route metadata로 선언하고, `ListFrame`과 카드 composition으로 공개·보호 화면을 단계적으로
이관했다. 통합 직후 실제 사용 피드백에서 드러난 카드 시각·전체 클릭, 이미지 clipping, 모바일 배경과 CTA
대비 회귀도 기존 책임 경계를 되돌리지 않고 보정했다. 최종 리뷰 기록은 critical/major 0, 프론트 **98개
테스트 파일·765개 테스트 통과**다.

## 2. 해결한 기술 도전과 해법

- **색상 정본 분산과 route별 chrome 오염**: 과거 퍼플 브랜드·블랙 CTA 규칙과 상세 속성색 기반 chrome
  재색이 함께 남아 페이지마다 상단·하단 색이 달라졌다. 계약 v1.0과 U-022에서 navy/gold/orange 역할을
  확정하고, 실제 값은 `tokens.css` 한 곳에만 두며 Tailwind는 CSS 변수만 매핑했다. route accent는
  `WorldMapBackground`와 명시적인 `RouteAccentScope`로만 전달하고 `TopNavbar`·navigation·footer·
  `CompareBar`는 고정 commerce token만 소비하게 했다. 정적 guard가 raw color, legacy palette, chrome
  후손 재색 selector를 빌드 전에 탐지한다. (근거: 계약 §1~3, `tokens.css`, `RouteAccentContext.tsx`,
  `check-ui-system.mjs`)

- **페이지 effect가 부모 AppShell 상태를 변경하던 수명 경쟁**: footer 밀도와 content plane을 페이지별
  Context setter/effect로 전달하면 loading·error 전환이나 cleanup 순서에 따라 shell이 흔들릴 수 있었다.
  `routeUi.ts`의 exact/dynamic registry가 pathname만으로 `footer`, `contentPlane`, `staticAccent`를 결정하도록
  바꾸고 `AppFooterContext`·`RouteVisualThemeContext`를 제거했다. 상세 응답 기반 accent 등록은 현재
  pathname과 일치할 때만 유효하도록 별도 상태로 제한했다. (근거: 계약 §4, `routeUi.ts`, `AppShell.tsx`,
  `RouteAccentContext.tsx`; `4ee3ef4` 삭제 이력)

- **목록 상태·그리드의 화면별 복제**: 경매·마켓·인벤토리·주문·홈 preview·내 판매가 heading, filter,
  loading/error/empty/ready, pagination을 각자 조립해 skeleton과 실제 카드의 열·간격이 어긋날 여지가 있었다.
  `ListFrameState` discriminated union과 geometry 기반 5개 preset을 도입하고 ready/loading이 같은
  `ListGrid` resolver를 공유하게 했다. cursor 목록에는 무한스크롤 sentinel과 별도로 native “더 보기”
  버튼을 제공했다. 현재 6개 소비자(`AuctionListPage`, `MarketPage`, `InventoryPage`, `HomePage`,
  `OrdersPage`, `MyShopsSection`)가 공통 구조를 사용하며, guard가 필수 heading/filter slot과 직접
  `grid-cols-*` 복제를 검사한다. 초기 리뷰에서 일부 heading/filter가 프레임 밖에 남은 문제와 import 이름만
  있어도 통과하던 guard의 false pass를 major로 발견했고, 실제 `<ListFrame>...</ListFrame>` 구성 블록을
  검사하도록 보강한 뒤 해소했다. (근거: 계약 §5, FC-278 리뷰, `ListFrame.tsx`,
  `CursorPagination.tsx`, `check-ui-system.mjs`)

- **표시·상호작용이 결합된 거대 카드와 회귀 복구**: 기존 `ItemCard`의 variant가 표시, flip, 가격,
  라우팅/모달까지 함께 결정했다. 이를 순수 표시 `ItemCardView`, controlled `ItemCardFlip`, link/button 단일
  주 행동 `ItemCardActionSurface`, API summary를 표시 모델로 바꾸는 feature adapter로 분리했다. 통합 뒤
  “카드정보 보기” 버튼 노출과 전체 클릭·배지·이미지 배치가 이전 경험과 달라진 회귀는 composition 경계를
  유지한 채 pointer용 action surface와 단일 키보드 대표 action을 분리해 복구했다. flip·compare는 각각
  44px 형제 hit area로 유지하고, 상태 badge는 `pointer-events: none` overlay로 두었다. (근거: 계약 §6,
  FC-280 리뷰, `ItemCardView.tsx`, `ItemCardFlip.tsx`, `ItemCardActionSurface.tsx`)

- **정적 타입 테스트가 잡기 어려운 CSS·대비 회귀**: 공통 카드 root가 grid cell 전체 폭을 소유하지 않아
  마켓 우측 열·내 판매·인벤토리에서 이미지가 잘렸고, 모바일 scene 범위도 짧았다. 전용 artwork root에
  `width: 100%; min-width: 0; display: block`을 적용하고 world-map을 모든 breakpoint에서
  `fixed inset-0`로 고쳤다. 또 orange CTA에 흰 전경을 조합한 초기값은 기본/hover 대비가 각각 **2.52:1,
  3.25:1**이어서 `control-action-ink=#171A20`을 도입해 **6.92:1, 5.36:1**로 올렸다. guard는 기본·hover
  4.5:1 하한과 잘못된 전경 조합을 계산·검색해 재발을 막는다. (근거: FC-281·FC-282 리뷰,
  `ItemFrame.css`, `WorldMapBackground.tsx`, `tokens.css`, `check-ui-system.mjs`)

## 3. 핵심 결정과 근거 (트레이드오프)

- **결정 정본과 런타임 정본을 분리**: 설계 결정은 `frontend-ui-system-contract.md` §2, 배포 값은
  `tokens.css`, Tailwind는 semantic alias 매핑만 담당한다. 컴포넌트가 palette 이름이나 raw hex를 직접
  쓰는 자유를 포기하는 대신 브랜드 변경의 영향 범위와 대비 검사를 한 곳에서 통제한다. 토큰 값·의미 변경은
  게이트2 대상으로 남겼다. (근거: 계약 §2.1·§2.5, U-022)

- **게임 감성과 거래 chrome의 이원화**: element 4색을 없애지 않고 아이템 표현·world-map 장식·명시적
  content scope에 격리했다. route마다 강한 개성을 chrome까지 확장하는 표현력은 줄지만, 돈이 오가는 거래
  표면의 신뢰감과 navigation 일관성을 우선했다. (근거: 계약 §3, `PRODUCT.md` Design Principles,
  U-022)

- **명령형 shell 제어 대신 선언형 route metadata**: DOM 높이 측정·페이지 effect의 유연성을 버리고
  pathname 의미로 footer/content plane을 결정했다. API 상태 변화에 shell이 흔들리지 않고, exact·dynamic
  우선순위와 404 compact 정책을 한 registry에서 검토할 수 있다. (근거: 계약 §4, `routeUi.ts`)

- **거대 variant보다 작은 composition**: 표시·geometry·interaction·slot을 독립 축으로 분리하되 가로
  `AuctionCard`, 주문 행처럼 형태가 다른 UI는 억지로 공통 카드에 넣지 않았다. 공통화 범위를 줄이는 대신
  카드 표시가 router/dialog/store/mutation을 모르는 단방향 경계를 얻었다. (근거: 계약 §6.1·§6.5,
  `check-ui-system.mjs` view purity guard)

- **단계적 이관 후 구 API 제거**: 호환 adapter로 소비자를 나누어 옮긴 뒤 `AppFooterContext`,
  `RouteVisualThemeContext`, 구 `ItemCard`/`ItemCardGrid`/`ItemCardTile`과 palette alias를 제거했다. 일시적인
  이중 경로 비용을 감수해 소비자별 되돌리기를 가능하게 했고, 마지막에는 정적 guard로 구 경로 재유입을
  막았다. API·query key·URL·백엔드 계약과 새 UI dependency는 변경하지 않았다. (근거: 계약 §7,
  `4ee3ef4`, FC-277)

- **새 화면 디자인 게이트는 발동하지 않음**: 이 에픽은 신규 화면 제작이 아니라 기존 공통 UI 정합과
  리팩터링이므로 디자인 게이트 없이 진행했고, 브랜드 값·소비 경계처럼 되돌리기 큰 결정은 게이트2에서
  승인받았다. (근거: 에픽 게이트 기록, 계약 상단 상태)

## 4. 아키텍처

```text
설계 결정
frontend-ui-system-contract §2 + U-022
        │ 기계적 배포 표현
        ▼
styles/tokens.css ──▶ tailwind.config.cjs semantic utility ──▶ 화면 컴포넌트
        │                                                         │
        └──────── check-ui-system.mjs ◀────────────────────────────┘
                  raw color·legacy API·대비·구조 guard

pathname ──▶ resolveRouteUi(routeUi.ts) ──▶ AppShell
                                             ├─ 고정 commerce chrome
                                             ├─ footer density/content plane
상세 성공 응답 element ──▶ RouteAccentProvider ─┬─ WorldMapBackground 1개
                                                 └─ 명시적 RouteAccentScope

서버 query 상태 ──▶ ListFrameState ──▶ ListFrame ──▶ ListGrid preset
                                             └────▶ CursorPagination

feature API summary + 공통 now
        └─▶ toItemCardViewModel
              └─▶ ItemCardView(순수 표시)
                    ├─ ItemCardFlip(controlled, 선택 조립)
                    ├─ ItemCardActionSurface(link | button)
                    └─ feature가 dialog·route·mutation 상태 소유
```

핵심 의존 방향은 **계약→토큰→semantic utility→컴포넌트**, **feature adapter→순수 카드 표시**다. route accent와
도메인 mutation은 공통 chrome/표시 커널로 역류하지 않는다.

## 5. 증거

### 계약·결정·보드

- **계약**: `docs/spec/frontend-ui-system-contract.md` v1.0 — 게이트2 승인(2026-08-12), 토큰·chrome·목록·카드·
  단계적 이관·검증 계약.
- **결정 로그**: `docs/ux/decision-log.md` U-022 — U-021의 브랜드 값/CTA·route chrome 재색 조항을
  supersede하고 navy/gold/orange와 고정 commerce chrome을 확정.
- **상태 근거**: `docs/board/epics/EPIC-FRONTEND-UI-SYSTEM.md`와 FC-270~282 — 전건 `done`,
  `review_status: passed`; 게이트3 사용자 승인 반영.
- **범위**: 프론트 UI 시스템 전용. API endpoint·wire contract·백엔드·DB 스키마 변경 없음(계약 상단·§7).

### 핵심 파일

- `frontend/src/styles/tokens.css` — 브랜드·surface·상태·역할형 token 런타임 단일 값.
- `frontend/tailwind.config.cjs` — raw color 없이 CSS custom property를 semantic utility로 매핑.
- `frontend/src/app/routeUi.ts` — exact/dynamic pathname별 footer/content plane/static accent registry.
- `frontend/src/components/layout/AppShell.tsx` · `RouteAccentContext.tsx` · `WorldMapBackground.tsx` — 고정
  chrome과 route 장식의 소유권 분리, AppShell당 scene 1개.
- `frontend/src/components/common/ListFrame.tsx` · `CursorPagination.tsx` — 목록 상태·geometry·접근 가능한
  pagination 공통 구조.
- `frontend/src/features/item/components/ItemCardView.tsx` · `ItemCardFlip.tsx` ·
  `ItemCardActionSurface.tsx` · `itemCardModel.ts` — 표시·flip·행동·데이터 adapter 분리.
- `frontend/scripts/check-ui-system.mjs` · `frontend/package.json` — semantic token, legacy API, chrome 누수,
  목록 slot/grid, 카드 순수성, CTA 대비 guard와 `prebuild` 연결.

### 테스트·리뷰

- `docs/board/reviews/FC-278-review.md` — 최종 통합 재리뷰 critical 0 / major 0 / minor 2;
  `check:ui-system`, typecheck, lint(error 0), 98 files / 760 tests, build, `git diff --check` 통과 기록.
- `docs/board/reviews/FC-280-review.md` — 카드 시각·전체 클릭·hit area 복구 critical/major/minor 0;
  관련 4 files / 23 tests와 직전 전체 98 files / 762 tests 통과 기록.
- `docs/board/reviews/FC-281-review.md` — 이미지 clipping 수정 critical 0 / major 0 / minor 1;
  98 files / 764 tests 통과 기록.
- `docs/board/reviews/FC-282-review.md` — 모바일 background·CTA 대비 수정 critical 0 / major 0 / minor 1;
  **최신 98 files / 765 tests**와 build 통과 기록.
- 대표 자동 검증: `ListFrame.test.tsx`, `AppShell.test.tsx`, `WorldMapBackground.test.tsx`,
  `ItemCardComposition.test.tsx`, `AuctionPreviewCard.test.tsx`, `InventorySlotGrid.test.tsx`,
  `ShopCard.test.tsx`, `SellPage.test.tsx`, `PurchaseDialog.test.tsx`.
- **검증 범위 주의**: 리뷰가 통과한 구현 자체와 별개로 실제 브라우저의 320/390px 긴 route 스크롤·CSS
  computed clipping, 일부 dynamic accent/coarse pointer/reduced-motion/keyboard pagination 경계는 자동 회귀
  테스트가 직접 보호하지 못한다. FC-278·281·282의 minor 후속 보강 사항이다. lint에는 사용자 소유
  `InventoryItemCard.test.tsx` warning 2건, build에는 기존 단일 JS chunk 경고(최신 669.03kB,
  gzip 180.79kB)가 기록돼 있다.

### 커밋

- `4ee3ef4` `refactor(frontend): 공통 UI 시스템과 브랜드 토큰을 통합` — 계약·토큰·AppShell·목록·카드·
  정적 guard와 소비자 이관(150 files, +4,082/-3,600).
- `f001c31` `fix(frontend): 아이템 카드 시각과 클릭 동작을 복원` — FC-280.
- `0816ecd` `fix(frontend): 목록 카드 이미지 잘림을 수정` — FC-281.
- `a837eb4` `fix(frontend): 모바일 배경과 CTA 색상을 통일` — FC-282, 최종 코드 보정.
