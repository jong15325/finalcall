# FC-369 카드정보 서버 계산 통합 리뷰 — API v1.34

## 최종 판정

- PASSED
- Critical: 0
- Major: 0
- Minor: 2

## 심각도별 발견

### Critical

- 없음

### Major

- 없음

### Minor

- `frontend/src/features/order/components/OrderCard.tsx`의 거래내역 compact card는 여전히 `nameSnapshot`과 원시 속성 코드 사전을 표시한다. 그러나 실제 백엔드 `OrderItemResponse`에는 이번 에픽의 `cardInfo` 계약이 없고, 프론트 `OrderSummary.item`이 이를 `AuctionItemBlock`으로 선언한 타입과도 불일치한다. 이번 응답 확장 범위 밖이므로 FC-369를 막지 않으며, 주문 응답 계약을 먼저 확정하는 후속 티켓에서 처리해야 한다.
- `frontend/src/features/auction/components/AuctionHeroCard.tsx`, `frontend/src/features/item/components/ItemInstanceDetail.tsx`, `frontend/src/features/item/components/ItemFrame.tsx`의 파일 상단 설명 일부가 폐기된 클라이언트 명칭·스킬·골드포스 파생 방식을 현재 동작처럼 기술한다. 실행 코드에는 영향이 없으나 후속 주석 정리를 권고한다.

## 확인 범위

- API v1.34 이름 계약: 정보영역 `formalName = {level}레벨 {원형 종류}`, 목록·compact card `shortName = Lv.{level} {속성약칭}{종류약칭}`
- 일반 마법 `필`, 특수 마법 `스필` 및 `formalName=스페셜필` 구분
- 마켓·경매·인벤토리·임시보관 목록, 카드 face, 카드정보 모달, 판매 inline, 아이템 상세, 구매·등록 확인 모달, ARIA label, 비교 화면, 워크벤치 fixture
- 붙임형 `9바검` 및 원시 `nameSnapshot`·`displayName`의 카드 표시 폴백 잔존 여부
- `validUntil` 기반 query 갱신과 기존 GF·채널·스킬·단일 기준시각 계약 회귀 여부
- 인증·인가, 추가 조회/N+1, 시크릿·금전·동시성 영향 여부

## 검증 증거

- `npm.cmd run typecheck` 통과
- `npm.cmd test -- --run src/pages/ComparePage.test.tsx src/features/delivery/components/DeliveredBanner.test.tsx src/lib/queries/cardInfoExpiry.test.tsx` 통과: 3개 파일, 8개 테스트
- 비교 compact card가 `shortName`을 표시하고 원시 snapshot을 노출하지 않는 테스트 통과
- 배송 완료 배너가 `cardInfo.shortName`을 표시하고 호환 `displayName`을 노출하지 않는 테스트 통과
- 직전 재리뷰에서 `CardInfoFactoryTest --rerun-tasks` 및 cardInfo 응답 계약 테스트 통과 확인
- 신규 critical/major 보안·IDOR·N+1·동시성 문제 없음
- 후속 회귀 검증: 카드정보·상세 속성표의 `남은 골드 포스`는 숫자만 표시하고, 목록 `ItemFrame`의 `N일` 접근성 label 및 상세 배지의 `N일 남음`은 유지됨을 관련 Vitest 4개 파일·30건 통과로 확인

## 판정 근거

이전 v1.34 리뷰의 major였던 비교 compact card의 `formalName` 사용은 `shortName`으로 교정됐고, 원시 snapshot 미노출 테스트가 이를 고정한다. 배송 완료 알림도 서버 `cardInfo.shortName`을 사용하며 호환 `displayName`을 렌더하지 않는다. 모달·inline·상세·확인 영역은 `formalName`, 목록·카드 face·연결된 접근성 label은 `shortName`을 사용해 이름의 문맥 경계가 계약과 일치한다. 붙임형 약칭은 화면에서 생성하지 않으며 검색 alias 후속 범위를 침범하지 않는다. 주문 카드의 응답 계약 공백과 오래된 설명 주석은 별도 후속 정리가 필요한 비차단 minor이므로 API v1.34 기준 통과로 판정한다.
