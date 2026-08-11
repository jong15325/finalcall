# FC-238 최종 재리뷰 — 전체 뷰포트 상세 배경 변경

대상: 계약 `docs/spec/element-detail-background-contract.md` v1.1 · 구현 `5a9f034` · 재작업 `608fbfd` · reviewer 읽기 전용 최종 판정

## 심각도별 발견

### Critical

- 없음.

### Major

- 없음.

### Minor

- 없음.

## 기존 발견 해결 여부

- **footer 대비 surface 부재 — 해결.** AppShell footer에 불투명 `bg-surface`와 `text-gray-600`을 적용해 속성 이미지에서 대비 책임을 분리했다. 기존 디자인 토큰 기준 `text-gray-600`/surface 조합은 일반 텍스트 WCAG AA 대비를 충족하며 네 속성·중립·이미지 실패 상태에 영향을 받지 않는다.
- **실제 chrome·scroll 검증 부재 — 해결.** AppShell 테스트가 Sidebar·TopNavbar·MobileBottomNav 실제 구현을 렌더하고 scene/chrome/footer 계층, footer surface, main의 새 overflow container 부재를 확인한다. 경매 페이지 테스트도 실제 BidDialog·PurchaseDialog를 열어 body scroll-lock과 unmount 복구를 검증한다.

## 계약 v1.1 전체 회귀 확인

- 배경 scene은 route-owned `fixed inset-0 z-0`이며 `100vw`와 별도 overflow/scroll container를 사용하지 않는다. AppShell 전체 시각 영역을 채우되 scrollbar 폭과 body 스크롤 모델을 바꾸지 않는다.
- AppShell root `isolate` 안에서 scene `z-0`, footer `z-10`, Sidebar `z-20`/overlay·drawer `z-40~50`, TopNavbar·MobileBottomNav `z-30`, CompareBar `z-40`, 모달 `z-50` 상대 계층이 유지된다.
- 콘텐츠는 scene 뒤의 `position:relative; z-index:auto` 형제로 장식 위에 그려지며 별도 stacking context를 만들지 않는다. fixed 입찰·구매 모달도 콘텐츠 래퍼에 갇히지 않는다.
- 상세→목록 이동 직후 scene DOM이 제거되고 목록 직접 진입에는 scene DOM이 없다. body class/dataset이나 AppShell의 route 영속 상태를 사용하지 않는다.
- 로딩·오류·404는 속성 scene을 마운트하지 않아 AppShell 중립 surface를 사용한다. 성공 응답의 지정된 element 경로만 배경 선택에 사용하고 id/속성 전환 시 stale 이미지 완료를 무시한다.
- 실제 입찰·구매 모달은 열릴 때 body overflow를 잠그고 unmount 시 원복한다. main에는 overflow container가 추가되지 않아 기존 sticky 입찰과 `scrollbar-gutter:stable` 기반 body 스크롤을 보존한다.
- Sidebar·TopNavbar·MobileBottomNav와 footer는 실제 surface·z-index를 유지한다. CompareBar는 기존 fixed `z-40`과 surface를 유지하며 상세 컴포넌트는 이를 변경하지 않는다.
- Water Canvas는 runtime reduced-motion·visibility·저사양/coarse pointer에서 정지하고 route unmount 시 RAF, resize timer, visibility/reduced-motion listener를 정리한다. resize 120ms debounce, DPR 1.5, 입자 18개 상한을 유지한다.
- 장식은 `aria-hidden`, `pointer-events:none`이고 forced-colors에서 제거된다. landmark·접근 가능한 이름·포커스 순서를 추가하지 않는다.
- 배포 JPG 4종은 308,985~430,526바이트로 파일당 500KB 목표·800KB 상한을 충족하며 현재 속성 1종만 지연 요청한다.
- 재작업 3개 파일의 모든 변경은 footer 대비와 실제 chrome/scroll 회귀 검증에 직접 추적되며 불필요 변경·보안·인가 회귀는 없다.

## 검증 결과

- `npm.cmd test`: 통과 — 93파일, 750테스트.
- `npm.cmd run typecheck`: 통과.
- 재작업 대상 3개 파일 ESLint(`--max-warnings=0`): 통과.
- 테스트 중 기존 `HomePage.test.tsx`의 React key 경고 1건이 stderr에 출력됐으나 이번 변경과 무관하고 테스트 실패는 아니다.
- 접근성/UX 기술 감사 점수: 접근성 4/4, 성능 4/4, 반응형 3/4, 테마 4/4, 안티패턴 4/4 — 합계 19/20(Excellent).

## 판정

`review_status: passed`

Critical·Major 발견이 없고 기존 Major·Minor와 계약 v1.1 회귀 전건이 검증되어 reviewer 관문을 통과한다. 티켓 state 및 `review_status` 필드의 실제 갱신은 메인세션이 수행한다.
