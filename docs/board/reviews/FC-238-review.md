# FC-238 리뷰 — 전체 뷰포트 상세 배경 변경 재리뷰

대상: 계약 `docs/spec/element-detail-background-contract.md` v1.1 · 구현 커밋 `5a9f034` · reviewer 읽기 전용 판정

## 심각도별 발견

### Critical

- 없음.

### Major

- **전체 뷰포트로 확장된 배경 위에서 footer 텍스트 대비를 보장하는 surface가 없다.**
  - 위치: `frontend/src/components/layout/AppShell.tsx:65-67`, `frontend/src/features/item/components/ElementDetailBackground.tsx:47-61`, `frontend/src/features/item/components/ElementDetailBackground.css:7-14,33-38`
  - 재현 시나리오: 데스크톱(`xl`)에서 네 속성 상세 중 하나를 열고 페이지 하단 footer까지 스크롤한다. fixed 배경 이미지·효과는 viewport 전체에 남아 있고 footer에는 `relative z-10`만 추가됐으며 배경 surface가 없다. `text-gray-400` 저대비 텍스트가 속성별로 명도와 색이 바뀌는 이미지 위에 직접 그려지므로 픽셀 위치에 따라 4.5:1을 보장할 수 없다. `z-10`은 페인트 순서만 바꾸며 대비를 만들지 않는다.
  - 기대 vs 실제: 계약 v1.1 §2·§4·§6과 FC-238 DoD는 AppShell footer가 배경 위에서 가독성을 유지하고, 텍스트 대비는 이미지가 아니라 surface가 책임질 것을 요구한다. 실제 footer는 투명하여 이 조건을 위반한다. 네 속성 및 이미지 로드 전/실패 중립 상태에서 불투명 또는 대비가 검증된 반투명 surface로 책임을 분리해야 한다.

### Minor

- **AppShell 통합 테스트가 실제 chrome 가독성과 scroll/sticky 동작 대신 mock 클래스만 확인한다.**
  - 위치: `frontend/src/components/layout/AppShell.test.tsx:7-19,44-61`
  - 재현 시나리오: 테스트를 보면 Sidebar·TopNavbar·MobileBottomNav·CompareBar가 빈 mock 요소로 대체되고 footer는 클래스만 검사된다. 320px/200% 확대, 실제 sticky 동작, body scroll-lock·`scrollbar-gutter`, footer/내비 surface 대비는 실행되지 않는다.
  - 기대 vs 실제: FC-238 DoD는 실제 AppShell chrome·sticky·scroll·modal 회귀 확인을 요구한다. 기존 개별 컴포넌트 테스트와 정적 구조로 상당 부분 보완되지만, 신규 통합 테스트만으로는 위 시각·스크롤 요구를 회귀 방지하지 못하며 이번 footer 결함도 놓쳤다.

## 확인된 적합 사항

- `.element-detail__scene`은 `fixed inset-0`이며 `100vw`나 새 overflow/scroll container를 만들지 않아 viewport와 기존 body 스크롤·`scrollbar-gutter:stable` 경계를 보존한다.
- AppShell root의 `isolate`가 공통 stacking context를 제공한다. 장식 scene은 `z-0`, footer `z-10`, 고정 Sidebar `z-20`/flyout·drawer `z-40~50`, TopNavbar·MobileBottomNav `z-30`, CompareBar `z-40`, 실제 경매 모달 `z-50` 순서를 유지한다.
- `.element-detail__content`는 `position:relative; z-index:auto`이고 scene 뒤 DOM 형제라 scene 위에 그려지면서 별도 stacking context를 만들지 않는다. 실제 fixed BidDialog/PurchaseDialog도 콘텐츠 래퍼에 갇히지 않는다.
- 상세→경매 목록 이동 시 scene DOM이 제거되고 직접 목록 진입에도 scene DOM이 없다. 컴포넌트는 body class/dataset이나 AppShell 영속 상태를 기록하지 않는다.
- 로딩·오류·404는 상세 배경을 마운트하지 않아 AppShell 중립 surface로 돌아가며, 성공 응답의 정해진 element 경로만 사용한다. 속성 변경 시 stale 이미지 완료 결과도 무시한다.
- route unmount 시 Water Canvas RAF, resize timer, visibility/reduced-motion listener가 정리된다. 페이지 비가시·runtime reduced-motion·저사양/coarse pointer에서 정지하며 resize는 120ms debounce, DPR은 1.5, 입자는 18개로 제한된다.
- 장식 레이어는 `aria-hidden`, `pointer-events:none`이고 forced-colors에서는 scene 전체가 제거된다. DOM landmark·접근 가능한 이름·포커스 순서를 추가하지 않는다.
- 배포 JPG 4종은 308,985~430,526바이트로 파일당 500KB 목표와 800KB 상한을 충족하며 현재 속성 1종만 요청한다.
- AppShell root 격리, pinned Sidebar의 positioned z-index, fixed scene 변경은 v1.1 stacking 요구에 직접 추적되며 무관한 리팩터링·보안·인가 회귀는 확인되지 않았다.

## 검증 결과

- `npm.cmd test`: 통과 — 93파일, 750테스트.
- `npm.cmd run typecheck`: 통과.
- 변경 대상 6개 구현·테스트 파일 ESLint(`--max-warnings=0`): 통과.
- 테스트 중 기존 `HomePage.test.tsx`의 React key 경고 1건이 stderr에 출력됐으나 이번 변경과 무관하고 테스트 실패는 아니다.
- 접근성/UX 기술 감사 점수: 접근성 2/4, 성능 4/4, 반응형 3/4, 테마 3/4, 안티패턴 4/4 — 합계 16/20(Good). footer 대비 Major가 점수와 별도로 통과를 차단한다.

## 판정

`review_status: changes-requested`

Critical은 없으나 footer 대비 Major 1건이 있어 통과 아님. 메인세션은 FC-238을 Done으로 전이하면 안 된다.
