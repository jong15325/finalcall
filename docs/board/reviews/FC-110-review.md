# FC-110 리뷰 — 검색 정합성 하드닝 (#2 화해 histogram · #5 관측)

- 리뷰어: reviewer (2026-07-24, concurrency-review)
- 대상: 커밋 db3f000 (#2·#5). #1·#4는 검증 그린(구현 없음), #3은 FC-116 이월.
- **판정: pass** (critical/major 0건)

## 재현 검증
- SearchReconciliationAggregationSliceTest(real MySQL) 4/4 · SearchReconciliationWorkerIntegrationTest(real ES) 3/3 = 7/7 green · checkstyleMain·spotlessCheck BUILD SUCCESSFUL(위반 0).

## 확인 항목 (전부 정합)
1. **버킷 대조 정확** — ES histogram(offset 0) `floor(v/interval)*interval` == MySQL `floor(price/size)*size`. 가격 전부 비음수(shop CHECK price>0·auction start_price primitive long)라 세 표현 일치·오프바이원 없음. status는 union(db,es) 합집합 순회로 한쪽 버킷도 양방향 처리.
2. **only_full_group_by 견고** — select식=group by식(bucketIndex) 동일, 하한 곱은 Java. 실 MySQL 8(ONLY_FULL_GROUP_BY on) 슬라이스 테스트로 검증.
3. **price 소스 정합** — sink rename start_price→price → ListingIndexer → template price:long. MySQL 버킷도 startPrice/price. NOT NULL+CHECK로 null/음수 차단.
4. **분포 드리프트 탐지(핵심)** — 총량 동일·status 분포 상이(테스트1), 총량·status 동일·가격버킷 상이(테스트3) 실제 탐지. 안정 필드(startPrice) 대조로 false drift 구조적 감소.
5. **미터 저카디널리티** — status_drift=listingType×status(~12 series), price_drift=listingType만. 가격버킷 하한은 로그만(태그 폭발 회피).
6. **테스트 실효** — 실 ES agg + 실 MySQL SQL. 렌더 확인 아님.
7. **과잉 변경 없음** — 9파일 전부 DoD#2/#5 직접 추적. countInEs는 status agg 합으로 대체(잔여 참조 0).

## minor (비차단 — Done 무영향, 후속 관찰)
- **M1 (concurrency)** `sweepOnce()`가 MySQL 3쿼리+ES 2agg를 각기 다른 시점 스냅샷으로 읽어, CDC 라이브 반영 중 in-flight 1건이 순간 드리프트로 계측될 수 있음. warn-only·correctOnDrift=false 기본이라 결함 아님(spec §12.5가 관측 대상으로 수용). 알람 노이즈 줄이려면 tolerance 임계 또는 re-check 한 단계 후속 여지.
- **M2 (효율)** statusCountsInEs·priceBucketCountsInEs가 동일 필터에 agg만 다른 ES search를 2회 발행. 단일 search에 agg 2개로 묶으면 type당 왕복 2→1. 5분 주기라 영향 미미, 선택적.

## Done
critical/major 0 → Done 가함. review_status: passed. FC-110 범위(#1·#2·#4·#5) 완결. 게이트3(사용자 Done 승인) 대기. M1·M2는 비차단 후속.
