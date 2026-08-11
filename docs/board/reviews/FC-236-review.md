# FC-236 리뷰 — 속성별 상세 배경 접근성·성능 통합 리뷰

대상: FC-233, FC-234, FC-235, FC-236 · 커밋 `b644bbc` · reviewer 읽기 전용 판정

## 심각도별 발견

### Critical

- 없음.

### Major

- **감소 모션을 실행 중 켜면 숨겨진 Canvas의 RAF 루프가 계속 실행된다.**
  - 위치: `frontend/src/features/item/components/ElementDetailBackground.tsx:80-90,129-150`, `frontend/src/features/item/components/ElementDetailBackground.css:144-151`
  - 재현 시나리오: 물 속성 상세을 일반 모션 설정으로 연 뒤 OS/브라우저의 `prefers-reduced-motion`을 `reduce`로 변경한다. CSS는 Canvas를 `display:none`으로 숨기지만 JS는 마운트 시점의 `matches`만 읽고 변경 이벤트를 구독하지 않아 `requestAnimationFrame(draw)`가 계속 돈다. 개발자 도구 Performance에서 지속 프레임 작업으로 확인할 수 있다.
  - 기대 vs 실제: 계약 §4·§5와 FC-233 DoD는 감소 모션 환경에서 Canvas/입자와 지속 애니메이션을 제거하고 정적 배경으로 강등할 것을 요구한다. 실제 구현은 시각적으로만 숨기고 이미 시작된 Canvas 작업을 중단하지 않아 접근성 설정 변경과 저전력·배터리 요구를 충족하지 못한다.

- **두 상세 라우트의 상태 전환·격리·핵심 상호작용 회귀가 테스트로 증명되지 않는다.**
  - 위치: `frontend/src/pages/AuctionDetailPage.tsx:68-114,165-245`, `frontend/src/pages/ItemDetailPage.tsx:21-85`; 관련 페이지 테스트 파일 없음. `frontend/src/features/item/components/ElementDetailBackground.test.tsx:16-88`은 공용 컴포넌트 3건만 검증한다.
  - 재현 시나리오: `/auctions/:id`와 `/items/:id`에서 로딩→성공, 성공→다른 id, 에러/404 전환을 수행하거나 입찰·구매 다이얼로그와 보호 라우트를 조작한다. 현재 자동 테스트는 실제 응답 경로(`auction.item.element`, `item.template.element`) 연결, 중립 전환, 모달 포커스/z-index, 다른 목록/AppShell로의 격리를 실행하지 않는다. Canvas 테스트도 `getContext()`를 항상 `null`로 만들어 Visibility 정지·정리·실패 폴백 경로를 전혀 통과하지 않는다.
  - 기대 vs 실제: 계약 §6 및 FC-234·FC-235·FC-236 DoD는 위 전환과 두 라우트의 핵심 회귀를 컴포넌트/통합 테스트로 검증하도록 요구한다. 실제 테스트는 자산 1종 요청·미등록 코드·stale 이미지 콜백만 보장하므로 구현 회귀가 통과할 수 있다.

### Minor

- **Canvas resize가 디바운스 없이 매 이벤트마다 고비용 버퍼 재할당을 수행한다.**
  - 위치: `frontend/src/features/item/components/ElementDetailBackground.tsx:103-110,143-148`
  - 재현 시나리오: 물 속성 상세에서 브라우저 창을 연속 리사이즈하거나 모바일 주소창/뷰포트 변화가 반복되면 매 `resize`마다 Canvas 크기 변경과 컨텍스트 초기화가 실행된다.
  - 기대 vs 실제: 제한 효과라도 입찰 상호작용과 모바일 배터리에 영향을 최소화해야 한다. 실제는 RAF 자체는 제한했지만 resize 호출 빈도 상한이 없어 순간적인 메인 스레드 부하를 만들 수 있다.

## 확인된 적합 사항

- 속성 선택은 공용 `toElementKey`를 사용하고 미등록 코드는 네트워크 요청 없이 `neutral`로 폴백한다.
- 이미지 요청은 현재 속성 1종만 생성하며 stale `onload` 결과를 무시한다. 배경 실패도 자식 콘텐츠를 차단하지 않는다.
- 장식 scene/Canvas는 `aria-hidden`, `pointer-events:none`이며 전역 `body`·AppShell 상태를 변경하지 않아 두 라우트 밖으로 스타일 상태가 누출되지 않는다.
- `forced-colors: active`에서 장식 scene을 제거하고, 상세 콘텐츠 카드들은 기존 불투명 surface를 유지한다.
- 배포 JPG 4종은 308,985~430,526바이트(1672×941)로 파일당 500KB 목표 및 800KB 상한을 모두 충족한다.
- 변경 파일과 라인은 계약의 공용 배경·두 상세 연결·테스트·자산 범위에 직접 추적되며 무관한 리팩터링은 확인되지 않았다.
- 보안 관점에서 URL 쿼리나 사용자 입력으로 자산 경로를 구성하지 않고 검증된 정수→고정 키 매핑만 사용하므로 경로 주입·인가 경계 변경은 확인되지 않았다.

## 검증 결과

- `npm.cmd test -- --run src/features/item/components/ElementDetailBackground.test.tsx`: 통과(1파일, 3테스트).
- `npm.cmd run typecheck`: 통과.
- `npm.cmd run lint -- --max-warnings=0`: 실패. 대상 변경과 무관한 기존 `InventoryItemCard.test.tsx`의 `react/jsx-sort-props` 경고 2건 때문이며 본 리뷰 발견으로 승격하지 않았다.
- 접근성/UX 기술 감사 점수: 접근성 3/4, 성능 2/4, 반응형 3/4, 테마 3/4, 안티패턴 4/4 — 합계 15/20(Good). AI 생성형 UI 안티패턴은 확인되지 않았다.

## 판정

`review_status: changes-requested`

Critical은 없으나 Major 2건이 있어 통과 아님. 메인세션은 FC-233~FC-236을 Done으로 전이하면 안 된다.
