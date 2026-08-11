# FC-236 재리뷰 — 속성별 상세 배경 접근성·성능 통합 리뷰

대상: 최초 구현 `b644bbc`, 재작업 `3ce00ec` · reviewer 읽기 전용 최종 판정

## 심각도별 발견

### Critical

- 없음.

### Major

- **상세 배경의 stacking context가 실제 입찰·구매 모달을 AppShell 고정 크롬 아래에 가둘 수 있으며, 신규 테스트는 이를 검증하지 않는다.**
  - 위치: `frontend/src/features/item/components/ElementDetailBackground.css:1-4`, `frontend/src/pages/AuctionDetailPage.tsx:165-244`, `frontend/src/features/auction/components/BidDialog.tsx:195`, `frontend/src/features/auction/components/PurchaseDialog.tsx:124`, `frontend/src/components/layout/TopNavbar.tsx:53`, `frontend/src/components/layout/MobileBottomNav.tsx:21`, `frontend/src/pages/AuctionDetailPage.test.tsx:25-77,163-172`
  - 재현 시나리오: 경매 상세에서 입찰 또는 즉시구매 모달을 연다. `ElementDetailBackground` 루트의 `isolation:isolate`가 새 stacking context를 만들고 실제 `fixed z-50` 모달은 그 내부 자식이다. 형제 stacking context인 상단 내비게이션(`z-30`)과 모바일 하단 내비게이션(`z-30`)보다 부모 상세 context 자체가 위로 승격되지 않으므로 모달의 `z-50`만으로 전역 크롬을 덮는다고 보장할 수 없다. 신규 테스트는 배경 래퍼를 평범한 mock `<section>`으로, 모달도 직접 만든 `className="z-50"` div로 교체한 뒤 문자열 클래스만 비교하므로 실제 stacking context와 fixed overlay를 전혀 실행하지 않는다.
  - 기대 vs 실제: 계약 §2·§6과 FC-234 DoD는 기존 모달 z-index·포커스 동작 보존을 요구한다. 실제 구조는 전역 overlay 계층을 변경했고 테스트는 mock에 작성한 `z-50`이 mock의 `z-10`보다 크다는 사실만 검증한다. 실제 컴포넌트를 렌더하거나 portal/stacking context 구조를 검증해야 한다.

- **재작업 커밋의 신규 Canvas 테스트가 TypeScript 검사에 실패한다.**
  - 위치: `frontend/src/features/item/components/ElementDetailBackground.test.tsx:143`
  - 재현 시나리오: `frontend`에서 `npm.cmd run typecheck`를 실행한다. `context.setTransform.mock.calls` 접근에 대해 `TS2339: Property 'mock' does not exist`가 발생한다. 테스트 내 mock 객체를 `CanvasRenderingContext2D`로 단언한 뒤 DOM 메서드 타입으로 접근한 것이 원인이다.
  - 기대 vs 실제: 재작업은 기존 major를 테스트로 고정하고 정상 빌드 검증을 통과해야 한다. 런타임 테스트는 통과하지만 정적 검사 단계가 실패해 현재 커밋은 릴리스 가능한 상태가 아니다.

### Minor

- 없음.

## 기존 발견 해결 여부

- **런타임 reduced-motion RAF 잔류 — 해결.** MediaQueryList `change`를 구독해 즉시 `cancelAnimationFrame`하고 Canvas를 지우며, 모션 허용 복귀 시에만 재시작한다.
- **visibility·unmount 정리 — 해결.** 비가시 전환 시 RAF를 중단하고, unmount에서 RAF·resize timer·세 이벤트 리스너를 모두 정리한다.
- **resize 디바운스 부재 — 해결.** 120ms trailing debounce와 unmount 시 timer 취소가 추가됐다.
- **두 상세 페이지 상태·응답 경로 테스트 부재 — 부분 해결.** 로딩/성공/404·일반 오류, `item.element`/`template.element` 전달과 id별 속성 교체는 추가 테스트로 확인된다. 다만 id 전환은 동일 라우터 인스턴스 navigation이 아니라 unmount 후 새 render이고, 경매 모달 계층 테스트는 전부 mock이라 실제 회귀를 검증하지 못한다.

## 확인된 적합 사항

- Canvas 테스트는 runtime reduced-motion, visibility, unmount, resize debounce 경로를 실제 effect listener 수준에서 실행한다.
- 미등록 코드 중립 폴백, 현재 속성 1종 요청, stale 이미지 결과 무시와 자산 실패 비차단은 기존 테스트로 유지된다.
- 아이템 상세 테스트는 성공 응답의 `template.element` 연결과 오류 화면에서 배경 미렌더를 확인한다.
- 경매 상세 테스트는 성공 응답의 `item.element` 연결과 오류 화면에서 배경 미렌더를 확인한다.
- 재작업 4개 파일은 기존 리뷰 발견과 해당 회귀 테스트에 직접 추적되며 무관한 변경은 없다.
- 보안·인가·사용자 입력 기반 자산 경로 관련 신규 회귀는 확인되지 않았다.

## 검증 결과

- `npm.cmd test -- --run src/features/item/components/ElementDetailBackground.test.tsx src/pages/AuctionDetailPage.test.tsx src/pages/ItemDetailPage.test.tsx src/features/auction/components/BidDialog.test.tsx`: 통과(4파일, 19테스트).
- `npm.cmd run typecheck`: 실패 — `ElementDetailBackground.test.tsx:143` TS2339.
- 대상 4개 변경 파일 ESLint(`--max-warnings=0`): 통과.
- 접근성/UX 기술 감사 점수: 접근성 4/4, 성능 4/4, 반응형 3/4, 테마 3/4, 안티패턴 4/4 — 합계 18/20(Excellent). 단, 기능 회귀·품질 게이트 major는 점수와 별도로 차단한다.

## 판정

`review_status: changes-requested`

최초 major 1건과 minor 1건은 해결됐고 페이지 상태 테스트도 상당 부분 보강됐다. 그러나 실제 모달 stacking context 회귀 미해결 및 typecheck 실패라는 Major 2건이 남아 통과 아님. 메인세션은 FC-233~FC-236을 Done으로 전이하면 안 된다.
