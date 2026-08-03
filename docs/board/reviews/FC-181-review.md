# FC-181 (EPIC-CARD-SYSTEM T3) 리뷰 — ItemCardGrid 정본 + 3그리드 이관 + 인벤 간격

- **대상**: `ItemCardGrid`(variant market/auction/inventory) 신설 + Market/AuctionList/Inventory 이관 + 인벤 gap-3→gap-2
- **리뷰어**: reviewer(읽기 전용) · **일자**: 2026-08-04
- **판정**: **PASS** (critical 0 / major 0 / minor 1) → `review_status: passed`

## 근거
1. **마켓·경매 픽셀 보존(중점)** — git diff 문자단위 대조: `GRID_CLASS`가 기존 인라인과 **바이트 동일**(market `gap-3` 2/3/6, auction `gap-4` 1/2/3). 래퍼 태그(section)·aria(region "마켓 상품 목록"/"경매 목록")·스켈레톤 형상·count(12/8) 보존. 회귀 스위트 green(ShopCard 6·ShopCardInfoDialog 8·AuctionPreviewCard 5, 전체 47파일 368).
2. **인벤 간격** — inventory variant `gap-2`(열 2/3/6 동일). 빈슬롯·용량·h-full·min-h 불변. **ready↔스켈레톤 드리프트 제거**(둘 다 GRID_CLASS.inventory gap-2 공유, 테스트 `not.toContain('gap-3')` 고정).
3. **범위(InventoryPage 5번째 파일)** — 정당: 인벤 스켈레톤이 InventoryPage에 있어(4번째 바이트 복제) 이관 안 하면 ready(gap-2)와 드리프트. 티켓 목표에 직접 추적(coding-discipline 3 충족). → 티켓 artifacts에 InventoryPage.tsx 보정.
4. **과설계 없음** — `as`(section|ul) 유니온은 인벤 ul/li 시맨틱 때문 불가피, variant enum 3종만·boolean 추가 없음(규약 §9.3 정합).
5. **테스트** — ItemCardGrid 7/7(variant·gap·count·aria), 회귀 47파일 368 green. tsc·eslint clean.

## Minor (비차단)
- **M1**: 티켓 `artifacts`에 `InventoryPage.tsx` 누락(4개만) → 보정(코드 결함 아님).

## 커밋 분리 주의
워킹트리에 T1(ItemSummaryResponse·SkillExposureIntegrationTest·api-contract) + T2(rules.md)가 함께 있음 → FC-181(그리드 프론트)과 **분리 커밋**.
