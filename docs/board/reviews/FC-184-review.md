# FC-184 (T6) 리뷰 — ItemCard variant 정비 + 스킬명 FE 배선

- **티켓**: FC-184 (EPIC-CARD-SYSTEM T6, 에픽 마지막) · Jira KAN-207
- **판정**: **PASS** (critical 0 · major 0 · minor 1 → 정리 완료)
- **검수자**: reviewer (읽기 전용)
- **일자**: 2026-08-04

## 요약
variant 모델 정비(boolean 폭발 제거) + 스킬명 정본 배선. 시각 형상 보존·variant 정합·스킬명 단일 배선·계약 형상 모두 통과. minor 1건('compact' dead 예약값)은 커밋 전 제거 완료.

## 형상/픽셀 보존 (최우선·마켓 — 통과)
base(HEAD) diff 대조:
- **ShopCard(market)**: `skillFlip`→`variant="market"`, `price={{amount}}`. `isMarket` 동일 산출, `.is-market` 클래스·`CodeAmount` 값 동일.
- **InventoryItemCard(market)**: price 미전달 → `.item-card__market-price` 미렌더 = 구 hidePrice 억제와 동일.
- **MyShopCard(browse)**: `price={{amount, label:'등록가'}}` 동일 렌더.
- CSS 셀렉터 불변(주석만 갱신).
- **유일 허용 시각 변경**: 인벤 카드·모달 스킬 표기 `#코드→이름`(계획 §4 허용분).

## 축별 판정
1. **variant 모델 정합** 통과 — `hidePrice`/`priceLabel`/`skillFlip` 3 boolean 실제 제거(잔존=주석/테스트 설명). price 부재→줄없음 / `{amount:null}`→"-" / browse label 매핑 정확.
2. **스킬명 단일 배선** 통과 — 카드·모달·경매·비교 전 경로가 `skillSlots.ts resolveSkillSlots/skillLabelOf` 단일 소비. 중복 배선·enum 복제 없음. 폴백 `스킬 #{code}` 정합.
3. **계약 형상 불변** 통과 — `ItemSummary`에 `skill1Name?/skill2Name?` optional 가법만. api-contract v1.21 §4.2와 일치, 백엔드 계약 변경 없음.
4. **회귀·테스트 신뢰성** 통과 — 카드 스위트 green, tsc clean. DOM 형상 단언 유지·강화(스킬명 `#104` 부재+실이름 존재로 강화, 약화 아님). oauth 3 fail은 T6 무관 선재 실패(auth feature 미변경).

## minor (정리 완료)
- **'compact' variant(speculative generality)**: 계획 §2.3 line 114 enum에 문자로 추적되나, line 122 실제 매핑은 `skillFlip→market`뿐이고 `isMarket = variant !== 'browse'`라 market과 행위 동일 = 소비자·분기·테스트 0의 dead 예약값. 제안 §2.4(과일반화 경계) 위반. **커밋 전 제거**: `ItemCardVariant`를 `'browse'|'market'`로 축소, `isMarket`를 `variant === 'market'` 명시 비교로. 관련 주석 3파일 정정. 재검증 typecheck clean·카드 40건 green.
