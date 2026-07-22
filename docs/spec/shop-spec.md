# FinalCall Shop Domain Spec (고정가 마켓 도메인 스펙)

상태: **v1.0 (초안) — 게이트2 상신 대기(2026-07-22)**. EPIC-SHOP(고정가 마켓: 판매자 등록 `POST /shops` → 구매자 즉시 구매 `POST /shops/{id}/purchase` → 판매자 취소 `.../cancel` + 기한 만료 자동 회수)의 계약/설계 정본이다.
게이트1 승인(2026-07-22) + **게이트2 기한 모델 정정(2026-07-22, 사용자)** — 제품 결정 확정: **(1) 판매 기한 = 판매자가 고르지 않고 서버가 `end_at = now + 관리자 설정 일수`(기본 7일, `@ConfigurationProperties` `shop.listing.default-duration-days`)로 자동 계산. 기한 범위·판매자 지정·최대값 없음. 만료 시 자동 회수 → 임시 보관함(TEMP). `end_at` nullable 유지(향후 무기한 노출 캐시아이템용, 범위 밖)** · **(2) 판매자 취소 허용(SOLD 전 ACTIVE에서 인벤토리 회수)**. 이 결정은 확정됐고 본 스펙이 반영한다. **남은 것은 기술 결정(구매 동시성·잔액 락 순서·이중판매 차단·만료 워커 주기·계약 정밀화)의 게이트2 상신(§8)이다.**
소유: architect(spec). 구현 = backend-impl(서버)·frontend-impl(마켓 목록·구매·판매 등록 화면). **architect는 코드·마이그레이션을 쓰지 않는다** — 아래 스키마·시그니처는 확정 형태이며 실제 작성·채번은 backend-impl 소유다.

범위(코어): **고정가 등록 · 즉시 구매(정가) · 판매자 취소 · 기한 만료 자동 회수**.
**범위 밖**: 무기한 등록의 공개 UX 노출(schema·worker만 지원, 향후 캐시아이템 경로에서 별도 노출) · 관리자 강제취소 · 정산 후 환불/크레딧(fee-policy-spec §5) · 알림 · 가격 수정(내려서 재등록으로 대체).

근거(정본): **domain-spec §2·§5**(FixedSale 애그리거트·상태 머신 ACTIVE→SOLD|EXPIRED|CANCELLED·"입찰 없음"·SOLD 핸드오프 단일화·지연 인덱스 만료 트리거·§8 "정합성은 DB"), **purchase-spec v1.0**(즉시구매 SOLD 흐름·SettlementRecorder 재사용·A4 잔액 user_id 오름차순 락·live 종료성 CAS — 고정가 구매는 이 흐름의 **더 단순한 변주**: 입찰·홀드·패자처리·시간축 배타가 없다), **closing-domain-spec v1.0**(SOLD 정산 TX·불변식 I-A~I-H·만료 워커 패턴 §3·PC clear 함정), **fee-policy-spec v1.0**(수수료 판매자 단독·경매/고정가 공통·`shop.price` 기준·SOLD 시만·취소/만료 0), **erd v1.4 §4.2 shop·§5 인덱스**(테이블·인덱스 이미 정의됨 — 델타는 채번·semantic), **api-contract v1.13 §3.2 shop·§5 SHOP_001~006**(엔드포인트·에러 기등재 — 정밀화 대상). CLAUDE.md 섹션 4·5.

백엔드 실측(재사용 자산 — 코드 변경 0): `settlement/{SettlementRecorder.record(SaleOrderSourceType,Long,...), SaleOrder(+Repository, UK uk_sale_order_source(source_type,source_id)), PlatformRevenueLedger(+Repository), FeeCalculator.compute(long), FeePolicyProperties.version(), SaleOrderSourceType.SHOP(정의됨·미사용), OrderService/SaleOrderRepositoryImpl(source_type 제네릭 — SHOP 자동 유입), CloseWorker/ClosingWorkerProperties(만료 워커 패턴), PurchaseService(참조 패턴)}`, `item/{InventoryService.releaseFromListing(소유자 불변 LISTED→INVENTORY/만실 TEMP)·transferListedToBuyer(소유자 변경), ItemInstanceRepository.markListedIfInInventory(등록 CAS)·transferListedToTemp, ItemLocation, TransferType.TRADE}`, `member/UserBalanceRepository.{increaseGameMoney,decreaseGameMoney(available-gated)}`, `auction/{AuctionService(등록·취소 참조 패턴), AuctionRepository(FOR UPDATE 스칼라 프로젝션·종료성 CAS 선례)}`.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1 | 2026-07-22 | FC-092 착수 — shop 애그리거트 상태 머신·등록/구매/취소/만료 flow·동시성(shop 행 FOR UPDATE + 종료성 CAS)·금전 모델(buyer/seller 2행 직접 이동)·불변식 S-A~S-H·기한 옵션(`@ConfigurationProperties`)·만료 워커(TEMP 회수)·erd/api-contract 델타(PROPOSAL)·게이트2 상신 항목(§8) 정리 |
| v0.2 | 2026-07-22 | **게이트2 기한 모델 정정 반영** — 판매자 endAt 입력 제거(등록 body `{itemInstancePublicId, price}`), 서버가 `end_at = now + shop.listing.default-duration-days`(기본 7일) 자동 계산. 최대값·판매자 지정·기한 범위 폐기(C5 정정). `end_at` nullable = 향후 무기한 캐시아이템용. §3.1에 기한 연장 seam 1줄(per-listing end_at). §3 등록 flow·C5·§6·§7 PROPOSAL 갱신. cancel POST(C6) 채택 확정 |
| v0.3 | 2026-07-22 | **FC-103 — 판매 관리 조회 계약(PROPOSAL)** §10 신설: `GET /me/shops`(판매자=주체·status 필터 ACTIVE 기본/`ALL`·ShopCursor 재사용). 신규=조회 1개, 취소 재사용. 스키마·에러코드·기존 엔드포인트 무변경(additive read). 게이트2 상신 M1~M3. 구현 FC-104 |
| v0.4 | 2026-07-22 | **게이트2 M3 정정 반영(사용자)** — '내 판매' 카드에 등록가 + **예상 정산액** 함께 표시. §10.3 응답 DTO = `MyShopSummary`(ShopSummary + 판매자 전용 `estimatedFee`·`estimatedSettle` 예상치, FeeCalculator 재사용). 공개 `ShopSummary` 무오염(별도 DTO 격리). 추정치=예상 표기, 실현값은 /me/orders 유지. §10.5 M3·M3표 갱신. 스키마 무변경(서버 파생값) |

---

## 1. 문제 정의 — 고정가는 "입찰 없는 즉시 SOLD"다

경매(auction)의 이음새는 "입찰이 있는가"이고 고정가(FixedSale/shop)의 이음새는 "입찰이 없다"이다(domain-spec §2). 그래서 고정가는 경매의 복잡성 대부분을 **가진 적이 없다**:

| 축 | 경매(auction) | 고정가(shop) |
|---|---|---|
| 가격 결정 | 입찰 경쟁(최고가) | **정가 고정**(`shop.price`) |
| 종료 | 마감 워커(낙찰) + 즉시구매 | **구매 즉시 SOLD** + 기한 만료(EXPIRED) |
| 예약 시작 | SCHEDULED 지원 | **없음**(domain-spec §5 — 등록 즉시 ACTIVE) |
| 에스크로 금전 | 입찰 홀드(money_hold)·패자 해제·낙찰 capture | **없음** — 구매 시 buyer 잔액 직접 차감·seller 크레딧 |
| 시간축 배타 | 즉시구매(live) vs 마감(expired) 분할 필요 | 구매(live) vs 만료(expired) 분할 — 단, **홀드·패자 없어 훨씬 단순** |

**정산 꼬리는 경매·즉시구매와 완전히 같다.** 고정가 SOLD도 `sale_order`로 핸드오프하며(domain-spec §5 구매 경로 단일화), `SettlementRecorder.record(SaleOrderSourceType.SHOP, shop.id, ...)`를 그대로 호출한다. 다른 것은 (1) 진입(정가·본문 없음), (2) 금전 유입(구매자 직접 차감, 홀드 없음), (3) 종료 트리거(구매·만료), (4) `source_type=SHOP`뿐이다.

### 1.1 재사용 원칙 (신규 설계 최소화)

- **정산 꼬리·수수료·수익원장 = 코드 변경 0.** `SettlementRecorder`가 이미 첫 인자로 `SaleOrderSourceType`을 받고 `SHOP` enum 값이 정의돼 있다. `sale_order`·`platform_revenue_ledger` 스키마(V14) 그대로. `FeeCalculator.compute(shop.price)` 1회.
- **거래내역 API = 코드 변경 0.** `SaleOrderRepositoryImpl`이 `source_type`에 제네릭(`sourceTypeEq`)이라 SHOP 주문이 `GET /me/orders`(`sourceType=SHOP` 필터)·`GET /orders/{id}`에 **자동 유입**한다. 역할별 노출(fee/settle 판매자 전용, purchase-spec §5.2)·IDOR 스코프 그대로 적용된다.
- **아이템 에스크로 = 기존 CAS 재사용.** 등록 = `markListedIfInInventory`(auction 등록과 동일). 구매 이전 = `transferListedToBuyer`(SettlementRecorder 내부). 취소 회수 = `releaseFromListing`.
- **잔액 이동 = A4 규율 재사용.** `user_id` 오름차순(buyer/seller 2행) — 데드락 원천 차단(purchase-spec §7-A4).
- **불변식 I-A~I-H 승계.** 특히 **I-H 게임머니 총량 보존**을 고정가에서도 지킨다(§5).

**신규 설계 대상**은 (1) `shop` 애그리거트(엔티티·리포지토리·서비스·컨트롤러·상태 CAS), (2) 만료 워커(경매 마감 워커 복제 아닌 패턴 재사용), (3) 만료 회수 목적지 TEMP 전이 1건, (4) 기한 설정 옵션 `@ConfigurationProperties`뿐이다.

---

## 2. shop 애그리거트 · 상태 머신

### 2.1 상태 머신 (domain-spec §5 정합)

```
        (등록: INVENTORY→LISTED CAS)
ACTIVE ──(구매)────────▶ SOLD        // 구매자 정가 결제·정산·소유 이전(§4)
   │
   ├────(판매자 취소)───▶ CANCELLED   // ACTIVE에서만. 아이템 판매자 회수(인벤토리 복귀·만실 TEMP, §4.3)
   │
   └────(기한 만료)─────▶ EXPIRED     // end_at 설정분·만료 워커. 아이템 판매자 회수(TEMP 직행, §4.4)
```

- **SCHEDULED 없음** — 고정가는 예약 시작이 없다(domain-spec §5). 등록 즉시 `ACTIVE`.
- **종료 상태 3종(SOLD/CANCELLED/EXPIRED)은 모두 ACTIVE에서만 진입**하며, 셋은 상호 배타다(status CAS 단일 승자).
- **무기한(end_at NULL)** 리스팅은 EXPIRED로 가지 않는다(만료 워커 스캔 제외 §4.4). SOLD 또는 CANCELLED로만 종결된다.

### 2.2 테이블 (erd §4.2 — 이미 정의됨, EPIC-SHOP V15에서 최초 생성)

erd v1.4 §4.2가 `shop` 테이블을, §5가 인덱스를 **이미 완전히 정의**한다. 컬럼·인덱스 신규·변경 **없음**. 델타는 (1) Flyway V15 채번(현재 DB 미생성 — erd §6 group4 "shop은 후속 에픽 EPIC-SHOP" 이연분), (2) `sale_order.source_type=SHOP` 실사용 시작(semantic)뿐이다(erd 델타 PROPOSAL §7).

| 컬럼 | 타입 | 널 | 키 | 설명 |
|---|---|---|---|---|
| public_id | ULID | N | UK | 외부 노출 식별자(B-004). URL·응답 리소스 |
| seller_id | BIGINT | N | FK→user | 판매자 |
| item_instance_id | BIGINT | N | FK→item_instance | 출품 아이템(에스크로, LISTED) |
| price | BIGINT | N | | 고정 판매가(> 0) |
| status | ENUM | N | | ACTIVE / SOLD / EXPIRED / CANCELLED |
| end_at | DATETIME(6) | Y | | 판매 기한. **NULL = 무기한**(만료 없음). 설정 시 만료하면 EXPIRED |
| item_name_snapshot | VARCHAR | N | | 등록 시점 표시명 스냅샷(D-045) |
| item_spec_snapshot | VARCHAR | N | | 등록 시점 핵심 스펙 요약 스냅샷 |

인덱스(erd §5, 이미 정의됨): `(status, end_at)`(만료 워커 스캔) · `(seller_id, status)`(판매자 목록) · `(item_instance_id)`(출품 역참조).

---

## 3. 등록 flow — `POST /api/v1/shops`

경매 등록(`AuctionService.register`)과 **동일 패턴**이며 소프트클로즈·예약·즉시구매가·시간 파라미터가 빠져 더 짧다.

```
@Transactional
register(itemInstancePublicId, price):   // 판매자 = SecurityContext 주체 sellerId. 기한 입력 없음 — 서버 자동 계산
 1. 아이템 로드(fetch join owner) — 미존재·미소유 → SHOP_ITEM_NOT_SELLABLE(403, §6·§8-C4)
 2. 가격 검증: price > 0 (위반 → 검증 400)
 3. 기한 자동 계산(§3.1): endAt = now + shop.listing.default-duration-days(설정, 기본 7일). 판매자는 고르지 않는다.
 4. 아이템 에스크로: markListedIfInInventory(item.id)  CAS(INVENTORY→LISTED)
      0행 → 초기 위치 분기(auction 등록 선례): TEMP=미보유→403(SHOP_ITEM_NOT_SELLABLE) / 그 외=이미 출품중→409(SHOP_ALREADY_LISTED)
 5. shop INSERT(ACTIVE, price, end_at, item 스냅샷)  // 스냅샷은 등록 시점 displayName·스펙 요약(AuctionService.buildSpecSnapshot 선례)
COMMIT
→ 201 { shopPublicId, status:"ACTIVE" }
```

- **CAS 실패 시 shop INSERT도 롤백**(단일 TX). 중복 출품은 `markListedIfInInventory` 단일 승자가 차단(경매·고정가가 같은 item CAS 공유 → 한 아이템을 경매·고정가에 동시 출품 불가).
- 미존재·미소유·미보유(TEMP)를 **403 단일**로 통일(SHOP_ITEM_NOT_SELLABLE, SEC-007 열거 방지 — AUCTION_001 v1.7 선례). "이미 출품중"(LISTED 상태 충돌)만 409(SHOP_ALREADY_LISTED).

### 3.1 기한 자동 계산 규칙 (제품 결정 1 — 게이트2 정정 2026-07-22)

- **판매자는 기한을 고르지 않는다.** 등록 요청에 `endAt`·기한 입력 필드가 **없다**. 서버가 등록 시점에 `end_at = now + 설정 일수`로 **자동 계산**해 채운다. 기한 범위·판매자 지정·최대값 개념은 없다(게이트2 정정 — C5의 "판매자 지정·최대 30일" 폐기).
- **설정 일수 = 단일 관리자 값** — `@ConfigurationProperties` `shop.listing.default-duration-days`(기본 **7일**, 하드코딩 금지). 향후 DB 설정 이관 여지를 남긴다. `AuctionService`의 소프트클로즈 상수가 지금 컴파일 상수인 것과 달리, 게이트1이 "관리자 조정 설정 옵션"을 명시했으므로 반드시 설정 바인딩한다(CLAUDE.md 섹션 4 · `ClosingWorkerProperties`·`FeePolicyProperties` 선례).
- **`end_at` 컬럼 nullable 유지 — 지금은 항상 설정값으로 채운다.** NULL(무기한)은 **향후 "무기한 노출 캐시아이템"** 전용이며(등록 시 무기한 플래그면 null) 이 에픽 범위 밖이다. 만료 워커는 `end_at IS NOT NULL` 조건으로 무기한 리스팅을 만료 대상에서 제외한다(§4.4). 현재 `POST /shops`는 항상 유한 `end_at`을 만든다.
- **기한 연장 seam(향후 캐시아이템 = 판매 기한 연장 아이템, 별도 에픽)**: `end_at`이 리스팅별(per-listing) 값이라 특정 리스팅의 `end_at`을 뒤로 미는 연장이 자연스럽다 — 애그리거트·워커 구조 변경 없이 도메인 메서드 1개(`extendUntil`)와 연장 아이템 소비로 얹을 수 있다. 본 에픽은 seam만 남기고 구현하지 않는다.

---

## 4. 구매·취소·만료 flow

### 4.1 구매 — `POST /api/v1/shops/{shopPublicId}/purchase` (ShopPurchaseService, 신규)

purchase-spec §3.2의 즉시구매를 **더 단순화**한 흐름이다 — 입찰·홀드·패자 처리·시간축 배타 분할이 없고 잔액 이동이 **buyer/seller 2행뿐**이다.

```
@Transactional
purchase(shopPublicId):   // 구매자 = SecurityContext 주체 buyerId. 요청 본문 없음(금액=서버 shop.price 확정)
 1. shop 행 배타 락 + 값 스냅샷
      @Lock(PESSIMISTIC_WRITE) SELECT ... FOR UPDATE  (ShopPurchaseContext 스칼라 프로젝션 — id·sellerId·status·endAt·price·itemInstanceId)
      없으면 → SHOP_NOT_FOUND(404)
 2. 재검증(전부 락 스냅샷 근거):
      buyerId != sellerId          아니면 → SHOP_SELF_PURCHASE(403)   (wash trade·SEC-003, auction 대칭)
      purchasable 판정: status==ACTIVE && (endAt==null || now < endAt)   아니면 → SHOP_ALREADY_SOLD_OR_CLOSED(409)
 3. 수수료 계산 1회: fee = FeeCalculator.compute(price);  settle = price − fee;  version = feePolicy.version()
 4. 잔액 이동(user_id 오름차순, §8-C2 · A4 규율):  ★ PC clear
      buyer:  decreaseGameMoney(buyerId, price)   available-gated. 0행 → SHOP_INSUFFICIENT_BALANCE(422)
      seller: increaseGameMoney(sellerId, settle) 0행 → 불변식 위반(롤백)
 5. 정산 공통 꼬리(purchase-spec §6 recorder 재사용):
      settlementRecorder.record(SHOP, shop.id, buyerId, sellerId, itemInstanceId, price, fee, settle, version, now)
      → sale_order INSERT((source_type=SHOP,source_id=shop.id) UK가 이중 SOLD 차단) → 수익원장 INSERT → 아이템 이전(transferListedToBuyer) → 소유이력 append(TRADE, orderId)
 6. 종료성 CAS: markShopSoldIfPurchasable(shop.id, now)
      @Modifying CAS  SET status='SOLD'
      WHERE status='ACTIVE' AND (end_at IS NULL OR end_at > :now)   assert 1행
COMMIT
→ 201 { orderPublicId, finalPrice }   // finalPrice = shop.price
```

- **잔액 락 순서**: buyer·seller 2행뿐이고 `buyer ≠ seller`(자기구매 차단)라 겹침이 없다. `user_id` 오름차순 적용으로 교차거래(두 사용자가 서로의 리스팅 동시 구매) 데드락을 원천 차단(purchase-spec §7-A4, `applyBalanceInUserIdOrder` 규율 재사용). **loser·홀드 스텝이 없어 즉시구매보다 단순하다.**
- **시간 조건 `end_at IS NULL OR end_at > now`(live)**: 만료 워커의 `end_at <= now`(expired)와 **시간축을 배타 분할**한다(purchase-spec §3.3 선례). 만료 시각을 막 지난 리스팅이 구매·만료 어느 한쪽으로만 종결되게 보장. 무기한(NULL)은 항상 구매 가능.
- **동시성**: 구매 vs 구매·구매 vs 취소·구매 vs 만료는 모두 shop 행 `FOR UPDATE` + status CAS로 직렬화 → 단일 승자. 뒤엣 경로는 재검증 또는 CAS 0행에서 `SHOP_ALREADY_SOLD_OR_CLOSED`.
- **PC clear 함정 승계**(purchase-spec §3.4): `decreaseGameMoney`/`increaseGameMoney`/recorder가 영속성 컨텍스트를 비우므로 판정 근거는 1단계 스칼라 프로젝션으로 전부 복사, 이후 전이는 `@Modifying` CAS·fresh INSERT.

### 4.2 잔액 이동 상세 (즉시구매 대비 단순화)

| | 즉시구매(auction) | 고정가(shop) |
|---|---|---|
| 잔액 행 | buyer·seller·loser(최대 3) | **buyer·seller(2)** |
| 홀드 | 진행 최고입찰 RELEASE + bid OUTBID | **없음** |
| 본인구매 특례 | 최고입찰자 자기 홀드 선해제 | **불요**(홀드 개념 없음) |
| 락 순서 | user_id 오름차순(3행) | user_id 오름차순(2행) |

고정가는 입찰이 없어 `bidRepository.findActiveByAuctionId`·`moneyHoldService.release`·`markOutbidIfActive`가 **전부 불필요**하다. `applyBalanceInUserIdOrder`의 loser 분기 없는 2행 버전만 있으면 된다.

### 4.3 취소 — `POST /api/v1/shops/{shopPublicId}/cancel` (제품 결정 2)

경매 취소(`AuctionService.cancel`)와 **동일 패턴**, 단 "입찰 0건" 조건이 고정가엔 없다(입찰 개념 부재) — 조건은 **"아직 판매되지 않음(ACTIVE)"**뿐이다(domain-spec §5).

```
@Transactional
cancel(shopPublicId):   // 판매자 본인만
 1. shop 로드 → 없으면 SHOP_NOT_FOUND(404)
 2. 주체 == seller 검증(IDOR) — 아니면 403(SHOP_ITEM_NOT_SELLABLE, 미소유 통일 SEC-007)
 3. markShopCancelledIfActive(shop.id)  CAS(status='ACTIVE'→CANCELLED)
      0행 → SHOP_ALREADY_SOLD_OR_CLOSED(409)   (이미 SOLD·EXPIRED·CANCELLED)
 4. 아이템 에스크로 해제: releaseFromListing(shop.itemInstance)   // 소유자 불변, 인벤토리 복귀·만실 TEMP
COMMIT
→ 200 { status:"CANCELLED" }
```

- 취소는 **인벤토리 복귀 우선**(만실 시 TEMP) — `releaseFromListing` 그대로. 판매자가 능동적으로 내리는 동기 경로라 슬롯 배정이 자연스럽다.
- 취소 CAS에 **시간 조건 없음**: 만료 시각을 지났지만 아직 ACTIVE인 리스팅도 판매자가 취소 가능(만료 워커와 status CAS 단일 승자로 경합 해소 — 어느 쪽이 이겨도 아이템은 판매자에게 회수, 목적지만 다름).

### 4.4 만료 — 만료 워커 (제품 결정 1: 자동 회수 → TEMP)

경매 마감 워커(`CloseWorker`/`CloseService`)의 **패턴을 재사용**(복제 아님)한 별도 워커다. 마감보다 훨씬 단순하다 — 금전 이동·정산이 없고 아이템 회수만 한다.

```
@Scheduled(fixedDelayString = "${shop.expiry.worker.fixed-delay-ms:...}")   // 설정 바인딩(§8-C4)
ShopExpiryWorker.sweep():   // enabled=false(통합 테스트)면 즉시 return, 로직은 sweepOnce 직접 호출 검증(CloseWorker 선례)
  now = Instant.now()
  ids = shopRepository.findExpirableIds(now, LIMIT batchSize)
        // SELECT s.id FROM shop s WHERE s.status='ACTIVE' AND s.end_at IS NOT NULL AND s.end_at <= :now
        //  ORDER BY s.end_at ASC   -- 오래 밀린 것부터. 인덱스 (status, end_at) 커버. end_at NULL(무기한)은 IS NOT NULL로 제외
  for each id in ids:
      shopExpiryService.expireOne(id, now)   // 경매 1건 = 독립 TX + 행 락(개별 실패가 배치 롤백 안 함)

@Transactional
expireOne(shopId, now):
 1. shop 행 배타 락 + 스냅샷(ShopExpireContext: id·status·endAt·itemInstanceId)
 2. 재검증: status=='ACTIVE' && end_at != null && end_at <= now   아니면 return(이미 종결·취소·구매 = 정상 skip)
 3. 아이템 회수(TEMP 직행): recoverExpiredToTemp(itemInstance)   // 소유자 불변, LISTED→TEMP 무조건 + temp_storage 행
 4. markShopExpiredIfExpirable(shop.id, now)  CAS(status='ACTIVE' AND end_at IS NOT NULL AND end_at<=now → EXPIRED)  assert 1행
COMMIT
```

- **★ 회수 목적지 = TEMP 직행(소유자 불변).** 취소(인벤토리 복귀 우선)와 **비대칭**이다. 근거:
  1. **판매자 부재.** 만료는 워커 자동 처리라 판매자가 능동적으로 인벤토리 슬롯을 관리하지 않는다. TEMP(상한 없음·슬롯 없음)로 회수하고 판매자가 다음 방문 시 기존 `relocate`(TEMP→INVENTORY)로 되돌린다.
  2. **워커 배치 경합 회피.** 한 tick에 다수 리스팅이 만료될 때 인벤토리 빈 슬롯 해석(`resolveSlot`)·`slot_key` UK flush를 리스팅마다 하면 실패 표면·경합이 커진다. TEMP는 슬롯이 없어 `slot_key` 경합이 원천 없다 → 워커가 결정적·무경합. (경매 마감 워커의 `transferListedToBuyer`가 만실 시 TEMP로 빠지는 것과 같은 이유를, 만료에선 **무조건** 적용.)
- 기존 `releaseFromListing`(인벤토리 우선)·`transferListedToTemp`(소유자 변경)는 **어느 것도 그대로 못 쓴다** — 만료는 "소유자 불변 + TEMP 무조건"이라 신규 소형 전이(`recoverExpiredToTemp`: `moveToTemp` + temp_storage INSERT, 소유자 불변)가 필요하다(§8-C4, backend-impl 소유). `releaseFromListing`의 만실 분기를 무조건화한 형태다.
- **다중 인스턴스 안전**: shop 행 락 + status CAS로 이중 처리 차단(closing I-F 대칭). 분산락 불요.
- **무기한(end_at NULL) 제외**: `end_at IS NOT NULL` 조건이 스캔·CAS 양쪽에서 무기한 리스팅을 만료 대상에서 뺀다. 인덱스 `(status, end_at)` 커버.

---

## 5. 불변식 (reviewer/테스트 정본) — closing/purchase 승계 + 고정가 고유

| # | 불변식 | 위반 시 의미 |
|---|---|---|
| **S-A** | 구매 성립 후 `shop.status='SOLD'` ∧ sale_order 1건(`source_type=SHOP`, `source_id=shop.id`, `final_price=shop.price`). closing I-A의 SHOP 변주 | 분기 오류 |
| **S-B** | `final_price = shop.price = settle_amount + fee_amount`, `fee_amount = FeeCalculator(shop.price)`(재현) | 정산 금액 드리프트 |
| **S-C** | shop당 SOLD 핸드오프 정확히 1회. `sale_order (source_type,source_id)` UK가 이중 SOLD를 DB 차단. **복합 UK라 SHOP source_id와 AUCTION source_id가 수치상 같아도 충돌하지 않는다**(폴리모픽 안전). row lock+status CAS 단일 승자 | 이중 정산 |
| **S-D** | 구매자 `game_money_balance −= price`(available-gated, 홀드 미경유), 판매자 `game_money_balance += settle`. **홀드·money_hold 행 관여 0**(입찰 부재) | 무자본 획득·정산 누락 |
| **S-E** | SOLD 후 `item_instance.owner_id = buyerId` ∧ `location ∈ {INVENTORY,TEMP}` ∧ `item_ownership_history`에 (seller→buyer, TRADE, sale_order_id) 1행. CANCELLED·EXPIRED 후 `owner_id = sellerId`(불변) ∧ `location ∈ {INVENTORY,TEMP}` ∧ 이력 append 없음 ∧ sale_order 0건 | 소유 이전 누락·오귀속 |
| **S-F** | 종료 전이(SOLD/CANCELLED/EXPIRED)는 **idempotent**. shop 행 락 + status CAS로 동시·재시도에도 1회분 효과만(2회차 CAS 0행 → 무부작용). 만료 워커 다중 인스턴스 안전 | 이중 처리 |
| **S-G** | 만료 판정 근거는 **락 스냅샷의 최신 end_at**. 무기한(NULL)은 만료 안 됨. 구매(live)·만료(expired) 시간축 배타로 경계 리스팅이 한쪽만 종결 | 조기/이중 만료 |
| **S-H** | **게임머니 총량 보존** — SOLD 전후 `SUM(game_money_balance) + SUM(platform_revenue_ledger.amount)` 불변. 델타: 구매자 `−price`, 판매자 `+settle`, 원장 `+fee`, `price=settle+fee` ⟹ 합 0. 취소·만료는 금전 이동 0이라 자명 보존 | 게임머니 생성·소멸 |

**필수 시나리오(테스트)**:
1. 정상 구매 — 구매자 −price·판매자 +settle·원장 +fee·아이템 이전·sale_order 1건(source=SHOP). S-A·S-B·S-D·S-E·S-H.
2. 자기구매 거부(SHOP_SELF_PURCHASE)·잔액부족(SHOP_INSUFFICIENT_BALANCE)·미존재(SHOP_NOT_FOUND).
3. 판매자 취소 — ACTIVE→CANCELLED·아이템 인벤토리 복귀(만실 TEMP)·sale_order 0건. S-E·S-F.
4. 기한 만료 — end_at 지난 ACTIVE → 워커 EXPIRED·아이템 **TEMP 직행**·소유자 불변·sale_order 0건. S-E·S-G. **무기한(NULL)은 만료 스캔 제외 검증**.
5. 구매 vs 취소 동시 — shop 행 락으로 단일 승자, 후착 SHOP_ALREADY_SOLD_OR_CLOSED. S-F.
6. 구매 vs 만료 경합 — live/expired 시간 분할로 한쪽만 성립, 이중 종결 없음. S-C·S-G.
7. 이중판매 방지 — sale_order (SHOP, shop.id) UK 위반 경로 2회차 차단. S-C.
8. 게임머니 총량 보존 — cap/최소 저촉 price(고액·소액) 경계 포함. S-H·S-B.
9. 거래내역 유입 — SOLD 후 `GET /me/orders?sourceType=SHOP`에 구매자·판매자 각 role로 노출, fee/settle 판매자 전용(purchase-spec §5.2 재사용).

---

## 6. api-contract — 엔드포인트·에러(기등재 정밀화)

계약 §3.2 shop 엔드포인트와 §5 SHOP_001~006이 이미 등재돼 있다. 본 스펙이 **동작을 정밀화**하고, api-contract 델타는 PROPOSAL(§7·게이트2 승인 전제)로 낸다.

| 엔드포인트 | 인증 | 정밀화 요지 |
|---|---|---|
| `POST /shops` | 판매자 | body `{ itemInstancePublicId, price }` — **기한 입력 없음**(서버가 설정 일수로 end_at 자동 계산). 응답엔 endAt 노출. SHOP_001=403 단일·SHOP_002=409(§3) |
| `GET /shops` | 불요 | cursor 목록. 필터·정렬 화이트리스트(price·endAt·createdAt) — 계약 §3 기정의 |
| `GET /shops/{id}` | 불요 | ShopDetail(계약 §3.3 기정의). 없으면 SHOP_003(404) |
| `POST /shops/{id}/purchase` | 필요 | **요청 본문 없음**(금액=서버 shop.price 확정). 201 `{ orderPublicId, finalPrice }`. SHOP_004(409)·SHOP_005(422)·SHOP_006(403) |
| `POST /shops/{id}/cancel` | 판매자 | ACTIVE만 CANCELLED. 200 `{ status }`. SHOP_004(409) |

- **cancel 동사 = POST 유지 권고**(auction `POST /auctions/{id}/cancel` 대칭). 티켓이 `PATCH`를 언급했으나 계약 §3.2가 이미 POST로 확정돼 있고 경매와 대칭이 깨지면 프론트 에러맵·라우팅이 이원화된다 → **POST 권고**(§8-C6, 게이트2 소결정).
- 에러코드 매핑(§5 기등재, 정밀화):

| 코드 | 의미 | HTTP | 정밀화 |
|---|---|---|---|
| SHOP_001 | 아이템 미소유·미보유·미존재(출품 불가) | **403 단일** | 현행 "403/409" → **403 단일**(AUCTION_001 v1.7 선례, SEC-007). "이미 출품중"만 SHOP_002 409 |
| SHOP_002 | 이미 출품중 | 409 | 유지 |
| SHOP_003 | 고정가 없음 | 404 | 유지 |
| SHOP_004 | 이미 판매/종료(SOLD·EXPIRED·CANCELLED) | 409 | 구매·취소 공통. 라벨에 EXPIRED 포함 명시 |
| SHOP_005 | 게임머니 잔액 부족 | 422 | 유지 |
| SHOP_006 | 판매자 자기구매(SEC-003) | 403 | 유지 |

- **도메인 ErrorCode enum ↔ 계약 1:1**(§5 규약): backend-impl은 `ShopErrorCode`(SHOP_001~006)를 위 매핑대로 신설. SHOP_001은 403 단일 enum.
- **거래내역(§4.3) 무변경**: SHOP 주문은 기존 `GET /me/orders`(`sourceType=SHOP` 필터)·`GET /orders/{id}`에 자동 유입. 역할별 노출·IDOR·SaleOrderResponse 스키마 그대로(purchase-spec §5). **신규 필드·엔드포인트 없음.**

---

## 7. erd · api-contract 델타 (PROPOSAL — 게이트2 승인 전제, 확정 반영 아님)

> 아래는 게이트2 승인 시 erd·api-contract에 반영할 **제안**이다. 승인 전까지 확정 문구로 덮어쓰지 않는다(각 파일에 동일 PROPOSAL 블록 병기).

**erd 델타(PROPOSAL)** — 스키마 컬럼·인덱스 **무변경**(§4.2 shop·§5 인덱스 이미 정의):
- Flyway §6 group4에 **`V15__shop.sql`** 실물 채번 등재(현재 최신 V14). `shop` 테이블 최초 생성(erd 정의 준수) + 인덱스 `(status,end_at)`·`(seller_id,status)`·`(item_instance_id)`. `price > 0` 체크는 앱 검증(auction 선례, DB 체크 제약 미도입).
- semantic: `sale_order.source_type=SHOP`·`uk_sale_order_source(source_type,source_id)`가 고정가 SOLD 핸드오프에서 **실사용 시작**(종전 정의됨·AUCTION만 기록). `(buyer_id)`·`(seller_id)` 인덱스가 SHOP 거래내역 조회에서 실사용.
- 버전 로그: v1.5 "게이트2(EPIC-SHOP) 승인 반영 — shop 테이블 V15 최초 생성, SHOP source_type 실사용. 스키마 컬럼·인덱스 무변경(§4.2·§5 기정의)."

**api-contract 델타(PROPOSAL)** — 엔드포인트·필드 집합 **무변경**, 동작·에러 정밀화:
- §3.2: `POST /shops` 요청 바디에 endAt 필드 **없음**(서버가 설정 일수로 자동 계산, 응답엔 endAt 노출), `POST /shops/{id}/purchase` 본문 없음·finalPrice=shop.price 명시, cancel POST 유지.
- §5: `SHOP_001` "403/409" → **403 단일**(SHOP_002 409 분리), `SHOP_004` 라벨에 EXPIRED 포함.
- §4.3: SHOP 주문 자동 유입 주석(코드·스키마 무변경).
- 버전 로그: v1.14 "게이트2(EPIC-SHOP) 승인 반영 — §3.2 고정가 동작 정밀화(기한 기본·구매 본문 없음), §5 SHOP_001 403 단일·SHOP_004 EXPIRED. 엔드포인트·필드·스키마 무변경. 정본 shop-spec v1.0."

---

## 8. 게이트2 상신 항목 (제품 결정은 게이트1 확정 — 기술 결정 추천안만)

제품 결정(기한 서버 자동 계산·무기한 향후 캐시아이템·취소 허용·만료 TEMP 회수)은 게이트1 + 게이트2 정정(2026-07-22)에서 확정됐다. 아래는 **남은 기술 결정**의 추천안이다. 각 "추천 + 한 줄 근거 + 제품 영향(평이하게)".

| # | 기술 결정 | 추천안 | 근거 | 제품 영향(평이한 언어) |
|---|---|---|---|---|
| **C1** | 구매 동시성 방식 | **shop 행 배타 락(FOR UPDATE) + 종료성 status CAS** — 즉시구매 패턴 재사용, 홀드·패자·시간축 분할 없어 더 단순 | 정합성은 DB(domain-spec §8). Redis 분산락 배제(EPIC-BID 게이트2 정합) | 두 사람이 같은 물건을 동시에 "구매" 눌러도 **정확히 한 명만** 사고, 나머지는 "이미 판매됨" 안내. 재고 하나가 두 번 팔리는 일이 원천 불가 |
| **C2** | 잔액 락 순서 | **user_id 오름차순(buyer/seller 2행)** — SettlementRecorder 밖 호출측이 적용(A4 규율 재사용) | 교차거래 순환대기(데드락) 원천 차단. 즉시구매(3행)보다 단순 | A가 B 물건을, B가 A 물건을 동시에 사도 시스템이 멈추지(교착) 않는다. 결제가 항상 끝까지 진행 |
| **C3** | 이중판매 차단 | **`sale_order (source_type,source_id)` UK 재사용**(신규 제약 0) + shop status CAS. 복합 UK라 SHOP/AUCTION source_id 수치 충돌 없음 | 이미 존재하는 안전장치(closing I-C). 코드·스키마 변경 0 | 어떤 경합·재시도·서버 다중화에서도 한 리스팅의 판매 기록이 **딱 한 번**만 남는다(수수료·소유이전 중복 불가) |
| **C4** | 만료 워커 주기·배치 | **별도 `ShopExpiryWorker` + `@ConfigurationProperties(shop.expiry.worker)`**. 기본 주기 **60초**·배치 200. 회수 목적지 TEMP 직행(소유자 불변, 신규 소형 전이) | 만료는 경매 마감(2초, 낙찰자 대기·에스크로 금전)보다 시급성 낮음 → 긴 주기로 부하 절감. 값은 튜닝(설정) | 기한 지난 매물이 **최대 1분 내** 자동으로 내려가 판매자 임시보관함으로 돌아간다. 급하지 않아 서버 부담을 줄이려 1분 주기 권장(운영 중 조정 가능) |
| **C5** | 기한 설정값 (게이트2 정정 확정) | **`ShopListingProperties.default-duration-days`(@ConfigurationProperties, 기본 7일)** 단일 값. 등록 시 서버가 `end_at = now + 이 값`으로 자동 계산. **판매자 지정·최대값·기한 범위 없음.** 무기한(null)은 향후 캐시아이템 전용 | 게이트1 "관리자 조정 설정 옵션·하드코딩 금지" + 게이트2 정정("판매자 기한 미선택·단일 설정값") 이행 | 판매자는 기한을 **고르지 않는다** — 올리면 자동으로 **7일 뒤 만료**. 이 7일은 코드 수정 없이 설정으로 바꾼다(향후 DB 이관 여지) |
| **C6** | cancel 엔드포인트 동사 | **`POST /shops/{id}/cancel` 유지**(auction 대칭). 티켓 언급 PATCH 대신 | 계약 §3.2 기확정 POST + 경매 취소와 동일 형태 → 프론트 에러맵·라우팅 단일 | 판매 취소 동작이 경매와 똑같은 방식으로 붙어 화면·코드가 일관. 사용자 체감 차이 없음 |

**스키마 영향 = 신규 테이블 1개(`shop`, V15)뿐이며 erd에 이미 정의됨.** 컬럼·인덱스·UK는 신규·변경 0(§7). `sale_order`·`platform_revenue_ledger`·orders API·수수료 계산기·인벤토리 CAS는 전부 **코드 변경 0 재사용**. 위 C1~C6은 정책·동시성·설정·계약 정밀화 결정이다.

---

## 9. 파급 분석 (contract-first)

- **기존 티켓 영향 = 없음.** shop은 신규 애그리거트이고 재사용 자산(SettlementRecorder·SaleOrder·orders API·FeeCalculator·InventoryService·UserBalanceRepository)은 **읽기/호출만** 하며 시그니처를 바꾸지 않는다. EPIC-CLOSING·EPIC-PURCHASE 완료분에 소급 변경이 없다.
- **계약 정밀화(§6·§7)는 신규 코드 없이 semantic**: SHOP_001 403 단일화·SHOP_004 라벨은 아직 미구현 코드(SHOP 도메인 신규)라 기존 구현과 충돌 없음. orders API는 이미 제네릭이라 SHOP 유입에 코드 변경 불요.
- **frontend 영향**: 마켓 목록·구매 버튼·판매 등록 화면은 EPIC-SHOP 신규 화면(디자인 게이트 대상). 거래내역 화면은 기존 `/me/orders`에 `sourceType=SHOP` 필터만 추가(purchase-spec 거래내역 UI 재사용).
- **backend-impl 신규 자산(구현 티켓 인계)**: `domain/shop/*`(`Shop`·`ShopRepository`·`ShopService`(등록·목록·상세·취소)·`ShopPurchaseService`(구매)·`ShopExpiryWorker`·`ShopExpiryService`·`ShopPurchaseContext`·`ShopExpireContext` 프로젝션·`ShopErrorCode`·`ShopStatus`·상태 CAS(`markShopSoldIfPurchasable`·`markShopCancelledIfActive`·`markShopExpiredIfExpirable`·`findExpirableIds`·`findPurchaseContextForUpdate`)·`ShopListingProperties`·`ShopExpiryWorkerProperties`) + `InventoryService.recoverExpiredToTemp`(소유자 불변 LISTED→TEMP) + `api/shop/*`(컨트롤러·요청/응답 record) + `V15__shop.sql`. **정산·수수료·거래내역·수익원장은 재사용(신규 0).**

---

## 10. 판매 관리 조회 — `GET /me/shops` (EPIC-SHOP-MANAGE / FC-103, PROPOSAL)

> **⚠ PROPOSAL — 게이트2 미승인(2026-07-22).** 판매자가 마이페이지 '내 판매'에서 자기 고정가 리스팅을 조회·관리한다. **신규 = 조회 엔드포인트 1개**뿐이며, 취소는 기존 `POST /shops/{id}/cancel`(§4.3, FC-093 완료)을 재사용한다. **스키마·에러코드·기존 엔드포인트 무변경(additive read).** 아래는 게이트2 승인 전제의 계약 정밀화다.

### 10.1 엔드포인트 형태 — `GET /me/shops` (대안 `GET /shops?mine=true` 배제)

- **`me` 접두 = 인증 주체 리소스 규약**(api-contract §4 서두 "`me` 접두는 인증 주체(SecurityContext) 기준 리소스")에 정합한다. 기존 `/me/orders`·`/me/inventory`·`/me/temp-storage`·`/me/balance`와 동형이라 프론트·서버 라우팅이 일관된다.
- **판매자 = SecurityContext 주체.** 요청 파라미터로 `seller` 를 받지 않는다 → 타인 판매목록 조회(IDOR) 원천 차단(B-009, `/me/orders` 스코프 규율 재사용). 컨트롤러가 아니라 서비스가 주체를 도출한다.
- **`?mine=true` 배제 근거**: 공개 브라우즈 `GET /shops`(인증 불요)에 `mine` 을 얹으면 한 엔드포인트에서 인증이 **조건부**가 되고 응답 스코프가 파라미터로 갈린다 — 캐싱·보안 모델이 이원화된다. 인증 스코프를 엔드포인트 단위로 분리하는 편이 단순하고 안전하다.

### 10.2 판매자 스코프·상태 필터·페이징

```
GET /me/shops?status={ACTIVE|SOLD|EXPIRED|CANCELLED|ALL}&cursor=...&size=...&sort=createdAt,desc
  → seller_id = me 로 좁힘  →  status 필터  →  keyset cursor 페이지
```

- **판매자 스코프**: `seller_id = me`. 인덱스 `ix_shop_seller_status (seller_id, status)`(V15 실재 — 확인 완료) 커버. 신규 인덱스 불요.
- **상태 필터**: `status` 생략 = **ACTIVE 기본**(진행 중 리스팅 조회가 1차 용도, 게이트1 배경). 명시 시 해당 영속 상태만(SOLD·EXPIRED·CANCELLED 이력). **`ALL` = 전 상태**(판매 이력 전체 탭) — API 레벨 센티널이며 컨트롤러가 "상태 predicate 없음"으로 매핑한다(`ShopStatus` enum 은 DB 4값 그대로 유지). 공개 `GET /shops`의 status 규약(null→ACTIVE, `statusScope`)과 semantic 정합하며, `ALL` 만 my-shops 전용 확장이다.
- **페이징·정렬 = 기존 `ShopCursor`/`ShopSort` 재사용.** 정렬 화이트리스트 `createdAt|price|endAt`, **기본 = `createdAt desc`**(최근 등록 우선, `/me/orders` created_at desc 대칭). keyset(정렬필드+id tiebreaker)·hasNext(size+1) 규율 그대로.
- **구현 노트(backend-impl)**: `findByCursor` 의 `statusScope` 를 (a) sellerId AND (b) status(ALL 이면 무필터)로 확장하는 **additive** 변경. 기존 public 목록 경로(sellerId 미지정)는 무영향. 신규 소형 자산 = `ShopService` 조회 메서드 1개(주체 스코프) + 컨트롤러 핸들러 1개 + 응답 재사용. 정본 형태는 backend-impl(FC-104) 소유.

### 10.3 역할별 노출 — 예상 정산액 판매자 전용 노출(게이트2 M3 정정 2026-07-22 사용자)

- **응답 DTO = `MyShopSummary`(신규, /me/shops 전용)** = `ShopSummary`(§3.3 `{ shopPublicId, status, item, price, endAt?, sellerNickname }`) + **판매자 전용 예상 정산 2필드** `estimatedFee`·`estimatedSettle`:

```
MyShopSummary (GET /me/shops content):
  { shopPublicId, status, item, price, endAt?, sellerNickname,
    estimatedFee, estimatedSettle }
  // estimatedFee    = FeeCalculator.compute(price)   (현재 수수료 정책)
  // estimatedSettle = price − estimatedFee
```

- **공개 브라우즈 오염 금지.** 공개 `GET /shops`가 쓰는 `ShopSummary`는 **무변경** — fee/settle 은 `/me/shops` 전용 `MyShopSummary`로만 나간다. 공개 목록 응답에 판매자 회계값이 절대 유입되지 않는다(별도 DTO 격리). `/me/shops`는 인증 주체(판매자 본인)라 노출이 안전하다.
- **예상치(estimate)임을 명시.** ACTIVE 리스팅은 아직 `sale_order` 가 없어 이 2값은 **실현값이 아니라 예상치**다. 서버가 등록가 기준으로 `FeeCalculator.compute(price)`·`price − fee`를 계산한다. **SOLD 시점 `feePolicy.version()` 기준 실현값과 드리프트할 수 있으므로**(S-B) 필드명·계약 설명에 "예상/estimate"를 명시하고, UX 는 "예상 정산액"으로 표기한다. **실현 fee/settle 은 판매 후 `GET /me/orders?sourceType=SHOP`(판매자 전용, purchase-spec §5.2)에 그대로 노출**된다(이 경로는 무변경).
- **backend-impl 재사용 지점**: `settlement/FeeCalculator.compute(long)`(백엔드 실측 §서두 — 정산 꼬리에서 이미 쓰는 계산기, 코드 변경 0). 조회 응답 조립 시 리스팅별 `price`로 1회 호출. `estimatedSettle = price − estimatedFee`.

### 10.4 파급·스키마 확인

- **파급 = 없음(additive read).** 기존 `GET /shops` 공개 브라우즈·`POST /shops`·`/purchase`·`/cancel`·EPIC-SHOP(done)에 소급 변경 없음. `findByCursor` sellerId 스코프는 additive(기존 시그니처·public 경로 무영향).
- **스키마 무변경.** 신규 컬럼·테이블·인덱스·에러코드 0. `ix_shop_seller_status (seller_id, status)` V15 실재 확인.

### 10.5 게이트2 상신 항목 (read 엔드포인트 — 소량)

| # | 결정 | 추천안 | 근거(한 줄) | 제품 영향(평이한 언어) |
|---|---|---|---|---|
| **M1** | 엔드포인트 형태 | **`GET /me/shops`**(대안 `GET /shops?mine=true` 배제) | `/me/*` 인증 주체 리소스 규약 정합 + 요청에 seller 없음 = 타인 판매목록 조회 원천 불가 | '내 판매' 화면이 '내 주문·내 인벤토리'와 똑같은 방식으로 붙는다. 남의 판매목록을 훔쳐볼 URL이 아예 없다 |
| **M2** | 상태 필터 기본값 | **생략=ACTIVE(판매 중), 명시=해당 상태, `ALL`=전체 이력** | 진행 중 조회가 1차 용도(게이트1). 이력 탭은 `ALL`/개별 상태로 | 기본은 지금 팔고 있는 물건만 보인다. 팔린·만료·취소된 과거 내역은 '전체' 또는 각 탭으로 볼 수 있다 |
| **M3** | 예상 정산액 노출 (게이트2 정정 확정) | **등록가 + 예상 정산액(`estimatedFee`·`estimatedSettle`) 함께 노출**. `/me/shops` 전용 `MyShopSummary`로 격리 — 공개 `ShopSummary` 무오염 | 판매자 본인 화면이라 회계값 노출 안전. 추정치라 "예상"으로 표기(S-B). FeeCalculator 재사용(코드 변경 0) | '내 판매' 카드에 등록가와 함께 "이만큼 팔리면 예상 정산액 N"을 보여준다. 실제 정산액은 팔린 뒤 '내 주문'에서 확정 확인. 남이 보는 공개 목록엔 이 값이 안 나간다 |

**스키마 영향 = 0.** M1~M3은 계약 형태·필터·노출 범위 결정이며 테이블·인덱스·에러코드 신규·변경이 없다(예상 정산액도 서버 파생값 — 컬럼 추가 없음).
