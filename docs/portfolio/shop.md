# 도시에: 고정가 마켓 (EPIC-SHOP — 아이템 즉시 판매·구매)

> 포트폴리오(케이스 스터디·이력서 불릿·소개 페이지) 재가공용 **중간 산출물**이다. 정본이 아니라
> 코드·spec·계약·erd·보드·리뷰에서 큐레이션한 파생 요약이다. 모든 주장은 증거(파일·커밋·테스트)로
> 뒷받침한다 — 과장·미구현을 구현으로 쓰지 않는다.

- **영역/에픽**: EPIC-SHOP (고정가 마켓: 등록 `POST /shops` → 즉시 구매 `POST /shops/{id}/purchase` → 취소·기한 만료 회수)
- **상태**: 완료 · reviewer PASS · 온디맨드 보안 0건 · 게이트3 Done 승인(2026-07-22) · 원격 반영 확인
- **기간(커밋 기준)**: `04f5987`(shop-spec v0.2 계약) ~ `5855626`(backend) ∥ `9ab2b27`+`abcaa1f`(frontend) ~ `fb8a5b6`(게이트3 Done)
- **관련 티켓**: FC-092(architect)·FC-093(backend-impl)·FC-094(frontend-impl)·FC-095(reviewer) / 후속 FC-096(취소 UI, todo)

## 1. 개요 (한 문단)

경매(입찰·마감) 옆에 **고정가 마켓**을 연다. 판매자가 인벤토리 아이템을 정가로 즉시 판매 등록하면,
구매자가 마켓에서 둘러보고 **입찰 없이 곧바로 구매**한다(프론트 `/market`의 "준비 중" 자리를 실기능으로
전환). 표면은 "정가로 사고파는 흔한 마켓"이지만, 실제 가치는 **이미 만든 정산·에스크로·거래내역
인프라를 코드 변경 0으로 세 번째로 재사용**했다는 데 있다. 고정가 SOLD의 정산 꼬리(sale_order·수익원장·
아이템 이전·수수료)는 경매 낙찰·즉시구매와 완전히 같아서, 이번 에픽에서 신규로 설계한 것은 shop
애그리거트의 "머리"(등록·구매·취소·만료 상태 전이)뿐이다. 정산 "꼬리"가 세 번째 소비처(마감→즉시구매→
고정가)에서 다시 검증되며 단일화가 실증됐다.

## 2. 해결한 기술 도전과 해법

- **정산 꼬리 재사용(코드 변경 0)으로 신규 표면 최소화**: 고정가는 경매의 복잡성 대부분을 *가진 적이
  없다* — 입찰 경쟁·홀드(money_hold)·패자 해제·예약 시작(SCHEDULED)이 전부 없다. 그래서 "입찰 없는
  즉시 SOLD"(shop-spec §1)로 정의하고, SOLD 이후의 정산 꼬리는 `SettlementRecorder.record(SHOP, shop.id, …)`
  **단일 호출**로 위임했다 → sale_order INSERT·수익원장·아이템 이전(`transferListedToBuyer`)·소유이력
  append(TRADE)가 그대로 재사용된다. `SaleOrderSourceType.SHOP`은 이전 에픽에서 이미 enum에 정의만
  돼 있던 값이라 이번에 **실사용을 시작**했을 뿐이다. `sale_order`·`platform_revenue_ledger` 스키마(V14)
  변경 0, `FeeCalculator`·`InventoryService` CAS·`UserBalance` 증감·orders API 전부 변경 0.

- **동시성 3중 방어(이중판매 원천 차단)**: 두 구매자가 같은 물건을 동시에 "구매"해도 정확히 한 명만
  사도록 세 층으로 막는다 —
  1. **shop 행 배타 락**(`findPurchaseContextForUpdate`, `SELECT … FOR UPDATE`): 리스팅 단위 직렬화.
     구매·취소·만료가 **한 행에서** 대기해 단일 승자가 된다.
  2. **종료성 status CAS**(`markShopSoldIfPurchasable`: `status=ACTIVE AND (end_at IS NULL OR end_at>now) → SOLD`):
     조건부 UPDATE 영향행이 정확히 1이어야 성립.
  3. **sale_order `(source_type, source_id)` UK 백스톱**: 어떤 경합·재시도·다중 인스턴스에서도 한
     리스팅의 판매 기록이 DB 수준에서 딱 한 번만 남는다. 복합 UK라 SHOP과 AUCTION의 source_id 수치가
     같아도 충돌하지 않는다(폴리모픽 안전).

- **구매(live) vs 만료(expired) 시간축 배타 분할**: 만료 시각을 막 지난 경계 리스팅이 구매·만료
  **어느 한쪽으로만** 종결되게, 구매 CAS는 `end_at IS NULL OR end_at > now`(live), 만료 CAS는
  `end_at IS NOT NULL AND end_at <= now`(expired)로 시간 조건을 상보 분할했다(`ShopRepository`
  `markShopSoldIfPurchasable` ↔ `markShopExpiredIfExpirable`). 무기한(NULL)은 항상 구매 가능·만료 제외.

- **교차거래 데드락 원천 차단(A4 규율 재사용)**: A가 B의 물건을, B가 A의 물건을 동시에 사면 shop 행
  락은 서로 다른 행이라 순환 대기를 못 막는다. 그래서 잔액 이동을 **`user_id` 오름차순** 단일 전역
  순서로 고정(`applyBalanceInUserIdOrder`)해 InnoDB 데드락을 원천 차단했다. 즉시구매는 buyer·seller·loser
  최대 3행이지만 고정가는 홀드·패자가 없어 **buyer·seller 2행**으로 단순화된다.

- **영속성 컨텍스트(PC) clear 함정 승계**: `decreaseGameMoney`/`increaseGameMoney`/`SettlementRecorder`가
  영속성 컨텍스트를 비우므로, 판정 근거를 1단계에서 **스칼라 프로젝션**(`ShopPurchaseContext`)으로 전부
  값 복사하고 이후 전이는 `@Modifying` CAS·fresh INSERT로만 수행한다. 프로젝션이 `s.seller.id`·
  `s.itemInstance.id`를 읽어 조인이 없어 `FOR UPDATE`가 단일 테이블 잠금으로 유지된다.

- **만료 워커 — 회수 목적지 TEMP 직행(취소와 비대칭)**: 만료는 별도 `ShopExpiryWorker`가
  `(status, end_at)` 인덱스로 후보 id만 스캔(락 없이 짧게)하고, 전이는 1건씩 독립 TX + 행 락
  (`ShopExpiryService.expireOne`)으로 처리한다. 회수는 **TEMP 무조건 직행**(`recoverExpiredToTemp`,
  소유자 불변) — 판매자가 자리에 없어 슬롯을 관리하지 않고, 한 tick에 다수 만료 시 인벤토리 슬롯
  경합·`slot_key` UK flush를 원천 없애기 위해서다. 반면 판매자가 능동적으로 내리는 **취소는 인벤토리
  복귀 우선**(`releaseFromListing`, 만실 시 TEMP)이다 — 슬롯 배정이 자연스러운 동기 경로라서다.

## 3. 핵심 결정과 근거 (트레이드오프)

- **판매 기한 = 관리자 단일 설정값 자동 계산(판매자 미선택)**: 등록 요청 본문은 `{itemInstancePublicId, price}`
  뿐이고, 서버가 `end_at = now + shop.listing.default-duration-days`(기본 7일)로 자동 채운다.
  판매자 기한 지정·최대값·기한 범위 개념을 폐기했다. 값은 `@ConfigurationProperties`
  (`ShopListingProperties`)로 바인딩해 코드 수정 없이 설정으로 조정(향후 DB 이관 여지). `end_at`
  컬럼은 nullable로 유지 — NULL(무기한)은 **향후 무기한 캐시아이템** 전용 seam이며 이 에픽 범위 밖이다.
  (근거: 게이트1 제품 결정 1 + 게이트2 기한 모델 정정, shop-spec §3.1·C5)

- **Redis 분산락 배제, 정합성은 DB**: 구매 동시성을 Redis 분산락이 아니라 shop 행 `FOR UPDATE` +
  종료성 CAS로 처리한다. `@DistributedLock`은 고정 임대(watchdog 부재)라 상호배제가 깨질 수 있고 Redis
  장애가 구매 전면 중단으로 전파된다 — 이미 EPIC-BID 게이트2에서 폐기된 판단과 정합(domain-spec §8
  "정합성은 DB"). (근거: shop-spec §8 C1)

- **이중판매 차단에 신규 제약 0**: 이미 존재하는 `sale_order (source_type, source_id)` UK(closing I-C)를
  백스톱으로 재사용해 DB 제약을 추가하지 않았다. 코드·스키마 변경 없이 폴리모픽 안전을 얻는다.
  (근거: shop-spec §8 C3)

- **cancel 동사 = POST 유지(PATCH 아님)**: FC-093 티켓 초안은 `PATCH .../cancel`을 언급했으나 계약
  §3.2가 이미 `POST /shops/{id}/cancel`로 확정돼 있고 경매 취소(`POST /auctions/{id}/cancel`)와 대칭이
  깨지면 프론트 에러맵·라우팅이 이원화된다 → **POST로 통일**. architect가 계약을 근거로 티켓 문구를
  바로잡은 사례. (근거: shop-spec §8 C6, 게이트2 소결정)

- **만료 워커 주기 60초(경매 마감 2초보다 김)**: 만료는 낙찰자 대기·에스크로 금전이 없어 시급성이 낮다
  → 긴 주기로 부하를 줄인다. `@ConfigurationProperties`(`ShopExpiryWorkerProperties`, 배치 200)로 튜닝
  가능. (근거: shop-spec §8 C4)

## 4. 아키텍처

현재 코드는 `com.finalcall.domain.shop.<layer>` feature-first 구조다. **shop 애그리거트(머리)만 신규,
정산 꼬리는 재사용했다.** 아래 다이어그램은 구현 당시의 책임 분리를 현재 패키지 구조로 다시 표기한 것이다.

```
domain/shop/controller/            domain/shop/service/                      [재사용 — 코드 변경 0]
  ShopController                     ShopService(등록·목록·상세·취소)          domain/settlement/
   · POST /shops        (판매자)      · register: markListedIfInInventory CAS    SettlementRecorder.record(SHOP,…)
   · GET  /shops        (공개)         · cancel:   releaseFromListing            SaleOrder(+UK source_type,source_id)
   · GET  /shops/{id}   (공개)        ShopPurchaseService(구매·최고위험)         PlatformRevenueLedger / FeeCalculator
   · POST .../purchase  (구매자)       · FOR UPDATE 스냅샷→재검증→수수료1회      item/
   · POST .../cancel    (판매자)        →잔액 user_id 오름차순→recorder→SOLD CAS   InventoryService.transferListedToBuyer
  요청/응답 record                    ShopExpiryService/Worker(만료)             ·releaseFromListing ·markListedIfInInventory
   (ShopRegister/Detail/…)            · 후보 id 스캔→1건 독립 TX+행 락           member/
                                       · recoverExpiredToTemp(TEMP 직행) ★신규    UserBalanceRepository inc/decreaseGameMoney
                                      ShopRepository(FOR UPDATE 프로젝션·CAS×3)   orders API(GET /me/orders?sourceType=SHOP 자동 유입)
                                      ShopErrorCode(SHOP_001~006)
                                      ShopListing/ExpiryWorkerProperties(@ConfigurationProperties)

DB: V15__shop.sql — shop 테이블 최초 생성(append-only 채번). 인덱스 (status,end_at)·(seller_id,status)·(item_instance_id)
    CHECK(price>0) 심층방어. sale_order·platform_revenue_ledger(V14)는 스키마 무변경, source_type=SHOP 실사용 시작.
인증 주체: JWT subject=userId → SecurityContext (X-User-Id 미신뢰). GET만 permitAll, 쓰기 인증 강제.

frontend: features/shop/{components: ShopCard·ShopFilters·ShopHeroCard·ShopBuyPanel·ShopPurchaseDialog·ShopSellConfirmDialog,
          lib: shopErrors·shopFilters·shopStatus} · lib/api/shop.ts · lib/queries/shop.ts
          pages: MarketPage(목록)·MarketDetailPage(/market/:id)·SellPage(고정가 판매등록)
```

**신규 designed vs 재사용 경계**: 신규 = shop 엔티티·상태머신(ACTIVE→SOLD|CANCELLED|EXPIRED)·리포지토리
CAS 3종·구매/취소/등록 서비스·만료 워커·`InventoryService.recoverExpiredToTemp` 소형 전이 1건·`ShopErrorCode`·
설정 프로퍼티 2종·V15 테이블·프론트 shop 계층. 재사용(변경 0) = 정산·수수료·수익원장·거래내역 API·
인벤토리 CAS·잔액 증감.

## 5. contract-first 게이트 흐름 (프로세스 성과)

이 에픽은 오케스트레이션·게이트 정책이 매끄럽게 돈 사례다:

- **게이트1(에픽 승인)**: 다음 작업으로 고정가 마켓 선택. 제품 결정 2건(판매 기한 = 관리자 설정값·무기한
  지원 / 판매 취소 허용)을 사용자와 확정.
- **게이트2(계약/스키마)**: architect가 기한 모델을 게이트2로 상신 → **사용자가 "판매자 기한 선택"을
  "서버 단일 설정값 자동 계산"으로 정정** → shop-spec v0.1→v0.2 재작성. **contract-first 파급 관리**가
  작동한 순간: 계약 단계에서 방향이 바뀌어 구현 재작업 0. 스키마 영향은 신규 테이블 1개(shop, V15)뿐,
  컬럼·인덱스·UK 변경 0으로 확정.
- **병렬 팬아웃**: FC-093(backend) ∥ FC-094(frontend) — 쓰기 파일 집합 무교차(backend `domain/shop`·
  `api/shop`·V15 vs frontend `features/shop`·`pages/Market*`)라 병렬 실행. frontend는 backend/src 0 변경.
- **디자인 게이트 / 목업 fidelity**: 마켓 목록은 사용자 game-market 목업 §9를 디자인 정본으로
  (mockup-fidelity-only-fix), 단 **API 정본은 목업이 아니라 우리 `/shops` 계약**(목업 권장 `/market/listings`
  폐기). 마켓 상세는 목업 미포함 → **사용자 게이트 결정으로 승인 경매상세 디자인을 고정가 변형 재사용**
  (신규 비주얼 창작 없음).
- **reviewer PASS → 온디맨드 보안 0건 → 게이트3 Done**: critical/major 0(minor 2 비차단). 에픽 완료
  직전 `/security-review` 1회 HIGH/MEDIUM **0건**. 사용자 Done 승인 후 관련 커밋의 원격 반영을 확인했다.

**교훈**: (1) 목업에 없는 화면(취소·판매관리 UI)을 발견 → 억지로 끼우지 않고 후속 티켓 **FC-096**으로
분리(EPIC-SHOP done을 막지 않음). 백엔드 cancel API는 FC-093에서 이미 구현, UI 소비처만 후속. (2)
게이트2 승인분을 **정확히** 준수 — "하드닝 후속으로 남기지 말 것"(FC-089 A4 교훈)을 반영해 이번엔
계약 이탈 0. 후속 하드닝 백로그는 게이트2 승인분과 무관한 항목(무기한 keyset·필터 파리티)만 남겼다.

## 6. 증거

- **엔드포인트/기능**: 계약 §3.2 — `POST /shops`(판매자, body `{itemInstancePublicId, price}` — 기한 입력
  없음, 서버 자동 계산) · `GET /shops`(공개, 커서 목록) · `GET /shops/{id}`(공개) ·
  `POST /shops/{id}/purchase`(구매자, 본문 없음·finalPrice=shop.price, 201) · `POST /shops/{id}/cancel`(판매자, 200).
  에러 §5 SHOP_001(403 미소유/미보유/미존재 단일)·SHOP_002(409 이미출품)·SHOP_003(404)·SHOP_004(409
  이미판매/종료)·SHOP_005(422 잔액부족)·SHOP_006(403 자기구매).
- **핵심 파일**:
  - `backend/src/main/java/com/finalcall/domain/shop/ShopPurchaseService.java` — 구매(FOR UPDATE→재검증→수수료→잔액 user_id 오름차순→recorder→SOLD CAS), PC clear 함정 처리
  - `backend/src/main/java/com/finalcall/domain/shop/ShopRepository.java` — FOR UPDATE 프로젝션 2종 + 종료성 CAS 3종(sold/cancelled/expired)·만료 후보 스캔
  - `backend/src/main/java/com/finalcall/domain/shop/ShopService.java` — 등록(markListedIfInInventory CAS)·목록·상세·취소(releaseFromListing)
  - `backend/src/main/java/com/finalcall/domain/shop/ShopExpiryService.java` + `ShopExpiryWorker.java` — 만료 워커(후보 스캔·1건 독립 TX·TEMP 직행·멱등)
  - `backend/src/main/java/com/finalcall/domain/shop/{ShopStatus,ShopErrorCode,ShopListingProperties,ShopExpiryWorkerProperties}.java`
  - `backend/src/main/java/com/finalcall/domain/item/InventoryService.java:182` — `recoverExpiredToTemp`(LISTED→TEMP 무조건, 소유자 불변) ★유일한 신규 인벤토리 전이
  - `backend/src/main/java/com/finalcall/api/shop/ShopController.java` + 요청/응답 record 9종
  - `backend/src/main/resources/db/migration/V15__shop.sql` — shop 테이블 최초 생성(인덱스 3종·CHECK price>0·FK 2종)
  - frontend: `frontend/src/lib/api/shop.ts`·`lib/queries/shop.ts`·`features/shop/**`·`pages/{MarketPage,MarketDetailPage,SellPage}.tsx`
- **테스트**(backend 신규 28건·전체 309 green, `:backend:build` SUCCESSFUL / frontend vitest 517 passed·build 통과·eslint 0):
  - `backend/.../integration/ShopPurchaseConcurrencyIntegrationTest.java` — 구매 동시성·이중판매 차단·잔액 락 순서(실 MySQL 커밋)
  - `backend/.../integration/ShopPurchaseSettlementIntegrationTest.java` — 정산 정합(수수료 1회·수익원장·아이템 이전·총량보존 S-H)
  - `backend/.../integration/ShopExpiryAndCancelIntegrationTest.java` — 만료 EXPIRED·TEMP 직행·취소 인벤 복귀·무기한 제외
  - `backend/.../integration/ShopApiIntegrationTest.java` · `support/ShopTestBase.java`
  - `frontend/src/features/shop/lib/{shopErrors,shopFilters,shopStatus}.test.ts`
- **불변식(shop-spec §5, reviewer 정본)**: S-A(SOLD∧sale_order 1건)·S-B(final=settle+fee 재현)·S-C(SOLD
  핸드오프 1회, UK 백스톱)·S-D(홀드 미경유 잔액 이동)·S-E(소유 이전/불변)·S-F(종료 전이 멱등)·S-G(시간축
  배타)·S-H(게임머니 총량 보존).
- **리뷰**: `docs/board/reviews/FC-095-review.md` — review_status **passed**(critical 0·major 0·minor 2).
  이중판매 3중 방어·시간축 배타·잔액 락 순서·정산 정합·도메인 인가(취소 IDOR SHOP_001·자기구매 SHOP_006·
  주체=SecurityContext) 확인. 온디맨드 보안 리뷰 취약점 0건(EPIC-SHOP.md §온디맨드).
- **커밋**:
  - `04f5987` docs(spec): shop-spec v0.2 + erd/api-contract shop 델타 — 계약 확정 (FC-092)
  - `5855626` feat(shop): 고정가 마켓 서버 구현 — 등록·구매·취소·만료 워커 (FC-093)
  - `9ab2b27` feat(shop): 고정가 마켓 프론트 실기능화 — 목록·구매·판매등록·거래내역 필터 (FC-094)
  - `abcaa1f` feat(shop): 마켓 상세 페이지 신설 — 카드→상세→구매 통일 (FC-094 게이트)
  - `761301a` docs(board): FC-095 검수 PASS + FC-096 후속 분리
  - `359529a` docs(board): EPIC-SHOP 온디맨드 보안 리뷰 — 취약점 0건 (게이트3 전)
  - `fb8a5b6` docs(board): EPIC-SHOP done — 게이트3 사용자 승인 (KAN-102)

## 7. 범위 밖 · 후속

- **고정가 판매 관리·취소(내리기) UI = FC-096**(todo). 백엔드 cancel API는 구현됨, UI 소비처만 후속.
- **무기한 캐시아이템**(end_at NULL 공개 노출·기한 연장 `extendUntil` seam) = 별도 에픽. 현재 스키마·
  워커는 지원하나 등록 경로는 항상 유한 기한만 생성. 리뷰가 지목한 `encodeNext` null-endAt latent NPE는
  현재 도달 불가이며 그 에픽 착수 시 게이트로 다룰 항목.
- 가격 흥정·제안·관리자 콘솔(기한 옵션 UI)·알림·EPIC-GRADE·EPIC-SEARCH.
