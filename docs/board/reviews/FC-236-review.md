# FC-236 최종 재리뷰 — 속성별 상세 배경 접근성·성능 통합 리뷰

대상: 최초 구현 `b644bbc`, 재작업 `3ce00ec`, 최종 재작업 `1602554` · reviewer 읽기 전용 최종 판정

## 심각도별 발견

### Critical

- 없음.

### Major

- 없음.

### Minor

- 없음.

## 기존 발견 해결 여부

- **런타임 reduced-motion RAF 잔류 — 해결.** MediaQueryList 변경을 구독해 RAF를 즉시 중단하고 Canvas를 지우며, 허용 상태로 돌아올 때만 재시작한다.
- **visibility·unmount 정리 — 해결.** 비가시 전환 시 RAF를 중단하고 unmount에서 RAF·resize timer·이벤트 리스너를 모두 정리한다.
- **resize 디바운스 부재 — 해결.** 120ms trailing debounce와 unmount timer 취소가 적용됐다.
- **두 상세 페이지 상태·응답 경로 테스트 부재 — 해결.** 로딩/성공/id별 속성 교체/404·일반 오류와 `AuctionDetail.item.element`·`ItemInstanceDetail.template.element` 연결을 검증한다.
- **실제 모달 stacking context 회귀 — 해결.** `.element-detail`의 `isolation:isolate`와 콘텐츠의 불필요한 z-index를 제거하고 장식 scene만 `z-index:0`으로 유지했다. 경매 페이지 테스트가 실제 `ElementDetailBackground`, `BidDialog`, `PurchaseDialog`를 렌더해 입찰·구매 fixed `z-50` overlay와 배경 루트의 비격리 상태를 확인한다.
- **Canvas 테스트 TS2339 — 해결.** `setTransform` mock 참조를 별도 변수로 유지해 Vitest 호출 검증과 DOM 타입을 분리했으며 typecheck가 통과한다.

## 전체 계약 회귀 확인

- 속성 선택은 공용 `toElementKey`만 사용하며 미등록 코드는 네트워크 요청 없이 중립 배경으로 폴백한다.
- 현재 상세 속성 자산 1종만 요청하고 stale 이미지 완료 결과를 무시한다. 이미지/Canvas 실패가 자식 콘텐츠와 액션을 차단하지 않는다.
- 로딩·오류·404에서는 속성 배경을 렌더하지 않으며 두 상세 응답의 정해진 element 경로만 배경 선택에 사용한다.
- 장식 scene과 Canvas는 접근성 트리·포인터·탭 순서에 개입하지 않고 forced-colors와 reduced-motion 정적 강등을 유지한다.
- Canvas는 물 속성에만 한정되며 저사양·coarse pointer·감소 모션·비가시 상태에서 실행하지 않는다. DPR 상한과 입자 수 상한도 유지된다.
- 배경 루트는 전역 `body`·AppShell 상태를 변경하지 않으며 모달·상단/하단 내비게이션의 전역 z-index 계층을 더 이상 격리하지 않는다.
- 배포 JPG 4종은 308,985~430,526바이트로 파일당 500KB 목표와 800KB 상한을 충족한다.
- 네 속성의 콘텐츠는 기존 불투명 surface를 유지하고 속성 라벨을 별도로 출력하므로 배경색·모션만으로 정보를 전달하지 않는다.
- 최종 재작업 3개 파일은 남은 리뷰 발견과 회귀 검증에 직접 추적되며 무관한 리팩터링·보안·인가 회귀는 없다.

## 검증 결과

- `npm.cmd test`: 통과 — 92파일, 748테스트.
- `npm.cmd run typecheck`: 통과.
- 대상 구현·테스트 6개 파일 ESLint(`--max-warnings=0`): 통과.
- 테스트 중 기존 `HomePage.test.tsx`의 React key 경고 1건이 stderr에 출력됐으나 본 변경 범위와 무관하고 테스트 실패는 아니다.
- 접근성/UX 기술 감사 점수: 접근성 4/4, 성능 4/4, 반응형 3/4, 테마 3/4, 안티패턴 4/4 — 합계 18/20(Excellent).

## 판정

`review_status: passed`

Critical·Major 발견이 없고 기존 발견 전건과 전체 계약 회귀가 검증되어 reviewer 관문을 통과한다. 티켓 state 및 `review_status` 필드의 실제 갱신은 메인세션이 수행한다.
