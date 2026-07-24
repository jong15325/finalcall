# FC-101 리뷰 — 마켓 목록 대량 성능 (ShopCard memo · per-second now 격리)

- 리뷰어: reviewer (2026-07-24)
- 대상: 워킹트리(MarketPage·ShopCard·ShopCard.test). errorCodes.ts는 별건(계약 정합) 제외.
- **판정: pass** (critical/major 0건)

## 확인 항목
1. **memo 정합** — MarketPage가 ShopCard에 넘기는 `shop`(react-query 캐시 참조·구조적 공유로 기존 원소 안정)·`now`(마운트 고정) 둘 다 안정 참조. 인라인 객체/콜백 없음 → 얕은 비교로 memo 성립. 부모 리렌더(balance/fetching)가 카드로 안 번짐.
2. **now 제거 정확** — 마켓 카드 now는 골드포스 잔여일(`Math.ceil((expireAt-now)/DAY_MS)`, 일 단위)에만. 마운트 고정으로 충분. 자정 넘김 장시간 오픈 시 잔여일 과다 표기 가능하나 재조회 remount로 갱신(informational, DoD 허용).
3. **비교 하이라이트 무영향** — `CardCompareOverlay`가 zustand 스토어 직접 구독 → 부모 memo와 무관하게 갱신. 실측 확인.
4. **경매 목록 회귀 없음** — useNow 훅 미변경, AuctionListPage 카운트다운 유지. ShopCard는 마켓 전용.
5. **과잉 변경 없음** — windowing 미도입 적절(무한스크롤 DOM 제한 + memo). diff 전 라인이 요청에 직접 추적.

## minor (비차단)
- **minor-1** ShopCard.test의 memo 테스트가 `$$typeof===react.memo` 구조 단언에 그침(행위 미검증). 렌더 카운트 스파이로 강화 여지. (골드포스 잔여 파생 테스트는 견고.)
- **minor-2 (informational)** 자정 넘김 stale 경계 — DoD 허용, 코멘트 문서화.

## Done
critical/major 0 → pass. review_status: passed. 잰더 실측(브라우저 깊은 스크롤 5천)은 총괄 후속. 게이트3 대기.
