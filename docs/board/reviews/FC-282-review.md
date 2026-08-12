# FC-282 모바일 배경·CTA 대비 재작업 최종 리뷰

- 대상: 최신 FC-282 diff, `frontend-ui-system-contract.md`, AppShell·WorldMapBackground·CTA token/consumer·UI guard
- 판정: **passed**
- 집계: critical 0 / major 0 / minor 1

## Major 재검증 — 해소됨

- 위치:
  - `frontend/src/styles/tokens.css:79`
  - `frontend/tailwind.config.cjs:64`
  - `frontend/scripts/check-ui-system.mjs:63-102`
  - `frontend/src/pages/SellPage.tsx:232,249,266,465`
  - `frontend/src/features/auction/components/PurchaseDialog.tsx:217`
  - `frontend/src/features/shop/components/ShopPurchaseDialog.tsx:208`
- 이전 실제: orange 기본/hover 배경에 흰색 `text-on-strong`을 조합해 대비가 각각 2.52:1, 3.25:1이었다.
- 기대: primary filled-action의 기본·hover 전경이 모두 WCAG AA 4.5:1 이상이어야 한다.
- 최신 실제: 전용 의미 토큰 `control-action-ink=#171A20`을 추가하고 기존 filled orange consumer를 해당 토큰으로 이관했다. 계산 대비는 기본 `#EF8A2C`에서 **6.92:1**, hover `#D9741A`에서 **5.36:1**로 모두 4.5:1 이상이다. Tailwind consumer뿐 아니라 `CardInfoDialog.css:349-350,472-473`의 직접 CSS 조합도 함께 정정됐다.
- 재현 확인: 판매 단계 CTA, 경매/고정가 구매 확정 CTA를 포함한 전체 `bg-control-action` 검색 결과에서 기존 흰색/일반 전경 조합이 남지 않았다.

## Minor 1 — 실제 320/390 scroll·containing-block 회귀 테스트는 아직 없다

- 위치:
  - `frontend/src/components/layout/AppShell.test.tsx:114-188`
  - `frontend/src/components/layout/WorldMapBackground.test.tsx:48-105`
- 재현: 이후 AppShell 또는 상위 요소에 `transform`/`filter`가 추가된 상태로 320px 또는 390px 긴 route를 실제 브라우저에서 스크롤한다.
- 기대: scene의 bounding rect가 스크롤 전후 viewport에 고정되고, header부터 footer까지 배경이 끊기지 않아야 한다.
- 실제: 현재 테스트는 viewport 산술, class와 CSS 문자열을 확인하므로 실제 브라우저의 fixed containing-block 회귀까지 탐지하지는 못한다. 현재 구현 자체에는 해당 ancestor가 없어 동작상 결함은 확인되지 않았으며, 향후 회귀 방지용 보강 사항이다.

## Filled-action 일관성·guard 확인

- `control-action-ink`는 현재 orange filled-action 전체에 적용됐다. 판매/구매 CTA뿐 아니라 로그인·회원가입·게시판·비교·메시지 등 이미 orange fill을 사용하던 control의 전경도 같은 의미 토큰으로 정규화됐다. 대량 변경은 이 일관성 확보를 위한 기계적 토큰 이관이며 무관한 리팩터·포맷 변경은 확인되지 않았다.
- `check-ui-system.mjs`는 Tailwind token 매핑 존재 여부, 기본/hover 대비 4.5:1, Tailwind의 잘못된 `text-on-strong`/`text-content-fg` 조합, 기본+hover fill의 foreground 누락, 직접 CSS의 foreground 누락을 검사한다. 현재 literal consumer와 직접 CSS consumer를 유효하게 방어한다.
- `bg-control-action-soft`와 상태 표면은 이관 대상에서 제외되어 기존 의미와 시각 계층을 유지한다. disabled 상태의 `disabled:*` 동작과 opacity도 바뀌지 않았다.
- TopNavbar의 기존 가입 action처럼 이미 control이었던 요소는 전경만 정규화됐다. HorizontalNav·MobileBottomNav·filter·status의 구조 배경을 orange action으로 바꾸는 변경은 없어 구조색 오염이 없다.

## 모바일 world-map 배경 재검증

- `WorldMapBackground.tsx:15`의 scene은 모든 breakpoint에서 `fixed inset-0`이며 AppShell의 `relative isolate`, chrome/footer/dialog z-index와 함께 viewport 뒤의 독립 레이어를 유지한다. pointer event를 받지 않고, 긴 문서 전체 크기로 canvas backing store가 늘어나지 않는다.
- reduced-motion/update-slow에서는 animation·transition과 canvas만 멈추고 정적 image/glow 배경은 유지한다. forced-colors에서만 scene 전체를 숨기는 예외가 유지된다.
- desktop은 기존 `sm:fixed`의 계산 결과가 이미 fixed였으므로 동작 회귀가 없다.

## 검증 결과

- `npm.cmd run check:ui-system`: 통과
- `npm.cmd run typecheck`: 통과
- `npm.cmd run lint`: 오류 0, 사용자 소유 `InventoryItemCard.test.tsx` warning 2건
- `npm.cmd run test`: 98 files / 765 tests 통과
- `npm.cmd run build`: 통과, 기존 대형 JS chunk 경고만 존재(`669.03 kB`, gzip `180.79 kB`)
- `git diff --check`: whitespace error 0

## 최종 판정

orange filled-action의 기본/hover 대비와 전역 전경 일관성이 해소됐고, soft·disabled·nav/filter/status의 역할 분리는 유지됐다. guard는 현재 사용 패턴을 검사하며 모바일 fixed scene의 layering, 정적 reduced-motion 배경, forced-colors 예외, desktop 동작에도 새 회귀가 없다. critical 0 / major 0 / minor 1로 **통과**, `review_status=passed` 판정이다.
