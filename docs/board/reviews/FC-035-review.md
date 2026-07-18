# FC-035 — EPIC-BID 통합 리뷰 (reviewer)

- 대상: `88fe01b`(FC-031 스키마·홀드) · `5a4d24a`·`b2258cd`(FC-032 입찰 API) · `db90778`·`87b4254`·`79bb8e9`(FC-034 동시성 테스트) · FC-033 2커밋(내역조회·실값대체·`minNextBidAmount`·keyset). `git diff 434aa26..HEAD -- backend/` 전 44파일
- 기준: `bid-domain-spec.md` v0.3(§4.2·§4.4·§4.6·§10) · `api-contract.md` v1.9 · `domain-spec.md` §4·§8 · `concurrency-review` 스킬 · `.claude/claude-security-guidance.md`
- 방식: 정적 리뷰 + gradle 테스트 실행(Testcontainers 실 MySQL). 앱 :8080 미기동
- 판정일: 2026-07-18

## 최종 판정: **PASS** — critical 0 · major 0 · minor 9

**EPIC-BID Done 전이: 가(可).** 발견은 전부 minor이며 회귀 방어선을 무너뜨리지 않는다. m1·m2·m4는 후속 티켓으로 구속 권고.

### 검증 실행
`:backend:test --tests 'Bid*' --tests 'AuctionCancelVsBid*' --tests 'domain.bid.*' --tests 'AuctionRepositorySliceTest'` → **12 클래스 69건 전건 통과, 실패·에러 0**.

**★ `@Lock(PESSIMISTIC_WRITE)` + 생성자 프로젝션이 실제로 `FOR UPDATE`를 낸다는 직접 증거 확보**: `취소_원인판정_재조회는_동시_입찰이_채운_최고입찰자를_본다`가 통과한다는 것은, 같은 트랜잭션의 일반 `findById`는 옛 값을 보는데 `findCancelStateForUpdate`만 최신 커밋 값을 본다는 뜻이다. **잠금 읽기가 아니면 InnoDB RR에서 원리적으로 불가능하다.** 동일 메커니즘인 `findBidContextForUpdate`의 직렬화도 이로써 간접 입증된다.

---

## minor 발견 (9건)

### m1. 락 획득 *전에* 시각을 포착한다 — 마감 경계가 락 대기 시간만큼 샌다
`BidService.java:69`에서 `Instant now = Instant.now()`, `:72`에서 행 락. **마감 직전 폭주(이 에픽의 대상 시나리오)** 에서 스레드가 락 큐에서 수백 ms~수 초 대기한 뒤 **낡은 `now`로** `isBiddable`·소프트클로즈를 판정한다.
- 기대(I8): `now >= end_at` 이후 모든 입찰은 `BID_006`.
- 실제: 큐 대기 중 실시간이 `end_at`을 넘어도 수용될 수 있다(특히 `max_end_at == end_at`이라 연장 여지가 없는 경매). 연장 폭도 대기 시간만큼 짧아진다.
- I7(단조 비감소)은 `max()`·클램프가 지켜 안 깨지고 금전 불변식도 무관 → minor.
- 기존 테스트가 못 잡는 이유: `마감_시각이_지난_경매는...BID_006`은 `endAt`을 요청 시점에 이미 과거로 둬 전 스레드가 동일 판정을 한다.
- **수정 1줄**(락 획득 직후로 `Instant.now()` 이동).

### m2. `applyBid`가 무조건부 UPDATE — 경매 행에는 "이중 방어"가 없다
`AuctionRepository.java:89-98`의 `WHERE a.id = :id`. 금전 경로는 조건부 CAS + 락 2층인데 최고가 갱신은 **비관적 락 단층**이다. 게이트2 (a)가 표방한 "행 락 + 조건부 CAS 이중 방어"가 auction 행에는 성립하지 않는다. 현재 결함은 아니나(락 유효 확인됨) 락이 후속 리팩터로 약해지면 lost update가 조용히 성립한다.
- 권고: `AND (a.highestBidAmount IS NULL OR a.highestBidAmount < :amount)` + 0행 예외.

### m3. `findActiveByAuctionId`가 비잠금 읽기 — 스냅샷 개방 순서에 의존
`BidService.java:79`. 최신인 근거가 "이것이 트랜잭션의 첫 consistent read"라는 사실뿐이다. spec §4.6.2가 **스스로 "호출 경로 변경으로 쉽게 깨지므로 기본값은 잠금 읽기"**라고 못 박은 자리인데 예외가 적용됐다. 현재는 안전(`JwtAuthenticationFilter`가 DB 미조회, OSIV off, TX가 `place()`에서 시작). **검증용 선행 조회가 하나만 추가돼도 깨진다** → 주석 또는 `@Lock` 권장.

### m4. ★ `MEMBER_002` 탈퇴 차단이 TOCTOU — EPIC-BID가 이 갭을 *활성화*했다
`MemberService.java:126-131`이 `user_balance`를 **비잠금**으로 읽어 `gameMoneyHeld == 0`을 검사한 뒤 soft delete. EPIC-BID 이전엔 `held`가 항상 0이라 검사가 공허했고 경합이 **도달 불가**였다. 이제 도달 가능하다.
- 시나리오: `DELETE /me`와 `POST /bids` 동시 → withdraw가 held=0 읽음 → 입찰이 홀드 잡고 커밋 → withdraw가 soft delete 커밋. 결과는 **탈퇴 계정이 ACTIVE 입찰 + HELD 홀드 보유**.
- **`bid-domain-spec §1·§11 G11`의 "재작업 0 · 정합" 주장은 직렬 실행 전제에서만 참이다. 이 리뷰가 그 주장을 정정한다.**
- 부수 발견: `BidService.currentUserId()`(`:199`)는 주체가 **활성 회원인지 검사하지 않는다**(`MemberService.currentActiveUser()`와 대비). 탈퇴 직후에도 access 토큰 수명(≤30분) 동안 입찰이 성립한다. **EPIC-AUCTION에서 확립된 기존 패턴이라 본 에픽 신규 결함은 아니다.**
- I4·I5 불변식은 유지되고 피해가 행위자 본인 계정에 국한되며 EPIC-CLOSING 홀드 해제가 `money_hold` 기준이라 자금 영구 동결도 없다 → minor.
- **권고: §14(에스크로 CAS owner)와 동일 방식으로 EPIC-CLOSING 티켓 DoD에 구속** — "`withdraw`는 `user_balance`를 잠금 읽기로 검사하고, 탈퇴 vs 입찰 동시 경합 테스트로 검증한다".

### m5. `AuctionService.cancel`이 상세 쿼리 재사용 (`AuctionService.java:159-160`) — 확인요청 #1 판정 참조
### m6. 마스킹 3번째 사본 (`ItemInstanceDetailResponse.java:49-55`) — #3 참조
### m7. `domain.auction → domain.bid` 패키지 의존 — #4 참조

### m8. 계약 문서 드리프트(코드 아님)
`api-contract.md:169`의 `POST /bids` 에러 목록에 **`COMMON_004`(409)가 없다.** `bid-domain-spec §7.1`과 `GlobalExceptionHandler.handleLockFailure`는 이를 낸다. 공통 코드라 치명적이지 않으나 **프론트 재시도 UX의 단일 진실이 비어 있다.**

### m9. V11 마이그레이션 파일을 사후 편집했다
커밋 `5a4d24a`가 이미 커밋된 `V11__bid_and_money_hold.sql`에 `CHECK (amount > 0)` 2건을 추가했다. **내용은 옳은 심층방어지만 Flyway 체크섬이 어긋난다** — V11을 이미 적용한 로컬 DB는 `repair` 없이 부팅 실패한다. 미push 에픽이라 영향이 로컬로 한정돼 minor. **향후 append-only 규율 재확인 권장.**

**참고(결함 아님)**: `GET /bids`의 `page` 상한이 없어 deep offset이 가능하나 스캔이 해당 경매 입찰 행 수로 자연 상한이 걸려 증폭 표면이 아니다. `size`는 100으로 접힌다.

---

## 구현자 확인 요청 6건 — 판정

**#1 `cancel`의 `AuctionWithBidCount` 언랩 → 수용 가능(minor), 후속 정리 권장.** 정확성 영향 없음(CAS + 잠금 읽기 재조회 경로 불변, §4.6 분기 유지). 다만 취소 1회마다 leftJoin 5개 + `COUNT` 서브쿼리가 불필요 실행되고, **읽는 쪽이 "왜 bidCount가 필요한가"를 설명할 수 없는 코드**가 된다. 전용 프로젝션(`findCancelTargetByPublicId`)이 낫다. 블로킹 아님.

**#2 Tuple select + `fetchJoin()` → 저위험, 수용.** `auction`이 select 목록에 있어 규정상 합법, 실 MySQL 통합테스트 커버. 결정적으로 **실패 모드가 전부 시끄럽다** — fetch 무시 시 `LazyInitializationException`(500) 즉시, 쿼리 빌드 거부 시 예외. **조용한 데이터 오염 경로가 없다**는 점이 minor 근거. Hibernate 업그레이드 시 회귀 대상으로 명시해 두면 충분.

**#3 마스킹 3번째 사본 → 후속 티켓 필요(YES). 범위 밖으로 둔 것은 옳았다.** 현재 동작은 `NicknameMasker.mask`와 **완전 동일**(null/빈→`***`, `min(2,len)` 접두). 결함이 아니라 드리프트 리스크다. 다만 **계약 §3.3이 "동일 규약"으로 못 박은 보안 값**이라 한쪽만 바뀌면 곧 식별정보 노출 — 방치 대상 아니다. FC-033이 범위 밖이라 보고만 한 것은 coding-discipline 원칙 3에 정확히 부합(무단 확장이 더 나쁜 선택이었다).

**#4 증분 규칙 단일화 + `domain.auction → domain.bid` → 섹션 4와 충돌하지 않는다. 수용.**
1. 섹션 4가 규정하는 것은 **레이어 방향**(`api → domain → infra → common`)이지 도메인 하위 패키지 간 방향이 아니다. 둘 다 같은 레이어 → 위반 없음. ArchUnit이 최상위만 보는 것은 누락이 아니라 규약과 일치하는 스코프다.
2. **선례 존재**: FC-031의 `domain.currency ↔ domain.bid` 순환이 동일 형태. 새 종류의 결합이 아니다.
3. 의존 대상이 `BidIncrementProperties` — **의존 없는 순수 정책 값 객체**다. 서비스·트랜잭션에 엮인 게 아니다.
대안(구간표 복제)의 비용은 "화면이 안내한 금액으로 입찰했는데 거부됨" = **계약 위반**. 단일 진실원이 명백히 옳다. `상세가_안내한_minNextBidAmount로_입찰하면_정확히_성립한다`가 10,999 거부 / 11,000 성립으로 두 경로를 맞물려 고정 — 좋은 테스트다.

**#5 keyset NULL(MySQL 네이티브 정렬) → 정확성 예측 맞고 테스트가 실제로 고정한다. 성능 근거만 미검증.**
- ASC(NULLS FIRST)/DESC(NULLS LAST)와 `highestBidKeyset` 경계식이 **4분기 모두 일치** 확인. ASC 값 분기에서 NULL이 `gt(value)` unknown으로 자연 배제되는 것까지 정확.
- DESC의 `.or(highestBidAmount.isNull())` 누락 시 "입찰 없는 경매가 2페이지부터 사라진다"는 예측 **맞다**.
- **테스트가 껍데기가 아니다**: `AuctionRepositorySliceTest` 신규 3건이 NULL 2 + 동값 2 픽스처로 ASC/DESC 전체 순서를 커서로 재구성해 `containsExactly` 단언, **page size 1**(모든 그룹 전이가 경계가 되는 최악 조건)까지 실행.
- 다만 기각 근거인 "Hibernate `col IS NULL` 에뮬레이션으로 F6 인덱스 무력화"는 **어떤 테스트·EXPLAIN으로도 검증되지 않았다.** 합리적 예측이나 실측이 아니다 → 문서에 "미실측 예측"으로 표기하는 것이 정직하다.

**#6 I6를 `setRollbackOnly`로 검증 → 게이트2 (b)를 실제로 증명한다. 수용. `@MockitoSpyBean`보다 강한 증거다.**
- `상위_입찰_트랜잭션을_롤백하면_직전_홀드가_되살아난다`가 결정적. 홀드가 `REQUIRES_NEW`였다면 롤백 후에도 직전 홀드가 `RELEASED`로 남고 신규 홀드가 살아 있어야 한다. 실제로는 `heldSum(first) == START_PRICE`, `heldCount() == 1`, `count() == 1` — **경계 밖으로 샌 쓰기가 하나도 없다**는 관찰 가능한 증명.
- 스파이는 "어떤 메서드가 호출됐나"를 보지만 이 테스트는 "다섯 테이블 효과가 전부 되돌아갔나"를 본다. **후자가 게이트2 (b)의 실제 주장이다.**
- `MoneyHoldService`의 `Propagation.MANDATORY`가 **구조적 보증**을 얹는다 — 검증(테스트) + 강제(전파속성) 조합.

---

## 불변식 I1~I10 — **전 10건 실질 검증. 미보호 없음**

DB 상태 직접 단언(`em.clear()` 후 JPQL)이고, `assertAuctionAnchorInvariants`/`assertMoneyConservation`을 기반 클래스에 한 번만 정의해 시나리오별 해석 드리프트를 막은 설계가 특히 좋다.

껍데기 아님 근거:
- **실패를 조용히 삼키지 않는다** — `placeAndCaptureCode`가 `BusinessException` 외 예외를 클래스명으로 반환하고 `unexpected`가 비어야 통과. 500·락 실패가 "거절"로 집계돼 합계 단언을 우회하는 경로가 막혀 있다.
- I9는 실행마다 승자가 갈리는 문제를 **홀수 라운드 선입찰로 결정적 분기**를 만들어 해결 + 무경합 결정 테스트 별도.
- 데드락 회귀는 라운드마다 즉시 단언해 1차 원인(락 실패)이 2차 증상(BID_004)에 가려지지 않게 함(`79bb8e9`). **뮤테이션 사고가 실제로 테스트에 반영된 흔적.**
- I5는 "가용 3건분 사용자가 8개 *서로 다른* 경매에 동시 입찰 → 정확히 3건"으로 **경매 행 락이 도와줄 수 없는 축**만 떼어 `user_balance` CAS 단독 방어력을 증명. 이중 방어의 두 축을 분리 검증했다.

**단 하나의 사각(m1)**: I8의 "`now >= end_at` 이후 전건 거부"가 **락 큐 대기 중 실시간이 마감을 넘는 경우**를 커버하지 않는다. m1 수정 시 함께 닫힌다.

---

## 그 밖에 확인한 것 (문제 없음)

- **도메인 인가**: `BidPlaceRequest`가 `amount` 단일 필드라 **IDOR 구조적 불가능**. 주체는 `SecurityContext`에서만. `BID_003`=락 스냅샷 `seller_id`, `BID_004`=락 스냅샷 `highest_bidder_id` — 우회 경로 없음. `SecurityConfig`가 `HttpMethod.GET`으로만 `/auctions/*/bids`를 열고 POST 401을 테스트로 고정.
- **정보 노출**: `BidSummaryResponse`에 실식별자·자금 정보 없음. 테스트가 **응답 본문 원문**에 원문 닉네임·loginId 부재를 단언 — jsonPath만 보는 것보다 옳다.
- **AOP self-invocation**: `MoneyHoldService`·`InventoryService` 전부 외부 빈. `BidService` 내부 private에 어노테이션 기반 기능 없음. 무력화 경로 없음.
- **락 실패 정의**: `PessimisticLockingFailureException` → `COMMON_004`(409). `DeadlockLoser`·`CannotAcquireLock` 공통 상위를 한 곳에서 수신.
- **락 순서**: `placeHold`가 두 잔액 갱신을 한 메서드 안에서 `user_id` 오름차순 강제 — **호출측 규율이 아니라 구조로 강제**. `bid`/`money_hold` INSERT의 부모 행 S 락이 순환에 기여하지 않음 확인.
- **계약 정합**: `BID_001~007` ↔ §5 코드·HTTP 상태 **1:1**(422/422/403/409/422/409/409). 최고가 실값 대체가 **스키마·계약 무변경**(상관 서브쿼리 + 기존 컬럼).
- **경계값**: buyNow 정확히 일치→`BID_002` ✓ / 최소 증분 11,000 성립·10,999 거부 ✓ / `max_end_at == end_at` → 연장 없이 성립, `extension_count` 0 ✓ / 윈도우 정각은 트리거되나 실제 연장 0 ✓ / 증분 구간 12개 경계 전수 ✓.
- **불필요 변경 없음**: 전 44파일이 요청에 추적. `AuctionCursorResponse`·`AuctionSlice`·`AuctionRepositoryCustom` 변경은 `Auction → AuctionWithBidCount` 타입 전파의 필연적 귀결. `frontend/**` 미변경.

---

## 메인세션 조치 제안
1. **m4 → EPIC-CLOSING DoD 구속**(§14 선례와 동일 형식). **가장 실질적인 후속 항목.**
2. **m1 + m2 → FC-032 소규모 후속 티켓**(락 후 시각 재포착 + `applyBid` CAS 가드 + m1용 회귀 테스트 1건).
3. **m6 → 1파일 티켓**(`ItemInstanceDetailResponse.mask` → `NicknameMasker` 위임).
4. **m8 → 계약 v1.10 문언 보정**(architect, `POST /bids` 에러 목록에 `COMMON_004` 추가).
5. **m5 → 백로그**(cancel 전용 프로젝션), **m9 → 프로세스 확인**(Flyway append-only).
