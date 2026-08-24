# 도시에: 경매·입찰·마감·정산

- **에픽**: EPIC-AUCTION, EPIC-BID, EPIC-CLOSING, EPIC-PURCHASE
- **상태**: 완료
- **기간**: 핵심 구현 2026-07-18 ~ 2026-07-22, 후속 정산 하드닝 2026-08-03
- **관련 티켓**: FC-025~035, FC-081~083, FC-088~091

## 1. 개요

아이템을 에스크로에 출품하고, 마감 직전 입찰 폭주 속에서도 최고가와 홀드를 일치시키며, 마감 후 낙찰금·
판매대금·플랫폼 수수료·아이템 소유권을 한 번만 전이하는 경매 생애주기를 완성했다. 핵심은 외부 락에 정확성을
맡기지 않고 MySQL 트랜잭션 안에서 auction 행을 직렬화 앵커로 삼고, 금전 변경에는 조건부 CAS를 겹친 것이다.

## 2. 해결한 기술 도전과 해법

- **동시 입찰**: `findBidContextForUpdate`의 auction 행 `PESSIMISTIC_WRITE`로 경매별 순서를 만든 뒤 최소증분,
  자기경매, 연속입찰, 마감시각을 다시 판정했다. 사용자 잔액은 가용금액 조건부 UPDATE로 차감하고 직전 홀드는
  CAS 해제해 다른 경매와의 경쟁에서도 음수화와 이중 해제를 막았다.
- **홀드 왕복의 원자성**: 신규 bid·money_hold, 직전 홀드 해제, 최고가·최고입찰자 갱신을 한 TX에 두고
  `MoneyHoldService`에 `MANDATORY`를 사용했다. 상위 TX 강제 롤백 테스트가 다섯 테이블 효과의 원복을 확인했다.
- **소프트클로즈**: 현재 `end_at`과 `max_end_at`을 잠금 스냅샷에서 읽고 window 안의 유효 입찰만 연장했다.
  누적 연장은 cap을 넘지 않고 종료시각은 단조 비감소한다.
- **마감·정산 경합**: `CloseWorker`가 후보를 스캔하되 경매 한 건을 독립 TX로 `CloseService.closeOne`에 넘겼다.
  행 락 후 최신 종료시각을 재검증하고 종료성 CAS로 ACTIVE/SCHEDULED를 SOLD 또는 UNSOLD로 한 번만 전이했다.
- **총량 보존**: 낙찰 홀드를 CAPTURE하고 판매자에게 `final-fee`를 지급하며 fee는 전용 플랫폼 수익 원장에
  기록했다. `sale_order` source UK와 ledger UK가 재실행 중복을 DB에서도 차단한다.
- **즉시구매 재사용**: PurchaseService는 경매 종료 “머리”만 담당하고, 주문·수수료·소유권·원장 “꼬리”를
  `SettlementRecorder`로 추출해 마감과 공유했다.

## 3. 핵심 결정과 근거

- **Redis 분산락 기각**: 기존 `DistributedLockAspect`는 고정 lease이며 watchdog이 없다. TX가 lease를 넘으면
  상호배제가 깨지고 Redis 장애가 입찰 중단으로 전파된다. 그래서 Redis는 정확성 경계가 아니라 데모/보조
  인프라로 남기고 DB 행 락+CAS를 선택했다(`bid-domain-spec.md` §8).
- **auction 행이 직렬화 앵커**: bid 테이블에는 “아직 없는 다음 행”을 안정적으로 잠글 수 없으므로 항상 존재하는
  auction 행을 잠갔다. 경매 간 병렬성은 유지하고 같은 경매만 직렬화하는 절충이다.
- **락만 믿지 않는 금전 CAS**: auction 락은 경매 단위 경쟁만 막는다. 한 사용자가 여러 경매에 동시에 입찰하는
  축은 잔액 행 조건부 CAS가 방어한다. 테스트도 서로 다른 8개 경매에 동시 입찰해 CAS 축을 분리 검증했다.
- **InnoDB RR 함정 명시**: 일반 consistent read는 TX 스냅샷의 과거 값을 볼 수 있다. 원인 판정 재조회에는
  잠금 읽기를 사용하고 persistence context clear 뒤 재조회한다. 리뷰의 취소-vs-입찰 테스트는 일반 조회가
  과거값을 보는 상황에서 `FOR UPDATE`만 최신 커밋을 관찰함을 입증했다.
- **전용 수익 원장**: 수수료 소멸보다 회계·감사 추적과 게임머니 총량 검증을 택했다. 비용은 테이블·UK·검증 증가다.

## 4. 아키텍처

```text
출품: INVENTORY --CAS--> LISTED → Auction(SCHEDULED/ACTIVE)

입찰 TX
Auction FOR UPDATE → 규칙 재판정 → UserBalance 조건부 CAS
 → 이전 MoneyHold RELEASE CAS → Bid+MoneyHold(HELD)
 → Auction 최고가/입찰자/soft-close 갱신

마감 TX
Auction FOR UPDATE → 종료시각 재검증
 ├─ 입찰 없음: UNSOLD + LISTED→INVENTORY
 └─ 낙찰: SOLD + Hold CAPTURE + item 소유권 이전
           → SaleOrder + seller credit + PlatformRevenueLedger

즉시구매: PurchaseService → SettlementRecorder(공통 정산 꼬리)
```

## 5. 증거

- 계약: `docs/spec/auction-domain-spec.md`, `bid-domain-spec.md`, `closing-domain-spec.md`,
  `purchase-spec.md`, `fee-policy-spec.md`, `api-contract.md` §3.1·§4.3.
- 코드: `backend/src/main/java/com/finalcall/domain/bid/service/BidService.java`,
  `backend/src/main/java/com/finalcall/domain/currency/service/MoneyHoldService.java`,
  `backend/src/main/java/com/finalcall/domain/settlement/service/CloseService.java`,
  `backend/src/main/java/com/finalcall/domain/settlement/service/CloseWorker.java`,
  `backend/src/main/java/com/finalcall/domain/settlement/service/SettlementRecorder.java`,
  `backend/src/main/java/com/finalcall/domain/settlement/service/PurchaseService.java`.
- 리뷰: `docs/board/reviews/FC-035-review.md` — 12클래스 69건 통과, I1~I10 검증;
  `docs/board/reviews/FC-082-review.md` — 전체 백엔드 255건, 16스레드 경합과 I-A~I-H 통과;
  `docs/board/reviews/FC-089-090-review.md` — 279/490 통과 후 major 수정, 재검 백엔드 281건 통과.
- 커밋: `88fe01ba` 스키마·홀드, `b2258cda` 입찰, `0a5b952c` 입찰조회, `7110c9d5` 마감·정산,
  `fda5240b` 즉시구매·SettlementRecorder, `b44aea03` user_id 락 순서 수정, `fae437d4` 음수 정산 방지.

### 정직한 한계

FC-035의 락 획득 전 시각 포착 등 minor 9건은 리뷰에 남았다. 마감 정산의 고정 잔액 락 순서도 워커 재시도
정책으로 수용한 minor였고, 이후 즉시구매 동기 경로는 user_id 오름차순으로 강화했다. 이 문서는 발견을 숨기지
않고 당시 판정과 후속 하드닝을 구분한다.
