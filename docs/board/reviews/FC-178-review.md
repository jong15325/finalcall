# FC-178 통합 리뷰 — 인벤토리를 아이템 마켓과 동일하게(카드정보 모달)

- **대상**: FC-178(인벤토리 타일=마켓 ItemCard·카드정보 모달=ShopCardInfoDialog 계승·'바로구매'→'판매 등록')
- **리뷰어**: reviewer(읽기 전용)
- **일자**: 2026-08-04
- **판정**: **PASS** (critical 0 / major 0 / minor 2) → `review_status: passed`

## 초점별 근거
1. **마켓 회귀 없음(중점)**: `ItemCard.tsx` `hidePrice`는 순수 가법 prop(default false), skillFlip 가격 줄만 조건부 래핑 — 그 외 렌더 전부 불변. `ShopCard.tsx`·`ShopCardInfoDialog.tsx`(+`.css`)·`SellPage` **미변경**(git 확인). 마켓 스위트 green(ShopCard 6·ShopCardInfoDialog 8·ItemCard 11).
2. **카드정보 모달 충실성·접근성**: `InventoryCardInfoDialog`에 usePurchaseShop·balance·isOwn·confirm 서브뷰 전부 제거, 죽은 참조·미사용 import 0. CTA '판매 등록'→`onSell`→`/sell?item=<itemInstancePublicId>`(모달 닫고 navigate). focus trap·Esc·scroll lock·backdrop·role=dialog·aria 계승, `aria-labelledby=inventoryCardInfoTitle`(마켓과 id 충돌 없음).
3. **타일=마켓 카드**: `InventoryItemCard`=ItemCard(skillFlip)+`.shop-card` 래퍼+`absolute inset-0` 오버레이. price 미전달·hidePrice·seller/compare 없음. `decodeTypeCode(summary.typeCode)` 매핑·스킬명 폴백 정확.
4. **레이아웃·정리**: 전체폭 셸·용량 배지·2/3/6 그리드 유지, 빈 슬롯 `h-full min-h-[210px]` 행 정합. 삭제 파일(InventoryItemDialog·InventorySlotGrid.css) dangling 참조 0. SellPage 무변경.
5. **테스트**: 전체 `vitest run` 676 pass(oauth 3 선존 실패 무관), tsc·eslint clean. 신규/갱신 스위트가 hidePrice·onOpen·판매등록 네비·속성표/스킬·Esc/닫기 실검증.

## Minor (비차단)
- **M1(크로스 feature 결합)**: `InventoryCardInfoDialog`(member)가 `@/features/shop/lib/channelLimit`·`@/features/shop/components/ShopCardInfoDialog.css` 임포트 → member→shop 결합. 시각 DRY로 허용 가능(프론트 ArchUnit 미적용·선례 있음)하나, 향후 `channelLimitOf`·공유 카드정보 CSS를 `common`/item 공용으로 승격 권장.
- **M2(스켈레톤 높이 점프)**: `InventoryGridSkeleton` h-[168px] vs 실제 min-h-[210px] → 로딩 전환 레이아웃 시프트. UX 나이트, 회귀 아님.

## 변경/추가/삭제
- 추가: `InventoryItemCard.tsx`(+test), `InventoryCardInfoDialog.tsx`(+test).
- 수정: `ItemCard.tsx`(hidePrice), `InventorySlotGrid.tsx`, `InventoryPage.tsx`(+tests).
- 삭제: `InventoryItemDialog.tsx`(+test), `InventorySlotGrid.css`.
