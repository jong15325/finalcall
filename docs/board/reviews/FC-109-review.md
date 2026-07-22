# FC-109 리뷰 — EPIC-SEARCH 통합 검수 (1차)

- **에픽**: EPIC-SEARCH (KAN-119)
- **대상**: FC-107 backend(cb91c64) + FC-108 frontend(fcf7e03)
- **판정**: **changes-requested** — critical 0 · **MAJOR 1** · minor 4
- **일자**: 2026-07-22 (reviewer)
- **정본**: search-spec v0.3 §12 · api-contract §3(C1~C3) · domain-spec §8

## ★ dual-write 판정 = NOT dual-write (합격)
- 도메인 쓰기(AuctionService.register·ShopService·입찰·구매)는 MySQL만 write, ES 직접 쓰기 없음(검색 컴포넌트 참조는 읽기 ListingSearchService.search뿐).
- ListingIndexer는 정본(MySQL) 읽고(findAllForIndexing 조인) 멱등 bulk upsert(_id=publicId 전체 replace) — 호출자=SearchReconciliationWorker.reindexAll 단 1곳(도메인 TX 밖). 유형(a) 재색인/화해. 금지 dual-write 아님. §12.3·§12.8 정합.

## MAJOR-1 — 검색이 기본 설정·런북 절차에서 비작동 (동기 정합 DoD 미충족)
- 인덱스/질의 필드 = camelCase(nameSnapshot·listingType·price·endsAt). Debezium unwrap은 **DB 컬럼명(snake_case)** 발행, **rename SMT 없음**. `listing_type` 컬럼 부재(listingType은 ListingIndexer 합성).
- → CDC 문서는 nameSnapshot·listingType·price·endsAt 미충족. 질의는 항상 `term listingType` AND(ListingSearchService.java:99) → CDC-only 문서 0건 매칭. multi_match nameSnapshot도 미색인 0건.
- 검색 가능 문서 유일 경로 = ListingIndexer.reindexAll → **correct-on-drift=true일 때만 실행, 기본 false**(application.yml:190), 부팅/admin 트리거 부재.
- **재현**: 런북(create-index→register-connectors→snapshot 백필)→ 스모크 `GET /auctions?q=검` = **빈 결과**. README "텍스트/가격/상태는 CDC로 완전히 흐른다"는 사실과 불일치(텍스트 컬럼명 불일치로 안 흐름).
- **보정 방향**: (a) sink rename SMT/ingest-pipeline로 camelCase+listingType 채움, 또는 (b) 앱 재색인을 주 populator로 공식화(부팅 재색인 + correct-on-drift 기본 on + 런북 enrich 단계). 최소한 런북 스모크가 실제 통과해야. CDC 파이프라인(게이트2 선택)은 유지하되 실제 문서 생산에 기여하도록.

## MINOR
1. 화해 histogram 미구현(count만, SearchReconciliationWorker.java:57) — spec §12.5 부분 미충족. 상태전이 드리프트 미탐지 가능.
2. enrich 지연·bulk 반복: correct-on-drift on 시 신규 리스팅마다 무-listingType CDC 문서가 드리프트로 잡혀 tick(5분)마다 전건 재색인 — 근실시간 런북과 상충. 문서화/튜닝 권고.
3. ES에 비마스킹 nickname 색인(ListingIndexer.java:108) — 현재 source.fetch(false)·DB 하이드레이션이라 API 미노출이나 향후 _source 반환 시 노출면(SEC-007 잠재).
4. 광범위 catch(ListingSearchService.java:75, IOException|RuntimeException→503)가 로직 버그까지 503 흡수. 단 validate/decode(400)는 try 밖이라 정상.

## 합격 항목
- 주입 차단(match/multi_match·term/range만·query_string 부재) · q 규약(2~64·400·빈결과 200) · C2 이중 방어(백엔드 400 + 프론트 조합 미생성) · search_after 커서 무중복/누락 · 비색인 민감필드(자금·홀드 없음) · 엔드포인트 공개 목록 additive · ES 순서보존 DB 하이드레이션 · 프론트 계약/접근성.

## 재검 (2차, 2026-07-22 · 커밋 edd9807) — MAJOR-1 해소 (PASS)
- **판정: passed** — critical/major 0. 1차 changes-requested 사유 해소.
- (a) sink SMT 정합: rename(snake→camel)+listingType 주입(TopicNameMatches, route 이전 실행)·`_id`=public_id. shop `start_price` rename은 no-op(이미 price)·양쪽 price 수렴.
- (b) ListingBootReindexer(ApplicationReadyEvent→reindexAll) 게이팅 정합: base off·local on·test off·ES 미가용 스킵.
- (c) upsert 병합 비클로버: enrichment join 필드는 CDC에 필드명 부재라 보존. (d) populator 테스트가 실경로(bulkUpsert) q매칭+코드축 대리검증. 런북 스모크 통과 가능.
- dual-write 없음 재확인. MINOR-1(마스킹)·MINOR-3(catch 축소) 정합. **잔존 = 비차단 minor(histogram·TransportException 500화·highestBidAmount 스테일)만, 전부 후속**.
- **운영 유의(후속)**: local만 부팅 재색인·correct-on-drift on. 운영은 초기 색인 전략 별도 결정 필요(현 운영 트리거 없음, 의도된 후속).
