# FC-256 독립 리뷰

- 대상 계약: `docs/spec/horizontal-app-shell-contract.md` v1.2
- 대상 커밋: `857a94b`
- 최종 판정: **passed**
- 집계: critical 0 / major 0 / minor 0

## 경매 상세 opaque region

- 성공 화면은 `ElementDetailBackground`의 content 안에 `AuctionPageRegion`을 정확히 한 번 렌더한다.
- 뒤로가기, 성공 toast, AuctionHeroCard, BidPanel, BidHistory가 모두 동일 region 내부에 포함된다.
- region은 `bg-surface`의 불투명 흰 배경, `border-line`, `rounded-xl`, `shadow-sm`, `xl:rounded-2xl`을 사용한다. AppShell plane 안쪽에서도 border와 shadow로 독립된 page boundary가 구분된다.
- region padding은 `p-3 sm:p-5 lg:p-6`으로 320px에서 과도한 중첩 여백이나 고정 폭을 만들지 않는다.
- region에 `overflow`, `transform`, `filter`, `z-index`가 없어 modal fixed positioning, sticky, stacking을 방해하지 않는다.

## 내부 surface·정보 계층

- `.auction-detail-region .detail-surface`의 더 높은 specificity가 기존 dark/glass 상세 override를 경매 region 안에서만 해제한다.
- Hero, BidPanel, BidHistory는 흰 `--surface`, 밝은 `--line`, 기본 `--gray-900`/`--gray-500`, 가벼운 shadow로 복원된다.
- 경매 region 전용 selector라 `/items/:id`의 기존 `.detail-surface` theme에는 영향이 없다.
- 가격 강조 block과 상태 badge 같은 의도된 nested surface는 유지되어 흰 region → 밝은 카드 → navy 가격 block의 계층이 명확하다.
- 주요 입찰 CTA는 기존 element별 `detail-cta` 대비 토큰과 orange 의미를 유지하고, 종료·본인·비로그인·즉시구매 상태 표현도 회귀하지 않는다.
- 기본 본문, 보조 text, border 및 focus ring 토큰은 밝은 surface에서 기존 WCAG AA 조합을 유지한다.

## 배경·상태 경계

- fixed viewport image/particle scene은 region의 형제가 아니라 `ElementDetailBackground` scene/content 계층으로 분리되어 region 뒤와 AppShell outer gutter에서 계속 보인다.
- scene은 region 안에 포함되지 않으며 region이 viewport veil이나 새 fixed containing block을 만들지 않는다.
- loading, transport error, 404도 동일 `AuctionPageRegion`을 사용해 성공 전환과 같은 흰 boundary·padding을 유지한다. 이 상태에서는 상세 theme/scene을 등록하지 않는다.
- id와 route 전환 시 기존 theme, image, Canvas RAF·media/resize/visibility listener cleanup이 유지된다.

## stacking·scroll·responsive 회귀

- BidPanel은 `lg:sticky lg:top-28`로 64px + 48px desktop header 아래에 유지된다.
- Bid/Purchase dialog는 region DOM 아래에 있어도 조상에 transform/stacking context가 없으며 실제 overlay는 `fixed z-50`이다.
- dialog open/unmount 시 body scroll-lock 저장·복원, focus lifecycle 및 Escape 처리가 유지된다.
- AppShell plane과 region 모두 새 scroll container를 만들지 않는다. BidHistory의 table overflow는 카드 내부의 의도된 국소 overflow다.
- 320px 및 200% 확대에서 grid는 단일 열로 흐르고 CTA는 full width이며, region의 `min-w-0`과 responsive padding으로 outer horizontal scroll을 만들지 않는다.
- footer, CompareBar, MobileBottomNav, header 및 outer gutter particle 가시성에 회귀가 없다.

## 검증 결과

- `npm.cmd test -- --run`: 통과 — 95 files, 762 tests
- `npm.cmd run typecheck`: 통과
- 변경 TypeScript 대상 ESLint `--max-warnings=0`: 통과
- `npm.cmd run build`: 통과 — 기존 500kB 초과 chunk 경고
- 전체 `npm.cmd run lint -- --max-warnings=0`: 변경 범위 밖 `InventoryItemCard.test.tsx` 81·94행의 기존 `react/jsx-sort-props` warning 2건으로 종료 코드 1
- CSS 파일은 현재 ESLint 대상이 아니며 별도 지정 시 “matching configuration 없음” warning이 발생한다. CSS 문법은 production build에서 통과했다.
- 전체 테스트 stderr의 기존 `NoticeSection` key warning은 FC-256 변경 범위 밖이다.

확정 계약을 차단하는 critical/major/minor 발견이 없어 통과 판정한다.
