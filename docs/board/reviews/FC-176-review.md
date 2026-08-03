# FC-176 확인 리뷰 — 음수 정산 결함 수정(옵션 B 수수료 클램프)

- **대상**: FC-176(게이트2 승인안 B — `fee = min(max(capped, minFee), finalPrice)`)
- **리뷰어**: reviewer(읽기 전용)
- **일자**: 2026-08-03
- **판정**: **PASS** (critical 0 / major 0 / minor 0) → `review_status: passed`

## 초점별 근거
1. **불변식 정확성** — 정확. `FeeCalculator.java:46-51` 클램프가 minFee floor **뒤**에 위치 → 모든 `finalPrice≥1`에서 `0 ≤ fee ≤ finalPrice` ⟹ `settle ≥ 0`. 세 판매경로 하한(경매1·즉시구매2·상점1)이라 음수/0 price 무관.
2. **구조적 봉인** — 완전. `feeCalculator.compute` 소비자 정확히 4곳(CloseService:116·PurchaseService:103·ShopPurchaseService:91·ShopService:227 estimatedFee), 전부 `settle=price−fee` 일관. 독립 fee 산출·`price−minFee` 우회 없음. 클램프 계산기 1곳뿐.
3. **회귀 불변** — 확인. 클램프는 `price<100`에서만 바인딩. price=2,480,000(fee 110,200)·cap 20,000,000(fee 300,000)·estimatedFee(price=1M→51,000) 무영향, DB `sale_order.fee_amount`로 재확인.
4. **테스트 실질성** — 강함(DB 상태 실검증). 통합 3건이 판매자 잔액 0 시작 → 저가 성사 후 잔액 비감소·`settleAmount=0`·`feeAmount=price`·Σ(잔액)+Σ(원장) 전후 동일을 DB로 단언(구버그면 −99로 실패).
5. **스코프 준수** — 청결. 변경 = FeeCalculator(1줄+Javadoc) + 테스트 3 + spec 각주 4파일뿐. API 계약·ErrorCode·응답 형상 무변경, spec은 불변식·순서·경계표만 추가(직렬화 형상 보존). 과설계 없음.

## 검증 실행(직접)
- `FeeCalculatorTest` — BUILD SUCCESSFUL(경계 1/2/50/99/100/101 + 회귀 1667/2.48M/cap 20M).
- `SoldSettlementIntegrationTest`·`PurchaseSettlementIntegrationTest`·`ShopPurchaseSettlementIntegrationTest` — Testcontainers 실 MySQL BUILD SUCCESSFUL.

## 참고(비차단)
- `compute` `@return` Javadoc이 "min(cap, finalPrice) 이하"로 다소 느슨(실 상한=finalPrice). 결함 아님.
- sub-100 상점 매물 estimatedSettle=0 표시는 회귀 아닌 정상 동작(spec 각주 정합).

## 불변식 정본(향후)
`0 ≤ fee ≤ final_price` ⟹ `settle ≥ 0`(fee-policy-spec §3 5단계). 새 판매경로는 반드시 `feeCalculator.compute(price)` 경유(직접 fee 산출 금지). 옵션 A(등록가 하한)는 별개 제품정책으로 분리.

## 변경 파일
`backend/.../settlement/service/FeeCalculator.java`(+테스트 FeeCalculatorTest·SoldSettlement·PurchaseSettlement·ShopPurchaseSettlement IntegrationTest), `docs/spec/{fee-policy,closing-domain,purchase,shop}-spec.md`.
