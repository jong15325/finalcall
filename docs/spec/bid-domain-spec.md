# FinalCall Bid Domain Spec (입찰 도메인 스펙)

상태: v0.2 — FC-030(EPIC-BID 계약/설계 확정, architect) 산출 + **게이트2 결정 반영(2026-07-18, 전건 승인)**. 기존 정본(api-contract §3.1·§3.3·§5, erd §4.1·§4.2·§5·§6, domain-spec §4·§5·§6·§8·§9·§10)의 **검증·동시성 설계·구현 슬라이싱·갭 식별**을 담는다.
소유: architect (spec). 게이트2 5항목(a~e) + 계약·erd 정밀화 6건(F1~F6) 전부 승인 완료(§13) → **구현 착수 근거.**
근거: api-contract **v1.8** §3.1(`/bids` 2개)·§3.3(`BidSummary`·`minNextBidAmount`)·§5(`BID_001~007`), erd **v1.0** §4.1(`money_hold`·`user_balance`)·§4.2(`bid`·`auction`)·§5·§6, domain-spec **v0.6** §4(입찰 규칙 D-004·P-008)·§5·§6·§8(동시성 D-008)·§9·§10, auction-domain-spec v0.2 §9-a·§9-b·§9-e(EPIC-AUCTION 인계), item-domain-spec v0.3, CLAUDE.md 섹션 4·섹션 5.
범위: 정본을 대체하지 않는다. 본 문서는 **EPIC-BID 구현 지침의 단일 참조점**이다.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1 | 2026-07-18 | FC-030 착수 — 계약·erd 검증, 동시성 설계 초안, 갭 11건, 게이트2 5건 + F1~F6 상신 |
| v0.2 | 2026-07-18 | **게이트2 전건 승인 반영** — (a) auction 행 비관적 락 확정, (b) 단일 TX 확정, (c) 소프트클로즈 식 확정, (d) 기회적 영속 승격 확정, (e) `highest_bidder_id` 앵커 확정. F1~F6을 계약 v1.8·erd v1.0에 반영 완료(`bid.public_id`·`BidSummary`·`minNextBidAmount`·`BID_007`·첫 입찰 하한·auction 인덱스). 실행 순서 031→032→**034**→033 확정. 선결 검토(에스크로 CAS owner) EPIC-CLOSING 이연 확정 |

**EPIC-BID 경계(게이트1 승인 2026-07-18)**: `bid`·`money_hold` 도입 + `POST /auctions/{id}/bids`(직렬화·홀드·직전홀드 즉시해제·최고가 갱신·소프트클로즈 연장) + `GET /auctions/{id}/bids` + auction 목록/상세 최고가 실값 대체 + 동시성 테스트. **마감·낙찰·정산·`sale_order`·소유이전·즉시구매(`/purchase`)는 EPIC-CLOSING, 고정가는 EPIC-SHOP.** 본 에픽은 `bid.status` = ACTIVE/OUTBID만, `money_hold.status` = HELD/RELEASED만 세팅한다(WON·CAPTURED = EPIC-CLOSING).

---

## 1. 대상 엔티티·엔드포인트

- 신규 엔티티: `bid`(erd §4.2), `money_hold`(erd §4.1). Flyway **V11 단일 채번**(V1~V10 소비 완료, erd §6 4-b).
- 기존 자산 재사용(신규 구현 아님):
  - **`UserBalanceRepository.hold(userId, amount)` / `release(userId, amount)` — 이미 구현돼 있다.** 조건부 `@Modifying` UPDATE(가용 = balance − held 이내에서만 성공, 영향행 0 = 실패). 게임머니 홀드·해제의 원자성은 이 두 메서드가 DB 행 락 아래에서 보증한다. **새로 만들지 말 것.**
  - `auction.highest_bid_amount`·`highest_bidder_id`·소프트클로즈 config 컬럼 — V10에 이미 존재(EPIC-AUCTION이 "저장만"으로 남긴 자리, auction-spec §9-b·§9-c).
  - `AuctionDetailResponse.maskHighestBidder`(앞 2자 + `***`) — 마스킹 규약 구현체. `BidSummary.bidderMasked`가 재사용한다.
- 엔드포인트(api-contract v1.8 §3.1):
  - `POST /api/v1/auctions/{auctionPublicId}/bids` — 인증 필요. 201 `{ bidPublicId, amount, currentHighestAmount, endAt }`.
  - `GET /api/v1/auctions/{auctionPublicId}/bids` — 인증 불요(마스킹). 200 offset 페이지(`BidSummary`).
- 교차 도메인:
  - **auction**: 최고가·최고입찰자·`end_at`·`extension_count`·`status` 갱신. `AuctionService.cancel`의 0행 분기 정정(§4.6).
  - **member/currency**: `user_balance` 홀드·해제, `money_hold` 원장.
  - **member 탈퇴 차단(계약 §2.5 `MEMBER_002`)**: `MemberService.withdraw`가 이미 `gameMoneyHeld == 0`을 검사한다 → EPIC-BID가 홀드를 채우면 **"홀드 보유 입찰" 차단이 자동으로 유효해진다**(auction-spec §9-e 앵커 패턴과 동일). **재작업 0 · member 파일 편집 불요.**

---

## 2. 엔티티 정의

논리 타입은 erd v1.0, 물리 타입은 auction/item 도메인 스타일을 승계한다(BIGINT id AUTO_INCREMENT, CHAR(26) ULID + `@JdbcTypeCode(SqlTypes.CHAR)`, DATETIME(6) UTC, ENUM은 VARCHAR + `@Enumerated(STRING)`). 공통 컬럼(id·created_at·updated_at)은 `BaseTimeEntity` 상속으로 처리하고 표에서 생략한다.

### 2.1 `bid` — 경매 입찰 (erd v1.0 §4.2)

| 컬럼 | 타입 | 널 | 키 | 비고 |
|---|---|---|---|---|
| public_id | CHAR(26) ULID | N | UK | 외부 식별자(B-004). **erd v1.0 F1로 신설 확정.** 서버 발급(`Ulid.generate()`) |
| auction_id | BIGINT | N | FK→auction | |
| bidder_id | BIGINT | N | FK→user | 입찰자 = SecurityContext 주체 |
| amount | BIGINT | N | | 입찰액(`< buy_now_price`, D-004) |
| status | ENUM(VARCHAR 20) | N | | ACTIVE / OUTBID / WON. **본 에픽 세팅값 = ACTIVE·OUTBID**(WON=EPIC-CLOSING) |

- soft delete 없음(입찰은 원장 — OUTBID로 보존, 삭제 아님) → D-081 패턴 불요.
- `@Setter` 금지. status 전이는 `@Modifying` UPDATE로 수행한다(§4.2 함정).
- 인덱스(erd §5): `(auction_id, amount DESC)`, `(bidder_id)`. **신규 인덱스 없음**(§11 G4).

### 2.2 `money_hold` — 게임머니 홀드(에스크로) (erd §4.1)

| 컬럼 | 타입 | 널 | 키 | 비고 |
|---|---|---|---|---|
| user_id | BIGINT | N | FK→user | 입찰자 |
| bid_id | BIGINT | N | UK, FK→bid | 홀드-입찰 **1:1**(erd). 중복 홀드 DB 차단 |
| amount | BIGINT | N | | 홀드 게임머니 = `bid.amount`(항상 동일, I3) |
| status | ENUM(VARCHAR 20) | N | | HELD / RELEASED / CAPTURED. **본 에픽 세팅값 = HELD·RELEASED**(CAPTURED=EPIC-CLOSING) |
| released_at | DATETIME(6) | Y | | 해제·차감 시각 |

- `public_id` 없음 — 외부 노출 리소스가 아니다(`money_exchange` 선례).
- 인덱스(erd §5): `(user_id, status)`.
- **INSERT 순서 강제**: `bid_id`가 NOT NULL FK + UK라 `bid` INSERT → flush → `money_hold` INSERT(동일 TX).

### 2.3 패키지 배치 (CLAUDE.md 섹션 4 의존 방향)

- `domain/bid/*` — `Bid`, `BidStatus`, `BidRepository`(+Custom/Impl), `BidErrorCode`, `BidService`, `BidIncrementProperties`.
- `domain/currency/*` — `MoneyHold`, `MoneyHoldStatus`, `MoneyHoldRepository`, **`MoneyHoldService`**(기존 `MoneyExchange`가 이 패키지).
  - `MoneyHoldService`는 금전 이동(잔액 홀드 CAS + 원장 INSERT / 잔액 해제 CAS + 원장 상태 전이)을 한 빈에 응집시켜 보안 리뷰·불변식 테스트 표면을 좁힌다. `BidService`는 이 빈을 **외부 빈으로 호출**한다(동일 TX 참여, self-invocation 아님 — CLAUDE.md 섹션 4).
- `api/bid/*` — `BidController`(`@RequestMapping("/api/v1/auctions/{auctionPublicId}/bids")`), Request/Response record.
  - **`AuctionController`에 붙이지 않는다**(파일 교차 축소 + 도메인 경계 유지).

---

## 3. 입찰 검증 규칙·순서

### 3.1 검증 순서 (확정)

전 검증은 **§4의 직렬화 구간(auction 행 락) 안에서** 락으로 읽은 스냅샷을 근거로 수행한다. 락 밖 선검사(빠른 실패용)는 허용하되 **판정 근거가 되어서는 안 된다**(TOCTOU).

| 순서 | 검증 | 실패 시 | 판정 근거 |
|---|---|---|---|
| 1 | 경매 존재 | `AUCTION_004`(404) | publicId 조회 |
| 2 | 개시 여부 | `BID_007`(409) | `status=SCHEDULED ∧ start_at > now` |
| 3 | 마감·종료 아님 | `BID_006`(409) | §3.2 |
| 4 | 자기 경매 아님 | `BID_003`(403) | `auction.seller_id != 주체`(SecurityContext, B-009) |
| 5 | 연속 입찰 아님 | `BID_004`(409) | `auction.highest_bidder_id != 주체`(§13-e 앵커) |
| 6 | buyNow 상한 미만 | `BID_002`(422) | `buy_now_price IS NULL OR amount < buy_now_price` |
| 7 | 최소 증분 충족 | `BID_001`(422) | §3.3 |
| 8 | 게임머니 가용 잔액 충분 | `BID_005`(422) | `UserBalanceRepository.hold` 영향행 0 |

- 순서 근거: 상태(2·3) → 주체(4·5) → 금액(6·7) → 자금(8). **자금 검증을 마지막에 두어 불필요한 잔액 행 락 획득을 피한다**(락 보유 시간 최소화 + 데드락 표면 축소).
- 정보 노출: 2~7의 판정 근거는 전부 공개 상세(`GET /auctions/{id}`)로 이미 노출되는 값이라 순서에 따른 열거 리스크가 없다(SEC-007 무관).

### 3.2 입찰 가능 상태 판정 (`BID_006` / `BID_007`)

락으로 읽은 auction 행 기준:

```
미개시(BID_007) ⇔ status = 'SCHEDULED' AND start_at > now
입찰 가능        ⇔ (status = 'ACTIVE' OR (status = 'SCHEDULED' AND start_at <= now))
                   AND now < end_at
그 외(BID_006)   ⇔ 종료 상태(SOLD/UNSOLD/CANCELLED) OR now >= end_at
```

- **`BID_007` 신설 확정**(계약 v1.8 F4). "아직 시작 안 함"과 "이미 끝남"은 클라이언트 안내·재시도 가능성이 정반대다.
- **마감 판정은 시각 기준(`now >= end_at`)** 이다. 마감 워커(EPIC-CLOSING) 미도입 상태에서 status가 아직 ACTIVE로 고여 있어도 정확히 거부된다(auction-spec §9-a lazy 파생과 동일 원리).

### 3.3 최소 입찰 증분 (계단식, domain-spec §4 D-004)

검증식: `신규입찰 >= 현재 최고가 + 해당 구간 증분`.

- **첫 입찰(`highest_bid_amount IS NULL`)**: `amount >= start_price`. 증분 미적용(시작가 자체가 하한) — 계약 v1.8 §3.1 문언화 완료(F5).
- **후속 입찰**: `amount >= highest_bid_amount + increment(highest_bid_amount)`.
- 구간표 — `@ConfigurationProperties` + `@Validated`로 바인딩한다(CLAUDE.md 섹션 4, 산발적 `@Value` 금지). 프로파일 config 값이며 컴파일 상수가 아니다.

| 현재 최고가 구간 | 증분 |
|---|---|
| ~ 9,999 | 100 |
| 10,000 ~ 99,999 | 1,000 |
| 100,000 ~ 999,999 | 5,000 |
| 1,000,000 ~ 9,999,999 | 10,000 |
| 10,000,000 ~ 99,999,999 | 100,000 |
| 100,000,000 ~ | 1,000,000 |

- **`minNextBidAmount` 산출(계약 v1.8 §3.3, F3)**: 입찰 없으면 `startPrice`, 있으면 `highest_bid_amount + increment(highest_bid_amount)`. 종료 상태 경매는 null. 상세 응답 전용 파생값이며 **저장하지 않는다**.
- **`buy_now_price`와의 상호작용**: `highest + increment >= buy_now_price`인 구간에는 유효한 입찰이 존재하지 않는다(`BID_001`과 `BID_002`가 동시에 막는다). domain-spec §4 "즉시구매가는 그 경매의 상한선"과 정합하며 그 구간의 유일한 진행 경로는 즉시구매(EPIC-CLOSING)다. **버그가 아니라 설계된 종착점이므로 별도 코드를 두지 않는다.**

---

## 4. 직렬화 설계 (동시성 핵심 · domain-spec §8 D-008)

> 원칙 인용(domain-spec §8): "정합성은 DB, 처리량은 락. 정합성의 최종 보증은 DB(조건부 원자 갱신 + 유니크 제약)가 맡고, 분산락(Redisson)은 경합 완화·처리량 최적화 수단이지 정확성 보장 수단이 아니다."
> "입찰 유효성 검증·최고가 갱신은 경매 단위로 직렬화하되 최종 정합성은 DB가 보증한다. 소프트 클로즈의 마감 연장 판단은 입찰 수용과 동일한 직렬화 단위에 포함한다."

**메커니즘 확정(게이트2 a 승인 2026-07-18): auction 행 비관적 락(`SELECT ... FOR UPDATE`) + 금전 조건부 CAS 이중 방어. `@DistributedLock`(Redis)은 정확성 경계로 사용하지 않으며 본 에픽에서 도입하지 않는다.**

### 4.1 단일 트랜잭션 절차 (확정)

```
BEGIN TX (@Transactional)
 1. auction 행 배타 락 획득 + 스냅샷 읽기
      @Lock(PESSIMISTIC_WRITE) → SELECT ... FROM auction WHERE public_id = ? FOR UPDATE
      → 이 시점부터 커밋까지 동일 경매의 다른 입찰은 이 행에서 대기 = 경매 단위 직렬화
      → 필요한 값(seller_id·status·start_at·end_at·max_end_at·window·extend·extension_count·
         buy_now_price·start_price·highest_bid_amount·highest_bidder_id)을 즉시 지역 변수로 복사(§4.2)
 2. §3.1 검증 2~7 (락 스냅샷 근거)
 3. 직전 최고 입찰 식별(있으면) — §4.3
 4. 잔액 갱신 2건을 user_id 오름차순으로 수행 (§4.4 데드락 회피 — 순서 강제)
      · 입찰자    : UserBalanceRepository.hold(bidderId, amount)              → 0행이면 BID_005
      · 직전입찰자: UserBalanceRepository.release(prevBidderId, prevAmount)   → 0행이면 불변식 위반 → 예외
 5. bid INSERT(status=ACTIVE) + flush → money_hold INSERT(status=HELD)
 6. 직전 최고 입찰이 있으면(P-008 즉시 해제):
      prev bid.status  ACTIVE→OUTBID                  (@Modifying UPDATE, WHERE status='ACTIVE')
      prev money_hold  HELD→RELEASED + released_at=now (@Modifying UPDATE, WHERE status='HELD')
 7. auction UPDATE (@Modifying, 단일 문):
      highest_bid_amount=amount, highest_bidder_id=bidderId,
      status: SCHEDULED이고 start_at<=now면 'ACTIVE'로 영속 승격(§13-d),
      end_at·extension_count: §6 연장 판정 결과
COMMIT  → 행 락 해제
```

- 4단계에서 잔액 갱신을 5·6단계보다 **먼저** 수행하는 이유: `BID_005`(잔액 부족)를 행 INSERT 전에 확정해 불필요한 쓰기를 줄인다. 순서가 바뀌어도 단일 TX라 정합성은 동일하다.
- 6단계의 두 UPDATE는 조건부(`WHERE status='ACTIVE'` / `WHERE status='HELD'`)다. **영향행 0이면 이중 해제·불변식 위반이므로 무시하지 않고 예외로 올려 전체 롤백**한다.

### 4.2 ★★ 구현 함정 — `@Modifying(clearAutomatically = true)`와 관리 엔티티

`UserBalanceRepository.hold`/`release`는 `@Modifying(clearAutomatically = true, flushAutomatically = true)`다. **이 호출은 영속성 컨텍스트 전체를 clear 한다** → 1단계에서 락으로 로드한 `Auction`(및 이후의 `Bid`) 엔티티가 **detach 되어 dirty-checking 갱신이 예외 없이 유실된다.**

- DB 행 락 자체는 트랜잭션에 귀속되므로 **직렬화는 깨지지 않는다.** 깨지는 것은 JPA 변경 감지뿐이다. 그래서 증상이 "예외 없이 갱신 누락"으로 나타나 위험하다.
- **집행 규칙(FC-032 필수)**:
  1. **auction 갱신은 전부 `@Modifying` UPDATE**로 한다. dirty-checking 금지. (`Auction` 엔티티는 이미 setter·전이 메서드가 없어 이 규칙과 정합한다 — EPIC-AUCTION 설계 유지.)
  2. 락 스냅샷에서 필요한 값은 **`hold`/`release` 호출 전에 지역 변수(또는 DTO 프로젝션)로 복사**한다.
  3. `bid`·`money_hold` 상태 전이도 clear 이후에는 dirty-checking에 의존하지 않는다 — 조건부 `@Modifying` UPDATE로 수행한다(§4.1 6단계).
  4. 새로 추가하는 `@Modifying` 메서드에 `clearAutomatically`를 **관성적으로 붙이지 않는다**(같은 함정을 확산시킨다).
- 검증: 이 함정은 단위 테스트로 잡기 어렵다 → **FC-034의 불변식 I1·I7이 회귀 방어선**이다.

### 4.3 직전 최고 입찰의 식별

직전 최고 입찰의 `bid.id`·`amount`·`bidder_id`가 필요하다(§4.1 3·6단계). auction에는 `highest_bid_id` 컬럼이 없다.

- **확정: `bid WHERE auction_id = ? AND status = 'ACTIVE'` 단건 조회.** auction 행 락 아래이므로 **경매당 ACTIVE 입찰은 최대 1건**(불변식 I1)이고 판정이 정확하다.
- 인덱스: 기존 `(auction_id, amount DESC)`로 커버된다 — 입찰 금액이 단조 증가(I2)하므로 이 인덱스의 선두 행이 곧 현재 최고 입찰이다. **`(auction_id, status)` 신규 인덱스 불요**(erd v1.0 §5 이유 열에 근거 명시).
- 기각: `auction.highest_bid_id` 컬럼 신설 — erd 미등재 스키마 변경 + `highest_bidder_id`와 이중 진실.

### 4.4 데드락 회피 — 잔액 갱신 순서 강제 (필수)

`hold`(입찰자)와 `release`(직전 입찰자)는 **서로 다른 두 `user_balance` 행**에 배타 락을 건다(연속 입찰 금지 `BID_004`로 두 사용자는 항상 다르다).

- **위험**: 서로 다른 두 경매에서 두 사용자가 교차로 상대를 outbid 하면 락 획득 순서가 역전돼 **데드락이 성립한다.**
  - 예: 경매 X에서 U1이 U2를 밀어냄(U1 hold → U2 release) ∥ 경매 Y에서 U2가 U1을 밀어냄(U2 hold → U1 release).
- **집행 규칙: 두 잔액 갱신은 `user_id` 오름차순으로 수행한다.** 전역 락 순서가 하나로 고정되면 순환 대기가 성립하지 않는다.
- **백스톱**: MySQL 데드락 검출 시(`DeadlockLoserDataAccessException`) `COMMON_004`(409)로 매핑해 클라이언트 재시도를 허용한다. 정합성은 롤백으로 보존된다.
- 순서를 바꿔 release가 먼저 일어나도, 이후 hold가 실패하면 TX 전체가 롤백돼 해제가 취소되므로 정합하다.
- 회귀 테스트: FC-034 시나리오 7(§10).

### 4.5 홀드 생명주기 (P-008)

```
입찰 성립 ──▶ money_hold(HELD) + user_balance.game_money_held += amount
   │
   ├── 상위 입찰 발생 ──▶ RELEASED(released_at) + game_money_held -= amount   [본 에픽, 즉시 해제]
   ├── 낙찰          ──▶ CAPTURED + 차감                                      [EPIC-CLOSING]
   └── 유찰·강제취소  ──▶ RELEASED + 해제                                      [EPIC-CLOSING]
```

- **즉시 해제 근거(domain-spec §4 P-008)**: "마감 일괄 해제가 아니라 즉시 해제인 이유는, 밀린 입찰의 홀드가 누적돼 사용자 잔액이 장시간 묶이는 것을 막기 위함이다."
- 따라서 **경매당 HELD 홀드는 항상 최대 1건**(= 현재 최고입찰자, 불변식 I3). 밀린 입찰의 홀드는 남지 않는다.
- 이중 해제 방어는 이중이다: `money_hold.status='HELD'` 조건부 전이 + `UserBalanceRepository.release`(현재 홀드 이내에서만 성공). 어느 한쪽이 0행이면 불변식 위반 → 예외 → 롤백.

### 4.6 `AuctionService.cancel` 0행 분기 정정 (EPIC-AUCTION 인계 · FC-032 포함)

현재 코드는 CAS 실패(0행) 시 **CAS 이전에 로드한 엔티티**의 `highestBidder`로 원인을 분기한다. EPIC-AUCTION에서는 전건 NULL이라 정확했고, 코드 주석이 이미 경고를 남겼다:

> `★ EPIC-BID 진입 시: 동시 입찰이 로드 이후 highest_bidder 를 채우는 경쟁은 fresh/locking 재조회가 필요하다.`

- **증상**: 취소 로드 직후 첫 입찰이 커밋되면 CAS가 0행이 되는데, 스테일 엔티티는 `highestBidder == null`이라 `AUCTION_007`(입찰 존재) 대신 `AUCTION_006`(이미 종료)을 반환한다. **정합성 결함은 아니고**(취소는 정확히 차단된다) **에러코드 오분류**다.
- **조치(FC-032)**: 0행 이후 원인 판정을 **스칼라 프로젝션 재조회**(`SELECT status, highest_bidder_id FROM auction WHERE id = ?`)로 바꾼다.
  - **`findById` 재조회는 해법이 아니다** — `cancelIfCancellable`에 `clearAutomatically`가 없어 1차 캐시가 스테일 엔티티를 그대로 반환한다. 스칼라/DTO 프로젝션이어야 1차 캐시를 우회한다.
- 취소 자체에 락은 불요하다(CAS가 단일 승자를 보증). 정정 대상은 분기 근거뿐이다.
- 회귀 테스트: FC-034 시나리오 5(§10 I9).

---

## 5. 최고가 갱신 · 상태 파생

- `highest_bid_amount`·`highest_bidder_id`는 입찰 성립과 **동일 UPDATE 문**에서 갱신한다(부분 갱신 상태 없음). 두 컬럼은 항상 같은 bid에서 유래한다(I1).
- `SCHEDULED` + `start_at <= now` 경매에 입찰이 성립하면 **동일 UPDATE에서 `status='ACTIVE'`로 영속 승격**한다(§13-d). auction-spec §9-a의 lazy 파생(표시층)은 그대로 유지되며, 입찰이 들어온 경매의 영속값이 자연 치유된다.
- EPIC-AUCTION이 남긴 null/0 하드코딩(auction-spec §9-b)은 FC-033에서 실값으로 대체된다 — `AuctionSummaryResponse.bidCount`, `AuctionDetailResponse.highestBidAmount`·`bidCount`·`highestBidderMasked` + 신규 `minNextBidAmount`.

---

## 6. 소프트클로즈 연장 규칙 (D-004) — 확정

> domain-spec §4: "마감 직전 트리거 윈도우(기본 T-30초) 내 유효 입찰이 발생하면 마감을 연장(기본 +30초)한다. … 총연장상한은 필수다."
> domain-spec §8: "소프트 클로즈의 마감 연장 판단은 입찰 수용과 동일한 직렬화 단위에 포함한다(입찰은 성공했는데 연장이 누락되는 틈 방지)."

```
연장 트리거 ⇔ 입찰 성립 AND now >= end_at - soft_close_window_sec
             (now < end_at 은 §3.2에서 이미 보장)

new_end_at = max(end_at, min(now + soft_close_extend_sec, max_end_at))

연장 발생  ⇔ new_end_at > end_at
  → 발생한 경우에만 extension_count += 1
```

- **기준점 = `now + extend`**(`end_at + extend` 아님). 근거: "입찰 시점부터 extend초 보장"이 소프트클로즈의 의미이며, 윈도우 내 다발 입찰이 `end_at`에 **선형 누적**돼 마감이 밀려나는 현상을 막는다(동시 10건 → +300초 대신 ~30초로 수렴).
- **`max(end_at, ...)`로 단조 비감소 강제** — 어떤 경우에도 `end_at`이 앞당겨지지 않는다(I7).
- **`max_end_at` 상한 도달 시**: `new_end_at`이 클램프되어 더 증가하지 않으면 `extension_count`도 증가하지 않는다. **입찰 자체는 정상 성립한다** — 연장 불가는 입찰 거부 사유가 아니며, 상한 도달 후에도 마감 순간까지 입찰을 받는다.
- `extension_count`의 의미 = **실제 연장 횟수**(시도 횟수 아님). 응답 `extensionCount`가 사용자에게 "몇 번 밀렸는지"를 뜻한다.
- **연장 계산은 직렬화 구간 안(§4.1 7단계)에서** auction UPDATE와 동일 문으로 수행한다 → "입찰은 성공했는데 연장이 누락"되는 틈이 원천 차단된다(domain-spec §8 요구).
- 응답 `endAt`은 **연장 반영 후 값**이다(계약 v1.8 §3.1 명시).
- 기본값(`window=30`·`extend=30`)·상한(각 300초, 총연장 24시간)은 EPIC-AUCTION 게이트2 (c) 승인분을 승계한다(`AuctionService` 상수로 이미 구현).
- 마감 워커(EPIC-CLOSING)와의 관계: 본 에픽은 `end_at`을 갱신만 하고 재예약 인덱스는 도입하지 않는다. domain-spec §9 "DB가 진실, 인덱스는 재구축"에 따라 워커 도입 시 `(status, end_at)` 인덱스 스캔으로 복구된다.

---

## 7. API 응답 스펙 (계약 v1.8)

### 7.1 `POST /auctions/{auctionPublicId}/bids`

- 인증 필요. body `{ amount }`(`@Valid`, `amount >= 1`).
- 응답 201: `{ bidPublicId, amount, currentHighestAmount, endAt }`.
  - `currentHighestAmount` = 방금 성립한 입찰 금액(= `amount`). 성립 직후 최고가는 자신이다.
  - `endAt` = **연장 반영 후** 마감 시각.
- 에러: `AUCTION_004`(404) · `BID_001`(422) · `BID_002`(422) · `BID_003`(403) · `BID_004`(409) · `BID_005`(422) · `BID_006`(409) · `BID_007`(409) · `COMMON_004`(409, 데드락 재시도 유도).

### 7.2 `GET /auctions/{auctionPublicId}/bids`

- 인증 불요. 응답 스키마 = **`BidSummary`**(계약 v1.8 §3.3 등재 완료, F2):

```
{ bidPublicId, bidderMasked, amount, status, createdAt }
```

- offset 페이지(계약 §1.3): `?page=&size=` → `{ content, page, size, totalElements, totalPages }`.
- 기본 정렬 `amount desc`(= `created_at desc`, 금액 단조증가 I2). 기존 인덱스 `(auction_id, amount DESC)`가 커버한다.
- **마스킹**: `bidderMasked` = nickname 앞 2자 + `***`(`maskHighestBidder` 규약 재사용). **`userPublicId`·`loginId`·실 nickname을 절대 싣지 않는다**(인증 불요 엔드포인트 — SEC-007 회원 열거 방지).
- **홀드·잔액 등 자금 정보를 싣지 않는다**(타인 자금 상태 노출 금지). 입찰액은 경매 진행 정보라 공개 대상이다.
- 존재하지 않는 경매 → `AUCTION_004`(404).
- SecurityConfig: `GET /auctions/*/bids`는 **2세그먼트**라 기존 `permitAll(/auctions/*)`에 걸리지 않는다 → 화이트리스트 추가 필요. **POST는 인증 유지**(경로 패턴이 GET/POST를 함께 열지 않도록 HTTP 메서드 지정 필수).

### 7.3 auction 목록/상세 실값 대체 (FC-033)

| 필드 | 현재(EPIC-AUCTION) | EPIC-BID 대체 |
|---|---|---|
| `highestBidAmount` | 항상 null | `auction.highest_bid_amount` 그대로 |
| `bidCount` | 하드코딩 0 | `bid` 집계(아래) |
| `highestBidderMasked` | 항상 null | 기존 마스킹 함수 결과(입찰 없으면 null 유지) |
| `minNextBidAmount` | 미존재 | 신규 파생(§3.3, 계약 v1.8 F3) |

- **`bidCount` 산출(확정)**: 목록/상세 QueryDSL 프로젝션에 **상관 서브쿼리 `COUNT(bid WHERE auction_id = a.id)`** 를 싣는다. 페이지당 20행 × 인덱스 range count라 비용이 작다. **스키마 무변경.**
  - 기각: `auction.bid_count` 비정규화 컬럼 — erd 미등재 스키마 변경 + `highest_bidder_id`와 이중 진실 + 갱신 경로 추가(auction-spec §9-e가 같은 이유로 기각한 선례). 목록 성능이 실측으로 문제가 되면 그때 상신한다(선 측정 후 최적화).
- `highestBidAmount` 정렬은 erd v1.0 F6 인덱스 `auction (status, highest_bid_amount)`가 커버한다.

---

## 8. `BidErrorCode` (CLAUDE.md 섹션 5 `{DOMAIN}_{3자리}`)

계약 v1.8 §5 등재분과 1:1. `ErrorCode` 인터페이스 구현 enum(`AuctionErrorCode`·`ItemErrorCode` 선례).

| enum 상수(권고) | code | HTTP | 의미 |
|---|---|---|---|
| BID_BELOW_MIN_INCREMENT | BID_001 | 422 | 최소 증분 미달(첫 입찰은 시작가 미달) |
| BID_EXCEEDS_BUY_NOW | BID_002 | 422 | buyNowPrice 이상 |
| BID_SELF_AUCTION | BID_003 | 403 | 자기 경매 입찰(SEC-003 대칭) |
| BID_CONSECUTIVE | BID_004 | 409 | 연속(현재 최고가 보유자) 입찰 |
| BID_INSUFFICIENT_BALANCE | BID_005 | 422 | 게임머니 가용 잔액 부족 |
| BID_NOT_BIDDABLE | BID_006 | 409 | 마감·종료됨 |
| BID_NOT_STARTED | BID_007 | 409 | 경매 미개시(SCHEDULED·startAt 미도래) |

- code ↔ HTTP status는 **1:1**이다(계약 §5 규칙). 한 상수가 두 status를 갖지 않는다(EPIC-AUCTION G7 선례).
- `AUCTION_004`(경매 없음)는 `AuctionErrorCode` 재사용 — 입찰 경로에서 새 코드를 만들지 않는다.

---

## 9. 인가·보안 요구 (최고위험 구간)

- **주체는 항상 `SecurityContext`**다. `bidder_id`를 요청 body·헤더에서 받지 않는다(B-009, IDOR 차단. 계약 §1.2 "X-User-Id 등 헤더 신뢰 없음").
- `BID_003`(자기 경매)는 wash trade·shill bidding 방지다(SEC-003, 즉시구매 `AUCTION_009`와 대칭). **판매자 판정은 락 스냅샷의 `auction.seller_id`로만** 한다.
- **금액은 서버 재계산**한다 — 클라이언트가 보낸 `amount` 외의 파생값(최소 증분·홀드액·최고가)을 요청에서 받지 않는다.
- `money_hold.amount`는 항상 `bid.amount`와 같다. 두 값이 갈라질 수 있는 코드 경로를 만들지 않는다(I3).
- 잔액 음수화·초과 홀드 방어는 `user_balance` 조건부 UPDATE의 `WHERE`가 담당한다. **앱 선검사는 UX용이며 판정 근거가 아니다.**
- 공개 조회(`GET /bids`)에 실식별자·자금 정보 미노출(§7.2).
- 최악 시나리오는 **홀드 미해제(자금 동결)·이중 해제(무자본 입찰)** 이며, I3·I4가 전용 방어선이다.

---

## 10. ★ 동시성 불변식 목록 (FC-034 테스트 정본)

FC-034는 아래 불변식을 **DB 상태 직접 검증**으로 옮긴다(API 응답이 아니라 테이블을 읽는다 — 응답은 구현 버그를 숨길 수 있다).

| # | 불변식 | 위반 시 의미 |
|---|---|---|
| **I1** | 경매당 `bid.status='ACTIVE'`인 행은 **≤ 1건**이고, 그 행의 `bidder_id`·`amount`는 `auction.highest_bidder_id`·`highest_bid_amount`와 **정확히 일치**한다 | 최고가·최고입찰자 불일치(직렬화 실패 또는 §4.2 PC clear 함정) |
| **I2** | 경매의 성립 입찰 금액은 **시각 순으로 엄격 증가**한다. `auction.highest_bid_amount`는 단조 비감소 | lost update(더 낮은 입찰이 최고가를 덮어씀) |
| **I3** | 경매당 `money_hold.status='HELD'`인 행은 **≤ 1건**이며, 그 `user_id`·`amount`는 `auction.highest_bidder_id`·`highest_bid_amount`와 일치한다 | P-008 즉시 해제 누락(자금 동결) 또는 이중 홀드 |
| **I4** | 사용자별 `user_balance.game_money_held` == `SUM(money_hold.amount WHERE user_id=? AND status='HELD')` | 원장-잔액 드리프트(무자본 입찰 또는 자금 동결) |
| **I5** | 항상 `0 <= game_money_held <= game_money_balance`(가용 ≥ 0), 잔액 음수 없음 | 초과 홀드·음수 잔액 |
| **I6** | N개 동시 입찰 시 `성공 응답 수 == 신규 bid 행 수 == 신규 money_hold 행 수`. 실패한 입찰은 bid·money_hold·잔액에 **어떤 흔적도 남기지 않는다** | 부분 커밋(트랜잭션 경계 오류) |
| **I7** | 항상 `end_at <= max_end_at`. `end_at`은 단조 비감소. `extension_count` == `end_at`이 실제로 증가한 횟수 | 무한 연장·마감 앞당김·카운트 드리프트 |
| **I8** | `now >= end_at` 이후의 모든 입찰은 `BID_006`이며 부작용 0. 연장이 커밋된 뒤의 입찰은 **새 `end_at`** 기준으로 판정된다 | 마감 경계 누수(마감 후 입찰 수용) |
| **I9** | 판매자 취소와 첫 입찰이 경합하면 **정확히 하나만** 성공한다. 취소 성공 시 `highest_bidder_id IS NULL`·홀드 0건, 입찰 성공 시 `status != CANCELLED`. **실패한 취소는 `AUCTION_007`로 분류된다**(§4.6) | domain-spec §10 "취소 vs 첫 입찰 경합" / 에러코드 오분류 |
| **I10** | `BID_004` 위반 입찰(현재 최고입찰자의 재입찰)은 동시 상황에서도 성립하지 않는다 | 자기 가격 인상(shill) 우회 |

**필수 시나리오 7종(domain-spec §10 정합)**:
1. 단일 경매 · N(≥30) 스레드 동시 입찰(동일 금액 / 계단 금액 혼합) → I1·I2·I6.
2. 마감 직전 폭주 — `end_at`을 수백 ms 앞에 두고 동시 입찰 → I7·I8(연장 경합: 연장된 만큼만 수용).
3. A·B 교대 입찰 M회 → I3·I4(홀드 합계 원복: 최종 HELD 1건, 나머지 RELEASED, 두 사용자 `game_money_held` 정확).
4. 잔액 경계 — 가용 잔액이 1건분뿐인 사용자가 서로 다른 두 경매에 동시 입찰 → 정확히 1건 성공, I5.
5. 취소 vs 첫 입찰 동시 → I9(성공 1건 + 실패 측 에러코드 정확).
6. 최고입찰자의 동시 재입찰 → I10(전건 `BID_004`).
7. **데드락 회귀** — 사용자 U1·U2가 경매 X·Y에서 서로를 outbid 하는 교차 부하 → 데드락 미발생(§4.4 순서 강제). 발생 시에도 `COMMON_004`로 매핑되고 정합성은 유지.

기존 선례 활용: `AuctionRegisterConcurrencyIntegrationTest`·`UserBalanceConcurrencyIntegrationTest`·`ExchangeConcurrencyIntegrationTest`의 `CountDownLatch` + Testcontainers 패턴을 그대로 따른다.

---

## 11. 계약 ↔ ERD ↔ domain-spec 정합 검증 (갭 목록 — 전건 해소)

| # | 위치 | 유형 | 내용 | 조치 |
|---|---|---|---|---|
| **G1** | 계약 §3.1 `bidPublicId` vs erd `bid` | 스키마 갭 | erd `bid` 표에 `public_id`가 없어 계약을 만족하는 구현이 불가능했다 | **해소** — erd v1.0 F1로 `public_id ULID NOT NULL UK` 추가 |
| **G2** | 계약 §3.1 `GET /bids` | 계약 갭 | 응답 스키마가 §3.3에 미정의(프론트·QA 단일 진실 부재) | **해소** — 계약 v1.8 F2로 `BidSummary` 등재 |
| **G3** | 계약 §5 `BID_006` | 에러코드 | "미개시"를 표현할 코드 없음 | **해소** — 계약 v1.8 F4로 `BID_007`(409) 신설 |
| **G4** | 직전 최고 입찰 식별 | 인덱스 | `(auction_id, status)` 인덱스 부재 | **정합(불요)** — 금액 단조증가(I2)로 기존 `(auction_id, amount DESC)`가 커버. erd v1.0 §5 이유 열에 근거 명시 |
| **G5** | 첫 입찰 하한 | 규칙 공백 | 최고가 부재 시 하한 미규정 | **해소** — §3.3 확정 + 계약 v1.8 F5 문언화 |
| **G6** | 계약 §3.3 `AuctionDetail` | 응답 필드 | 프론트가 증분 구간표를 복제해야 했다(드리프트) | **해소** — 계약 v1.8 F3로 `minNextBidAmount` 추가 |
| **G7** | 계약 §3.3 정렬 `highestBidAmount` | 인덱스 | erd auction 인덱스 부재(EPIC-AUCTION G5 이연분) | **해소** — erd v1.0 F6로 `auction (status, highest_bid_amount)` 신설 |
| **G8** | domain-spec §5 취소 조건 | 문서 드리프트 | "입찰 0건 & ACTIVE"로 남아 계약 v1.7과 어긋남 | **해소** — domain-spec v0.6에서 "SCHEDULED\|ACTIVE"로 정정 |
| **G9** | erd `bid` 갱신 컬럼 | 정합 | status 갱신에 `updated_at` 필요 | `BaseTimeEntity` 상속으로 충족. **정합** |
| **G10** | Flyway 채번 | 순서 | group2(`money_hold`)·group4(`bid`)가 한 에픽에 필요 | **V11 단일 파일**(FC-031 소유). `bid` → `money_hold` 순서(FK 의존) + F6 인덱스 포함. erd v1.0 §6 2-a·4-b 반영. 정합 |
| **G11** | 계약 §2.5 `MEMBER_002` | 교차 정합 | "홀드 보유 입찰" 탈퇴 차단 | `MemberService.withdraw`가 이미 `gameMoneyHeld == 0` 검사 → 자동 유효. **재작업 0. 정합** |

**미해결 갭 없음.** 스키마 변경(G1·G7)은 V11에 흡수되며, 기존 테이블 ALTER는 `auction` 인덱스 추가 1건뿐이다.

---

## 12. 티켓 슬라이싱 + 팬아웃 판정

패키지·채번: `api/bid/*`, `domain/bid/*`, `domain/currency/*`, `resources/db/migration/V11__bid_and_money_hold.sql`(**다음 Flyway 채번 = V11**).

### FC-031 — V11 + `bid`·`money_hold` 엔티티 + 홀드 도메인 로직
쓰기 파일 집합:
- `backend/src/main/resources/db/migration/V11__bid_and_money_hold.sql`
  - `bid`(+ `public_id` UK, 인덱스 2, FK 2) → `money_hold`(+ `bid_id` UK, 인덱스 1, FK 2) 순서 + **F6 인덱스 `auction (status, highest_bid_amount)`**
- `domain/bid/Bid.java`, `BidStatus.java`, `BidRepository.java`, `BidErrorCode.java`
- `domain/currency/MoneyHold.java`, `MoneyHoldStatus.java`, `MoneyHoldRepository.java`, `MoneyHoldService.java`
- (테스트) `domain/bid/BidRepositorySliceTest.java`, `domain/currency/MoneyHoldServiceTest.java`

### FC-032 — ★ `POST /auctions/{id}/bids` (직렬화·홀드·즉시해제·최고가·연장)
쓰기 파일 집합:
- `api/bid/BidController.java`(신규 — POST), `BidPlaceRequest.java`, `BidPlaceResponse.java`
- `domain/bid/BidService.java`(신규 — `place`), `BidPlaceCommand.java`, `BidPlaceResult.java`
- `domain/bid/BidIncrementProperties.java`(`@ConfigurationProperties` + `@Validated`) + `application*.yml` 편집
- `domain/auction/AuctionRepository.java`(**편집** — `@Lock(PESSIMISTIC_WRITE)` 조회 + 최고가/연장/status 갱신 UPDATE + cancel 0행 스칼라 프로젝션)
- `domain/auction/AuctionService.java`(**편집** — §4.6 cancel 0행 분기 정정)
- `infra/config/SecurityConfig.java`(**편집** — `GET /auctions/*/bids` 공개. **POST는 인증 유지**)
- (테스트) `domain/bid/BidServiceTest.java`, `integration/BidApiIntegrationTest.java`

### FC-034 — 동시성 테스트 강화 (실행 순서상 FC-033보다 먼저)
쓰기 파일 집합(테스트 전용):
- `integration/BidConcurrencyIntegrationTest.java`, `BidSoftCloseConcurrencyIntegrationTest.java`, `BidHoldInvariantIntegrationTest.java`, `AuctionCancelVsBidConcurrencyIntegrationTest.java`, `BidDeadlockRegressionIntegrationTest.java`
- `support/*` 픽스처 보강 가능성
- 대상: §10 불변식 I1~I10 + 시나리오 7종

### FC-033 — `GET /auctions/{id}/bids` + auction 최고가 실값 대체
쓰기 파일 집합:
- `api/bid/BidController.java`(**편집** — GET) ← FC-032와 교차
- `api/bid/BidSummaryResponse.java`, `BidPageResponse.java`
- `domain/bid/BidService.java`(**편집** — 조회) ← FC-032와 교차
- `domain/bid/BidRepository.java`(**편집** — offset 페이지) ← FC-031과 교차
- `api/auction/AuctionSummaryResponse.java`·`AuctionDetailResponse.java`(**편집** — `bidCount`·`highestBidAmount`·`minNextBidAmount` 실값)
- `domain/auction/AuctionRepositoryImpl.java`·`AuctionRepositoryCustom.java`(**편집** — `bidCount` 상관 서브쿼리)
- `domain/auction/AuctionSlice.java` 등 프로젝션 캐리어(**편집 가능성**)
- (테스트) 목록/상세 실값 테스트, 입찰 내역 조회·마스킹 테스트

### 판정 — **병렬 불가, 전 구간 순차 (단일 backend-impl 순차 단일 패스)**

교차·의존 근거:
1. **선형 의존**: FC-032·033·034는 FC-031의 `Bid`·`MoneyHold`·Repository·`BidErrorCode`를 전제한다.
2. **Flyway 단일 채번**: V11 단일 파일(FC-031 소유).
3. **`BidController`·`BidService` 교차**: FC-032(POST)·FC-033(GET)이 동일 파일 편집.
4. **`BidRepository` 교차**: FC-031(정의)·FC-033(조회 메서드).
5. **`domain/auction/*` 교차**: FC-032(`AuctionRepository`·`AuctionService`)·FC-033(`AuctionRepositoryImpl`·응답 DTO).
6. FC-034는 032의 API·스키마에 전면 의존.

→ CLAUDE.md 섹션 9 팬아웃 조건(의존 없음 ∧ 쓰기파일 무교차)을 **의존·교차 양쪽 위반**. EPIC-ITEM(FC-020→022)·EPIC-AUCTION(FC-026→028) 선례와 동일하게 **하나의 순차 위임**으로 낸다.

### 실행 순서 — **031 → 032 → 034 → 033 (승인 확정 2026-07-18)**

보드 티켓 번호·`depends_on` 필드는 그대로 두고 **실행 순서만** 조정한다.

- 근거 1: FC-032가 이 프로젝트 **최고위험 코드**다. 동시성·홀드 정합이 확정되지 않은 상태에서 FC-033(조회 표현)을 쌓으면 032 재작업 시 프로젝션·응답까지 함께 흔들린다.
- 근거 2: FC-034의 불변식 검증은 **DB 상태 직접 검증**(§10)이라 조회 API에 의존하지 않는다 — 032 직후 실행 가능하다.
- 근거 3: `ENABLE_STOP_REVIEW=1` 한시 구간(032·034)을 연속으로 두면 조회 티켓에서 불필요한 재프롬프트가 줄어든다.

### 티켓 분할·병합 — 현행 4분할 유지

- FC-032를 더 쪼개지 않는다: 직렬화·홀드·즉시해제·최고가·연장이 **하나의 트랜잭션·하나의 서비스 메서드**라, 쪼개면 불변식이 성립하지 않는 반쪽 커밋이 생긴다.
- FC-031을 032에 병합하지 않는다: 스키마(V11)는 롤백 비용이 다른 층이라 커밋을 분리하는 편이 리뷰·롤백에 유리하다(EPIC-AUCTION 선례).

---

## 13. 게이트2 결정 (승인 완료 2026-07-18, 전건 채택)

### (a) ★ 직렬화 메커니즘 — **auction 행 비관적 락(`FOR UPDATE`) + 금전 조건부 CAS 이중 방어 확정**

| | A. `@DistributedLock`(Redis) 단독 | **B. auction 행 비관적 락 (채택)** | C. 낙관적 CAS + 재시도 | D. B + A 계층 결합 |
|---|---|---|---|---|
| 정확성 | **불충분** — 펜싱 토큰 없음, 임대 만료·GC 정지 시 상호배제 상실 | **정확** — TX 수명 = 락 수명, 만료 없음 | 정확 | 정확(B가 담당) |
| 폭주 처리량 | 경합이 **단일 경매 행**에 집중돼 이점 미실현 | InnoDB 행 락 대기(최적화된 경로) | **재시도 폭증**(thundering herd) | B + Redis RTT 2회 |
| 장애 시 동작 | **Redis 다운 = 입찰 전면 중단**(현 Aspect는 연결 예외 미처리 → 500) | DB 외 추가 실패점 없음 | 추가 실패점 없음 | Redis 다운 시 A와 동일 |
| 테스트 | Redis 컨테이너 필요, 만료·장애 재현 곤란 | **MySQL Testcontainers만으로 완결** | 재시도 경로 검증 까다로움 | 컨테이너 2종 |

**결정 근거**:
1. domain-spec §8이 이미 결론을 문서화했다 — *"분산락은 경합 완화 수단이지 정확성 보장 수단이 아니다. 락만 의존하면 Redis 장애·락 만료·클럭 스큐 시 중복 판매가 발생할 수 있다."* 금전이 움직이는 구간에서 정확성을 Redis에 위임할 근거가 없다.
2. **코드 실측으로 A의 한계 2건이 확인됐다**(`DistributedLockAspect`): ① `leaseMs` 고정 임대라 Redisson watchdog가 동작하지 않아 **TX가 10초를 넘기면 상호배제가 상실**된다. ② Aspect가 `InterruptedException`만 잡아 **Redis 연결 예외가 도메인 매핑 없이 500으로 전파**된다.
3. 본 케이스의 경합은 **단일 경매 행**에 집중된다. 앱락으로 대기열을 앞당겨도 결국 같은 행을 직렬 처리하므로 A의 처리량 이점이 실현되지 않는다(락이 유리한 국면은 임계구역이 비싸거나 DB 밖 자원을 다룰 때다).
4. **되돌리기 비용 비대칭**: B→D 전환은 어노테이션 1개(낮음)지만, A 단독으로 갔다가 금전 정합 결함이 관측된 뒤 되돌리는 비용은 매우 크다(금전 데이터 정정 필요).

- **포트폴리오 서사**: 설명 가능한 선택은 "Redisson을 썼다"가 아니라 **"왜 분산락을 정확성 경계로 쓰지 않았는지"를 근거와 실측으로 말할 수 있는 것**이다. `@DistributedLock` 자산은 스켈레톤 데모에 남아 있어 미사용이 아니다.
- **후속 옵션(D)**: Redis 완충을 얹으려면 **선행 보강 2건**이 필수다 — (i) Redis 장애 시 락 없이 진행(graceful degradation)하도록 Aspect 예외 처리 보강, (ii) `leaseMs`를 TX 상한보다 크게 잡거나 watchdog 모드 사용. 보강 없이 얹으면 **가용성만 낮아진다.** 실측 기반 후속 판단 대상이며 본 에픽 범위 밖이다.
- **CLAUDE.md 섹션 1 문언**: bid를 "Redis 분산락 @DistributedLock, E1 활용"으로 기술한 부분은 스켈레톤 기획 시점 서술로 본 결정과 충돌한다. **문언 정정은 메인세션 소관**이다(spec 밖).

### (b) 홀드 원자성 경계 — **전부 단일 트랜잭션 확정**

- §4.1의 4~7단계를 **하나의 `@Transactional`**에 둔다. 직전 홀드 해제가 실패하면 **입찰 자체가 롤백**되어 "부분 실패 상태"가 성립하지 않는다.
- 즉 **"정합 회복" 절차가 필요 없도록 설계한다** — 회복 로직은 그 자체가 검증 부담이자 새 결함면이다.
- 세 경계가 **정확히 일치**한다: 직렬화 구간(auction 행 락) ⊇ 트랜잭션 = 홀드 원자성 경계.
- 해제 UPDATE가 0행이면 무시하지 않고 **예외로 올려 롤백**한다(불변식 위반 감지 = 조용한 자금 드리프트 방지).
- 기각(대안 B2 — 해제를 별도 TX/아웃박스로 분리): "홀드는 잡혔는데 직전 해제가 안 된" 창이 생기고 재시도·보상·중복 해제 방어가 전부 새 요구가 된다. **외부 연동이 없으므로 TX를 쪼갤 이유가 없다** — D-053이 분리를 요구한 대상은 외부 PG 호출이지 내부 원장이 아니다.
- 회귀 방어선: I3·I4·I6.

### (c) 소프트클로즈 연장 규칙 — **`max(end_at, min(now + extend, max_end_at))` 확정**

- §6 전문이 확정 사양이다. 기준점 `now + extend`, 단조 비감소 강제, 상한 클램프 시 `extension_count` 미증가 + **입찰은 정상 성립**, 연장 계산은 직렬화 구간 내 동일 UPDATE, `extension_count` = 실제 연장 횟수.
- 기각(C2 — 기준점 `end_at + extend`): 윈도우 내 다발 입찰이 마감을 **선형 누적**으로 밀어낸다(동시 10건 → +300초). "마감 자원이 무한히 고이는 것을 방지"라는 D-004 취지와 어긋난다.
- 기각(C3 — 상한 도달 시 입찰 거부): 연장 여부는 입찰자 통제 밖이라 부당하고, 계약 §5에 대응 코드도 없다.
- 기본값·상한은 EPIC-AUCTION 게이트2 (c) 승인분 승계(재상신 아님).

### (d) SCHEDULED→ACTIVE 영속 전이 — **입찰 시점 파생 판정 + 동일 TX 내 기회적 영속 승격 확정**

- 입찰 가능 판정은 §3.2 파생식으로, 입찰이 성립하면 **동일 UPDATE에서 `status='ACTIVE'`로 영속 승격**한다.
- **신규 인프라 0.** 워커(지연 인덱스 + 스케줄러)는 마감·만료와 **동일 인프라**라 EPIC-CLOSING에서 한 번에 만든다(domain-spec §9 "세 종류의 트리거를 단일 지연 인덱스로 통합").
- 입찰이 들어온 경매는 영속값이 자연 치유되고, 입찰 없는 경매는 lazy 파생(표시층)으로 충분하다 — auction-spec §9-a와 **모순 없이 확장**된다. FC-029 리뷰 판단 #3(목록 `status` 필터 스테일)의 **부분 완화**이기도 하다.
- 기각(D2 — 워커를 EPIC-BID로 당김): 지연 인덱스·재예약·DB 재구축 스캔이 전부 따라오고, 마감이 없는 상태에서 예약 시작만 워커화하면 같은 인프라를 두 번 만들 위험이 크다(에픽 경계 침범 + 범위 확대).
- 기각(D3 — 파생만): `status` 필터·통계 스테일이 계속 남는다. 승격 비용이 0(이미 실행되는 UPDATE에 컬럼 하나)이라 포기할 이유가 없다.
- 결합 결정: 미개시 입찰 에러코드 = **`BID_007` 신설**(계약 v1.8 F4).

### (e) `BID_004` 판정 근거 — **`auction.highest_bidder_id` 앵커 확정**

- `auction.highest_bidder_id == 주체`면 `BID_004`. 근거:
  1. 계약 §5 문언이 **"연속(현재 최고가 보유자) 입찰"** — 판정 대상이 정확히 이 컬럼이다("직전 입찰자"가 아니다).
  2. 직렬화 구간에서 **이미 락으로 읽은 행**이라 추가 쿼리 0, staleness 0.
  3. 스키마 무변경. auction-spec §9-e가 취소 판정에 쓴 앵커의 **일관 확장**이다.
- 기각(`bid` 테이블 최근 1건 조회): 결과는 같으나 추가 쿼리 + 인덱스 의존이 생기고, `bid`와 `auction`이 어긋났을 때 진실이 모호해진다(이중 진실).
- 경계: 첫 입찰(`highest_bidder_id IS NULL`)은 `BID_004` 미적용.

### 부록 F — 계약·erd 정밀화 (전건 승인·반영 완료)

| # | 대상 | 반영 결과 |
|---|---|---|
| **F1** | erd §4.2 `bid` | **반영 완료(erd v1.0)** — `public_id ULID NOT NULL UK` 추가 |
| **F2** | 계약 §3.3 | **반영 완료(계약 v1.8)** — `BidSummary { bidPublicId, bidderMasked, amount, status, createdAt }` + offset 페이지·마스킹·자금정보 미노출 규약 등재 |
| **F3** | 계약 §3.3 `AuctionDetail` | **반영 완료(계약 v1.8)** — `minNextBidAmount` 파생 필드 추가 |
| **F4** | 계약 §5 | **반영 완료(계약 v1.8)** — `BID_007`(경매 미개시, 409) 신설. `BID_006` 일반화 대신 **신설**을 택한 이유: enum↔계약 1:1 + "아직 시작 안 함"과 "이미 끝남"은 안내 문구·재시도 가능성이 정반대(`ITEM_003` 선례 동류) |
| **F5** | 계약 §3.1 | **반영 완료(계약 v1.8)** — "첫 입찰 하한 = `startPrice`" 문언 추가 |
| **F6** | erd §5 | **반영 완료(erd v1.0)** — `auction (status, highest_bid_amount)` 인덱스 추가. V11에 포함 |

---

## 14. 선결 검토 판정 — 에스크로 CAS owner 조건 (**EPIC-CLOSING 이연 확정**)

**대상**: `ItemInstanceRepository.markListedIfInInventory` — CAS 조건이 `WHERE id = :id AND location = 'INVENTORY'`로 **`owner_id` 조건이 없다.** 소유자 검증은 CAS 직전의 별도 읽기(`item.isOwnedBy(sellerId)`)에 있어 TOCTOU 구조다.

**판정(승인 2026-07-18): EPIC-BID에서 처리하지 않는다. EPIC-CLOSING(소유권 이전 도입)으로 이연하되, 이연을 티켓 DoD로 구속한다.**

근거:
1. **EPIC-BID는 노출면을 늘리지 않는다.** 착취가 성립하려면 소유자 검증과 CAS 사이에 `item_instance.owner_id`가 바뀌어야 한다. 현재 코드베이스에 `owner_id` 갱신 경로는 **없고**(소유권 이전 = EPIC-CLOSING), 입찰은 아이템을 이동시키지 않는다. 본 에픽 종료 시점에도 착취 불가 상태가 유지된다.
2. **지금 고치면 검증할 수 없다.** 재현할 결함이 없어 회귀 테스트를 쓸 수 없고, reviewer는 정적 확인밖에 못 한다. EPIC-CLOSING에서는 **취약해지는 변경(owner UPDATE 도입)과 방어가 같은 리뷰 범위**에 들어와 실제 경합 테스트가 가능하다.
3. **에픽 경계**: 수정 대상이 `domain/item/*`으로 EPIC-BID 쓰기 집합 밖이고, EPIC-AUCTION 등록 경로 테스트 재검증을 유발한다.
4. 이연의 유일한 실질 리스크는 "잊혀짐"이며, 티켓 DoD 고정으로 해소된다.

**메인세션 조치(승인됨)**: EPIC-CLOSING 소유권 이전 티켓 생성 시 DoD에 다음을 **선행 조건으로 등재**한다 —
> `ItemInstanceRepository.markListedIfInInventory`의 CAS 조건에 `AND i.owner.id = :ownerId`를 추가하고, 소유권 이전과 출품 선점의 동시 경합 테스트로 검증한다. (출처: FC-029 보안 리뷰 관찰 · FC-030 §14 이연 판정)

---

## 15. 미해결·이연

- 마감(ACTIVE→SOLD/UNSOLD)·낙찰 차감(`money_hold` CAPTURED)·잔여 홀드 일괄 해제·`bid.status=WON`·`sale_order`·정산·소유 이전 = **EPIC-CLOSING**.
- 즉시구매(`POST /auctions/{id}/purchase`)·`AUCTION_005`·`AUCTION_009` = **EPIC-CLOSING**. 본 에픽의 `BID_002`(buyNow 상한)는 즉시구매를 **항상 유효하게 유지**하기 위한 제약이며 구매 경로 자체는 다루지 않는다.
- 지연 인덱스 워커(마감·예약시작·만료 통합, domain-spec §9) = **EPIC-CLOSING**.
- Redis 락 완충 계층(§13-a 옵션 D) = 실측 기반 후속 판단. 선행 보강 2건 필수.
- `auction.bid_count` 비정규화(§7.3) = 목록 성능 실측 후 필요 시 상신.
- 최소 증분의 DB 정책 테이블 승격(domain-spec §4 명시 경로) = 운영 조정 요구 관측 시.
- 관리자 강제취소(홀드 전량 해제 포함) = 백로그.
- 고정가(shop) = **EPIC-SHOP**. proxy(자동) 입찰·상위입찰 알림 = 범위 밖.
- **처리 완료된 문서 드리프트**: `item-domain-spec` v0.3 §3.1(`markListed()` → 조건부 CAS, FC-029 판단 #5) · `domain-spec` v0.6 §5(취소 조건 SCHEDULED|ACTIVE, §11 G8). 둘 다 2026-07-18 정정.
