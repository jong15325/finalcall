# FC-244 최종 재리뷰 — 몰입형 글래스 셸 접근성·성능

대상: 계약 `docs/spec/element-detail-background-contract.md` v2.0 · 구현 `b41a4f9` · 재작업 `1bae388`, `34f9ec2` · reviewer 읽기 전용 최종 판정

## 심각도별 발견

### Critical

- 없음.

### Major

- 없음.

### Minor

- 없음.

## 잔여 발견 해결 여부

- **TopNavbar·MobileBottomNav unread badge 대비 — 해결.** 두 실제 소비처가 공용 `UNREAD_BADGE_CLASS`의 `bg-orange text-gray-900`을 사용한다. `#f59e0b/#18181b` 대비는 약 8.25:1로 9~10px 숫자의 4.5:1 기준을 충족한다. 공용 클래스 테스트가 orange 배경·dark foreground·white 미사용을 고정한다.
- **CompareToggle 선택·hover 대비 — 해결.** 선택 상태는 `border-gray-900 bg-orange text-gray-900`, 미선택 hover도 orange 전환과 함께 dark text/border를 사용한다. 텍스트와 컨트롤 경계 모두 요구 대비를 충족하고 `aria-pressed` 상태 의미를 유지한다.

## 계약 v2.0 누적 회귀 확인

- RouteVisualThemeProvider는 정확히 `/auctions/:id`, `/items/:id`에서만 검증된 ElementKey와 정적 token을 소비한다. pathname/id 변경 및 unmount에서 기존 등록을 즉시 배제한다.
- theme 전달에 body/html class·dataset·style이나 localStorage를 사용하지 않는다. 다른 route 직접 진입은 theme selector·scene·Image 요청·RAF·media listener가 모두 0이며 상세→목록 이탈에서도 DOM/theme/Canvas 수명이 정리된다.
- 흰 전면 veil 없이 하나의 fixed scene이 Sidebar·TopNavbar·footer·MobileBottomNav·CompareBar 뒤에서 이어진다. chrome·card는 국소 surface로 대비를 책임지고 다른 route baseline은 유지된다.
- 확정 목업 parity는 wind curved ribbon/회전, fire glow·flame/흔들리는 상승, earth mineral·crystal/drift, water 낙하·impact ripple·jet의 서로 다른 primitive와 궤적으로 구현됐다.
- Canvas는 화면당 하나, RAF 하나이며 desktop 48/coarse 24 배열, DPR 1.5, delta 40ms, resize debounce 상한을 지킨다. visibility·reduced-motion·update-slow·coarse pointer·forced-colors 전환에서 stop/clear/restart하고 unmount에서 RAF·timer·listener를 정리한다.
- 네 속성 chrome/card/form의 밝은 text·meta surface, 주요 CTA와 hover의 dark foreground, unread badge와 선택 토글, 2px focus ring이 WCAG AA 대비를 충족한다. 속성 라벨·disabled·danger·success 의미도 유지된다.
- 콘텐츠 wrapper는 stacking context나 overflow container를 만들지 않는다. 실제 modal/dropdown/sticky/body scroll-lock, scrollbar-gutter, Sidebar/TopNavbar/footer/MobileNav/CompareBar z-index와 포커스 동작을 보존한다.
- 장식은 `aria-hidden`, `pointer-events:none`이고 forced-colors에서 제거된다. 320px·200% 확대에서 fixed scene은 레이아웃 폭을 만들지 않으며 주요 콘텐츠의 기존 반응형 구조를 바꾸지 않는다.
- 배포 JPG 4종은 308,985~430,526바이트로 파일당 500KB 목표·800KB 상한을 충족하고 현재 속성 1종만 요청한다.
- 최종 재작업 6개 파일은 잔여 대비 발견과 회귀 테스트에 직접 추적되며 불필요 변경·보안·인가·금전 로직 회귀는 없다.

## 검증 결과

- `npm.cmd test`: 통과 — 94파일, 756테스트.
- `npm.cmd run typecheck`: 통과.
- 최종 재작업 대상 6개 파일 ESLint(`--max-warnings=0`): 통과.
- 기존 `HomePage.test.tsx` React key stderr 경고는 이번 변경과 무관하고 테스트 실패는 아니다.
- 접근성/UX 기술 감사 점수: 접근성 4/4, 성능 4/4, 반응형 3/4, 테마 4/4, 안티패턴 3/4 — 합계 18/20(Excellent).

## 판정

`review_status: passed`

Critical·Major·Minor 발견이 없고 계약 v2.0 및 누적 재작업 회귀가 검증되어 reviewer 관문을 통과한다. 티켓 state와 `review_status` 필드의 실제 갱신은 메인세션이 수행한다.
