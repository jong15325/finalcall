# FinalCall Purchase Domain Spec (즉시구매 + 거래내역 도메인 스펙)

상태: **v1.0 — 게이트2 승인 확정(2026-07-22, 사용자)**. EPIC-PURCHASE(경매 즉시구매 `POST /auctions/{id}/purchase` + 거래내역 조회 `GET /me/orders`·`GET /orders/{id}`)의 계약/설계 정본이다.
게이트2 8항목(A1~A5·B1~B3) 전건 승인 — **A1 구매자 잔액 직접 차감** · **A2 진행입찰 RELEASE+OUTBID·최고입찰자 본인구매 허용** · **A3 SettlementRecorder 추출 + PurchaseService 신규** · **A4 live CAS(`markSoldBuyNowIfLive`, `end_at > now`) + user_id 오름차순 락** · **A5 AUCTION_006 라벨 확대(신규 코드 미추가)** · **B1 orders IDOR 스코프** · **B2 fee/settle 판매자 전용** · **B3 BUYNOW 구분 코어 미노출**. **스키마 무변경**(BUYNOW result_type·source_type=AUCTION 이미 존재, V14 무변경). 이 승인분이 erd v1.4(semantic)·api-contract v1.13에 확정 반영된다(§7).
소유: architect(spec). 구현 = backend-impl(FC-089 서버)·frontend-impl(FC-090 즉시구매 버튼·거래내역 화면).

범위(코어): **즉시구매(BUYNOW)** + **거래내역 조회 2종**.
**범위 밖**: 고정가(EPIC-SHOP, `POST /shops/{id}/purchase`·source_type=SHOP) · 관리자 강제취소 · 정산 후 환불/크레딧(fee-policy-spec §5) · 알림 · 마켓/커뮤니티/충전.

근거(정본): **closing-domain-spec v1.0**(SOLD 정산 TX §4·불변식 I-A~I-H·에스크로·수수료 계산기·PC clear 함정 — 즉시구매는 이 SOLD 흐름을 **재사용/변주**한다), fee-policy-spec v1.0(수수료 판매자 단독·취소/유찰 0·SOLD 시만), erd v1.3(§4.2 `sale_order` source_type·`platform_revenue_ledger`, §4.2 `auction.result_type` BUYNOW·`buy_now_price`, §5 인덱스), api-contract v1.12(§3.1 `POST /purchase` 엔드포인트·에러 AUCTION_005/006/009·BID_005 이미 등재, §4.3 주문 API 이미 등재, §3.3 마스킹 규약). CLAUDE.md 섹션 4·5.

백엔드 실측(현 구조·재사용 자산): `settlement/{CloseService.settleSold, SaleOrder, SaleOrderRepository, PlatformRevenueLedger, PlatformRevenueLedgerRepository, FeeCalculator, FeePolicyProperties, SettlementErrorCode}`, `auction/{AuctionRepository(markSoldIfClosable·markUnsoldIfClosable·findCloseContextForUpdate·CAS 선례), AuctionResultType.BUYNOW(정의됨·미사용), AuctionBidContext(buyNowPrice·highestBidderId 보유·itemInstanceId 미보유)}`, `bid/{BidRepository.markOutbidIfActive·findActiveByAuctionId, BidService.validate}`, `currency/{MoneyHoldService.release·capture, MoneyHoldRepository}`, `item/InventoryService.transferListedToBuyer`, `member/UserBalanceRepository(increaseGameMoney·decreaseGameMoney available-gated·capture)`.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1 | 2026-07-22 | FC-088 착수 — 즉시구매 흐름·동시성·금전모델(직접차감 vs 홀드+capture)·진행입찰 홀드해제·종료성 CAS(live 조건)·불변식 P-A~P-H·정산 재사용 판정(SettlementRecorder 추출)·orders API 인가/필드 노출범위. 게이트2 상신 항목 정리(§7) |
| v1.0 | 2026-07-22 | **게이트2 전건 승인 반영**(deviation 없음) — A1 직접차감·A2 RELEASE+OUTBID+본인구매 허용·A3 SettlementRecorder 추출+PurchaseService 신규·A4 live CAS+락 순서·A5 AUCTION_006 라벨 확대·B1 IDOR 스코프·B2 fee/settle 판매자 전용·B3 BUYNOW 코어 미노출. §7 상신표 → 결정표로 확정. erd v1.4·api-contract v1.13에 확정 반영. FC-089(backend-impl)·FC-090(frontend-impl) 인계 계약 확정 |

---

## 1. 문제 정의 — 즉시구매는 "라이브 상태에서의 SOLD"다

마감 워커(EPIC-CLOSING)의 SOLD는 **마감 시각이 지난**(`end_at <= now`) 경매를 최고 입찰자에게 낙찰시킨다. 즉시구매는 그 대칭이다: **아직 진행 중인**(`now < end_at`) 경매를 구매자가 `buy_now_price`에 **즉시 종료·낙찰**시킨다. 결과 상태는 동일한 SOLD이되 `result_type`이 다르다(`BID` → `BUYNOW`)이고, 낙찰가가 최고입찰가가 아니라 즉시구매가다.

두 경로의 **정산 꼬리(sale_order·수익원장·아이템 이전·판매자 크레딧)는 완전히 같다**. 다른 것은 (1) 진입(동기 HTTP vs 비동기 워커), (2) 금전 유입(구매자 직접 차감 vs 낙찰자 홀드 capture), (3) 패자 처리(진행 중 최고 입찰자 홀드 해제), (4) 종료성 CAS 시간 조건(live vs expired), (5) result_type다. 이 스펙은 그 차이만 규정하고, 공통부는 closing-domain-spec §4를 승계한다.

### 1.1 재사용 원칙

- **sale_order·platform_revenue_ledger·V14 스키마 무변경.** 즉시구매는 신규 테이블·컬럼·마이그레이션이 **없다**. `source_type=AUCTION`·`result_type=BUYNOW`·`buy_now_price`가 이미 존재한다(erd v1.3). → **게이트2 스키마 항목 없음**(정책·동시성·인가·노출범위만 상신).
- **FeeCalculator·FeePolicyProperties 그대로.** 수수료는 `final_price = buy_now_price` 기준 동일 계산기 1회. 취소/유찰 0·SOLD 시만 원칙 유지(fee-policy-spec §5).
- **불변식 I-A~I-H 승계.** 특히 **I-H 게임머니 총량 보존**은 즉시구매에서도 훼손되지 않는다(§4).

---

## 2. 즉시구매 API — `POST /api/v1/auctions/{auctionPublicId}/purchase`

계약 §3.1에 엔드포인트·에러가 이미 등재돼 있다. 이 절은 그 **동작을 정밀화**한다(신규 필드·엔드포인트 없음, 동작 명세).

- 인증: 필요. 구매자 = SecurityContext 주체(요청 본문에서 받지 않는다).
- 요청 본문: 없음(경매 식별은 경로, 금액은 서버가 `buy_now_price`로 확정 — 클라이언트 금액 신뢰 없음).
- 응답 201: `{ orderPublicId, finalPrice }`(계약 §3.1 그대로. `finalPrice = buy_now_price`).
- 에러: `AUCTION_005` 즉시구매 미설정(422) · `AUCTION_006` 이미 종료·구매 불가(409) · `AUCTION_009` 판매자 자기구매(403) · `BID_005` 게임머니 잔액 부족(422) · `AUCTION_004` 경매 없음(404). (§7-A5 not-started 처리 상신)

---

## 3. 동시성 모델 — 입찰·마감과 같은 행 락으로 직렬화

### 3.1 핵심: auction 행 배타 락 공유

즉시구매는 입찰(bid-domain-spec §4.1)·마감(closing-domain-spec §3.2)과 **동일한 auction 행**을 `FOR UPDATE`로 잡는다. 세 경로가 한 행에서 직렬화되므로 별도 조정이 불요하다:

- **즉시구매 vs 진행 입찰**: 입찰이 먼저 커밋되면 즉시구매는 락 획득 후 그 입찰이 반영된 최신 `highest_bidder_id`를 보고 그 홀드를 해제한다. 즉시구매가 먼저 커밋되면(SOLD) 이후 입찰은 `now < end_at` 실패 또는 상태 검증에서 `BID_006`.
- **즉시구매 vs 마감 워커**: 두 경로가 시간축을 **분할**한다 — 즉시구매는 `now < end_at`(live)에서만, 마감은 `end_at <= now`(expired)에서만 종료성 CAS를 성립시킨다(§3.3). 락 하 재검증 + 상태 CAS로 한쪽이 SOLD로 전이하면 다른 쪽은 무부작용 판정된다(closing I-F 대칭).
- **즉시구매 vs 즉시구매**(두 구매자 동시): 먼저 락을 쥔 쪽이 SOLD로 전이하고, 뒤엣 쪽은 재검증에서 `status ∉ (SCHEDULED,ACTIVE)` → `AUCTION_006`.

### 3.2 `purchase(auctionPublicId)` 절차 (PurchaseService, 신규)

```
@Transactional
purchase(auctionPublicId):   // 구매자 = SecurityContext 주체 bidderId
 1. auction 행 배타 락 + 값 스냅샷
      @Lock(PESSIMISTIC_WRITE) SELECT ... FOR UPDATE   (AuctionPurchaseContext 프로젝션 — §3.4)
      → id·sellerId·status·startAt·endAt·buyNowPrice·itemInstanceId·highestBidderId·highestBidAmount 를 지역 변수 복사
      없으면 → AUCTION_004(404)
 2. 재검증 (락 스냅샷 근거 — 전부 락 안에서):
      buyNowPrice != null            아니면 → AUCTION_005(422)
      buyerId != sellerId            아니면 → AUCTION_009(403)   (wash trade 방지, 입찰 BID_003 대칭·SEC-003)
      live 판정: (status==ACTIVE || (status==SCHEDULED && startAt 도래)) && now < endAt
                                     아니면 → AUCTION_006(409)   (§7-A5: 미개시 처리 상신)
 3. 진행 중 최고 입찰 식별: bidRepository.findActiveByAuctionId(id) → loserBidId(nullable)
      (경매당 ACTIVE 입찰 최대 1건 = closing I1. 없으면 입찰 0건 경매의 즉시구매)
 4. 수수료 계산 1회: fee = FeeCalculator.compute(buyNowPrice);  settle = buyNowPrice − fee;  version = feePolicy.version()
 5. 패자 홀드 해제 + 입찰 강등 (loserBidId != null 일 때):
      moneyHoldService.release(loserBidId)          // HELD→RELEASED + 잔액 held 복원. ★ PC clear
      bidRepository.markOutbidIfActive(loserBidId)  // ACTIVE→OUTBID CAS, assert 1행
 6. 구매자 직접 차감: userBalanceRepository.decreaseGameMoney(buyerId, buyNowPrice)   // available-gated. ★ PC clear
      0행 → BID_005(422) 가용 게임머니 부족
 7. 정산 꼬리(공통, closing §4.1 재사용 — §6 SettlementRecorder):
      seller 크레딧 → sale_order INSERT(source AUCTION/id, final=buyNowPrice, fee, settle, version) → 수익원장 INSERT
      → 아이템 이전(transferListedToBuyer(itemInstanceId, buyerId)) → 소유이력 append(TRADE, orderId)
 8. 종료성 CAS(live): auctionRepository.markSoldBuyNowIfLive(id, now)
      @Modifying CAS  SET status='SOLD', result_type='BUYNOW'
      WHERE status IN ('SCHEDULED','ACTIVE') AND end_at > :now   assert 1행
COMMIT → 행 락 해제
```

### 3.3 ★ 종료성 CAS의 시간 조건 = `end_at > now` (마감과 반대)

마감 SOLD CAS(`markSoldIfClosable`)는 `end_at <= now`(expired)를 요구한다. 즉시구매 CAS는 **`end_at > now`(live)** 를 요구한다 — 두 조건이 시간축을 배타 분할하므로, 오배선·경합으로 두 경로가 같은 경매를 노려도 시간 조건 자체가 한쪽만 성립시킨다(status 가드가 단일 승자를 보장하는 위에 방어 한 겹 추가). `AuctionRepository.markSoldBuyNowIfLive`가 신규(backend-impl 소유) — `markSoldIfClosable`의 시간 조건·result_type만 다른 CAS다.

### 3.4 PC clear 함정 (closing §4.2 승계)

`release`(5)·`decreaseGameMoney`(6)·`increaseGameMoney`(7 내부)는 `clearAutomatically`라 **영속성 컨텍스트를 통째로 비운다**. 따라서 (1) 판정 근거는 1단계에서 전부 값 스냅샷으로 복사하고, (2) 이후 모든 전이는 `@Modifying` CAS 또는 fresh INSERT(`getReferenceById` FK)로 수행한다. `AuctionPurchaseContext`는 엔티티가 아닌 **스칼라 프로젝션**이어야 한다(AuctionCloseContext 선례). 현행 `AuctionBidContext`는 `itemInstanceId`가 없고 `AuctionCloseContext`는 `buyNowPrice`·`startAt`이 없어 **어느 것도 그대로 못 쓴다** → 신규 프로젝션(id·sellerId·status·startAt·endAt·buyNowPrice·itemInstanceId·highestBidderId·highestBidAmount).

### 3.5 실행 순서 근거 (패자 해제를 구매자 차감보다 앞에)

5단계(패자 홀드 해제)를 6단계(구매자 차감)보다 앞세우는 이유: **구매자가 곧 현재 최고 입찰자일 수 있다**. 즉시구매는 입찰이 아니라서 연속입찰 차단(BID_004)의 대상이 아니므로, 최고 입찰자가 자기 리드를 확정하려 즉시구매하는 경로를 허용한다(§7-A2). 그 경우 5단계가 구매자 자신의 홀드를 먼저 풀어 가용 잔액을 회복시켜야 6단계 `decreaseGameMoney`(available-gated)가 통과한다. 구매자 ≠ 최고 입찰자인 일반 경로에서도 순서는 무해하다(서로 다른 사용자 잔액 행이라 데드락 표면은 §7-A4에서 다룬다).

---

## 4. 불변식 (reviewer/테스트 정본) — closing I-A~I-H 승계 + 즉시구매 고유

| # | 불변식 | 위반 시 의미 |
|---|---|---|
| **P-A** | 즉시구매 성립 후 `status='SOLD'` ∧ `result_type='BUYNOW'` ∧ sale_order 1건(source=AUCTION, source_id=auction.id, `final_price = auction.buy_now_price`). closing I-A의 BUYNOW 변주 | 분기 오류 |
| **P-B** | `final_price = buy_now_price = settle_amount + fee_amount`, `fee_amount = FeeCalculator(buy_now_price)`(재현) | 정산 금액 드리프트 |
| **P-C** | 경매당 SOLD 핸드오프 정확히 1회. `sale_order (source_type,source_id)` UK가 이중 SOLD(즉시구매 2회·즉시구매↔마감 경합)를 DB 차단. row lock+status CAS로 단일 승자 | 이중 정산 |
| **P-D** | 구매자 `game_money_balance −= buy_now_price`(available-gated, 홀드 미경유). 진행 중 최고 입찰자가 있었으면 그 홀드 `HELD→RELEASED`(held 복원, balance 불변) ∧ 그 bid `ACTIVE→OUTBID`. 즉시구매 후 경매에 ACTIVE bid·HELD hold 0건 | 무자본 획득·패자 자금 동결 |
| **P-E** | `item_instance.owner_id = buyerId` ∧ `location ∈ {INVENTORY,TEMP}` ∧ `item_ownership_history`에 (seller→buyer, TRADE, sale_order_id) 1행 | 소유 이전 누락 |
| **P-H** | **게임머니 총량 보존** — `SUM(game_money_balance) + SUM(platform_revenue_ledger.amount)` 불변. 델타: 구매자 `−buy_now_price`, 판매자 `+settle`, 원장 `+fee`, `buy_now_price=settle+fee` ⟹ 합 0. 패자 홀드 해제는 held 잠금 해제일 뿐 balance 변화가 없어 총량 무영향 | 게임머니 생성·소멸 |

- **P-F/P-G 비적용**: 즉시구매는 동기 단발 요청이라 워커의 idempotent 재시도(I-F)·소프트클로즈 재검증(I-G)이 없다. 대신 status CAS가 동시 즉시구매·마감 경합에서 단일 승자를 보장한다(P-C).

**필수 시나리오(테스트)**:
1. 입찰 0건 경매 즉시구매 — 구매자 −buyNow·판매자 +settle·원장 +fee·아이템 이전·sale_order 1건·result_type=BUYNOW. P-A·P-B·P-D·P-E·P-H.
2. 진행 입찰 있는 경매 즉시구매 — 패자 홀드 RELEASED·bid OUTBID·구매자 직접 차감. P-D.
3. 최고 입찰자 본인 즉시구매(§7-A2 승인 시) — 자기 홀드 해제 후 buyNow 차감, 순 지불 = buyNow. P-D·P-H.
4. 즉시구매 vs 마감 워커 경합 — live/expired 시간 분할로 한쪽만 성립, 이중 정산 없음. P-C.
5. 즉시구매 vs 즉시구매 동시 — 선착 1건 SOLD, 후착 AUCTION_006. P-C.
6. 자기구매 거부(AUCTION_009)·미설정 거부(AUCTION_005)·잔액부족(BID_005).
7. 게임머니 총량 보존 — cap/최소 저촉 buyNow(고액·소액) 포함 경계에서도 보존. P-H·P-B.

---

## 5. 거래내역 조회 API (`GET /me/orders` · `GET /orders/{id}`)

계약 §4.3에 엔드포인트가 이미 등재돼 있다. 이 절은 **SaleOrderResponse 필드 집합·인가·역할별 노출 범위**를 확정한다(계약 §4.3가 현재 미규정 — BidSummary v1.8 신설 선례처럼 스키마를 명세). **읽기 전용·스키마 무변경**(sale_order 그대로).

### 5.1 인가 (IDOR — 게이트2)

- **`GET /me/orders`**: 쿼리를 `buyer_id = me OR seller_id = me`로 **스코프**한다(제3자 주문 미노출). 필터 `role=BUYER|SELLER`는 그 안에서 한 축으로 좁힌다. 인덱스 `sale_order (buyer_id)`·`(seller_id)` 커버(erd §5). cursor 페이지·정렬 `created_at desc`.
- **`GET /orders/{orderPublicId}`**: public_id로 조회 후 **요청자 ∈ {buyer_id, seller_id}** 검증. 아니면 `ORDER_002`(403), 미존재면 `ORDER_001`(404). public_id가 ULID(추측 불가)라 403/404 구분의 열거 리스크는 실질 0(SEC-007 무관) — 계약 기확정 `ORDER_002=403` 유지.

### 5.2 역할별 노출 범위 (게이트2) — 수수료/정산액은 판매자 전용

거래 상대의 **경제 정보 비대칭 노출**을 막는다. `fee_amount`·`settle_amount`은 **판매자 측 회계**(판매자가 수수료를 부담하고 정산액을 받는다)다. 구매자는 자기가 지불한 `final_price`만 알면 되고, 플랫폼 수수료·판매자 순수취액을 알 이유가 없다.

| 필드 | 구매자 시점 | 판매자 시점 | 출처 |
|---|---|---|---|
| `orderPublicId` | ✓ | ✓ | sale_order.public_id |
| `myRole` | `BUYER` | `SELLER` | 파생(요청자 대비) |
| `sourceType` | ✓ (`AUCTION`) | ✓ | sale_order.source_type. (BID/BUYNOW 구분은 §7-B3 상신) |
| `counterpartyMasked` | 판매자 nickname 마스킹 | 구매자 nickname 마스킹 | §3.3 규약(앞 2자+`***`), userPublicId·loginId 미노출 |
| `item`(요약) | ✓ | ✓ | item_instance(+템플릿 코드·nameSnapshot). §3.3 item 블록 규약 재사용 |
| `finalPrice` | ✓ | ✓ | sale_order.final_price(구매자가 지불한 금액) |
| `feeAmount` | **✗ 숨김** | ✓ | sale_order.fee_amount |
| `settleAmount` | **✗ 숨김** | ✓ | sale_order.settle_amount |
| `status` | ✓ (`SETTLED`) | ✓ | sale_order.status |
| `createdAt`/`settledAt` | ✓ | ✓ | sale_order |

- **역할 인지 응답(role-aware DTO)**: 같은 주문이라도 구매자/판매자에게 다른 필드 집합을 낸다. 목록(`/me/orders`)·상세(`/orders/{id}`) 모두 동일 규칙. `myRole`로 클라이언트가 어느 경제 관점인지 분기한다.
- **현행 계약 §4.3과의 차이**: 현재 §4.3은 상세를 "출처·아이템·최종가·**수수료·정산액**·상태"로, 요약을 "상대·아이템·최종가·**정산액**·시각"으로 적어 **양 당사자 모두 fee/settle를 보는 것으로 읽힌다**. 위 표는 이를 **판매자 전용**으로 정밀화한다 → 계약 변경(게이트2, §7-B). 승인 후 §4.3에 SaleOrderResponse 스키마를 신설 반영한다.

### 5.3 SaleOrderResponse 스키마(제안)

```
OrderSummary (GET /me/orders content 항목):
  { orderPublicId, myRole, sourceType, counterpartyMasked, item(요약),
    finalPrice, status, createdAt,
    feeAmount?, settleAmount? }   // myRole==SELLER 일 때만 존재(구매자엔 필드 자체 부재)

OrderDetail (GET /orders/{id}):
  OrderSummary + { settledAt, itemInstancePublicId }
```

---

## 6. 정산 재사용 판정 — SettlementRecorder 추출(권고) · PurchaseService 신규

즉시구매와 마감 SOLD의 **공통 꼬리**(판매자 크레딧 → sale_order INSERT → 수익원장 INSERT → 아이템 이전 → 소유이력 append)는 코드가 동일하고, 이 구간이 곧 I-B·I-C·I-E·I-H를 지는 **총량 보존 임계 코드**다. 두 곳에 복제하면 드리프트 리스크가 그 임계 코드에 생긴다.

| 선택지 | 평가 |
|---|---|
| **A. 공통 꼬리를 `SettlementRecorder`(신규 컴포넌트)로 추출 (추천)** | `CloseService.settleSold`·`PurchaseService` 둘이 `recorder.record(sourceId, buyerId, sellerId, itemInstanceId, finalPrice, fee, settle, version, now) → orderId`를 호출. 총량 보존 임계 코드가 **한 곳**. 재사용 0-drift. EPIC-SHOP(source_type=SHOP)도 동일 recorder 재사용 |
| B. `PurchaseService`가 꼬리 복제 | 배선 단순하나 I-H 임계 코드 이중화 → 드리프트 표면 |
| C. `CloseService.settleSold` 자체를 즉시구매가 호출 | 머니-인(capture vs 직접차감)·패자처리·result_type·CAS 시간조건이 달라 헤비 파라미터화 필요 → 머니 임계 경로 가독성 훼손. 기각 |

**추천 = A.** 단, **머리(head)는 경로별로 분리**한다: 즉시구매의 락·재검증·패자 홀드 해제·구매자 직접차감·BUYNOW CAS는 `PurchaseService` 고유, 마감의 홀드 capture·BID CAS는 `CloseService` 고유. 공통 꼬리만 recorder로 응집. **실제 클래스 분할·시그니처는 backend-impl 재량**이며 architect는 "공통 꼬리 단일화 + 즉시구매 머리 분리" 구조와 불변식만 규정한다.

- 신규 자산(backend-impl): `PurchaseService`(패키지 `domain/settlement/*` 또는 `domain/auction/*` — 응집 판단은 backend-impl), `PurchaseController`(`POST /auctions/{id}/purchase`), `AuctionPurchaseContext` 프로젝션, `AuctionRepository.markSoldBuyNowIfLive`(신규 CAS), 거래내역 조회(`SaleOrderRepository` 커스텀 쿼리·`OrderService`·`OrderController`·역할별 `OrderResponse`). `SettlementRecorder`(§6-A 추출 시).
- 재사용 그대로: `FeeCalculator`·`FeePolicyProperties`·`SaleOrder(+Repository)`·`PlatformRevenueLedger(+Repository)`·`InventoryService.transferListedToBuyer`·`MoneyHoldService.release`·`BidRepository.markOutbidIfActive`·`UserBalanceRepository.{increaseGameMoney,decreaseGameMoney}`.

---

## 7. 게이트2 결정 (2026-07-22 승인 확정 — 전건 추천대로, deviation 없음)

| # | 항목 | 결정 |
|---|---|---|
| **A1** | 즉시구매 금전 모델 | **구매자 잔액 직접 차감**(`decreaseGameMoney`, available-gated). 홀드+capture 아님 — 즉시 종결이라 에스크로 단계 불필요, money_hold 행·synthetic bid 오버헤드 회피. |
| **A2** | 진행 입찰 홀드 처리 + 본인 구매 | 진행 중 최고 입찰자 홀드 **`RELEASED` + bid `OUTBID`**(EPIC-BID 패스 재사용). **최고 입찰자 본인 즉시구매 허용** — 패자 해제를 구매자 차감보다 앞세워(§3.5) 자기 홀드 먼저 해제 후 buyNow 차감으로 균일 처리(연속입찰 차단 BID_004는 입찰 전용). |
| **A3** | 정산 재사용 vs 신규 | 공통 꼬리 **`SettlementRecorder` 추출**(§6) + **`PurchaseService` 신규**(머리 분리). CloseService.settleSold 직접 호출 안 함. |
| **A4** | 종료성 CAS 시간 조건 + 락 순서 | 즉시구매 CAS = **`status IN(SCHEDULED,ACTIVE) AND end_at > now`**(live, `markSoldBuyNowIfLive` 신규) — 마감의 `end_at<=now`와 시간축 배타 분할(§3.3). 잔액 락은 `MoneyHoldService`의 **user_id 오름차순** 규율 재사용(§3.5). |
| **A5** | 미개시 처리 | live 판정 실패(미개시·종료)를 **`AUCTION_006`으로 흡수, 라벨을 "구매 불가(미개시·종료)"로 확대**(신규 코드 미추가) — enum↔계약 1:1 최소 유지. |
| **B1** | orders IDOR 인가 | `/me/orders`=`buyer OR seller` 스코프, `/orders/{id}`=당사자만(`ORDER_002` 403, 미존재 `ORDER_001` 404). ULID라 403/404 열거 무해. |
| **B2** | fee/settle 노출 범위 | `fee_amount`·`settle_amount` **판매자 전용**(구매자엔 필드 부재). 구매자는 `final_price`만. **역할 인지 DTO + `myRole`**. §4.3 정밀화(계약 변경). |
| **B3** | BID/BUYNOW 구분 노출 | **코어 미노출**(`sourceType=AUCTION`만). 필요 시 후속 auction 조인 파생(스키마 무변경). |

**스키마 영향 = 없음.** 위 전 항목은 정책·동시성·인가·노출 결정이며 sale_order/platform_revenue_ledger/auction 스키마·V14를 바꾸지 않는다. 확정 반영: erd는 semantic만(v1.4 — BUYNOW result_type·source_type=AUCTION·(buyer_id)/(seller_id) 인덱스 실사용), api-contract는 §3.1 즉시구매 동작 정밀화 + §4.3 SaleOrderResponse 스키마 신설(역할별 노출) + §5 AUCTION_006 라벨 확대(v1.13).

---

## 8. 프론트 영향

- **즉시구매 버튼(준비 중 자리 → 실연동)**: rebuild-contract-map §5 "즉시구매 버튼 = `buyNowPrice` 표기만·버튼 404" 자리를 실연동으로 승격. `POST /auctions/{id}/purchase`(본문 없음) 호출 → 201 `{ orderPublicId, finalPrice }`. 경매 상세에서 `buyNowPrice != null` ∧ live일 때만 활성. 에러 AUCTION_005/006/009·BID_005 분기(승계 에러맵 확장). 자기 경매(sellerNickname==나)면 버튼 미노출.
- **거래내역 화면(준비 중 자리 → 실연동)**: rebuild-contract-map §9·§13 "최근 거래내역 `/me/orders` 미구현→자리보류" 승격. `GET /me/orders`(cursor, `role`·`sourceType` 필터) + `GET /orders/{id}`. **역할별 노출**: 구매자 카드엔 fee/settle 없음(`myRole` 분기), 판매자 카드엔 수수료·정산액 표기. 상대는 마스킹.
- **낙찰 결과 표시 재사용**: 즉시구매 성립 후 경매 상세는 `status=SOLD`·`resultType=BUYNOW`로 온다(closing-domain-spec §9 표시 규약에 BUYNOW 추가). 클라 카운트다운은 live인데 서버가 SOLD면 "즉시구매로 마감" 표기.
- **본인 구매 후속(잔액·인벤토리)**: 구매자 게임머니 실차감·아이템 인벤토리(또는 임시보관) 반영은 기존 `/me/balance`·`/me/inventory`·`/me/temp-storage`가 자동 반영(신규 계약 불요).
