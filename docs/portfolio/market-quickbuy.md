# 도시에: 마켓 즉시구매 (EPIC-MARKET-QUICKBUY — 카드정보 UI 차용 인라인 구매)

> 포트폴리오(케이스 스터디·이력서 불릿·소개 페이지) 재가공용 **중간 산출물**이다. 정본이 아니라
> 코드·spec·계약·보드·리뷰·결정로그에서 큐레이션한 파생 요약이다. 모든 주장은 증거(파일·커밋·테스트)로
> 뒷받침한다 — 과장·미구현을 구현으로 쓰지 않는다.

- **영역/에픽**: EPIC-MARKET-QUICKBUY (마켓 목록에서 상세 이동 없이 게임 "카드정보" UI를 차용한 모달로 인라인 즉시 구매)
- **상태**: 완료 · reviewer 전건 passed · 게이트3 Done 승인(2026-07-29) · 원격 반영 확인
- **기간(커밋 기준)**: `f1aa276`(보드·목업) · `25d3652`(계약 FC-148) → `d088645`(backend FC-149) ∥ `f74c20f`(frontend FC-146·150) → `263e39d`(게이트3 Done)
- **관련 티켓**: FC-145(디자인 목업)·FC-146(모달 실구현)·FC-147(디자인 변형 목업)·FC-148(거래횟수 계약)·FC-149(백엔드 집계)·FC-150(프론트 표시)

## 1. 개요 (한 문단)

기존 고정가 마켓(EPIC-SHOP) 위에 **UX·표시 계층만 얹은 에픽**이다. 마켓 목록에서 아이템을 누르면
상세 페이지(`MarketDetailPage`)로 이동하던 흐름을, **목록에서 카드 영역을 클릭하면 바로 뜨는 게임식
"카드정보(CARD INFO)" 모달에서 즉시 구매**하도록 바꿨다. 표면은 "게임 카드 팝업으로 바로 사기"지만,
엔지니어링 관점의 핵심은 **계약(구매 API·정산·동시성)을 한 줄도 건드리지 않고** 구매 API
`POST /shops/{id}/purchase`(FC-094)를 그대로 재사용했다는 점, 그리고 그 과정에서 두 가지 규율 —
**목록 응답의 N+1 회피**와 **계약에 없는 데이터 위조 금지** — 을 계약·테스트로 기계 강제했다는 점이다.
게임 카드 aesthetic을 커머스에 차용하는 결정은 디자인 게이트에서 목업으로 확정했고, 판매자 신뢰
지표(거래 횟수)만 게이트2 성격의 계약 필드 1개 추가로 실데이터화했다.

## 2. 해결한 기술 도전과 해법

- **목록 응답 N+1 원천 차단 — 페이지당 배치 IN 집계 1쿼리로 계약**: 카드정보 모달이 **목록
  (`GET /shops`)에서 바로 열리므로**, 판매자별 "거래 N회"를 목록 응답에 실어야 했다. 리스팅 N건마다
  판매자 카운트를 쏘면 곧바로 N+1이다. 해법은 계약 단계(shop-spec §11.3)에서 **행별 카운트를 금지**하고,
  페이지에 등장한 판매자 집합으로 **추가 쿼리 딱 1개**
  (`SELECT seller_id, COUNT(*) FROM sale_order WHERE seller_id IN (:ids) GROUP BY seller_id`) →
  앱에서 shop→count 매핑(미등장=0)으로 못박은 것이다. 구현은
  `SaleOrderRepositoryImpl.countCompletedSalesBySellerIds`(빈 입력이면 `IN ()` 렌더를 피해 쿼리 자체
  생략), 조립은 `ShopService.completedSalesBySeller`가 목록·검색(ES 하이드레이션) 양쪽에서 동일하게
  호출한다. 슬라이스 테스트가 Hibernate `Statistics.getPrepareStatementCount() == 1`로 판매자 3인에도
  준비 문장이 1개임을 기계 검증해, 이 계약이 리팩터링으로 깨지면 빌드가 실패한다.

- **N+1 회피의 경로별 최적화(목록 vs 상세 vs 내판매)**: 세 응답 조립이 각기 다른 최적 형태를 갖는다 —
  (1) **목록/검색**은 판매자가 여럿이라 **배치 IN 집계 1쿼리**, (2) **상세(`GET /shops/{id}`)**는 단건이라
  **단건 카운트 1쿼리**(`countCompletedSalesBySellerId`), (3) **내 판매(`GET /me/shops`)**는 페이지 전체가
  동일 판매자(본인)라 **단건 카운트 1회**로 페이지 전체를 채운다(`ShopService.getMyShops`). 키셋 커서
  쿼리(§10.2)에는 손대지 않아 페이지네이션이 단순하게 유지된다.

- **계약에 없는 데이터 3종을 "위조/파생/실데이터"로 분류 처리**: 참조 게임 UI의 연출값을 그대로 옮기면
  없는 데이터를 지어내는 위조가 된다. 각각을 성격에 따라 갈랐다 — (a) **거래 128회 → 실데이터화**:
  정산원장(`sale_order`) 실집계 `sellerCompletedSales`로 교체(§2 N+1 참조). (b) **채널제한 → 표시 파생으로
  격리**: 계약·도메인에 채널제한 데이터가 없으므로(기획이 채널링대·합성조건을 명시 제외) 위조하지 않고
  계약 필드 `level`에서 결정적으로 파생하는 **표시 전용 헬퍼**(`channelLimit.ts`)로 분리 — 필터·정렬·시세
  축으로 승격하지 않음을 주석·구조로 못박음. (c) **랭크 뱃지(S/A/B/C) → 제거**: 계약에 근거가 없어
  렌더하지 않음(FC-146 디자인 게이트 확정). "탭" 연출도 함께 제거해 특수스킬 섹션만 직접 노출.

- **계약 변경 0으로 UX 전면 교체**: 목록 클릭 인터랙션을 네비게이션→모달로 바꾸는 것은 프론트 상태
  (`MarketPage`의 `selectedShop`)만의 문제였고, 구매·정산·동시성 API는 전부 재사용했다. 모달은 열릴 때만
  마운트되고(`ShopCardInfoDialog`), 구매는 기존 `usePurchaseShop`(`POST /shops/{id}/purchase`)에 연결해
  성공→무효화·실패코드(SHOP_004 이미판매·SHOP_005 잔액부족·SHOP_006 자기구매)를 그대로 표면화한다.
  `MarketDetailPage`(`/market/:id`)는 딥링크 seam으로 잔존(제거는 범위 밖).

## 3. 핵심 결정과 근거 (트레이드오프)

- **판매자 거래 횟수 = 채널 무필터 합산(경매 낙찰 + 마켓 판매)**: `sellerCompletedSales`를
  `COUNT(sale_order WHERE seller_id=?)`로 정의해 `source_type` 필터를 걸지 않았다. 근거 — 이 값은
  마켓 모달에서 열리지만 의미는 "이 판매자를 얼마나 믿을 수 있나"라는 **판매자 전역 신뢰 지표**이고,
  신뢰도는 채널로 쪼개지지 않는다(마켓플레이스 "판매 N회" 관행). 배제한 대안(`AND source_type='SHOP'`
  마켓만)은 경매로만 팔던 유능한 판매자가 마켓 첫 판매 시 "0회"로 보여 오해를 부른다. 부가 이득으로
  `(seller_id)` 인덱스를 필터 없이 그대로 커버한다. (근거: shop-spec §11.1, 게이트2 사용자 승인 2026-07-29)

- **완료 판정 = `sale_order` 행 존재(상태 컬럼 불요)**: `sale_order`는 SOLD 정산 성립분에만 생성되는
  원장이고 `status`는 `SETTLED` 단일값이라, "행이 존재한다 = 그 판매는 완료됐다"가 스키마 불변식이다.
  취소(CANCELLED)·유찰(UNSOLD)·만료(EXPIRED)·진행중(ACTIVE)은 `sale_order` 행을 만들지 않으므로 별도
  제외 조건(`WHERE status != …`) 없이 자연 배제된다. `sale_order`는 append-only·SETTLED 종단이라 현재
  카운트는 순수 완료 건수다(환불/크레딧 미구현 → 감산 없음, 도입 시 감산 여부는 그 에픽 seam). (근거:
  shop-spec §11.1)

- **집계 방식은 구현 자유, 계약은 값의 의미만 고정**: 배치 IN 집계를 채택하되(N+1 없음·스키마 무변경),
  대안으로 상관 서브쿼리·비정규화 카운터(`seller_stats.completed_sales_count` + 정산 TX 증분)를 명시적
  seam으로 남겼다. 배치 집계는 읽기 전용·additive라 언제든 다른 방식으로 이관해도 **계약(필드 형상)은
  불변**이다. 되돌리기 리스크가 낮은 지점을 계약에 못박아 구현 자유도를 확보했다. (근거: shop-spec §11.3)

- **형상 보존 — 필드 1개 추가만**: `ShopSummary`에 `sellerCompletedSales: long`(non-null, ≥0, 말미)만
  추가했다. `ShopDetail`(= ShopSummary + createdAt)·`MyShopSummary`(+ estimated*)는 **ShopSummary를
  상속**하므로 추가 작업 0으로 자동 포함된다. 직렬화 JSON 형상은 필드 1개 추가뿐 — 기존 필드·중첩 불변.
  스키마·인덱스·에러코드·Flyway 변경 0. (근거: shop-spec §11.4, api-contract §3.3)

- **공개 노출 안전성**: `sellerCompletedSales`는 집계 카운트(정수)일 뿐 거래상대·금액·PII를 담지 않아
  인증 없는 공개 목록에 실어도 정보 누출이 아니다(마켓플레이스 "판매 N회"와 동형). 별도 인증
  seller-stats 경로로 뺄 이유가 없어 목록 응답에 직접 실었다. (근거: shop-spec §11.3)

## 4. 아키텍처

의존 방향 feature-first — shop feature 조립 + settlement feature 집계 재사용. **신규 표면은 프론트 모달 +
백엔드 집계 쿼리뿐, 구매·정산·동시성은 EPIC-SHOP 자산 그대로.**

```
frontend                                        backend
  MarketPage                                      domain/shop/
   · selectedShop 상태(클릭→모달)                    ShopService (목록·검색·상세·내판매 조립)
   · ShopCard 영역 클릭 = 상세네비 대체                 · getList: completedSalesBySeller(배치 IN 1쿼리)
  features/shop/components/                          · search(ES): 동일 배치 집계로 하이드레이션
   ShopCardInfoDialog(.tsx/.css)  ★신규               · getDetail/getMyShops: 단건 카운트 1쿼리
    · 카드정보 구조 계승(헤더→썸네일|속성표             dto/ ShopSummaryResponse(+sellerCompletedSales)
       →특수스킬→판매자→가격+구매CTA)                        ShopDetailResponse·MyShopSummaryResponse(상속)
    · 비주얼=앱 라이트 커머스로 재설계                 [재사용 — 변경 0]
    · 모달배선(초점트랩·스크롤잠금·Esc·role=dialog)     settlement/
       = ShopPurchaseDialog 이식                        SaleOrderRepositoryCustom/Impl
    · 상태분기 = ShopBuyPanel 재사용                       · countCompletedSalesBySellerIds(배치 IN)  ★신규
    · usePurchaseShop(POST /shops/{id}/purchase)          · countCompletedSalesBySellerId(단건)      ★신규
  features/shop/lib/                                  ShopPurchaseService·ShopRepository(구매·CAS·정산)
   channelLimit.ts  ★신규(표시 전용 파생·계약 아님)      FeeCalculator·SettlementRecorder·sale_order UK
   shopErrors·shopStatus(재사용)                     [변경 0] 구매 API·정산·동시성 3중 방어·잔액 증감
  lib/api/shop.ts (ShopSummary 타입 +1필드)

계약: shop-spec §11(정본)·api-contract §3.3(ShopSummary 필드). 스키마·인덱스·에러코드·Flyway 변경 0.
집계 커버 인덱스: sale_order (seller_id) — 이미 거래내역 용도로 실재(erd §5), 신규 0.
```

**신규 vs 재사용 경계**: 신규 = `ShopCardInfoDialog`(모달)·`channelLimit.ts`(표시 파생)·MarketPage 클릭
인터랙션 교체·`sellerCompletedSales` 집계 2메서드(배치/단건)·DTO 필드 1개. 재사용(변경 0) = 구매 API·
정산 꼬리·동시성 3중 방어·잔액 증감·모달 배선/상태 분기 로직(`ShopPurchaseDialog`·`ShopBuyPanel` 이식).

## 5. contract-first · 게이트 흐름 (프로세스 성과)

이 에픽은 **디자인 게이트 반복 + 게이트2 계약 승격**이 순차로 작동한 사례다:

- **게이트1(에픽 승인)**: 계약 변경 없음(구매 API 기존)이라 architect 계약 단계를 스킵. 분해안 =
  FC-145(목업) → FC-146(구현). 배경·제약(디자인 게이트 필수·반응형 별도 설계)을 에픽에 명시.
- **디자인 게이트(FC-145)**: 카드정보 UI 차용 목업(`market-quickbuy-cardinfo.html`)을 선제작해 3결정
  (모달 vs 인라인 / 게임 다크패널 충실 vs 앱 커머스 적응 / 상세페이지 대체)을 시각 제시 →
  **권장안(모달·구조 차용·네비 대체) 승인**. 승인 시 랭크 뱃지·탭 제거를 함께 확정(계약에 없는 연출).
- **라이브 디자인 반복(FC-147)**: 실구현 후 사용자가 "상단 레이아웃·전체 톤·하단 판매자 정보가 뜬금없고
  작음"을 지적 → **변형 A~D 목업**(`card-info-design-variants.html`)을 나란히 제시해 고르게 함
  ([[options-need-html-mockup]]). 비주얼은 게임 다크 네이비 패널을 걷고 앱 라이트 커머스 톤으로 재설계.
- **게이트2 계약 승격(FC-148)**: 판매자 영역의 목업 "거래 128회"가 **계약에 없는 연출값(위조)**으로 드러남
  → 사용자가 "실데이터로 만들기(ⓐ)·정의=완료 판매 건수"로 결정 → shop-spec §11 신설(정의·집계·성능·형상·
  seam). 평이한 언어 요약(§11.5)으로 상신([[gate2-plain-language]]). **계약 확정 후** 병렬 팬아웃.
- **병렬 팬아웃**: FC-149(backend 집계) ∥ FC-150(frontend 표시) — 쓰기 파일 무교차(backend =
  settlement repository·shop service/dto, frontend = 모달 컴포넌트·타입)라 병렬. 프론트는 필드 계약만으로
  선구현하되 통합 확인은 backend 완료 후(프론트는 `?? 0` 안전 폴백으로 필드 미도달 시 "신규 판매자").
- **reviewer 전건 passed → 게이트3 Done**: FC-145~150 review_status 전부 passed, 사용자 Done 승인 후
  관련 커밋의 원격 반영을 확인했다.

**교훈**: (1) **연출값을 실데이터/표시파생/제거로 3분**해 목업 충실도와 "위조 금지"를 양립시켰다 — 거래
횟수는 실집계, 채널제한은 표시 전용으로 격리, 랭크 뱃지는 제거. (2) **N+1을 코드 리뷰가 아니라 계약
(§11.3)과 슬라이스 테스트(Statistics=1)로 선제 차단**해, "목록에 카운트 필드를 얹는다"는 흔한 성능 함정을
설계 단계에서 봉인했다. (3) UX 전면 교체를 **계약 변경 0**으로 달성 — 재사용 자산(구매·정산·모달 배선·상태
분기)이 넓어 신규 표면이 모달 + 집계 쿼리로 최소화됐다.

## 6. 증거

- **엔드포인트/기능**: 구매 API 변경 없음(`POST /shops/{id}/purchase`, FC-094 재사용). 계약 추가 =
  `ShopSummary.sellerCompletedSales`(long, non-null, ≥0) → `GET /shops`·`GET /shops/{id}`·`GET /me/shops`
  응답에 유입(상세·MyShop은 상속 자동). 정본 = shop-spec §11 · api-contract §3.3.
- **핵심 파일**:
  - `backend/src/main/java/com/finalcall/domain/settlement/repository/SaleOrderRepositoryCustom.java` +
    `SaleOrderRepositoryImpl.java` — `countCompletedSalesBySellerIds`(배치 IN 집계, 빈 입력=쿼리 생략)·
    `countCompletedSalesBySellerId`(단건). `(seller_id)` 인덱스 커버·채널 무필터 합산.
  - `backend/src/main/java/com/finalcall/domain/shop/service/ShopService.java` —
    `completedSalesBySeller`(페이지당 배치 1쿼리)·`sellerSales`(미등장=0)·목록/검색/상세/내판매 경로별 조립.
  - `backend/src/main/java/com/finalcall/domain/shop/dto/ShopSummaryResponse.java` —
    `sellerCompletedSales` 필드 + `from(shop, sellerCompletedSales)`(DTO는 값만 담고 집계는 서비스 주입).
  - `backend/src/main/java/com/finalcall/domain/shop/controller/ShopController.java`·`dto/ShopDetailResponse.java`·`dto/MyShopSummaryResponse.java` — 상속 전파.
  - `frontend/src/features/shop/components/ShopCardInfoDialog.{tsx,css}` — 카드정보 모달(구조 계승·앱 톤
    재설계·모달 배선/상태분기 이식·거래 N회 실값 표시·`?? 0` 안전 폴백).
  - `frontend/src/features/shop/lib/channelLimit.ts` — 채널제한 표시 전용 파생(`level` 기반, 계약 아님).
  - `frontend/src/pages/MarketPage.tsx` — 카드 클릭 인터랙션 네비→모달 교체(`selectedShop` 상태).
  - `frontend/src/lib/api/shop.ts` — `ShopSummary` 타입에 `sellerCompletedSales` 추가(계약 1:1).
- **테스트**:
  - `backend/src/test/java/com/finalcall/domain/settlement/repository/SaleOrderSellerSalesSliceTest.java`
    (실 MySQL Testcontainers, `@DataJpaTest`) — 5건: 경매+마켓 합산(=3)·무이력 0·배치 판매자별 묶음·미등장
    맵 배제·빈 입력 쿼리 생략(`PrepareStatementCount==0`)·**판매자 3인에도 준비 문장 1개
    (`PrepareStatementCount==1`, N+1 아님 증명)**.
  - `backend/src/test/java/com/finalcall/integration/ShopApiIntegrationTest.java` — 응답 조립에
    `sellerCompletedSales` 노출 검증(+64줄).
- **커밋**:
  - `f1aa276` docs(board): EPIC-MARKET-QUICKBUY 티켓·목업 (FC-145~150)
  - `25d3652` docs(spec): 판매자 완료 판매 건수 계약 — sellerCompletedSales (FC-148)
  - `d088645` feat(shop): 판매자 완료 판매 건수 sellerCompletedSales 집계·응답 (FC-149)
  - `f74c20f` feat(shop): 마켓 카드정보 구매 모달 — 목록 클릭 즉시구매·판매자 거래횟수 (FC-146·150)
  - `263e39d` docs(board): EPIC-MARKET-QUICKBUY Done 전이·HANDOVER 갱신 (FC-146·149·150)
- **목업**: `docs/ux/mockups/market-quickbuy-cardinfo.html`(FC-145 디자인 게이트)·
  `docs/ux/mockups/card-info-design-variants.html`(FC-147 변형 A~D) + 스크린샷(`shot-web-*`·`shot-mobile-*`·`variant-*`).

## 7. 범위 밖 · 후속

- **경매 카드 대칭(seam)**: 같은 지표를 `AuctionSummary/Detail`에도 얹으면 경매 카드에도 판매자 완료 판매
  건수를 보일 수 있다(additive·nullable, 상태머신·쿼리 무변경). 이 에픽은 shop 계열에만 넣고 경매 대칭은
  후속 seam으로 남김. (근거: shop-spec §11.4)
- **비정규화 카운터 이관(seam)**: 트래픽 증가 시 `seller_stats.completed_sales_count` + 정산 TX 증분으로
  이관 가능(계약 형상 불변). 현재는 배치 IN 집계 채택.
- **환불/크레딧 도입 시 감산 규칙**: 현재 `sale_order` append-only라 순수 완료 건수. 환불 개념이 생기면
  카운트 감산 여부를 그 에픽에서 결정.
- **서버 채널제한 필드**: 현재는 `level` 기반 표시 파생(`channelLimit.ts`). 서버가 실제 채널 필드를
  내려주면 헬퍼를 그 필드로 교체(계약 변경 시).
- **`MarketDetailPage` 정리**: 딥링크 seam으로 잔존. 제거는 범위 밖.
