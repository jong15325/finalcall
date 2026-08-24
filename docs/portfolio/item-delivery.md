# 도시에: 게임 아이템 지급 연동 (EPIC-ITEM-DELIVERY — 웹→게임 우편함 다리)

> 포트폴리오(케이스 스터디·이력서 불릿·소개 페이지) 재가공용 **중간 산출물**이다. 정본이 아니라
> 코드·spec·계약·보드·리뷰·결정로그에서 큐레이션한 파생 요약이다. 모든 주장은 증거(파일·커밋·테스트)로
> 뒷받침한다 — 과장·미구현을 구현으로 쓰지 않는다.

- **영역/에픽**: EPIC-ITEM-DELIVERY (장터에서 낙찰·즉시구매한 아이템을 실제 게임 캐릭터 인벤토리로 도착시키는 "다리"의 **웹측 우편함** — 1단계)
- **상태**: 완료 · reviewer 2라운드 통과(changes-requested→passed) · 에픽 완료 `/security-review` clean(신규 취약점 0) · 게이트3 Done 승인(2026-08-05) · 원격 반영 확인
- **기간(커밋 기준)**: `42d15a7`(계약 정본화·보드) → `5dfead4`(백엔드 배송 다리) ∥ `c609900`(프론트 배송 UI) → `0b19bc9`(계약 v1.1 정합·리뷰 기록) → `1304738`(주문 목록 배지 활성)
- **관련 티켓**: FC-185(계약)·FC-186(스키마)·FC-187(enqueue)·FC-188(소유 이동·재판매 가드)·FC-189(Redis 알림)·FC-190(프론트 배송 UI)·FC-191(통합 리뷰)·FC-192(배송 조회 API·분해 갭 보완)·FC-193(주문 목록 배지 활성) · FC-194(환경 테스트 2건, 에픽 밖 백로그)

## 1. 개요 (한 문단)

장터의 소유권 이전은 지금까지 **finalcall 내부 `item_instance`에서만 완결**됐다 — 구매자가 낙찰·즉시구매로
아이템을 손에 넣어도, 그가 게임(new_sp)에 접속해 캐릭터 인벤토리(`user_item`)를 열면 그 아이템이 **없다.**
이 괴리가 "단절 지점"이다. 이 에픽은 그 괴리를 닫는 **다리의 웹측 절반**을 구현했다: 정산이 성립하는 바로
그 트랜잭션 안에서 **내구 우편함(`item_delivery`)에 배송 1행을 enqueue**하고, 게임 서버가 나중에 그 우편함을
claim해 자기 인벤토리에 materialize한다. 표면은 "산 아이템이 게임으로 배송된다"지만, 엔지니어링의 핵심은
**두 내구 도메인(웹 MySQL·게임 인벤토리)에 걸친 지급을 유실·이중지급·이중존재 없이 잇는 것**이며,
그 답으로 **하이브리드 우편함(DB 내구 정본 + Redis best-effort 알림)** · **정산 TX 내 트랜잭셔널 아웃박스** ·
**claim 멱등 프로토콜(at-least-once 전달 + item_uuid UK로 exactly-once 효과)** · **재판매 2중 방어**를 택했다.
게임 서버 실이식(claim 구현·boundary 번역)은 게임 재컴파일이 필요해 **후속 별건(phase-2)** 으로 분리하고,
이번엔 게임이 맞출 **DB 프로토콜·계약만 확정**했다("웹 먼저, 게임 나중").

## 2. 해결한 기술 도전과 해법

- **두 내구 도메인에 걸친 지급의 유실·이중쓰기 차단 — 하이브리드 우편함 + 트랜잭셔널 아웃박스**: 아이템·금전이
  걸린 배송은 **유실 불가**다. 순수 Redis Stream 우편함은 (1) 손실창(RDB 스냅샷/AOF everysec 손실), (2)
  이중쓰기(정산=MySQL, XADD=Redis, 공유 TX 없음 → "팔렸는데 배송 없음" 또는 "배송됐는데 판매 없음"),
  (3) 장애 전파(Redis 다운=배송 전면 중단)로 **정확성 경계가 될 수 없어 기각**했다. 해법은 **DB 우편함을 내구
  정본으로, Redis를 폴링 제거용 best-effort 알림으로만** 쓰는 하이브리드다. 배송 생성을 정산과 **같은 TX**
  (트랜잭셔널 아웃박스)에 넣어 소유이전·배송생성을 exactly-once로 묶고, Redis 신호는 정산 커밋 후
  (`AFTER_COMMIT`)에만 best-effort로 발행한다. **Redis가 죽어도 최악은 "다음 안전망 폴/다음 접속까지 지연"일
  뿐 아이템 유실이 없다.** 이는 입찰이 Redis 분산락 대신 DB 비관락을 택한 근거(bid-spec §8: "정합성은 DB,
  처리량은 락 — 분산락은 정확성 보장 수단이 아니다")의 배송판 적용이다.

- **at-least-once 전달 + exactly-once 효과 — claim 멱등 프로토콜(DB 프로토콜만 확정)**: 게임 크래시로 CLAIM~APPLY
  사이가 끊기면 리스 만료 후 재청구해야 하고(at-least-once), 그러면 같은 배송이 두 번 apply될 수 있다. 이를
  **상태 CAS(PENDING→CLAIMED→APPLIED) + 리스 재청구 + 자연 멱등키 `item_uuid`(char40 UK)** 로 무해화한다 —
  웹이 배송 시점에 uuid를 발급해 우편함 행에 실어 보내고, 게임 `user_item.itm_uuid`에 UK를 두면 같은 uuid
  재삽입이 UK 충돌로 no-op가 된다. **재청구는 허용하되 apply를 멱등키로 봉인 = at-least-once 전달 + exactly-once
  효과.** claim/apply/ack/defer는 전부 조건부 CAS(`WHERE status=… [+claim_token=…]`)로 단일 승자·만료 토큰 무시를
  보장한다. 게임측 실이식은 phase-2지만, 이번에 게임이 맞출 **DB CAS SQL 규격을 계약으로 못박았다**(delivery-spec §5.2).

- **웹↔게임 이중 존재·재판매 2중 방어 — location XOR CAS + 배송 존재 가드**: 같은 아이템이 웹 인벤토리와 게임
  인벤토리에 동시 존재하면 재판매·중복 지급이 된다. 두 방어선을 이어 붙였다 — (1) 배송 APPLIED 관측 후 웹
  reconciler가 `item_instance.location`을 **`IN_GAME`(신규 enum 값)** 으로 CAS 전이하면, 출품 CAS
  `markListedIfInInventory`(`WHERE location='INVENTORY'`)가 IN_GAME 아이템을 자동 배제한다. (2) 그 전이가 완료되기
  전 구간(SOLD 직후~IN_GAME 전이)은 출품 경로가 **"해당 item_instance에 FAILED 아닌 배송 존재" 가드**로 차단한다.
  이 두 방어선이 **게임 apply~웹 reconciler 전이 사이의 lag 창**까지 이음매 없이 덮는다(reviewer가 잡은 MAJOR-2,
  §5 참조).

- **낙찰·즉시구매 양 경로 자동 커버 — SettlementRecorder 공통 꼬리 1지점**: 배송 enqueue를 별도 신규 경로가
  아니라 **이미 낙찰(closing)·즉시구매(purchase)가 공유하는 `SettlementRecorder.record(...)` 공통 꼬리 말미
  (5단계)** 에 1행 INSERT로 얹었다. 이 한 곳이 양 경로의 유일 정산 지점이므로 배송도 두 경로에 자동 적용된다.
  `sale_order_id` 1:1 UK가 정산 1건당 배송 1행을 DB에서 보장(이중 배송 차단)하며, 이는 `platform_revenue_ledger.sale_order_id`
  UK 선례와 동류다. 향후 EPIC-SHOP source_type=SHOP도 같은 recorder를 재사용하면 자동 포함된다.

- **커밋 후 신호의 정확한 배선 — AFTER_COMMIT + 예외 삼킴 + self-invocation 회피**: Redis 신호를 TX 안에서 쏘면
  롤백 시 "판매 없는데 배송 신호"(유령 신호)가 나간다. `SettlementRecorder`는 TX 안에서 **이벤트만 발행**하고,
  실제 PUBLISH는 별도 빈 `DeliveryNotifier`가 `@TransactionalEventListener(AFTER_COMMIT)`로 커밋 후에만 수행한다.
  `fallbackExecution=false`(기본)라 활성 TX가 없으면 리스너가 아예 실행되지 않아 커밋 없는 발행 경로가 구조적으로
  없다. 커밋 후 콜백에서 던진 예외는 이미 커밋된 TX 위로 relay되므로 **Redis 실패를 반드시 잡아 로깅만** 한다
  (정확성 무영향). `@EventListener` 계열이라 AOP self-invocation 함정과도 무관하다(외부 빈 경유).

## 3. 핵심 결정과 근거 (트레이드오프)

- **G2 우편함 전송 방식 = 하이브리드(DB 정본 + Redis 알림), 순수 Redis 기각**: 채택 = DB 내구 정본 + Redis
  best-effort 알림. 기각 = 순수 Redis Stream+Consumer Group(손실창·이중쓰기·장애 전파). 포기한 것 = Redis 단독의
  낮은 폴링 부하·단순 배선. 얻은 것 = "커밋=영속" 보장·정산과의 원자 결합·Redis 장애 격리. (근거: delivery-spec §3,
  proposal §3.2, bid-spec §8 정신)

- **G3 enqueue 원자성 = 정산과 같은 TX(트랜잭셔널 아웃박스)**: 채택 = SettlementRecorder 꼬리에서 정산과 한 TX로
  INSERT. 배제 = 정산 커밋 후 별도 단계 enqueue(커밋 후 enqueue 실패 시 "팔렸는데 배송 없음"). 트레이드오프 =
  정산 임계 경로에 INSERT 1개가 더해지지만, 소유이전·배송생성이 exactly-once로 묶인다(D-B). (근거: delivery-spec §7.3)

- **G4 claim = DB 직접 CAS 프로토콜(웹 REST API 아님)**: 채택 = 게임이 finalcall MySQL에 DB 직접 접근해 CAS로
  claim/apply/ack. 배제 = 웹 REST 엔드포인트 신설. 근거 = 통합 스키마·read 통합/write 소유자 모델(memo boundary
  선례), 지연 민감 경로에 네트워크 홉·직렬화·인증을 얹지 않음, 웹이 쓰는 것과 동일한 CAS 원시 재사용. 웹은
  스키마·상태 머신·자족 스냅샷·멱등키·Redis 채널만 계약면으로 제공한다. (근거: delivery-spec §13 (b), 게이트2 승인)

- **G5 소유 이관 상태 = location enum 확장(`IN_GAME`), 별도 상태축 기각**: 채택 = `item_instance.location`에 값
  `IN_GAME` 추가. 기각 = 별도 boolean/status 축. 근거 = location은 단일 디스크리미네이터이며, 별도 축을 두면
  디스크리미네이터가 둘이 되어 모순 상태(location=INVENTORY ∧ delivered=true = 이중 존재)를 **표현 가능**해진다 —
  단일 축 확장이 이중 존재를 **구조적으로 불가능**하게 하고, 출품 CAS(`WHERE location='INVENTORY'`)가 자동 배제한다.
  구현 이득 = `location`이 VARCHAR라 enum 값 추가에 DDL 변경조차 없었다. (근거: delivery-spec §13 (a), item-spec §3.1)

- **G6 실패 회수 = 우편함 안전 보관·멱등 재시도, 금전 미역전**: 채택 = 만실(확장 상한 96)·타임아웃·하드 실패 시
  DEFERRED/PENDING/FAILED로 우편함에 안전 보관하고 재시도, **판매·정산·잔액은 되돌리지 않음**. 배제 = 배송 실패 시
  보상 트랜잭션(금전 역전). 근거 = 판매는 이미 완결됐고 게임머니 총량 보존(I-H)·정산 원장·소유이력을 되돌리면 그
  불변식이 깨진다. 아이템은 유실이 아니라 우편함/커스터디에 안전 보관되므로 역전이 불필요·유해하다. (근거: delivery-spec §7.1, D-G)

- **G1 배치 = B-지금(크로스-스키마) / A-목표(완전 통합)**: 채택 = finalcall이 소유하는 우편함은 native 단일 스키마로
  짓되, 게임 살아있는 인벤토리(new_sp)는 이번에 이관하지 않음. 근거 = 인벤토리는 게임 최고 핫패스(접속 중 상시
  쓰기)라 즉시 이관은 위험·대작업. **우편함이 곧 그 점진 이관을 무중단으로 가능케 하는 seam**이다. 완전 통합(A)은
  별도 에픽·별도 게이트2. (근거: delivery-spec §2, memo 선례)

- **웹 먼저·게임 나중(개발 순서)**: 게임 서버는 재컴파일 가능하고 클라이언트는 고정이다. 따라서 웹측을 먼저
  완성하고 게임을 그 결과에 맞춘다. **boundary 번역(itm_skill 재패킹·level−1·usr_id 매핑)은 전적으로 게임 서버
  소속** — 웹은 정규화된 순수 값을 우편함에 **자족 스냅샷**으로 저장만 하고 번역하지 않는다(memo §8 선례). (근거:
  delivery-spec §6.2·§12.2, proposal §9.1)

## 4. 아키텍처

의존 방향 feature-first — 신규 `delivery` feature + 기존 `settlement`/`item`/`auction`/`shop` 재사용. **정산·소유
자산은 EPIC-CLOSING/PURCHASE 그대로, 신규 표면은 우편함 테이블·라이프사이클 워커·배송 조회 API·프론트 배지뿐.**

```
[웹 정산 TX — SettlementRecorder.record() @Transactional(MANDATORY)]
  (1) sale_order INSERT               ─ (source_type, source_id) UK: 이중 SOLD 차단
  (2) platform_revenue_ledger INSERT  ─ sale_order_id UK: 수수료 이중 적립 차단
  (3) inventoryService.transferListedToBuyer ─ owner→buyer, LISTED→INVENTORY/TEMP
  (4) item_ownership_history append
  (5) item_delivery INSERT (PENDING)  ◀── G3 트랜잭셔널 아웃박스. sale_order_id UK: 이중 배송 차단(D-A)
      · item_uuid 발급(UUID 36자)      ── 멱등키(D-E)
      · 자족 스냅샷 복사(type_code·level 1-based·skill1/2·percent·gf·nickname) ── D-C
  (6) eventPublisher.publishEvent(DeliveryEnqueuedEvent) ── TX 안에선 발행만
} COMMIT
      │ (AFTER_COMMIT, best-effort)
      └─▶ DeliveryNotifier: Redis PUBLISH "delivery:{recipientUserId}"  ── 실패 무해(try-catch, 정확성 무영향)

[웹 배경 워커 — DeliveryLifecycleWorker(@Scheduled) → DeliveryLifecycleService(독립 TX)]
  · reconcile: APPLIED 관측 → markInGameIfInCustody CAS → item_instance.location=IN_GAME(+temp_storage 정리)
  · reclaim  : 리스 만료 CLAIMED → PENDING 벌크 CAS(at-least-once 재청구 원천)
  · markFailed: 하드 실패 격리(→FAILED), 금전 미역전

[웹 읽기 — DeliveryController → DeliveryQueryService(@Transactional readOnly)]
  · GET /me/deliveries        ─ recipient=주체 스코프(IDOR 차단), CursorResponse<DeliverySummary>
  · GET /me/deliveries/{id}   ─ 당사자만, DELIVERY_001(404 열거방지 통일), claim_token 미노출

[재판매 2중 방어]
  AuctionService.register / ShopService.register:
    · existsByItemInstanceIdAndStatusIn(id, LISTING_BLOCKING_STATUSES={PENDING,CLAIMED,DEFERRED,APPLIED})  ── 배송 존재 가드
    · markListedIfInInventory(WHERE location='INVENTORY')                                                   ── IN_GAME 자동 배제

[게임 서버 — phase-2 후속 별건(이번 범위 밖, DB 프로토콜만 계약)]
  loop/on-signal: claim(CAS) → apply(user_item materialize, itm_uuid UK) → ack(CAS) / defer(CAS)
  boundary 번역(itm_skill 재패킹·level−1·usr_id 매핑) = 전적으로 게임 서버 소속

계약: delivery-domain-spec v1.1 · erd §4.4(item_delivery)·§6(Flyway V21) · api-contract §4.6(배송 조회)·§4.3(OrderSummary)
```

**신규 vs 재사용 경계**: 신규 = `item_delivery` 테이블(V21)·`ItemDelivery`/`DeliveryStatus` 엔티티·리포지토리·
`DeliveryLifecycleService`/`Worker`(reconcile/reclaim/fail)·`DeliveryQueryService`/`Controller`·`DeliveryNotifier`·
`item_instance.location=IN_GAME`·재판매 배송 존재 가드·프론트 배송 배지/배너. 재사용(핵심 로직 변경 최소) =
`SettlementRecorder` 공통 꼬리(1행 INSERT + 이벤트 발행 추가)·`markListedIfInInventory` 출품 CAS·정산·잔액·수익원장·소유이력.

## 5. 프로세스/품질 서사 (contract-first · reviewer 2라운드)

이 에픽은 **contract-first + 병렬 팬아웃 + reviewer 2라운드**가 규정대로 작동한 사례다:

- **게이트1(에픽 승인)**: 분해안 7티켓 확정. 순서 = FC-185(계약) → FC-186(스키마) → {FC-187→FC-189, FC-188}(백엔드
  직렬, 정산 영역 파일 겹침) ∥ FC-190(프론트, 계약 후 병렬·파일 무교차) → FC-191(리뷰).
- **게이트2 형상 3건 확정(FC-185)**: (a) item_instance 이관 상태 = location enum 확장(IN_GAME), (b) 게임 claim =
  DB 직접 프로토콜(웹 API 아님), (c) sale_order_id 1:1 UK가 낙찰·즉시구매 양 경로 커버 — 모두 사용자 승인.
- **병렬 팬아웃**: 백엔드(정산 영역)와 프론트(delivery/item/order feature)가 **쓰기 파일 무교차**라 병렬. 프론트는
  계약(api-contract §4.6)만으로 선구현.
- **분해 갭 자동 보완(FC-192)**: FC-190 착수 중 프론트가 소비할 **배송 조회 API 백엔드 티켓이 분해안에 누락**됨을
  발견 → `GET /me/deliveries` 티켓을 보완 신설. 계약이 파급을 미리 정의했기에 재협상 없이 티켓 추가로 수렴.
- **파급 보완(FC-193)**: FC-190이 "주문 목록(`OrderSummary`)에 `itemInstancePublicId`가 없어 배지를 graceful하게
  숨김"을 반환 → 사용자 옵션1(additive 필드 추가) 결정 → architect 계약 승격 → 백엔드 필드 추가(기존 fetch join
  재사용, N+1 없음)로 배지 자동 활성. 형상 보존(필드 1개 추가).
- **reviewer 2라운드(FC-191)**: R1 = **changes-requested**(프로덕션 코드 critical 0, MAJOR 2건) → 재작업 → R2 =
  **passed**. reviewer가 잡은 MAJOR 2건:
  - **MAJOR-2(재판매 가드 APPLIED lag 창 구멍)**: 초기 가드 상태집합 `{PENDING,CLAIMED,DEFERRED}`가 APPLIED를
    제외 → **게임 apply(APPLIED)~웹 reconciler IN_GAME 전이 사이 lag 창**에서 item_instance는 아직 INVENTORY인데
    아이템은 이미 게임 인벤에 재료화돼, 재출품이 뚫려 이중 존재(D-F 위반) 가능. phase-1(게임 apply 미구현)에서는
    도달 불가이나 phase-2 착지 전 봉쇄 필수. spec §5.4↔§6.1 내부 정의 불일치도 함께 드러남. **해소** = 가드를
    `LISTING_BLOCKING_STATUSES={PENDING,CLAIMED,DEFERRED,APPLIED}`(FAILED 아닌 전부)로 확장 + spec v1.1 정합화 +
    lag 창 차단 테스트 2건 추가. (근거: FC-191-review.md MAJOR-2, delivery-spec v1.1 변경 이력)
  - **MAJOR-1(테스트 격리 오염)**: `DeliveryQueryApiIntegrationTest`가 격리 실행은 GREEN인데 전체 suite에서 RED —
    이 에픽이 SettlementRecorder에 배송 enqueue를 추가하면서, 정산을 커밋하는 다른 통합 테스트들이 이제 배송 행도
    함께 커밋 → 조회 테스트의 `content[0]` 단언이 **타 테스트가 커밋한 배송**을 집었다. **해소** = `content[0]` 대신
    자기 `deliveryPublicId`로 조회·단언. recipient 스코프 자체는 원래 airtight(IDOR 아님). (근거: FC-191-review.md MAJOR-1)
- **에픽 완료 보안 리뷰**: 온디맨드 `/security-review` clean(신규 취약점 0). 자금 탈취·인증 우회·이중 지급·이중
  존재를 여는 결함 미발견. 사용자 Done 승인 후 관련 커밋의 원격 반영을 확인했다.

## 6. 트러블슈팅/교훈

- **enqueue 추가가 다른 테스트의 격리를 깼다(MAJOR-1)**: 정산 꼬리에 배송 INSERT를 얹는 순간, "정산을 커밋하는
  모든 통합 테스트"가 배송 행을 부수적으로 커밋하게 된다. 공유 Testcontainers DB에서 조회 테스트가 `content[0]`
  같은 **순서 의존 단언**을 쓰면 타 테스트 커밋분에 오염된다. 교훈 = 공유 정본을 건드리는 변경은 그 정본을 읽는
  기존 테스트의 격리 전제를 흔든다 — 단언을 **자기 식별자 기준**으로 좁혀야 한다.

- **공유 ItemTemplate 재사용이 하드코딩 단언을 파손(FC-192 재작업 근본원인)**: `CloseWorkerConcurrencyIntegrationTest`가
  9301~9304 "마감템플릿"을 커밋하면서, 배송 조회 테스트의 하드코딩 displayName 단언이 전체 suite 맥락에서 파손됐다.
  해소 = 표시 문자열 단언을 **persist 캡처 동적 기대치**로 전환하되, 결정값(typeCode/level/skill/status)은 정밀
  단언 유지. 교훈 = 표시 파생값과 결정값을 분리해, 공유 픽스처에 흔들리는 축과 계약이 고정하는 축을 다르게 단언한다.

- **두 spec 문서의 가드 정의 드리프트(MAJOR-2)**: §5.4(쓰기 소유자)와 §6.1(재판매 차단)이 가드 상태집합을 서로
  다르게 서술(§6.1이 APPLIED 제외) → 구현이 좁은 쪽을 따라 lag 창 구멍이 생겼다. reviewer가 "spec §5.4↔§6.1 내부
  불일치"로 명시 → architect가 v1.1로 **가드 정의를 "FAILED 아닌 모든 배송"으로 통일**하고 근거(관리자 개입·게임
  미재료화로 FAILED 제외)를 못박음. 교훈 = 같은 불변식을 두 절에서 서술하면 드리프트가 코드 구멍으로 새어 나온다 —
  reviewer가 코드뿐 아니라 **spec 내부 정합**까지 확인소로 잡았다.

- **"게임 apply~IN_GAME 전이 lag"라는 분산 타이밍 구멍**: 게임(claim/apply)과 웹(reconciler)이 서로 다른 시각에
  각자 테이블을 쓰는 이상, 두 쓰기 사이에는 반드시 창이 생긴다. 단일 방어선(location CAS)만으로는 그 창을 못 덮어,
  **배송 존재 가드가 창을 앞에서 막고 location CAS가 뒤를 이어받는 2중 방어**로 이음매를 없앴다. phase-1에서는
  발생원(게임 apply)이 없어 도달 불가지만 **phase-2 착지 전에 미리 봉쇄**한 것이 핵심 — "지금 도달 불가"를 "안전"으로
  착각하지 않았다.

## 7. 증거

- **엔드포인트/기능**:
  - `GET /api/v1/me/deliveries` · `GET /api/v1/me/deliveries/{deliveryPublicId}` — 구매자 배송 상태 조회
    (recipient=주체 스코프, `CursorResponse<DeliverySummary>`, claim_token 미노출, `DELIVERY_001` 404 통일). 정본 = api-contract §4.6.
  - 게임 claim/apply/ack = **DB 직접 CAS 프로토콜**(웹 REST 아님, delivery-spec §5.2·§10.2) — phase-2 게임 서버 소관.
  - `OrderSummary += itemInstancePublicId`(additive, FC-193) — 주문 목록 배지 활성. api-contract §4.3.
- **핵심 파일**:
  - `backend/src/main/java/com/finalcall/domain/settlement/service/SettlementRecorder.java` — 정산 꼬리 (5)단계
    `item_delivery` enqueue(트랜잭셔널 아웃박스·item_uuid 발급·자족 스냅샷 복사) + (6)단계 `DeliveryEnqueuedEvent` 발행. `@Transactional(MANDATORY)`·PC clear 함정 준수.
  - `backend/src/main/java/com/finalcall/domain/delivery/entity/ItemDelivery.java`·`DeliveryStatus.java` —
    우편함 엔티티(BaseCreatedEntity append 원장)·상태 머신(claim/apply/defer/fail 도메인 메서드)·`LISTING_BLOCKING_STATUSES`(재판매 가드 상태집합, APPLIED 포함 근거 주석).
  - `backend/src/main/java/com/finalcall/domain/delivery/service/DeliveryLifecycleService.java`·`DeliveryLifecycleWorker.java` —
    reconcile(APPLIED→IN_GAME CAS)·reclaim(리스 만료 재청구 벌크 CAS)·markFailed(하드 실패 격리, 금전 미역전). 건별 독립 TX·try-catch 격리.
  - `backend/src/main/java/com/finalcall/domain/delivery/service/DeliveryNotifier.java` — `@TransactionalEventListener(AFTER_COMMIT)` Redis PUBLISH(fallbackExecution=false·예외 삼킴·self-invocation 무관).
  - `backend/src/main/java/com/finalcall/domain/delivery/service/DeliveryQueryService.java`·`controller/DeliveryController.java`·`dto/DeliverySummaryResponse.java`·`DeliveryDetailResponse.java` — /me 스코프 배송 조회.
  - `backend/src/main/java/com/finalcall/domain/item/entity/ItemLocation.java`(IN_GAME)·`repository/ItemInstanceRepository.java`(`markInGameIfInCustody`·`markListedIfInInventory` CAS).
  - `backend/src/main/java/com/finalcall/domain/auction/service/AuctionService.java`·`shop/service/ShopService.java` — 출품 경로 배송 존재 가드(`existsByItemInstanceIdAndStatusIn(id, LISTING_BLOCKING_STATUSES)`) + location CAS 2중 방어.
  - `backend/src/main/resources/db/migration/V21__item_delivery.sql` — 우편함 스키마(public_id·sale_order_id 1:1 UK·item_uuid UK·(status,created_at)·(recipient_user_id,status) 인덱스).
  - `frontend/src/features/delivery/lib/deliveryView.ts` — 5상태→3버킷 매핑(SHIPPING/ARRIVED/FAILED, 미등록값 배송중 보수 폴백)·팔레트 정본 사용.
  - `frontend/src/features/delivery/components/DeliveryBadge.tsx`·`DeliveredBanner.tsx` + `lib/api/deliveries.ts`·`lib/queries/deliveries.ts` — 배송 배지·도착 배너(세션 1회 dismiss)·타입드 API 클라·쿼리훅.
- **테스트**:
  - `backend/src/test/java/com/finalcall/integration/DeliveryEnqueueIntegrationTest.java` — SOLD/BUYNOW enqueue·정산 롤백 시 배송 롤백·sale_order UK 이중 배송 차단(D-A·D-B·D-C).
  - `backend/src/test/java/com/finalcall/integration/DeliveryLifecycleIntegrationTest.java`(11건) — reconcile(INVENTORY/TEMP→IN_GAME·temp_storage 정리·멱등)·IN_GAME 재출품 불가·**APPLIED lag 창 재출품 차단(MAJOR-2 회귀)**·리스 재청구·만실 DEFERRED·하드 FAILED 금전 미역전.
  - `backend/src/test/java/com/finalcall/integration/DeliveryNotifyIntegrationTest.java` — 커밋 후 발행·롤백 시 미발행·Redis 실패 무해.
  - `backend/src/test/java/com/finalcall/integration/DeliveryQueryApiIntegrationTest.java`(7건) — /me 스코프 격리·커서 페이지네이션(MAJOR-1 격리 하드닝 후 전체 suite green).
  - `backend/src/test/java/com/finalcall/domain/delivery/entity/ItemDeliveryTest.java`·`repository/ItemDeliveryRepositorySliceTest.java` — 상태 전이 CAS·조회면 슬라이스.
  - 프론트: `deliveryView.test.ts`·`DeliveryBadge.test.tsx`·`DeliveredBanner.test.tsx`·`InventoryItemCard.test.tsx`.
- **불변식(reviewer/테스트 정본)**: delivery-spec §8 D-A~D-H(enqueue 원자성·자족 스냅샷·claim 멱등 CAS·at-least-once+exactly-once·이중 존재 차단·금전 미역전·단조 전이).
- **커밋**:
  - `42d15a7` docs(delivery): EPIC-ITEM-DELIVERY 착수 — 배송 계약 정본화 + 보드 (FC-185)
  - `5dfead4` feat(delivery): 백엔드 배송 다리 (웹 우편함) (FC-186·187·188·189·192)
  - `c609900` feat(delivery): 프론트 배송 상태 UI (FC-190)
  - `0b19bc9` docs(delivery): 계약 정합(v1.1)·보드·리뷰 기록 (FC-188 MAJOR-2·FC-191)
  - `1304738` feat(delivery): 주문 목록 배송 배지 활성 — OrderSummary += itemInstancePublicId (FC-193)
- **계획/계약 정본**: `docs/spec/proposals/game-item-delivery-proposal-v0.1.md`(게이트2 G1~G7)·`docs/spec/delivery-domain-spec.md`(v1.1)·`docs/spec/erd.md`(item_delivery·V21)·`docs/spec/api-contract.md` §4.6/§4.3·`docs/spec/item-domain-spec.md`(IN_GAME).
- **리뷰**: `docs/board/reviews/FC-191-review.md`(2라운드·MAJOR 2건).
- **목업**: `docs/ux/mockups/template-delivery-status.html`(FC-190 배송 상태 디자인 게이트).

## 8. 범위 밖 · 후속 (phase-2)

- **게임 서버 claim 실이식(2단계)**: 게임이 우편함을 claim/apply/ack하는 실코드 + `user_item.itm_uuid` UK 신설.
  게임 서버 소스·재컴파일 필요. 이번엔 게임이 맞출 DB 프로토콜·계약만 확정했다(웹은 게임 조정을 기다리지 않음).
- **boundary 포맷터(게임 서버 소속)**: itm_skill 재패킹·level−1·usr_id 매핑·닉네임→usr_id 폭 흡수. 전적으로
  게임 서버 소관 — 웹은 자족 스냅샷만 싣는다(delivery-spec §6.2).
- **완전 통합(A)**: 게임 살아있는 인벤토리(new_sp)를 finalcall로 이관·게임 서버 재지향. 별도 에픽·별도 게이트2.
- **역방향 출품(게임→장터 deposit)·장착(user_equipments) 연동·레거시 게임 인벤 임포트**: 범위 밖. 이번 다리는 웹→게임 단방향 지급만.
- **환경 테스트 위생(FC-194, 에픽 밖 백로그)**: AuctionRegisterConcurrency(seed bid FK 순서)·GatewayAccess(actuator 503) 2건 — 배송 회귀 아님, 별도 추적.
