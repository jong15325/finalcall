# FinalCall Closing Domain Spec (마감·낙찰 정산 도메인 스펙)

상태: **v1.0 — 게이트2 승인 확정(2026-07-21, 사용자)**. EPIC-CLOSING(경매 마감·낙찰 정산) 코어의 계약/설계 정본이다.
게이트2 5항목 전건 승인 — 스키마(`sale_order` 사용, V14 생성) · 마감 워커(폴링+행락+종료성 CAS, SCHEDULED 포함) · seller 지급(게임머니 크레딧+sale_order) ·
수수료 계산(SOLD TX 내 1회+정책버전 스탬프) 승인. **business fee 귀속은 ④-C(전용 수익 원장 `platform_revenue_ledger`)로 확정**(architect 추천 ④-A 소멸이 아님 —
게임머니 총량 보존 + 회계/감사 추적, §4.6). 소유: architect(spec). 이 승인분이 `erd.md`·`api-contract.md`에 확정 반영된다(§10).

범위(코어): **마감 워커** + **낙찰 정산(SOLD)** + **유찰(UNSOLD)**.
**범위 밖(후속)**: 즉시구매(`POST /auctions/{id}/purchase`, BUYNOW) · 고정가(EPIC-SHOP) · 거래내역 조회 API(`GET /me/orders`·`GET /orders/{id}`) · 관리자 강제취소 · 정산 후 환불/크레딧(fee-policy-spec §5, 원칙만 고정) · 알림(notification).

근거(정본): fee-policy-spec v1.0, bid-domain-spec v0.3(§4 금전/락 모델·§4.6.2 CAS 0행 원인판정 규칙·§10 불변식), erd v1.2(§4.1 money_hold·user_balance·§4.2 auction/bid/sale_order·§5 인덱스·§6 Flyway), api-contract v1.11(§3.1 경매·입찰·§3.3 AuctionDetail/BidSummary·§4.3 주문), domain-spec §5(SOLD 핸드오프)·§8(정합성은 DB)·§9(DB가 진실, 인덱스는 재구축)·§10. CLAUDE.md 섹션 4·5.
백엔드 실측(현 구조): `auction/{Auction,AuctionService,AuctionRepository,AuctionStatus,AuctionResultType}`, `bid/{Bid,BidService,BidRepository,BidStatus}`, `currency/{MoneyHold,MoneyHoldService,MoneyHoldRepository,MoneyHoldStatus}`, `member/UserBalanceRepository`, `item/{ItemInstance,ItemInstanceRepository,InventoryService,ItemOwnershipHistory,TransferType}`. 최신 마이그레이션 = **V13**(→ 신규 = **V14**).

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1 | 2026-07-21 | FC-081 착수 — 마감 워커 동시성 모델·SOLD/UNSOLD TX 절차·settlement 스키마(V14)·seller 지급·business fee·불변식·상태 전이표·계약/erd 델타 초안. 게이트2 상신 5항목 정리 |
| v1.0 | 2026-07-21 | **게이트2 전건 승인 반영** — #1 스키마(sale_order + V14: fee_amount NOT NULL·fee_policy_version·source UK), #2 마감 워커(SCHEDULED 포함 스캔·분산락 불요), #3 seller 게임머니 크레딧, #5 수수료 SOLD TX 내 1회. **#4 business fee = ④-C 확정**(전용 수익 원장 `platform_revenue_ledger`, §2.3·§4.6 재작성). 게임머니 총량 보존 불변식 I-H 신설(§6). erd v1.3·api-contract v1.12에 확정 반영. FC-082(워커)·083(SOLD)·084(UNSOLD) 인계 계약 확정 |

---

## 1. 문제 정의 — 왜 마감 워커가 필요한가

EPIC-BID까지 auction의 종료 상태(SOLD/UNSOLD)는 **누구도 쓰지 않는다**. 입찰은 마감을 **시각 기준**(`now >= end_at`)으로만 거부하고
(bid-domain-spec §3.2), status는 SCHEDULED/ACTIVE로 고인 채 남는다. 상세/목록의 status는 표시층에서 lazy 파생될 뿐이다(`Auction.displayStatus`).

EPIC-CLOSING이 이 공백을 닫는다: **마감 시각이 지난 경매를 실제 종료 상태로 영속 전이**하고, 그에 수반하는 금전·소유 정산을 원자적으로 수행한다.
- 입찰이 있었던 경매 → **SOLD**: 최고 입찰자가 낙찰. 홀드 확정 차감(CAPTURED) + 판매자 정산 지급 + 수수료 귀속 + 아이템 소유 이전.
- 입찰이 없었던 경매 → **UNSOLD**: 유찰. 아이템 판매자 반환(에스크로 해제). 금전 이동 없음(홀드 0건).

### 1.1 ★ SCHEDULED도 마감 대상이다 (놓치기 쉬운 지점)

입찰 없이 마감된 경매의 영속 status는 **여전히 SCHEDULED**일 수 있다. `start_at`이 미래인 예약 경매는 SCHEDULED로 등록되고,
영속 승격(SCHEDULED→ACTIVE)은 **첫 입찰이 성립할 때만** 일어난다(bid-domain-spec §5). 따라서 "예약 경매가 입찰 0건으로 마감 시각을 지난"
경우 영속값은 SCHEDULED에 고정된다(lazy 파생은 표시층 전용이라 DB를 바꾸지 않는다).

- **결론**: 마감 워커의 후보 스캔은 `status = 'ACTIVE'` 만이 아니라 **`status IN ('SCHEDULED','ACTIVE') AND end_at <= now`** 여야 한다.
  SCHEDULED-무입찰-마감은 UNSOLD로 종결된다(highest_bidder_id IS NULL 경로).
- 인덱스 `auction (status, end_at)`(erd §5, V10 존재)는 status 선두 복합이라 `status IN (2값) AND end_at<=now` 를 status별 range 스캔으로 커버한다.
  **신규 인덱스 불요**(erd §5 `(status, start_at)`는 예약 개시 트리거용이며 마감 스캔과 무관).

---

## 2. settlement 스키마 (V14) — 게이트2 승인 확정 ①

### 2.1 결론(승인): 신규 `settlement` 테이블도, `auction` 컬럼 확장도 아닌 — **기존 `sale_order` 테이블을 쓴다**

FC-081 지시는 "`settlement` 신규 테이블 vs `auction` 컬럼 확장"의 택일을 물었으나, **계약이 이미 제3의 답을 확정해 두었다**:
`sale_order`(erd v1.2 §4.2)는 판매 성립(SOLD) 거래 레코드로 이미 `final_price`·`fee_amount`·`settle_amount`·`status(SETTLED)`·`settled_at`을
정의하고 있고, fee-policy-spec v1.0(§3·§7)·api-contract v1.11(§4.3)이 모두 `sale_order`를 정산 기록의 정본으로 지목한다.
`sale_order`는 경매 낙찰과 shop 구매·즉시구매를 **단일 핸드오프로 수렴**시키도록(source_type/source_id 폴리모픽) 설계된 테이블이다(erd §1 Order명 확정 주).

| 선택지 | 평가 |
|---|---|
| **A. 기존 `sale_order` 사용 (추천)** | 계약·erd·fee-policy-spec 3중 정합. 낙찰·즉시구매·shop 구매가 한 테이블로 수렴 → EPIC-SHOP·BUYNOW에서 재작업 0. fee_amount/settle_amount 자리 이미 존재. `GET /orders/{id}`(후속) 계약이 이미 이 테이블을 읽는다 |
| B. 신규 `settlement` 테이블(auction_id 직결) | **이중 진실**: sale_order와 정산 기록이 갈라진다. shop/즉시구매 편입 시 통합 재설계 필요. fee-policy-spec·계약 §4.3가 가리키는 sale_order를 우회 → 문서 드리프트. **기각 권고** |
| C. `auction` 컬럼 확장(fee/settle를 auction에) | 리스팅 상태 테이블에 거래 결과를 섞는다(관심사 혼재). shop과 대칭 불가(shop에도 같은 컬럼 복제해야). result 조회가 auction 행 잠금과 경합. **기각 권고** |

**승인 = A(`sale_order`).** 아래 2.2가 V14에서 그 테이블을 생성한다(현재 DB 미존재 — erd §6 group4 "sale_order는 후속 에픽 V12+" 이연분).

### 2.2 V14 마이그레이션 (backend-impl 소유 · architect는 스키마 형태만 규정)

> **architect는 코드·마이그레이션을 쓰지 않는다.** 아래는 확정 스키마 **형태**이며 실제 `V14__sale_order_and_settlement.sql` 작성·채번은 backend-impl 소유다.
> 게이트2 승인으로 `sale_order` + `platform_revenue_ledger`(§2.3, ④-C)를 **한 마이그레이션**에 담는다(FK 의존 ledger→sale_order라 sale_order 먼저 — money_hold가 bid와 V11 한 파일인 선례).

`sale_order` 테이블 생성(erd v1.2 §4.2 정의 준수) + **정산 감사 컬럼 1건 추가 제안**:

| 컬럼 | 타입 | 널 | 키 | 비고 |
|---|---|---|---|---|
| id | BIGINT | N | PK | AUTO_INCREMENT |
| public_id | CHAR(26) ULID | N | UK | 외부 식별자(B-004). `GET /orders/{id}` 경로 리소스 |
| source_type | VARCHAR(20) ENUM | N | | AUCTION / SHOP. **코어는 AUCTION만 기록**(SHOP=EPIC-SHOP) |
| source_id | BIGINT | N | | 출처 리스팅 id(= auction.id) |
| buyer_id | BIGINT | N | FK→user | 낙찰자(winner) |
| seller_id | BIGINT | N | FK→user | 판매자 |
| item_instance_id | BIGINT | N | FK→item_instance | 이전 대상 |
| final_price | BIGINT | N | | 최종 낙찰가(= 낙찰 bid.amount) |
| fee_amount | BIGINT | N | | 플랫폼 수수료(판매자 단독, fee-policy-spec). SOLD 성립분이라 **NOT NULL**(erd는 자리 잔존용 널 허용이나 실기록은 항상 값 존재 — 아래 주) |
| settle_amount | BIGINT | N | | 판매자 정산액 = final_price − fee_amount |
| fee_policy_version | VARCHAR(10) | N | | **신규 제안** — 적용 수수료 정책 버전(예: `v1.0`). 정산 후 환불 비례 크레딧(fee-policy-spec §5)이 "당시 정책"을 알아야 함. 감사·재현성 |
| status | VARCHAR(20) ENUM | N | | SETTLED(내부 DB 단일 TX) |
| settled_at | DATETIME(6) | N | | 정산 완료 시각 |
| created_at | DATETIME(6) | N | | `BaseCreatedEntity`(불변 원장 — SETTLED 1회 기록, updated_at 없음. item_ownership_history 선례. FC-083 M3 정정) |

인덱스(erd §5 정의 준수): `(source_type, source_id)` · `(buyer_id)` · `(seller_id)`.
유니크(중복 성립 방지 보강): `(source_type, source_id)` 를 **UK로 승격 제안** — 동일 경매가 두 번 SOLD 핸드오프되는 것을 DB에서 차단(idempotency 최종 방어선, §6 I-C). erd §5는 이를 일반 인덱스로 두었으나 코어의 이중 정산 방지를 위해 UK 승격을 상신한다.

**erd 델타(게이트2 승인 반영 — erd v1.3 확정)**:
- `sale_order.fee_amount` 널 → **NOT NULL**(SOLD에서만 생성되므로 항상 값 존재. 취소/유찰은 애초에 sale_order 미생성).
- `fee_policy_version` 컬럼 신설.
- `(source_type, source_id)` 인덱스 → **UK 승격**.
- `platform_revenue_ledger` 테이블 신설(§2.3, ④-C).
- Flyway §6 group4에 `V14__sale_order_and_settlement.sql` 실물 채번 등재.

### 2.3 `platform_revenue_ledger` — 사업자 수익 원장 (④-C 확정)

수수료(`fee_amount`)의 귀속처(게이트2 #4 = ④-C). **플랫폼을 user로 두지 않고**(그 계정이 입찰·판매 주체로 오염될 리스크 회피) 전용 **append-only 원장**에 수익을 적립한다.
정산 1건당 수익 1행(1:1). 이 테이블이 "사업자 게임머니 총수익 = `SUM(amount)`"의 정본이며, 게임머니 총량 보존(I-H)의 회계 한 축이다.

| 컬럼 | 타입 | 널 | 키 | 비고 |
|---|---|---|---|---|
| id | BIGINT | N | PK | AUTO_INCREMENT |
| sale_order_id | BIGINT | N | **UK**, FK→sale_order | 정산 1건당 수익 1행(1:1). UK가 **수수료 이중 적립을 DB 차단**(I-C·I-H 연동) |
| amount | BIGINT | N | | 적립 수익 = 그 정산의 `sale_order.fee_amount`(계산기 1회 산출값, 재계산 없음) |
| fee_policy_version | VARCHAR(10) | N | | 적용 정책 버전 스냅샷(sale_order와 동일 값. 감사·환불 크레딧 재현) |
| created_at | DATETIME(6) | N | | 적립 시각. `BaseCreatedEntity`(불변 원장 — updated_at 없음, item_ownership_history 선례) |

- `public_id` 없음 — 외부 노출 리소스가 아니다(내부 회계 원장. money_hold·money_exchange 선례).
- 인덱스: `sale_order_id` UK가 조회·정합을 겸한다. 별도 보조 인덱스 불요(코어). 기간별 수익 집계는 후속 대시보드 도입 시 `(created_at)` 추가 검토.
- 패키지: `domain/settlement/*`(신규 — `SaleOrder`·`SaleOrderRepository`·`PlatformRevenueLedger`·`PlatformRevenueLedgerRepository`·`FeeCalculator`·`FeePolicyProperties`·`CloseWorker`·`CloseService`). currency(홀드)와 분리해 정산 표면을 응집한다.

---

## 3. 마감 워커 동시성 모델 — 게이트2 승인 확정 ②

### 3.1 폴링 + idempotent CAS 전이

```
@Scheduled(fixedDelay = <T>)  // 예: 1~5초. 값은 게이트2 확정(운영 부하·마감 지연 허용치 트레이드오프)
CloseWorker.sweep():
  now = Instant.now()
  ids = auctionRepository.findClosableIds(now, LIMIT batchSize)
        // SELECT a.id FROM auction a
        //  WHERE a.status IN ('SCHEDULED','ACTIVE') AND a.end_at <= :now
        //  ORDER BY a.end_at ASC   -- 오래 밀린 것부터
        //  LIMIT :batchSize        -- 인덱스 (status, end_at) 커버
  for each id in ids:
      closeService.closeOne(id)   // ★ 경매 1건 = 독립 트랜잭션 (아래 3.2)
```

- **후보 스캔과 실제 전이를 분리**한다. 스캔은 락 없이(짧게) 후보 id만 뽑고, 전이는 경매 1건씩 **독립 TX + 행 락**으로 처리한다.
  한 경매의 실패가 배치 전체를 롤백하지 않고, 락 보유 구간이 경매 1건으로 좁아진다.
- `LIMIT batchSize`로 한 tick의 처리량을 제한(예: 100~500)해 tick 지연 시 폭주를 방지한다. 못 딴 후보는 다음 tick이 재스캔한다
  (domain-spec §9 "DB가 진실, 인덱스는 재구축" — 워커 재시작·유실에도 스캔이 복구선).

### 3.2 `closeOne(auctionId)` — idempotent · 다중 인스턴스 안전

```
@Transactional
closeOne(auctionId):
 1. auction 행 배타 락 + 스냅샷 읽기
      @Lock(PESSIMISTIC_WRITE) SELECT ... FOR UPDATE  (AuctionCloseContext 프로젝션)
      → 필요한 값(id·seller_id·status·end_at·highest_bidder_id·highest_bid_amount·item_instance_id·result_type)을 지역 변수로 복사
 2. 재검증 (락 스냅샷 근거):
      status IN (SCHEDULED, ACTIVE) 인가?   아니면 → return(이미 종결. 다른 인스턴스가 처리함 = 정상)
      end_at <= now 인가?                    아니면 → return(소프트클로즈 막판 연장으로 마감이 밀렸다 = §3.3)
 3. 분기:
      highest_bidder_id IS NOT NULL → SOLD 절차(§4)
      highest_bidder_id IS NULL     → UNSOLD 절차(§5)
COMMIT → 행 락 해제
```

- **idempotency의 핵심 = 행 락 하 재검증 + 종료성 CAS**. 두 워커 인스턴스가 같은 경매를 동시에 집어도, 먼저 락을 쥔 쪽이 SOLD/UNSOLD로
  전이하고 커밋하면, 뒤이어 락을 얻은 쪽은 2단계에서 `status ∉ (SCHEDULED,ACTIVE)`를 보고 조용히 return한다(부작용 0).
- 최종 auction UPDATE도 **조건부 CAS**(`WHERE status IN ('SCHEDULED','ACTIVE') AND end_at <= :now`)라 영향행 0이면 롤백·재시도가 아니라
  "이미 처리됨"으로 판정한다(bid-domain-spec §4.6.2 CAS 0행 원인판정 규칙과 동류).
- **동일 행 락을 입찰과 공유**한다: 마감 전이는 입찰(bid-domain-spec §4.1)과 **같은 auction 행**을 `FOR UPDATE`로 잡는다.
  진행 중인 입찰 TX가 있으면 워커가 그 뒤에서 대기하고, 락을 얻었을 때는 그 입찰이 반영된 최신 `end_at`·`highest_bidder_id`를 본다 →
  "입찰과 마감의 경합"이 DB 직렬화로 자동 해소된다(별도 조정 불요).

### 3.3 소프트클로즈 막판 연장과의 경합

후보 스캔(3.1) 시점엔 `end_at <= now`였더라도, 스캔~락획득 사이에 막판 유효 입찰이 소프트클로즈로 `end_at`을 연장했을 수 있다.
- 3.2의 2단계 재검증이 락 스냅샷의 **최신 end_at**을 다시 보므로, 연장으로 `end_at > now`가 됐으면 **마감하지 않고 return**한다.
  그 경매는 새 `end_at`이 지나면 다음 tick이 다시 후보로 잡는다.
- 이 재검증이 bid-domain-spec I8("연장이 커밋된 뒤의 입찰은 새 end_at 기준으로 판정")의 마감측 대칭이다.

### 3.4 재시도·장애

- `closeOne` 내부 예외(정합 위반·인프라 오류)는 해당 경매 TX만 롤백하고 로깅한다. 다음 tick이 재스캔하므로 **자동 재시도**된다.
- 데드락(`DeadlockLoserDataAccessException`) 발생 시에도 롤백 후 다음 tick 재시도로 수렴한다(잔액 행 락 순서는 §4.4 참조).
- 워커 다중 인스턴스(수평 확장)는 3.2의 CAS로 안전하다 — **분산락(Redisson) 불요**(bid-domain-spec §4 정합, watchdog 없는 임대 배제).

---

## 4. 낙찰(SOLD) TX 절차 — 게이트2 승인 확정 ③④⑤

전제: `highest_bidder_id IS NOT NULL`. 경매 행 배타 락 아래(§3.2). 최종가 `P = highest_bid_amount`.

### 4.1 절차 (실행 순서 — PC clear 함정 회피)

`UserBalanceRepository`의 `capture`/`increaseGameMoney`는 `clearAutomatically`라 **영속성 컨텍스트를 통째로 비운다**
(bid-domain-spec §4.2). 따라서 모든 상태 전이는 **@Modifying CAS** 또는 **fresh INSERT(getReferenceById FK)** 로 수행하고,
판정 근거는 잔액 호출 **전에** 지역 변수로 복사한다.

```
 1. 낙찰 bid 식별   : bidRepository.findActiveByAuctionId(auctionId)   → winnerId, winBidId, winAmount(=P)
                      경매당 ACTIVE 입찰은 최대 1건(I1)이라 단건 바인딩 안전. 없으면 불변식 위반 → 예외(롤백)
 2. 수수료 계산 1회 : fee = FeeCalculator.compute(P)   (순수 함수 — 누진→반올림→cap→최소, §4.2)
                      settle = P − fee
 3. bid WON        : bidRepository.markWonIfActive(winBidId)  @Modifying CAS(WHERE status='ACTIVE')  assert 1행
 4. 홀드 확정 차감  : moneyHoldService.capture(winBidId)        (§4.3, HELD→CAPTURED + 실차감)  assert 성공
 5. 판매자 정산 지급: userBalanceRepository.increaseGameMoney(sellerId, settle)  assert 1행     (§4.5)
 6. 아이템 소유 이전: itemInstanceRepository.transferToBuyer(itemInstanceId, winnerId, targetSlot|null)
                      @Modifying CAS(WHERE location='LISTED') owner_id=winner, location=INVENTORY(slot)|TEMP  (§4.4)
                      + 이력 INSERT: item_ownership_history(TRADE, sale_order_id)  (§4.4)
 7. 거래 레코드    : saleOrderRepository.saveAndFlush(sale_order: source=AUCTION/auctionId, buyer=winner, seller,
                      item, final_price=P, fee_amount=fee, settle_amount=settle, fee_policy_version, SETTLED, settled_at=now)
                      → order.id 획득. (source_type,source_id) UK가 이중 SOLD를 여기서 차단(I-C)
 8. 사업자 수익 적립: platformRevenueLedgerRepository.saveAndFlush(ledger: sale_order_id=order.id, amount=fee,
                      fee_policy_version, created_at=now)   (§4.6, ④-C. sale_order_id UK가 이중 적립 차단 = I-H 정합)
 9. 경매 종료 전이  : auctionRepository.markSoldIfClosable(auctionId, now)
                      @Modifying CAS  SET status='SOLD', result_type='BID'
                      WHERE status IN ('SCHEDULED','ACTIVE') AND end_at <= :now     assert 1행
```

- 6단계 slot 계산: 낙찰자 인벤토리 여유를 조회(`countByOwnerIdAndLocation` / `findOccupiedSlotNos`)해 빈 슬롯 배정, 만실이면 TEMP(오버플로우).
  slot 이중배정 최종 방어는 `slot_key` UK(erd §4.3, `InventoryService.releaseFromListing` 선례). 커밋 전 flush로 위반을 표면화.
- 7·8·9의 순서: sale_order INSERT(7)를 수익 적립(8)·auction 전이(9)보다 먼저 두어, `(source_type, source_id)` UK(§2.2)가 **동일 경매 이중 SOLD**를
  7단계에서 즉시 차단하게 한다(이중 정산 방지, I-C). 8단계 `platform_revenue_ledger.sale_order_id` UK는 그 정산에 대한 수익 이중 적립을 차단한다(I-H).
- `highest_bidder_id`·`highest_bid_amount`는 이미 입찰 TX가 세팅해 뒀으므로 SOLD 전이에서 **덮어쓰지 않는다**(9단계는 status·result_type만).

### 4.2 수수료 계산기 (fee-policy-spec 정합)

- **단일 책임 계산기**(예: `FeeCalculator`/`FeePolicy` 빈, currency 또는 신규 settlement 패키지). 입력 `long finalPrice`, 출력 `long feeAmount`.
- 순서 **엄수**(fee-policy-spec §3): ① 구간별 누진 raw_fee → ② 원단위 사사오입(round half up) → ③ cap(min 300,000) → ④ 최소(max 100).
- cap·최소 클램프는 **계산기 내부**에서 한다(fee-policy-spec §7 — 호출부가 아니라 계산기가 단일 책임).
- 구간표·최소·cap은 `@ConfigurationProperties + @Validated`로 바인딩 권고(컴파일 상수 금지, CLAUDE.md 섹션 4. `BidIncrementProperties` 선례).
  `fee_policy_version`은 이 설정의 버전 문자열과 일치시킨다.
- **엣지(fee-policy-spec §4 주)**: `P < 100`이면 `settle = P − 100 < 0` 가능. 현행 리스팅 최소 시작가가 이 대역을 배제하므로 비저촉이나,
  구현 시 `settle < 0` 방어(예: fee = min(fee, P))를 관찰 항목으로 둔다(정책 미결 — 상신 대상 아님).

### 4.3 홀드 확정 차감 (HELD→CAPTURED) — 게이트2 승인 확정 ③ 일부

낙찰자의 홀드된 게임머니가 **실제로 계정을 떠난다**. 현재 홀드는 `user_balance.game_money_held`에 묶여 있고 `game_money_balance`는 그대로다.
차감 확정은 두 값을 동시에 줄여야 한다:

```
UserBalanceRepository.capture(userId, amount):   -- 신규 메서드 제안(backend-impl 소유)
  UPDATE user_balance
     SET game_money_balance = game_money_balance - :amount,
         game_money_held    = game_money_held    - :amount
   WHERE user.id = :userId
     AND game_money_held    >= :amount
     AND game_money_balance >= :amount
  -- 영향행 0 = 홀드/잔액 불일치 = 불변식 위반 → 예외(롤백)
```

```
MoneyHoldService.capture(bidId):   -- 신규 메서드 제안 (Propagation.MANDATORY, 호출자 TX 참여)
  snapshot = moneyHoldRepository.findHeldByBidId(bidId).orElseThrow()  -- HELD 최대 1건(bid_id UK)
  userBalanceRepository.capture(snapshot.userId, snapshot.amount)      -- 실차감, assert 1행
  moneyHoldRepository.captureIfHeld(snapshot.holdId, now)              -- @Modifying CAS HELD→CAPTURED, assert 1행
```

- `captureIfHeld`는 `releaseIfHeld`(현존)와 대칭인 신규 CAS(`WHERE status='HELD'` → CAPTURED). 이중 차감 불가(영향행 0 = 불변식 위반).
- **불변식 유지**: capture 후 낙찰자 `game_money_held`가 `amount`만큼 감소하고 HELD 홀드가 CAPTURED로 빠지므로 I4(held == SUM(HELD))가 보존된다.
- 순서: `capture`가 PC를 clear하므로 이 호출은 4.1의 다른 managed-entity 의존 작업보다 뒤/독립이어야 한다(4.1 순서가 이를 만족).

### 4.4 아이템 소유 이전

- 낙찰자 = 신규 소유자. `item_instance`: `owner_id → winnerId`, `location LISTED→INVENTORY(빈 슬롯)` 또는 만실 시 `TEMP`(+ temp_storage 행).
  현존 `InventoryService.releaseFromListing`은 **소유자 불변**(판매자 반환)이라 그대로 못 쓴다 → 낙찰용 **신규 이전 메서드** 필요.
- 전이는 CAS(`WHERE location='LISTED'`)로 단일 승자 보장(중복 이전 차단). PC clear 뒤라 dirty-checking 대신 `@Modifying` CAS 권고.
- `item_ownership_history` append: `from_owner_id=sellerId, to_owner_id=winnerId, transfer_type=TRADE, sale_order_id=<신규 order id>, transferred_at=now`.
  (TransferType.TRADE는 현재 미사용 enum값 — EPIC-CLOSING이 첫 사용, 주석 명시대로.)
- slot UK 위반은 `InventoryService` 선례대로 flush 시 매핑. (마감 경로는 낙찰자 1인이라 동시 slot 경합 표면은 작지만 방어선 유지.)

### 4.5 seller 지급 원장 모델 — 게이트2 승인 확정 ③

- 방식 = **게임머니 크레딧**(`increaseGameMoney(sellerId, settle_amount)`, 현존 메서드 재사용 — 교환 입금 선례). 잔액 `game_money_balance += settle`.
- **분개(에스크로 정합)**: 낙찰자 홀드 `CAPTURED = P`(4.3, 계정에서 P 유출) → 그중 `settle`이 판매자 잔액으로 유입, `fee`는 사업자 수익 원장으로 적립(§4.6 ④-C).
  즉 `P = settle + fee`가 항상 성립(불변식 I-B). **게임머니 총량 보존**은 사용자 잔액 + 수익 원장을 합쳐 성립한다(I-H) — 유출 `P` = 유입 `settle`(판매자) + `fee`(원장).
- **별도 seller 지급 원장 테이블은 두지 않는다(코어)**. `sale_order`(settle_amount·settled_at)가 지급 기록의 정본이다. money_hold(CAPTURED)와
  sale_order(SETTLED)가 매수측 유출·매도측 유입의 이중 기록을 이룬다. 전용 크레딧 원장(money_credit 등)은 후속(환불 크레딧 도입 시) 재검토.

### 4.6 business fee 귀속 — ④-C 확정 (전용 수익 원장)

게이트2 #4 = **④-C**. `fee_amount`을 전용 append-only 원장 `platform_revenue_ledger`(§2.3)에 적립한다. SOLD TX 8단계(§4.1)에서
`sale_order` INSERT 직후 `sale_order_id`를 참조해 수익 1행을 INSERT한다.

```
platformRevenueLedgerRepository.saveAndFlush(PlatformRevenueLedger.builder()
    .saleOrder(saleOrderRepository.getReferenceById(orderId))   -- FK 프록시(PC clear 뒤라 재조회 없이 참조만)
    .amount(fee)                                                -- 계산기 1회 산출값(재계산 금지)
    .feePolicyVersion(version)
    .build());                                                  -- sale_order_id UK가 이중 적립을 DB 차단
```

- **선택 근거(사용자 확정)**: (1) **게임머니 총량 보존** — fee가 소멸하지 않고 원장에 적립되어 "사용자 잔액 합 + 원장 합"이 SOLD 전후 불변(I-H).
  (2) **회계/감사 추적** — 정산별 수익을 개별 행으로 추적, 환불 비례 크레딧(fee-policy-spec §5) 도입 시 원 수익 행을 근거로 되돌릴 수 있다.
- **플랫폼을 user로 두지 않은 이유**(④-B 대비): 플랫폼 user 계정은 입찰·판매·탈퇴 등 거래 주체 경로로 오염될 표면이 있고, 그 계정을 모든 도메인 검증에서
  예외 처리해야 한다. 전용 원장은 그 표면이 없다(읽기·집계 전용).
- `fee`는 **계산기 1회 산출값**을 sale_order와 ledger에 동일 기재한다(단일 진실 — 두 곳에서 재계산하지 않는다).
- 후속(정산 대시보드·실화폐)에서 원장에 기간·유형 축을 확장하거나 정산 배치를 붙일 수 있다(스키마 확장은 그때 게이트2). fee-policy-spec §8과 정합.

---

## 5. 유찰(UNSOLD) TX 절차

전제: `highest_bidder_id IS NULL`(입찰 0건). 경매 행 배타 락 아래(§3.2).

```
 1. 홀드 없음 확인 : 입찰 0건이므로 HELD money_hold도 0건(I3). 방어적으로 assert(없어야 정상). 금전 이동 없음.
 2. 아이템 반환   : inventoryService.releaseFromListing(item)   -- 현존 메서드 재사용(LISTED→INVENTORY/만실 TEMP, 소유자=판매자 불변)
 3. 경매 종료 전이 : auctionRepository.markUnsoldIfClosable(auctionId, now)
                    @Modifying CAS  SET status='UNSOLD'   (result_type 그대로 NULL 유지)
                    WHERE status IN ('SCHEDULED','ACTIVE') AND end_at <= :now   assert 1행
```

- `result_type`은 **NULL 유지**(SOLD가 아니므로 BID/BUYNOW 어느 것도 아님). erd §4.2 `result_type` 널 허용과 정합.
- `sale_order` **미생성**(fee-policy-spec §5: 유찰 → 수수료 0, sale_order 없음).
- 2단계 `releaseFromListing`은 별도 빈 경유(self-invocation 아님) 동일 TX 참여 → 실패 시 UNSOLD CAS까지 롤백(원자성).
- **2·3 순서**: 아이템 반환(2)을 auction 전이(3)보다 먼저 두면, releaseFromListing 실패(예: slot UK) 시 전이 전에 롤백된다. 순서가 바뀌어도
  단일 TX라 정합성은 동일하나, 아이템 반환 실패를 먼저 표면화하는 편이 진단에 유리하다.

---

## 6. 불변식 목록 (reviewer/테스트 정본)

bid-domain-spec §10(I1~I10)을 승계하고, 마감·정산 고유 불변식을 추가한다. 테스트는 **DB 상태 직접 검증**(응답 아님).

| # | 불변식 | 위반 시 의미 |
|---|---|---|
| **I-A** | 마감된 경매는 정확히 `status ∈ {SOLD, UNSOLD}`(또는 판매자 취소분 CANCELLED). SOLD ⟺ `highest_bidder_id IS NOT NULL` ∧ `result_type='BID'` ∧ sale_order 1건 존재. UNSOLD ⟺ `highest_bidder_id IS NULL` ∧ `result_type IS NULL` ∧ sale_order 0건 | 분기 오류(입찰 있는데 UNSOLD 등) |
| **I-B** | SOLD 1건에 대해 `final_price = settle_amount + fee_amount`, 그리고 `fee_amount = FeeCalculator(final_price)`(재현 가능), `final_price = 낙찰 bid.amount = auction.highest_bid_amount` | 정산 금액 드리프트·수수료 재계산 불일치 |
| **I-C** | 경매당 SOLD 핸드오프는 **정확히 1회**. `sale_order (source_type, source_id)` UK가 이중 SOLD를 DB에서 차단. 워커 다중 실행·재시도에도 sale_order·CAPTURED·소유이전이 **중복 발생하지 않는다** | 이중 정산(수수료·소유 이전 중복) |
| **I-D** | SOLD 시 낙찰자 홀드는 `HELD→CAPTURED` 1회 전이, `game_money_held`가 정확히 `P`만큼 감소하고 `game_money_balance`도 `P`만큼 감소. 판매자 `game_money_balance`가 `settle`만큼 증가. (I4·I5는 capture 후에도 보존) | 에스크로 정합 파괴(무자본 획득·자금 동결) |
| **I-E** | SOLD 후 `item_instance.owner_id = winnerId` ∧ `location ∈ {INVENTORY, TEMP}` ∧ `item_ownership_history`에 (seller→winner, TRADE, sale_order_id) 1행 append. UNSOLD 후 `owner_id = sellerId`(불변) ∧ `location ∈ {INVENTORY, TEMP}` ∧ 이력 append 없음 | 소유 이전 누락·오귀속 |
| **I-F** | 마감 전이는 **idempotent**. 같은 경매에 `closeOne`을 N회(동시 포함) 호출해도 SOLD/UNSOLD 1회분 효과만 남는다(2회차부터 CAS 0행 → 무부작용 return) | 다중 인스턴스·재시도 이중 처리 |
| **I-G** | `end_at`이 (막판 연장으로) `now`를 넘긴 경매는 마감되지 않는다. 마감 판정 근거는 **락 스냅샷의 최신 end_at**이다 | 연장 무시 조기 마감 |
| **I-H** | **게임머니 총량 보존** — SOLD TX 전후로 `SUM(user_balance.game_money_balance) + SUM(platform_revenue_ledger.amount)` 가 **불변**. SOLD 델타: 낙찰자 `−final`, 판매자 `+settle`, 원장 `+fee`, 그리고 `final = settle + fee` ⟹ 합 0. `platform_revenue_ledger.sale_order_id` UK가 수수료 이중 적립을 차단해 원장 합이 정산당 정확히 `fee` 1회분만 증가한다. UNSOLD는 금전 이동 0이라 자명 보존 | 게임머니 생성·소멸(무자본 획득 / 수익 누락·이중 적립) |

각주(FC-176, I-B 강화 — 2026-08-03 게이트2 승인): 모든 SOLD 정산에서 `0 ≤ fee_amount ≤ final_price` ⟹ **`settle_amount ≥ 0`**. 판매는 판매자 잔액을 절대 감소시키지 않는다. 소액(`final_price < minFee`) 매물에서 `settle=final_price−minFee`가 음수가 되던 결함은 `FeeCalculator`의 판매가 클램프(`fee = min(fee, final_price)`, fee-policy-spec §3 5단계)로 봉인됐다. 계약·형상 변경 없음.

**필수 시나리오(테스트)**:
1. SOLD 정상 — 입찰 1건 후 마감 → CAPTURED·판매자 크레딧·소유 이전·sale_order 1건. I-A·I-B·I-D·I-E.
2. UNSOLD 정상 — 입찰 0건 예약(SCHEDULED)·진행(ACTIVE) 각각 마감 → UNSOLD·아이템 반환·sale_order 0건. I-A·I-E. **SCHEDULED 무입찰 마감 포함(§1.1)**.
3. idempotency — 동일 경매 `closeOne` 동시 N회 → 정확히 1회 효과. I-C·I-F.
4. 소프트클로즈 경합 — 스캔 직후 막판 입찰이 end_at 연장 → 그 tick은 마감 skip, 연장분 지나면 다음 tick 마감. I-G.
5. 마감 vs 진행 입찰 경합 — 마감 워커와 유효 입찰이 같은 auction 행에 경합 → 직렬화(입찰 반영 후 마감, 또는 마감 후 입찰 BID_006). bid-domain-spec I8 대칭.
6. 이중 정산 방지 — sale_order UK 위반 경로 → 2회차 SOLD 시도가 DB에서 차단. I-C.
7. **게임머니 총량 보존** — SOLD 전후 `SUM(game_money_balance) + SUM(ledger.amount)` 동일. 낙찰자 −final·판매자 +settle·원장 +fee, `final=settle+fee` 검증. cap/최소 저촉 매물(고액·소액) 포함해 계산기 경계에서도 보존. I-H·I-B·I-D.

---

## 7. 상태 전이표

### 7.1 auction.status (EPIC-CLOSING이 채우는 종료 전이)

| from | to | 트리거 | 조건(CAS WHERE) | result_type |
|---|---|---|---|---|
| SCHEDULED / ACTIVE | SOLD | 마감 워커 · 낙찰 | `status IN (SCHEDULED,ACTIVE) AND end_at<=now` ∧ highest_bidder_id NOT NULL | BID |
| SCHEDULED / ACTIVE | UNSOLD | 마감 워커 · 유찰 | `status IN (SCHEDULED,ACTIVE) AND end_at<=now` ∧ highest_bidder_id NULL | NULL 유지 |
| SCHEDULED / ACTIVE | CANCELLED | 판매자 취소(EPIC-AUCTION, 기존) | 입찰 0건 | NULL |

- 즉시구매(SOLD/result_type=BUYNOW)는 **범위 밖**(후속 BUYNOW 에픽). 본 스펙은 result_type=BID만 세팅한다.

### 7.2 bid.status

| from | to | 트리거 |
|---|---|---|
| ACTIVE | WON | SOLD 마감 시 낙찰 bid(경매당 1건) |
| ACTIVE | OUTBID | 상위 입찰(EPIC-BID, 기존) |

- UNSOLD·CANCELLED 경매의 bid는 별도 전이 없음(입찰 0건이므로 애초에 ACTIVE bid 부재).

### 7.3 money_hold.status

| from | to | 트리거 |
|---|---|---|
| HELD | CAPTURED | SOLD 마감 시 낙찰자 홀드 확정 차감(§4.3) |
| HELD | RELEASED | 상위 입찰 즉시 해제(EPIC-BID, 기존) |

- 마감 시점 경매당 HELD는 최대 1건(= 최고입찰자, I3). SOLD면 그 1건이 CAPTURED, UNSOLD면 HELD 0건.

---

## 8. api-contract 델타 — 게이트2 승인 확정 (계약 파급)

**코어는 신규 엔드포인트를 추가하지 않는다**(마감 = 내부 워커, 외부 API 없음). 계약 파급은 **기존 응답 필드의 채워짐(semantic)** 뿐이다.

| 대상 | 현재(EPIC-BID까지) | EPIC-CLOSING 이후 |
|---|---|---|
| `AuctionDetail.resultType` | 항상 null | SOLD면 `BID`. UNSOLD/CANCELLED/진행중은 null |
| `AuctionDetail.status` (표시 파생) | SCHEDULED/ACTIVE lazy 파생 | 마감 후 **영속 SOLD/UNSOLD**가 그대로 노출(lazy 파생 불필요) |
| `AuctionDetail.highestBidderMasked` | 입찰 있으면 채워짐(EPIC-BID) | SOLD면 낙찰자 = 이 값(불변) |
| `AuctionDetail.minNextBidAmount` | 진행중 값 | 종료 상태(SOLD/UNSOLD)면 null (기존 `isClosed` 분기가 자동 처리 — **코드 변경 불요**) |
| `BidSummary.status` (`GET /auctions/{id}/bids`) | ACTIVE/OUTBID | 낙찰 bid는 `WON` 노출(계약 §3.3에 이미 정의된 값 — 값이 실제로 나타나기 시작) |

- `GET /me/orders`·`GET /orders/{id}`(거래내역, 계약 §4.3)는 **범위 밖**(후속). sale_order 데이터는 코어가 생성하지만 **읽는 엔드포인트는 미구현**.
  프론트는 낙찰 결과를 당분간 경매 상세(status=SOLD·resultType=BID·highestBidderMasked)로만 표시한다.
- **계약 필드 집합·에러코드 무변경.** 값의 의미가 채워질 뿐이라 6절 계약 변경 절차상 "semantic 명확화"에 해당(신규 필드 없음).

---

## 9. 프론트 영향

- **마감 판정 이원화 유지 + 서버 수렴**: 프론트는 지금처럼 `now >= endAt`으로 클라 마감을 표시(카운트다운 종료)하되, 이제 **서버 status도 뒤이어
  SOLD/UNSOLD로 따라온다**(워커 tick 간격만큼 지연). 즉 "카운트다운 0 → 잠시 후 서버가 SOLD/UNSOLD 확정"이라는 **짧은 전이 구간**이 존재한다.
  프론트는 이 구간을 "마감 처리 중"으로 표기하거나, 폴링/재조회로 최종 status를 갱신한다.
- **낙찰 표시**: 상세 `status=SOLD` + `resultType=BID` + `highestBidderMasked`(낙찰자)로 낙찰 결과를 렌더. 입찰 내역의 `status=WON` 배지.
- **유찰 표시**: `status=UNSOLD`. 최고가·낙찰자 없음.
- **거래내역 화면은 후속**: 낙찰자/판매자의 주문 목록·정산 상세 UI는 `GET /me/orders`·`/orders/{id}` 구현(후속 에픽) 뒤에 착수. 코어에서는 미노출.
- **본인 낙찰 후속(잔액·인벤토리)**: 낙찰자는 게임머니가 실제 차감되고(CAPTURED) 아이템이 인벤토리(또는 임시보관)로 들어온다 → 기존 `/me/balance`·
  `/me/inventory`·`/me/temp-storage` 화면이 자동으로 반영(신규 계약 불요).

---

## 10. 게이트2 결정 (2026-07-21 승인 확정)

| # | 항목 | 결정 |
|---|---|---|
| 1 | settlement 스키마(§2) | **승인** — 기존 `sale_order` 사용 + `V14__sale_order_and_settlement.sql` 생성 + `fee_amount` NOT NULL + `fee_policy_version` 신설 + `(source_type,source_id)` UK 승격 |
| 2 | 마감 워커 동시성(§3) | **승인** — `@Scheduled` 폴링(간격·배치 크기 backend-impl 튜닝) + 경매 1건 독립 TX + auction 행 비관락 + 종료성 CAS(idempotent·다중 인스턴스 안전·분산락 없음). 후보 스캔 **SCHEDULED+ACTIVE 둘 다**(§1.1) |
| 3 | seller 지급(§4.5) | **승인** — 게임머니 크레딧(`increaseGameMoney`) + `sale_order`를 지급 기록 정본으로. 전용 크레딧 원장 미도입 |
| **4** | **business fee 귀속(§4.6·§2.3)** | **④-C 확정** — 전용 수익 원장 `platform_revenue_ledger`(정산 1:1, sale_order_id UK). 게임머니 총량 보존(I-H) + 회계/감사 추적. ④-A(소멸)·④-B(플랫폼 계정) 기각 |
| 5 | 수수료 계산 배치(§4.2) | **승인** — SOLD TX 내 `final_price` 확정 직후 1회(누진→반올림→cap→최소, 계산기 내부 클램프). `@ConfigurationProperties` 바인딩 + `fee_policy_version` 스탬프 |

부수(backend-impl 신규 자산): `UserBalanceRepository.capture`, `MoneyHoldRepository.captureIfHeld` + `MoneyHoldService.capture`, `BidRepository.markWonIfActive`, `AuctionRepository.markSoldIfClosable`·`markUnsoldIfClosable`·`findClosableIds`·`findCloseContextForUpdate`, `ItemInstanceRepository.transferToBuyer`(+이력), `FeeCalculator`/`FeePolicyProperties`, `SaleOrder`·`SaleOrderRepository`, **`PlatformRevenueLedger`·`PlatformRevenueLedgerRepository`**, `CloseWorker`·`CloseService`(패키지 `domain/settlement/*`).

### 10.1 backend-impl 인계 티켓 (확정 계약)

- **FC-082 (마감 워커)** — `CloseWorker`(@Scheduled 폴링·배치·`findClosableIds`) + `CloseService.closeOne`(행 비관락·재검증·분기) + `AuctionCloseContext` 프로젝션 + 종료성 CAS(`markSoldIfClosable`·`markUnsoldIfClosable`). idempotency·SCHEDULED 포함·소프트클로즈 경합(§3). 의존: V14 선행(FC 스키마 티켓) 또는 동일 티켓에 포함.
- **FC-083 (SOLD 정산)** — §4 전 절차: 낙찰 bid WON·홀드 CAPTURED(`capture`)·판매자 크레딧·**수익 원장 적립**·아이템 이전(+이력)·sale_order INSERT. `FeeCalculator`·`FeePolicyProperties`. 불변식 I-A·I-B·I-C·I-D·I-E·I-H.
- **FC-084 (UNSOLD 유찰)** — §5 절차: 홀드 0건 확인·아이템 반환(`releaseFromListing` 재사용)·UNSOLD CAS. 불변식 I-A·I-E.
- **V14 스키마 티켓** — `sale_order` + `platform_revenue_ledger` 생성(§2.2·§2.3). FC-082~084의 선행. 엔티티(`SaleOrder`·`PlatformRevenueLedger`)·리포지토리 포함.
- 팬아웃 판정: V14 → FC-082 → FC-083 ∥? FC-084. FC-083·084는 `CloseService` 동일 파일을 편집(분기 두 메서드)하므로 **쓰기 파일 교차 → 순차** 권고(단일 backend-impl). 워커(FC-082)와 정산(083/084)도 `CloseService` 교차라 순차. 실질 **V14 → 082 → 083 → 084 순차 단일 패스**.

---

## 11. 범위 밖(후속 에픽) 명시

- **즉시구매(BUYNOW)**: `POST /auctions/{id}/purchase` — SOLD/result_type=BUYNOW 경로. sale_order 재사용. 별도 에픽.
- **고정가(EPIC-SHOP)**: shop 테이블·구매·정산 — sale_order source_type=SHOP 재사용.
- **거래내역 조회 API**: `GET /me/orders`·`GET /orders/{id}` — sale_order 읽기. 데이터는 코어가 생성하나 읽기 엔드포인트는 후속.
- **정산 후 환불·크레딧**: fee-policy-spec §5 비례 크레딧·분쟁 크레딧 — 전용 크레딧 원장 도입 시. 본 스펙은 원칙만 승계.
- **관리자 강제취소**·**알림(낙찰/유찰/상위입찰)**: 별도 에픽.
