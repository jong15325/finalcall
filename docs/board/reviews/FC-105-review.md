# FC-105 리뷰 — EPIC-SHOP-MANAGE 통합 검수

- **에픽**: EPIC-SHOP-MANAGE (KAN-115)
- **대상**: FC-104 backend(커밋 3e3eac3) + FC-096 frontend(35c4dd8)
- **판정**: **PASS (통과)** — critical 0 · major 0 · minor 2(비차단)
- **일자**: 2026-07-22 (reviewer)
- **정본 대조**: api-contract §3.2(GET /me/shops·MyShopSummary) · shop-spec §10 v0.4 · concurrency-review

## 축별 결과 (이상 없음)
1. **IDOR 원천 차단**: MeShopController가 seller 파라미터 없음(status/cursor/size/sort만) → 주체=SecurityContext(ShopService.getMyShops)·Repo `shop.seller.id.eq(sellerId)` 스코프. `/me/shops`는 permitAll 미포함(단일세그먼트 `/shops/*`와 배타) → 401. 테스트 고정.
2. **공개 ShopSummary 무오염**: estimatedFee/estimatedSettle은 MyShopSummaryResponse(별도 DTO)에만. 공개 ShopSummaryResponse엔 필드 부재. 회귀 테스트 `doesNotExist()` 고정. 계산 `estimatedSettle=price−FeeCalculator.compute(price)`(1,000,000→fee 51,000/settle 949,000).
3. **정합·성능**: findBySellerCursor fetch join(item/template/skill/seller) → N+1 없음. 인덱스 `(seller_id,status)` 선두 커버·keyset(정렬필드 NOT NULL·불변)·status(ACTIVE 기본/ALL 센티널/미허용 400). 취소 무효화 반경(내 리스팅·인벤·임시보관·공개마켓, 잔액 미포함 정확).
4. **취소 동시성**: 신규 취소 로직 없음 — 기존 markShopCancelledIfActive CAS+releaseFromListing(FC-093) 재사용 확인.
5. **계약 이탈**: 게이트2 M1~M3 정확 준수. 스키마 무변경(마이그레이션·컬럼 0·전건 additive). 무관 리팩터 없음.

## Minor (통과 차단 아님)
1. API가 SOLD/EXPIRED/CANCELLED에도 estimated값 반환(현 정책 기준) — 실현값 드리프트 가능하나 필드명 `estimated`·스펙이 실현값=/me/orders 명시·프론트 ACTIVE 고정이라 미노출. 향후 이력 탭 확장 시 종료분은 /me/orders 실현값 연동 권고.
2. 접근성: MyShopCancelDialog 초점·스크롤잠금·Tab 가둠·Escape·role/aria-modal·CodeAmount aria 전체값 — 정상, 회귀 없음.

## 후속
- api-contract/shop-spec PROPOSAL → 확정 버전로그 반영(게이트2 승인분, 비차단 doc).
