# FinalCall 보안 위협모델 체크리스트

> 이 문서는 **상세 정본**이다. 압축 색인(불변식 + 부재주장 규율)은
> `.claude/claude-security-guidance.md`(플러그인 로드용)에 있으며 각 항목 ID로 이 문서를
> 역참조한다. 색인과 상세가 어긋나면 **이 문서(상세)가 정본**이다.
> 각 체크 항목에는 안정적 항목 ID(BID-n·DUP-n·IDOR-n·JWT-n·SET-n·LOG-n·RL-n)가 부여돼 있다 —
> 색인·리뷰·플러그인이 이 ID를 태그로 참조한다. ID는 항목이 사라져도 재사용하지 않는다.

## 목적

자금을 다루는 서비스의 도메인 위협 체크리스트다. 플러그인 보안 리뷰(구현 중 자동 층)와
reviewer(확인소)가 **공유 참조**한다. 두 층이 같은 항목으로 같은 것을 보게 해, "차단이 존재하는가"만
보고 "차단이 어떻게 동작하는가"를 놓치는 사각(보안 findings SEC-015 회고 — 같은 파일 같은 행을
질문이 달라 놓친 사례)을 구조적으로 줄인다.

우선순위는 **인가 > 동시성 > 멱등**이다. 되돌리기 비용이 큰 순(자금 탈취·인증 우회 = 즉시 차단
사유)으로 배열했다.

## 범위

- 아래 5개 도메인(입찰 동시성 / 중복구매·wash trade / /me 인가·IDOR / JWT 세션 폐기 / 정산 정합·멱등)과
  1개 횡단 절(로깅 위생)을 다룬다. 레이트리밋은 경계만 명시하고 앱 레벨 잔여만 포인터로 남긴다.
- 스타일·성능·기능 정확성은 범위 밖이다(각각 코드 스타일 규약·QA·기능 테스트 소관).
- 다계정 공모(collusion)는 계약·구현으로 막을 수 없어 **범위 밖 확정**이다(보안 SEC-012 WONTFIX —
  재개 트리거는 실거래 데이터 축적이지 일정이 아니다). 이 체크리스트는 그것을 검사 대상으로 두지 않는다.

## 정본 참조 (어긋나면 계약이 정본)

| 축 | 정본 | 비고 |
|---|---|---|
| API 계약·에러코드 | `docs/spec/api-contract.md` (v1.5) | 응답 코드·인증 절·에러코드 표(5절)의 진실원 |
| 데이터 제약·UK·CAS 대상 | `docs/spec/erd.md` (v0.8) | 컬럼·유니크·인덱스·홀드 상태 enum |
| 도메인 규칙 | `docs/spec/domain-spec.md` (v0.5) | 상태 머신·홀드·회원 생애주기 |
| 위협 원장 | `docs/security/threat-model.md` · `docs/security/findings.md`(SEC-NNN) | 각 항목의 발견 티켓 |
| 전역 원칙 | `CLAUDE.md` 섹션 4 | AOP self-invocation·시크릿 fail-fast·시간 타입 |

**충돌 시 우선순위: 계약(api-contract) > erd > domain-spec > decision-log.** 계약과 코드가 어긋나면
계약이 정본이며, 코드를 계약에 맞춘다.

## 사용법 (심각도 랭킹)

각 항목은 체크박스다. 결과를 아래로 표기한다.

- **통과(O)** — 근거 코드·테스트를 원문으로 확인.
- **미흡(X)** — 결함. 심각도를 함께 매긴다.
  - **Critical** — 자금 탈취·인증 우회의 확정 경로. **즉시 차단**(Done·push 불가).
  - **Major** — 자금 정합·인가 리스크. 도메인 판정 전 수정.
  - **Minor** — 정보성·저실현성. 비차단, 처방 비용이 낮으면 함께 처리.
- **해당없음(-)** — 이 도메인에 미적용.

**부재 주장 규율(보안 checklist [도구 규율] 준수):** "인가 누락 없음"·"하드코딩 0건" 같은 부재를 근거로
쓸 때는 (a) 탐색 방법 1구(도구·경로·패턴), (b) 사용 도구를 병기한다. 목록 결과에 잘림 표시
(`Showing N of M`)가 있으면 전수가 아니다 — 다시 세거나 "전수 아님"이라 쓴다. 근거 없는 "없음"은
통과 근거로 쓰지 않는다.

---

## 도메인 1. 입찰 동시성 (bid)

마감 직전 입찰이 폭주하고(domain-spec 10절 "마감 직전 입찰 폭주"), 동일 사용자가 중복 입찰한다.
원칙은 **"정합성은 DB, 처리량은 락"**(domain-spec 8절) — 분산락(Redisson)은 경합 완화 수단이지
정확성 보장 수단이 아니다. 락만 의존하면 Redis 장애·락 만료·클럭 스큐에서 이중 처리가 난다.

- [ ] **[BID-1] 락-트랜잭션 경계 순서** — `@DistributedLock`은 트랜잭션 경계 **바깥**에서 획득·해제되는가
  (락 안에서 커밋 완료 후 해제). 락이 트랜잭션 안이면 커밋 전 해제로 경합이 새어든다.
  근거: CLAUDE.md 섹션 4 · concurrency-review 부록 C-3(락-트랜잭션 순서, HIGHEST_PRECEDENCE).
- [ ] **[BID-2] self-invocation으로 @DistributedLock 무력화 없음** — 같은 클래스 내부 호출은 프록시를 안 타
  어노테이션이 적용되지 않는다. 입찰 직렬화 진입점이 **외부 빈을 경유**하는가. 내부 호출로 락이
  조용히 빠지면 마감 폭주에서 최고가 경합이 그대로 노출된다.
  근거: CLAUDE.md 섹션 4(AOP self-invocation) · concurrency-review 부록 C-1.
- [ ] **[BID-3] 최고가 직렬화 갱신** — `auction.highest_bid_amount`·`highest_bidder_id` 갱신이 경매 단위로
  직렬화되고 최종 정합은 조건부 UPDATE/CAS로 보증되는가. 비정규화 최고가가 손실 갱신(lost update)으로
  뒤집히지 않는가.
  근거: erd auction.highest_bid_amount·highest_bidder_id(비정규화) · domain-spec 8절(입찰 유효성·최고가
  갱신 경매 단위 직렬화) · D-008.
- [ ] **[BID-4] 홀드 원자성·이전 최고입찰자 즉시 해제** — 입찰 수용 시 게임머니 홀드 생성(money_hold HELD)과
  직전 최고입찰자 홀드 즉시 해제(RELEASED)가 최고가 갱신과 **동일 직렬화 단위**에 묶이는가. 마감 일괄
  해제가 아니라 즉시 해제여야 잔액이 장시간 묶이지 않는다(P-008). 홀드-입찰 1:1(money_hold.bid_id UK)이
  깨지지 않는가.
  근거: domain-spec 4절·6절(P-008 즉시 해제) · erd money_hold(status HELD/RELEASED/CAPTURED, bid_id UK).
- [ ] **[BID-5] 소프트클로즈 연장 상한** — 마감 연장 판단이 입찰 수용과 **같은 직렬화 단위**에 있는가(입찰은
  성공했는데 연장이 누락되는 틈 방지). 연장이 `max_end_at`을 초과하지 못하는가 — 상한 없는 연장은
  마감 자원이 무한히 고이는 DoS다.
  근거: domain-spec 4절(총연장상한 필수)·8절(연장 판단 동일 직렬화 단위) · erd auction.max_end_at·
  base_end_at·extension_count · D-004.
- [ ] **[BID-6] BID 계열 도메인 검증이 락 안에서 평가** — 최소 증분(BID_001), buyNowPrice 이상(BID_002),
  자기 경매 입찰(BID_003), 연속(최고가 보유자) 입찰(BID_004), 잔액 부족(BID_005), 마감/종료
  (BID_006)이 락·직렬화 구간 **안에서** 평가되는가. 락 밖에서 검증하면 TOCTOU로 우회된다.
  근거: 계약 3.1절 POST /auctions/{id}/bids 에러코드 BID_001~006 · domain-spec 4절.
- [ ] **[BID-7] 잔액 검증 TOCTOU 없음** — 가용(= balance − held) 검사 후 홀드가 원자적이지 않으면 동시 다중
  요청이 각각 통과한 뒤 합산이 가용을 초과한다. `UPDATE ... SET held=held+:amt WHERE available>=:amt`류
  조건부 원자 갱신인가.
  근거: SEC-008(잔액 TOCTOU, 게이트2 표본) · erd user_balance(game_money_held) · D-008.

## 도메인 2. 중복구매·wash trade 방지 (auction/shop/purchase)

같은 매물에 이중 낙찰·이중 구매가 나거나, 판매자가 자기 매물을 사서 자전거래(wash trade)로 시세를
조작한다(sale_order가 시세 집계 market-prices 소스). 종료성 전이는 **조건부 CAS 단일 승자**로 처리해
동시 요청 중 하나만 성립시킨다(domain-spec 8절).

- [ ] **[DUP-1] 종료성 CAS 단일 승자** — SOLD/CANCELLED 전이가 `... WHERE status='ACTIVE'` 조건부 UPDATE로
  단일 승자를 뽑는가(영향 행 0이면 이미 종료 → 409). 즉시구매(AUCTION_006)·마감 낙찰·판매 성립
  (SHOP_004)·취소가 이 패턴을 공유하는가.
  근거: domain-spec 8절·10절(SOLD 확정 원자성) · erd auction.status·shop.status · 계약 3.1/3.2절
  (AUCTION_006·SHOP_004 이미 종료 409) · D-008.
- [ ] **[DUP-2] 출품 CAS(중복 출품 차단)** — 경매·고정가 등록 시 아이템을 인벤토리→출품 에스크로로
  `location INVENTORY→LISTED` CAS 이동해 중복 출품을 막는가(단일 아이템이 두 리스팅에 동시 걸리지
  않음). 이미 출품중이면 409(AUCTION_002·SHOP_002).
  근거: erd item_instance.location(INVENTORY/TEMP/LISTED 단일진실, 플래그 B) · 계약 3.1/3.2절
  (AUCTION_002·SHOP_002) · erd 5절(출품 중복 방지 = location 전이 CAS, 부분 유니크 인덱스 불요).
- [ ] **[DUP-3] 자기거래 차단 — 입찰·즉시구매·고정가 대칭** — 자기 경매 입찰(BID_003)뿐 아니라 즉시구매
  (AUCTION_009)·고정가 구매(SHOP_006)에서도 판매자 == 구매자가 차단되는가. 주체는 SecurityContext
  기준이며 body로 넘어온 식별자를 신뢰하지 않는가. 구매 경로에 자기구매 차단이 빠지면 wash trade가
  뚫린다.
  근거: SEC-003(자기구매 차단, FIXED 계약 v0.2) · 계약 3.1절 AUCTION_009·3.2절 SHOP_006·BID_003 대칭 ·
  threat-model purchase/settlement 표.
- [ ] **[DUP-4] Order·정산·소유이전 단일 TX** — SOLD 확정과 sale_order 생성·정산(잔액 증감)·소유 이전
  (item_instance.owner_id 갱신 + item_ownership_history 기록)이 **하나의 트랜잭션**으로 원자 처리되는가.
  거래는 내부 게임머니로만 이뤄지므로 외부 연동(충전)을 이 TX에 엮지 않는가.
  근거: domain-spec 8절(SOLD 확정 + Order 생성 단일 TX) · erd sale_order(status SETTLED, settle_amount) ·
  item_ownership_history(transfer_type TRADE, sale_order_id) · D-053.
- [ ] **[DUP-5] 검증 우회 경로 없음** — API를 직접 호출해 소유자·자기구매·상한 검증을 우회하는 경로가 없는가
  (게이트웨이 우회 직접접근 포함). 검증이 컨트롤러가 아니라 서비스·CAS 층에 있는가.
  근거: SEC-003 조치(게이트2 검증 우회 표본) · 계약 1.6절 GATEWAY_403(직접접근 차단, GatewayAccessFilter).

## 도메인 3. /me 인가·IDOR (member/item/order)

타인 리소스 식별자를 열거·조작해 접근한다(IDOR). 주체는 **서버가 토큰을 검증해 SecurityContext에서
결정**하며 `X-User-Id` 등 헤더를 신뢰하지 않는다(D-065). public_id ULID는 순번 열거를 낮추지만 인가를
대체하지 않는다.

- [ ] **[IDOR-1] 주체 = SecurityContext(헤더 불신)** — 인증 주체를 body·헤더가 아니라 검증된 토큰의
  SecurityContext에서 얻는가. `X-User-Id` 등 클라이언트 공급 신원을 신뢰하는 경로가 없는가.
  근거: 계약 1.2절(서버 토큰 검증·X-User-Id 미신뢰) · D-065 · threat-model auth Spoofing(양호).
- [ ] **[IDOR-2] 자원 소유자·당사자 서버측 대조** — `/me/*`·주문 상세·relocate·orders가 자원 소유자·거래
  당사자를 서버에서 대조하는가. 주문은 구매자·판매자 당사자만(ORDER_002 403), relocate·아이템은
  소유자만(ITEM_002 403). 식별자만 알면 접근되는 경로가 없는가.
  근거: 계약 4.3절 ORDER_002·4.2절 ITEM_002 · SEC-011(인가 적용 표본, 게이트2) · threat-model
  item/inventory IDOR.
- [ ] **[IDOR-3] public_id 추측불가 ≠ 인가** — public_id(ULID) 추측 곤란성을 인가 통제로 삼지 않는가. ULID는
  앞부분에 생성 시각(ms)을 인코딩해 생성 순서가 식별자만으로 노출된다(SEC-010, 정보성 수용). 민감
  리소스(charge 등)는 착수 시 무순서 식별자 여부를 재확인한다.
  근거: 계약 1.1절(public_id ULID) · SEC-010(WONTFIX 조건부 — charge 도메인 착수 시 재확인, 보안
  checklist 회수 등재분 #1).
- [ ] **[IDOR-4] PATCH /me 매스어사인 방지** — 프로필 수정이 `nickname`만 받는가. `isAdmin`·잔액·public_id 등
  서버 권위 필드가 요청 body로 덮어써지지 않는가(mass assignment). 응답 스키마도 loginId·passwordHash를
  싣지 않는가.
  근거: 계약 2.5절 PATCH /me(수정 가능 필드 nickname 한정) · GET /me(loginId·passwordHash 미노출) ·
  MEMBER_001(닉네임 중복 409).
- [ ] **[IDOR-5] 관리자 플래그 서버검증** — `is_admin`은 서버 권위이며 클라이언트 플래그는 표시 제어일 뿐인가.
  `/admin/**`가 SecurityContext 기반 role 필터로 일괄 인가되는가(URL 표기만으로 인가 보장 안 됨).
  비관리자의 force-cancel 호출이 403(AUTH_005)인가.
  근거: 계약 1.2절·2.5절(isAdmin 서버 권위) · 4.5절 force-cancel AUTH_005 · erd user.is_admin ·
  SEC-011(/admin 일괄 인가, 게이트2) · threat-model admin.

## 도메인 4. JWT 세션 폐기 완전성 (auth)

탈취된 토큰·로그아웃·탈퇴 후 잔여 세션으로 자금에 접근한다. 자금 시스템이라 탈취·로그아웃 대응이
가능한 **서버 저장 refresh** 방식을 채택한다(SEC-006 FIXED). access는 짧은 만료 무상태.

- [ ] **[JWT-1] access 무상태·refresh 서버저장(해시)** — access는 무상태 JWT(짧은 만료)이고, refresh는
  서버에 **해시된 값**으로 저장되는가(평문 저장 아님). 서버 저장이라야 폐기·탈취 대응이 된다.
  refresh 원문·access 원문·해시가 로그에 남지 않는가(로깅 위생 LOG-1 상호참조).
  근거: 계약 2절 토큰 전략(SEC-006) · CLAUDE.md F1(HS256, access 30m) · concurrency-review JWT 중점.
- [ ] **[JWT-2] 1회성 회전·재사용 탐지 무효화** — `/refresh`가 재발급마다 이전 refresh를 폐기(1회성 회전)하고
  신규를 발급하는가. 폐기된 토큰 재사용이 탐지되면 해당 refresh 세션을 무효화하는가(유출 refresh 반복
  재발급 차단). 만료·무효·재사용은 401(AUTH_004).
  근거: 계약 2절 POST /refresh 회전(SEC-006, D-070)·AUTH_004 · SEC-006 조치(회전·재사용 탐지).
- [ ] **[JWT-3] logout·탈퇴 세션 전폐기** — logout이 refresh를 무효화하는가(서버 저장분 폐기 필수, 204). 탈퇴
  (DELETE /me)가 refresh 세션을 **전부** 폐기하는가 — 탈퇴 후 잔여 세션으로 접근 불가여야 한다.
  탈퇴 자체가 진행 중 거래(활성 경매·홀드 입찰·미완료 주문) 보유 시 MEMBER_002(409)로 선차단됨을
  전제한다 — 세션 폐기와 거래 종료성은 별개 관문이다(중복구매 DUP-1·정산 SET-1 상호참조, MEMBER_002 확장지점).
  근거: 계약 2절 POST /logout(refresh 무효화 필수)·2.5절 DELETE /me(refresh 세션 전부 폐기, MEMBER_002) ·
  domain-spec 6.1절(탈퇴 시 refresh 세션 전부 폐기) · SEC-006.
- [ ] **[JWT-4] 탈퇴 주체 COMMON_005 열거방지** — 토큰은 유효하나 주체가 탈퇴(soft delete)된 계정이 만료 전
  access로 `/me`를 호출하면 401 `COMMON_005`(세션 무효)로 응답하는가. 미인증·만료 토큰 401과 **동일
  코드·포맷**이라 탈퇴 여부가 응답으로 드러나지 않는가(회원 열거 방지). 실패 응답의 타이밍도 분기별로
  달라지지 않는가(레이트리밋 RL-2 열거 타이밍 상호참조).
  근거: 계약 2.5절 v1.5(탈퇴 주체 401 COMMON_005)·5절 COMMON_005 · SEC-007(회원 열거) · 게이트2 승인.
- [ ] **[JWT-5] 재가입 세션 미승계** — login_id·nickname 재사용으로 재가입한 신규 회원이 과거(탈퇴) 회원의
  세션·잔액·이력을 승계하지 않는가. soft delete 자연키 UK(생성 컬럼 패턴)로 삭제행과 신규행이 별도
  회원으로 분리되는가. 단건 조회에 활성 필터(`...AndIsDeletedFalse`)가 붙어 다건 반환(로그인 파손)이
  없는가.
  근거: erd 1절 D-081(생성 컬럼 UK `login_id_active`·`nickname_active`, 동반 필수 활성 필터) ·
  domain-spec 6.1절(재가입 UK 재사용·이력 별도 보존) · 계약 2.5절 재가입 허용.

## 도메인 5. 정산 정합·멱등 (charge/exchange/settlement/balance)

자금 온램프(충전·교환)와 성립(정산)이 공격 표면이다(threat-model 자금 흐름 지도). 무상환 캐시 발행·
이중 크레딧·이중 차감·잔액 음수를 막는다. 멱등 앵커는 **클라이언트가 아니라 서버·PG 권위** 값에 건다.

> 네거티브 스페이스(해당없음, 오탐 방지): 충전 확정은 **pull-confirm**(서버가 토스 승인 API를 재조회)
> 모델이라 PG가 서버로 밀어주는 **push 웹훅이 없다**. 따라서 "웹훅 서명 검증(HMAC signature) 부재"는
> 이 도메인에 **해당없음(-)** 이다 — reviewer·플러그인이 웹훅 서명 누락을 결함으로 오탐하지 않도록 명시한다.
> 신뢰 앵커는 서버-투-서버 승인 재조회(SET-2)와 pg_tx_id UK 멱등(SET-4)이다.

- [ ] **[SET-1] 정산 단일 TX·홀드 확정/해제** — 낙찰 정산이 최고입찰자 홀드를 차감 확정(CAPTURED)하고 나머지
  홀드를 해제(RELEASED)하는 것을 종료 전이와 **동일 직렬화 단위**에 묶는가. sale_order 생성·잔액 증감·
  소유 이전이 단일 TX인가(도메인 2 DUP-4와 교차 — 여기서는 홀드 정산 관점).
  근거: domain-spec 6절·9절·10절(마감 시 최고입찰 차감 + 나머지 홀드 해제, 종료 전이 동일 직렬화) ·
  erd money_hold(CAPTURED/RELEASED)·sale_order(settle_amount) · D-053.
- [ ] **[SET-2] 서버 확정 금액(클라 amount 불신)** — 충전 confirm이 토스 **서버-투-서버 승인 API(시크릿 키)**로
  승인·금액을 재조회해 확정하는가. 클라이언트 amount를 근거로 캐시를 반영하지 않는가(신뢰 시 무상환
  캐시 발행 = Critical 승격). 승인액과 charge 불일치는 422(CHARGE_002). 정산·최종가도 서버 확정값인가.
  근거: 계약 4.4절 POST /charges/confirm(SEC-001·002, 클라 amount 미수용)·CHARGE_001·002 · SEC-002.
- [ ] **[SET-3] charge 소유자 검증** — confirm이 호출자 JWT와 `charge.user_id`를 대조하는가(타인 충전건 confirm
  가로채기 차단). 불일치는 403(CHARGE_003).
  근거: 계약 4.4절 confirm(charge 소유자 검증 SEC-002)·CHARGE_003 · threat-model charge Spoofing.
- [ ] **[SET-4] 충전 콜백 멱등(pg_tx_id UK)** — 캐시 반영이 `pg_tx_id`(=paymentKey) 기준 멱등인가.
  `charge.pg_tx_id` UK로 동일 PG 승인 재반영을 **DB에서** 차단하는가(멱등 앵커가 클라이언트 값이 아님).
  중복 승인은 200 no-op.
  근거: 계약 4.4절(pg_tx_id 멱등)·CHARGE 중복 200 · erd charge.pg_tx_id UK(멱등 앵커) · SEC-001.
- [ ] **[SET-5] 교환 멱등(복합 UK)** — `/exchanges`가 `Idempotency-Key` 헤더로 이중 제출·재시도를 1회만
  처리하는가. `money_exchange (user_id, idempotency_key)` 복합 UK로 중복 교환 재실행을 DB 차단하는가
  (클라이언트 공급 키라 전역 아닌 사용자 스코프). 역방향 교환은 422(EXC_002)로 차단(현금화 우회 방지).
  근거: 계약 4.4절 POST /exchanges(Idempotency-Key SEC-004)·EXC_001·002 · erd money_exchange
  (user_id, idempotency_key) 복합 UK · SEC-004.
- [ ] **[SET-6] 원자 증감(잔액 음수·손실갱신 방지)** — 캐시 차감·게임머니 지급·홀드 증감이 조건부 원자 갱신
  (`... WHERE available>=:amt`)인가. read-modify-write 경합으로 잔액이 음수가 되거나 손실 갱신(lost
  update)으로 뒤집히지 않는가. 캐시 잔액 부족은 422(EXC_001·BID_005·SHOP_005).
  근거: erd user_balance(cash_balance·game_money_balance·game_money_held, 원자적 갱신 D-008) ·
  SEC-008 · 계약 EXC_001·BID_005·SHOP_005.
- [ ] **[SET-7] 서버 시각(UTC) 검증** — 마감·시간 전이가 서버 클럭·지연 인덱스 기준인가(클라 시간 불신). 경매
  생성 시간 파라미터가 서버 검증되는가 — `endAt > now`, `startAt ≤ endAt`, `maxEndAt ≥ endAt`, window·
  extend 양수·상한 이내. 위반 시 422(AUCTION_008). 시간은 Instant(UTC) 통일.
  근거: 계약 3.1절 서버 검증(SEC-009)·AUCTION_008 · CLAUDE.md 섹션 4(시간 타입 Instant UTC) ·
  domain-spec 9절(마감 서버 클럭·지연 인덱스) · SEC-009.

---

## 공통·횡단 절 A. 로깅 위생 (전 도메인)

5개 도메인 어디에도 온전히 걸리지 않는 횡단 관심사다. 자금·인증 값이 로그·에러 응답·트레이스에
새면 저장소·집계(Loki)·화면 어디서든 재유출된다. 로깅은 관측 편의지 통제가 아니므로, 통제(시크릿·
PII 미유출)를 로깅이 깨지 않는지만 본다.

- [ ] **[LOG-1] 절대 금지 값 로그 미출력(유출 시 고심각도)** — refresh 토큰 원문, PG 시크릿/키(토스
  secretKey), 비밀번호 해시, JWT(access·refresh) 원문이 로그·MDC·트레이스·에러 응답 어디에도 남지
  않는가. 이 중 하나라도 로그에 실리면 저장소·집계에서 재유출되는 고심각도 결함이다. 예외 스택·요청
  덤프에 토큰 헤더가 통째로 찍히는 경로가 없는가.
  근거: CLAUDE.md 섹션 4(시크릿 fail-fast) · 계약 2절 토큰 전략(refresh 서버 해시 저장, SEC-006) ·
  threat-model 시크릿·설정 횡단 절.
- [ ] **[LOG-2] PII성 값 로그 최소화·마스킹** — 잔액(cash_balance·game_money_balance)·거래 금액이 로그에
  무분별하게 남지 않는가(PII성 — 주의 등급). 디버깅상 필요하면 최소화·마스킹하고, 접근 통제가 있는
  경로로만 남기는가. 금지(LOG-1)만큼 강하진 않으나 프라이버시 등급으로 관리 대상이다.
  근거: threat-model charge/bid/settlement 표(자금 값) · 보안 checklist 3(에러 응답 정보 노출).
- [ ] **[LOG-3] public_id는 시크릿 아님(등급 격하)** — public_id(ULID)는 **설계상 공개 식별자**로 API 응답에
  이미 노출된다. 따라서 로그에 남는 것을 시크릿 누출로 취급하지 않는다 — 상관관계/프라이버시 등급으로
  격을 내린다. (ULID 시각 성분 노출은 정보성 SEC-010 WONTFIX; charge 등 민감 리소스는 IDOR-3에서
  무순서 식별자 여부를 별도 재확인.) 이 항목은 "public_id 로그 = 시크릿 결함" 오탐을 막는 규율이다.
  근거: 계약 1.1절(public_id ULID 공개 식별자) · SEC-010(정보성 수용) · IDOR-3 상호참조.

## 레이트리밋 경계 절 (범위 밖 명시 + 앱 레벨 잔여 포인터)

새 위협 도메인이 아니다. 경계를 명시해 오탐을 막고, 게이트웨이가 못 덮는 앱 레벨 잔여만 다른 절로
포인터한다.

- [ ] **[RL-1] 레이트리밋 = 게이트웨이 소관(경계)** — rate limit은 **엣지 게이트웨이**(SCG, Redis 토큰버킷
  `RequestRateLimiter`)가 담당하고 **앱 레벨은 off**(INCLUDE_RATE_LIMITER=false)가 설계다. 초과는 엣지에서
  429(GATEWAY_429, `Retry-After` 동반). 따라서 앱 서비스 코드에 rate limit이 없는 것은 **결함이 아니라
  경계**다 — reviewer·플러그인이 앱 레벨 rate limit 부재를 결함으로 오탐하지 않는다.
  근거: CLAUDE.md 토폴로지(D-068)·Stage E2(INCLUDE_RATE_LIMITER=false) · 계약 1.6절·5절 GATEWAY_429 ·
  SEC-005 FIXED(gateway `application.yml:20~33` auth-rate-limited 라우트) · SEC-013 WONTFIX(오탐 철회).
- [ ] **[RL-2] 로그인 실패 응답 열거 타이밍(앱 잔여)** — 게이트웨이 rate limit은 속도만 죽인다. 앱 레벨에서
  로그인·조회 실패 응답이 존재/부재·활성/탈퇴에 따라 **코드·포맷·타이밍**이 갈려 회원 열거 단서를
  주지 않는가(login 단일 코드 AUTH_003, 탈퇴 주체 COMMON_005). JWT-4·IDOR-3와 상호참조.
  근거: SEC-007(회원 열거)·AUTH_003 단일 코드 · JWT-4 COMMON_005 상호참조 · findings SEC-005 완화 실체.
- [ ] **[RL-3] confirm/교환 멱등(앱 잔여)** — rate limit이 뚫려 재시도가 폭주해도 자금 확정이 멱등이면
  이중 반영이 없다. 충전 confirm은 pg_tx_id UK(SET-4), 교환은 복합 UK(SET-5)로 DB 차단되는가.
  레이트리밋의 앱 레벨 안전망은 멱등 앵커다 — 정산 절과 상호참조.
  근거: 계약 4.4절(pg_tx_id·Idempotency-Key 멱등) · SET-4·SET-5 상호참조 · SEC-001·004.
- [ ] **[RL-4] 계정 단위 잠금 정책 유무(앱 잔여)** — 게이트웨이 rate limit 키는 **IP 기준**
  (`clientIpKeyResolver`)이라 분산 IP 크리덴셜 스터핑은 계정 단위로 누적되지 않는다. 계정 단위(로그인
  실패 누적 잠금·알림) 정책이 필요한지는 wallet/auth 도메인 착수 시 판단한다 — 현재는 미도입이 의도된
  공백임을 명시(SEC-005 잔여는 SEC-014 실배포 전 조건으로 이관).
  근거: 계약 gateway 라우트 key `clientIpKeyResolver`(IP 기준) · SEC-005(잔여 SEC-014)·SEC-007.

---

## 신규 위협 도메인 착수 시

신규 도메인·기능을 착수하면 그 도메인의 위협 서술 + 체크박스 절을 이 문서에 추가한다. 새 절의 각
항목에는 새 ID 접두(도메인 약어 + 일련번호)를 부여하고, 압축 색인(`.claude/claude-security-guidance.md`)에
불변식 한 줄 + 부재주장을 함께 등재한다. 항목은 `docs/security/threat-model.md`의 STRIDE 표와
`docs/security/findings.md`(SEC-NNN)에서 도출하며, 각 체크박스에 근거 코드(계약 에러코드·erd 제약·
decision-log 결정번호)를 실재 대조해 인용한다(추정 금지). 계약과 어긋나면 계약이 정본이다.
