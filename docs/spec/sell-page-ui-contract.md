# 판매 등록 운영 UI 계약

- 버전: v1.0
- 확정일: 2026-08-14
- 근거 티켓: FC-306
- 디자인 게이트: A 작업 캔버스형 승인

## 1. 영향받는 티켓

- `FC-308`: 디자인 게이트 결과에 A 작업 캔버스형과 본 계약을 고정한다.
- `FC-309`: 운영 `SellPage`와 공용 카드정보 content 추출을 구현한다.
- `FC-310`: API 회귀, 반응형, 접근성, 모바일 CTA 활성 조건을 리뷰한다.
- `FC-307`은 승인 근거인 dev-only 워크벤치 산출물이며 운영 코드로 승격하지 않는다.

## 2. 운영 레이아웃과 등록 CTA

- PC(1280px 기준)는 판매조건 65%, 카드정보 35%의 2열이다. 두 표면은 같은 grid row에서 stretch되어 외곽 높이가 같아야 한다. 카드정보 내용이 길면 카드정보 content 영역 안에서 처리한다.
- 모바일(390px 기준)의 DOM 및 시각 순서는 `카드정보 → 판매조건 → 등록 버튼`이다. 등록 버튼은 판매조건 뒤의 일반 문서 흐름에 두며 가로 overflow를 만들지 않는다.
- 유효한 폼에서 PC의 `판매 등록 검토` 버튼은 즉시 활성화한다.
- 모바일은 유효한 폼이어도 사용자가 페이지 최하단 CTA 구간을 실제로 확인하기 전까지 버튼을 비활성화하고, 최하단 도달 후 활성화한다. 이 UI gate는 제출 권한이나 서버 검증을 대체하지 않는다. viewport가 PC로 바뀌면 적용하지 않는다.

## 3. 판매 방식과 시간

- 경매는 즉시 시작만 제공하고 `startAt`을 요청에서 생략한다.
- 경매 기간은 선택 시점의 now 기준 1/3/7일, 즉 24/72/168시간이다.
- 종료 시각은 KST `YYYY-MM-DD HH:mm:ss`로 초까지 표시하며 API에는 UTC ISO-8601 Instant를 보낸다.
- 고정가는 가격만 입력한다. 판매 기한은 서버가 결정하며 요청에 `endAt`을 추가하지 않는다.

## 4. 확인 dialog 계약

- 경매와 고정가 확인 UI는 `CardInfoDialog`와 동일한 반응형 dialog shell 계약을 따른다.
- PC에서는 중앙 dialog, 모바일에서는 viewport 하단에 붙는 bottom sheet다.
- backdrop, Escape, focus trap, body scroll lock, 닫힌 뒤 초점 복원을 유지한다.
- 등록 mutation과 오류 해석은 기존 `SellConfirmDialog`와 `ShopSellConfirmDialog` 소비자가 계속 소유한다.

## 5. 공용 CardInfo content 추출 계약

- `CardInfoDialog`에서 dialog chrome과 카드정보 content를 분리한다. 공용 content는 item feature가 소유하는 표현 전용 컴포넌트다.
- 공용 content는 이미지/프레임, 타입, 명칭, 채널 제한, 속성, 골드포스 잔여, 특수 스킬 1·2를 기존 계산 함수와 동일한 마크업 의미론으로 렌더한다.
- 공용 content는 `role=dialog`, backdrop, 닫기 버튼, focus trap, scroll lock, footer CTA, query 또는 mutation을 소유하지 않는다.
- `CardInfoDialog`는 content를 자신의 shell 안에서 소비하고, `SellPage`는 같은 content를 inline 카드정보 표면 안에서 소비한다.
- 판매 페이지는 현재 `InventoryItem.typeCode`와 기존 item 유틸인 `decodeTypeCode`, `channelLimitOf`, `resolveSkillSlots`, `goldforceRemainingDays`, `itemArt`로 view props를 조립한다. 별도 `GET /items/{id}` 호출이나 API 응답 필드 추가는 금지한다.
- 추출은 시각·접근성의 무변경 리팩터다. `CardInfoDialog`, `ShopCardInfoDialog`, `InventoryCardInfoDialog`의 shell/slot 계약과 소비자별 mutation은 유지한다.

## 6. API, 성능, 되돌리기 판정

- API와 DB 변경은 없다.
- 경매는 기존 `POST /auctions`의 `{ itemInstancePublicId, startPrice, buyNowPrice?, endAt, softCloseWindowSec?, softCloseExtendSec?, maxEndAt }`를 사용하고 `startAt`을 생략한다.
- 고정가는 기존 `POST /shops`의 `{ itemInstancePublicId, price }`를 사용한다.
- 카드정보는 이미 적재된 인벤토리 응답에서 파생하므로 네트워크 호출과 서버 부하는 증가하지 않는다. 모바일 최하단 감지는 클라이언트 viewport 관찰만 사용한다.
- 되돌리기는 운영 레이아웃과 공용 content 소비를 기존 내부 마크업으로 복원하는 프론트 범위이며 데이터 마이그레이션이 없다. 추가 게이트2 결정은 없다.

## 7. 영향 파일과 필수 테스트

예상 변경 파일:

- `frontend/src/pages/SellPage.tsx`
- `frontend/src/pages/SellPage.test.tsx`
- `frontend/src/features/item/components/CardInfoDialog.tsx`
- item feature의 공용 CardInfo content 신규 파일과 테스트
- `frontend/src/features/auction/components/SellConfirmDialog.tsx` 및 테스트
- `frontend/src/features/shop/components/ShopSellConfirmDialog.tsx` 및 테스트
- 필요 시 `frontend/src/features/auction/lib/sellForm.ts` 및 테스트

필수 검증:

- PC 65:35, 두 표면 동일 높이
- 모바일 카드정보 → 판매조건 → 등록 버튼 순서와 가로 overflow 없음
- PC 즉시 활성, 모바일 최하단 도달 전/후 활성, breakpoint 변경
- 경매 1/3/7일, 즉시 시작, KST 초 단위 표시, UTC payload
- 고정가 payload에 `endAt` 없음
- 두 확인 UI의 PC dialog와 모바일 bottom sheet
- focus trap, Escape, scroll lock, 초점 복원
- 기존 CardInfoDialog, ShopCardInfoDialog, InventoryCardInfoDialog 회귀 없음
