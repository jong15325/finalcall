# FC-244 리뷰 — 몰입형 글래스 셸 접근성·성능 최종 리뷰

대상: 계약 `docs/spec/element-detail-background-contract.md` v2.0 · 구현 커밋 `b41a4f9` · reviewer 독립 읽기 전용 판정

## 심각도별 발견

### Critical

- 없음.

### Major

- **확정 목업 parity(`wind=b`, `fire=c`, `earth=c`, `water=c`)를 구현하지 않고 네 속성 particle을 사실상 하나의 단순 엔진으로 축약했다.**
  - 위치: `frontend/src/features/item/components/ElementDetailBackground.tsx:107-157`; 시각 정본 `docs/ux/mockups/auction-detail-immersive-background.html:950-1240`
  - 재현 시나리오: 네 속성 상세의 Canvas 효과를 확정 목업과 나란히 비교한다. 구현은 공통 `x/y/speed/size`만 가진 입자를 사용하고, 물만 짧은 직선 stroke, 나머지는 같은 단색 원을 그린다. 이동도 불은 수직 상승, 나머지는 동일 수직 하강뿐이다. 반면 목업 wind=b는 곡선 ribbon과 중심 회전 궤적, fire=c는 radial glow와 흔들리는 완만 상승, earth=c는 광물 radial glow와 drift, water=c는 낙하체·충돌 crater·ripple·jet을 각각 사용한다.
  - 기대 vs 실제: 계약 §5·§6과 FC-244 DoD는 승인된 motif·밀도·궤적 parity를 요구한다. 실제는 속성별 색과 방향 일부만 다르고 확정 효과의 핵심 형태와 궤적이 누락됐다. `data-particle-limit=48`과 Canvas 개수만 검사하는 현재 테스트도 시각 계약을 증명하지 않는다.

- **CTA 시맨틱 토큰을 정의만 하고 소비하지 않아 orange 배경의 흰 글자가 WCAG AA를 위반한다.**
  - 위치: `frontend/src/components/layout/RouteVisualThemeContext.tsx:34-43`, `frontend/src/features/auction/components/BidPanel.tsx:177-184`, `frontend/src/features/item/components/ItemInstanceDetail.tsx:172-179`, `frontend/src/features/item/components/CompareBar.tsx:96-100`, `frontend/src/features/auction/components/BidDialog.tsx:340-346`, `frontend/src/features/auction/components/SellConfirmDialog.tsx:248-254`
  - 재현 시나리오: 상세 테마에서 입찰·즉시구매·로그인 유도·경매 등록·비교·모달 확인 CTA를 본다. 계약용 `--detail-cta-bg:#f59e0b`와 `--detail-cta-text:#18181b`가 정의됐지만 CSS 사용처가 없고 컴포넌트는 계속 `bg-orange text-white`다. 계산 대비는 `#f59e0b/#ffffff = 2.15:1`; `text-sm`/`text-xs`는 큰 텍스트가 아니므로 4.5:1 기준에 미달한다. 계약의 어두운 CTA 글자 조합은 8.25:1이다.
  - 기대 vs 실제: 계약 §2.1·§4는 CTA 의미 보존과 네 속성 모두 텍스트 4.5:1을 요구한다. 실제는 주요 거래 행동 전반의 글자가 AA를 위반하고 정의한 시맨틱 토큰이 dead contract다.

- **dark detail surface에서 기존 navy 전경을 보정하지 않아 상태·아이템 메타 텍스트 대비가 보장되지 않는다.**
  - 위치: `frontend/src/features/item/components/ElementDetailBackground.css:99-127`, `frontend/src/features/item/components/ItemInstanceDetail.tsx:111-116`, `frontend/src/features/auction/components/AuctionHeroCard.tsx:34-38,171-176`, `frontend/src/features/auction/components/BidHistory.tsx:24-29`
  - 재현 시나리오: 아이템 상세 위치 badge, 예약 경매 상태, 낙찰 상태, 채널 숫자를 확인한다. detail surface는 `rgba(10,17,28,.94)`의 짙은 배경으로 바뀌지만 CSS 보정 selector는 `text-gray-*`만 대상으로 한다. `text-navy`/`text-navy-700`과 `bg-navy/5~10` 조합은 그대로 남아 어두운 surface에서 전경과 배경이 함께 navy 계열로 수렴한다.
  - 기대 vs 실제: 계약 §4는 card·상태 표현의 일반 텍스트 4.5:1과 색 이외 상태 의미 유지를 요구한다. 실제는 라벨 문자열은 남아도 읽을 수 있는 대비를 토큰 또는 surface로 보장하지 못하며, 네 속성 최악 배경 대비 검증 테스트도 없다.

- **runtime `update:slow` 또는 coarse pointer 전환 시 숨겨진 Canvas RAF가 계속 실행된다.**
  - 위치: `frontend/src/features/item/components/ElementDetailBackground.tsx:73-85,96-99,158-215`, `frontend/src/features/item/components/ElementDetailBackground.css:177-187`, `frontend/src/features/item/components/ElementDetailBackground.test.tsx:134-172`
  - 재현 시나리오: fine/normal 상태로 상세을 연 뒤 실행 중 `(update: slow)` 또는 `(pointer: coarse)`가 true가 되게 환경을 전환한다. CSS는 update:slow에서 Canvas를 `display:none`으로 숨기지만 JS의 lowPower 값은 마운트 시 고정이고 AmbientCanvas는 update MQL을 만들거나 구독하지 않는다. coarse MQL도 초기 particle 수와 `start()` 조건에만 읽고 change listener가 없다. 따라서 이미 시작된 RAF는 계속 돈다.
  - 기대 vs 실제: 계약 §5는 update:slow/모바일·coarse 환경에서 정적 또는 24개 이하로 강등하고 event/media listener를 정리할 것을 요구한다. 실제는 초기 진입만 강등하고 runtime 변화에서는 보이지 않는 작업이 지속된다. 테스트도 reduced-motion과 forced-colors만 동적으로 전환한다.

### Minor

- **다른 route 무누출 테스트가 DOM/theme selector까지만 확인하고 요청·RAF·listener 0을 계측하지 않는다.**
  - 위치: `frontend/src/components/layout/AppShell.test.tsx:82-109`, `frontend/src/features/item/components/ElementDetailBackground.test.tsx:29-178`
  - 재현 시나리오: 목록 직접 진입 및 상세→목록 이동 테스트를 보면 scene과 `data-detail-theme` 제거만 확인한다. `Image` 생성 수, RAF 취소 후 재호출 없음, media/visibility listener 제거는 AppShell route transition 자체에서 계측하지 않는다.
  - 기대 vs 실제: 계약 §2·§6은 다른 route에서 theme selector·배경·요청·RAF·listener 모두 0을 요구한다. 컴포넌트 unmount 단위 테스트가 일부 보완하지만 pathname/id cleanup과 함께 묶인 통합 보장은 부족하다.

## 확인된 적합 사항

- provider는 `matchPath`로 정확히 `/auctions/:id`, `/items/:id`만 허용하고 registration에 pathname을 함께 저장해 다른 pathname에서는 동기적으로 기본 theme을 소비한다.
- theme 입력은 검증된 `ElementKey|null`과 정적 토큰 맵뿐이며 임의 CSS/URL을 받지 않는다. theme 전달에 body/html class·dataset·style이나 localStorage를 사용하지 않는다(AppShell의 기존 Sidebar pin localStorage는 별도 기능).
- 상세→목록 이동에서 scene과 AppShell `data-detail-theme`이 제거되고 목록 직접 진입에도 theme/scene DOM이 없다. 로딩·에러·404는 상세 wrapper가 없어 baseline AppShell을 유지한다.
- AppShell root는 상세 theme에서 투명해지고 흰 전면 veil pseudo-element가 제거됐다. 배경은 Sidebar·TopNavbar·footer·MobileBottomNav·CompareBar 뒤에서 하나의 fixed scene으로 이어지며 chrome은 국소 반투명 surface를 사용한다.
- 단일 상세 인스턴스당 Canvas 하나·RAF loop 하나이며 desktop 48, coarse 24 배열 상한, DPR 1.5, delta 40ms, resize 120ms debounce를 적용한다. visibility·reduced-motion·forced-colors·unmount 정리는 구현돼 있다.
- 장식 scene/Canvas는 `aria-hidden`, `pointer-events:none`이고 forced-colors에서 scene 전체가 제거된다. focus-visible은 2px gold ring과 offset을 제공한다.
- 콘텐츠 wrapper는 modal을 가두는 z-index stacking context를 만들지 않는다. 실제 Bid/Purchase modal `z-50`, TopNavbar/MobileNav `z-30`, CompareBar `z-40`, Sidebar/drawer와 body scroll-lock 기존 테스트는 유지된다.
- main/route wrapper에 overflow container나 `100vw`를 추가하지 않아 sticky 입찰, body scroll, scrollbar-gutter 구조를 보존한다.
- 배포 JPG 4종은 308,985~430,526바이트로 500KB 목표·800KB 상한을 충족하고 현재 element 1종만 요청한다.
- 변경은 route theme host, chrome/content 소비, particle 엔진, 상세 CTA 및 관련 검증 범위에 추적되며 무관한 대규모 포맷 변경은 없다. 경로 주입·인가·결제 로직 변경도 없다.

## 검증 결과

- `npm.cmd test`: 통과 — 93파일, 751테스트.
- `npm.cmd run typecheck`: 통과.
- `npm.cmd run lint -- --max-warnings=0`: 실패 — 변경 범위 밖 기존 `InventoryItemCard.test.tsx`의 `react/jsx-sort-props` 경고 2건. 변경 대상 13개 파일을 별도 ESLint 실행한 결과 통과.
- `npm.cmd run build`: 통과. Vite가 기존 500KB 초과 JS chunk 경고를 출력했으나 빌드는 성공했다.
- 기존 `HomePage.test.tsx` React key stderr 경고 1건은 이번 변경과 무관하고 테스트 실패는 아니다.
- 접근성/UX 기술 감사 점수: 접근성 1/4, 성능 2/4, 반응형 3/4, 테마 2/4, 안티패턴 3/4 — 합계 11/20(Acceptable). Major 4건이 통과를 차단한다.

## 판정

`review_status: changes-requested`

Critical은 없으나 목업 parity, CTA/상태 대비, runtime 저전력 강등에 Major 4건이 있어 통과 아님. 메인세션은 FC-244를 Done으로 전이하면 안 된다.
