# FC-029 — EPIC-AUCTION 통합 리뷰 (reviewer)

- 대상: EPIC-AUCTION(FC-026~028) 백엔드 working-tree 변경 (auction 신규 + item 편집 + SecurityConfig + V10 + 테스트)
- 기준: auction-domain-spec v0.2 · api-contract §3.1/§3.3/§5(v1.7) · erd(auction) · item-domain-spec(에스크로 불변식)
- 방식: 정적 리뷰(앱 :8080 부팅 미수행 — 사용자 IntelliJ 점유 회피)
- 판정일: 2026-07-18

## 최종 판정: PASSED (통과)

**critical 0 · major 0 · minor 8(판단 6 + 추가 2, 전부 비차단).** 게이트3 진행 가능.

## 도메인 인가 (최종 판정) — 이상 없음
- 등록: `AuctionService.register` — `item.isOwnedBy(sellerId)` 검증, 주체=SecurityContextHolder. 자기 아이템만 출품, 실패 AUCTION_001(403, 미존재도 403 통일로 열거 방지).
- 취소: 주체 ≠ `auction.seller.id` → AUCTION_001(403). IDOR 차단. seller fetch join 초기화.
- 공개 GET: `permitAll(GET, /auctions, /auctions/*)` — `/*` 단일 세그먼트라 취소(2세그먼트 POST)와 무교차. 응답에 소유자/판매자 실식별자·loginId·slot_no·최고입찰자 실값 없음. sellerNickname은 리스팅 고유정보(마스킹 대상 아님), highestBidderMasked 본 에픽 null. OSIV off·전부 to-one fetch join(LazyInit 없음).

## 동시성/에스크로 — 이상 없음
- 등록 CAS `markListedIfInInventory`(WHERE location=INVENTORY): 6스레드 동시성 테스트 성공1·나머지 AUCTION_002·최종 LISTED 1건. initialLocation 선포착으로 0행 분기(TEMP→001 / 그외→002) staleness 회피.
- 취소 CAS `cancelIfCancellable`(status IN(SCHEDULED,ACTIVE) AND highestBidder IS NULL): 단일승자·0행 분기.
- 에스크로 XOR: 등록 LISTED(slot NULL), 취소 여유=INVENTORY+slot / 만실=TEMP — item-spec §3.1 XOR·slot_key UK 정합. `releaseFromListing`은 별도 빈 경유(동일 TX, self-invocation 아님) → 실패 시 함께 롤백.
- 벌크 @Modifying 후 로드 엔티티 미재사용 → lost-update 없음.

## 계약 정합 — 이상 없음
- 응답 필드·에러코드(AUCTION_001~008, 001=403 단일 1:1)·cursor 코덱·displayStatus lazy 파생·최고가 null이 계약 v1.7·spec v0.2와 일치. Flyway V10 채번·FK 3·인덱스 4 정합. keyset 전부 to-one join(행 증식 없음).

## 판단 6건 판정 (backend-impl 상신)
1. cancel 미존재→404·타인→403: **수용** — 공개 GET 상세가 이미 존재 노출, 추가 누설 없음.
2. 소프트클로즈 상한 상수(300s/24h): **수용(본 에픽)** — 컴파일 상수·env override 불요라 §4 @ConfigurationProperties 대상 아님. 프로파일 튜닝 필요 시 승격(비차단).
3. status 필터 영속값 기준: **수용(알려진 한계)** — 기본 스코프는 SCHEDULED·ACTIVE 모두 노출, EPIC-CLOSING 워커가 영속 전이로 치유. 문서화 권고.
4. cancel 0행 로드 엔티티 판정: **수용(본 에픽)** — highest_bidder 전건 null이라 정확. ★주석이 EPIC-BID 시 fresh/locking 필요 명시.
5. markListed() 제거 → item-domain-spec §3.1 L92 드리프트: **확인(지적만)** — 문서 갱신은 architect 소유. 메인세션이 후속 전달 권고.
6. skill1/skill2 슬롯 위치 매칭: **수용** — §3.3 필드명 정합. "슬롯 무관 검색 아님" 의미론 계약 명시 권고.

## 추가 minor (비차단)
- **AUCTION_003 이중용도**: `validatePrice`가 startPrice≤0 위반에도 AUCTION_003("즉시구매가는 시작가보다 커야") 던짐 → 오해 메시지 + 계약 미기술(spec §5.1은 매핑 명시). 메시지 일반화 or 계약 각주 권고. 악용 불가(≤0 거부).
- **cancel 경로 INV_002 표면화**: `releaseFromListing` 자동 슬롯배정이 동일 판매자 동시 취소 2건 충돌 시 INV_002 매핑(재시도 없음). 계약 §5.4 미기술. 영향 극소(희귀·재시도 가능·롤백). 재시도 도입 or 각주 권고.

## 불필요 변경 점검 — 통과
backend 변경 전건 에픽 추적(SecurityConfig 공개 GET·api-contract v1.7 게이트2 정밀화). 무관 리팩터/포맷 없음.

## 메인세션 조치
(1) 본 파일 기록 ✓ (2) FC-026~029 review_status passed (3) 판단 #5 문서 드리프트 → architect 후속(item-domain-spec §3.1 markListed 갱신) (4) minor 2건(AUCTION_003 메시지·cancel INV_002) → 백로그(게이트3 비차단).
