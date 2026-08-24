# FinalCall 운영형 시나리오 데이터 계약

상태: **v0.1 — 승인·v2로 전환됨**
소유: architect
범위: 배포된 FinalCall을 실제 운영 흐름처럼 검증하기 위한 20인 시나리오 데이터. 애플리케이션 기능/API 계약과 기존 V1~V28 스키마는 변경하지 않는다.

근거: `member-domain-spec.md`, `item-domain-spec.md`, `auction-domain-spec.md`, `bid-domain-spec.md`, `closing-domain-spec.md`, `shop-spec.md`, `memo-domain-spec.md`, `chat-domain-spec.md`, `fee-policy-spec.md`, `erd.md`, Flyway V3~V28.

## 1. 목적과 경계

- 사용자 20명의 구매·판매 성향, 인벤토리, 경매/입찰, 고정가 마켓, 주문/정산, 1:1 채팅, 쪽지(`user_memo`)를 서로 연결된 하나의 운영형 시나리오로 만든다.
- 마스터 데이터는 기존 `item_template` 및 `skill_definition`만 참조한다. 시드 편의를 위한 가짜 템플릿·스킬 정의를 추가하지 않는다.
- 데이터는 **자동 부팅/Flyway 경로에 포함하지 않는다**. 운영 프로파일 부팅만으로 생성되어서는 안 된다.
- 실제 사용자, 실제 거래, 기존 V9/V12/V13 데모 데이터는 수정하거나 삭제하지 않는다. 아래 건수는 이번 시나리오 데이터만의 정확한 건수다.
- 보드/게시글, OAuth 소셜 계정, 게임 서버의 실제 인벤토리 물질화는 범위 밖이다.

## 2. 주입 계약

### 2.1 실행 방식

게이트2 권고안은 **애플리케이션과 별도인 수동 시드 명령**이다. 전용 Spring profile/ApplicationRunner 또는 동등한 CLI를 사용하되 다음 조건을 모두 만족해야 한다.

1. `SEED_SCENARIO=ops-20-v1`과 일치하는 명시적 시나리오 키가 없으면 즉시 실패한다.
2. 대상 DB의 JDBC URL/호스트/DB명을 출력하되 비밀번호는 출력하지 않고, `SEED_CONFIRM_TARGET=<db-name>:ops-20-v1` 확인값이 일치해야 실행한다.
3. `prod` 프로파일에서는 기본 거부하며 `SEED_ALLOW_PROD=true`를 추가로 명시한 단발 실행만 허용한다.
4. 서버 부팅 bean scanning에 의해 자동 실행되지 않는다. 일반 `bootRun`, Docker 재기동, Flyway migrate와 무관해야 한다.
5. 전체 주입은 단일 트랜잭션 또는 도메인 단계별 트랜잭션 + 실패 시 전단계 정리로 원자성을 보장한다. 부분 시드를 성공으로 보고하지 않는다.
6. `dry-run`은 대상 기존 행 충돌, 참조 마스터 수, 예상 INSERT/UPDATE 건수와 정합성 검사를 수행하되 쓰지 않는다.

Flyway 신규 버전으로 운영형 행을 INSERT하는 방식은 자동 적용·불가역성·환경별 데이터 혼입 때문에 금지한다. 마이그레이션은 스키마/불변 마스터에만 사용한다.

### 2.2 식별과 멱등성

- 시나리오 키: `ops-20-v1`.
- 로그인 ID: `fc_ops_01`~`fc_ops_20`; 닉네임: 한글 16자 이내의 고정 페르소나명.
- 외부 식별자(ULID), 채팅 client message UUID, delivery UUID, money exchange idempotency key는 시나리오 정의에서 결정적으로 생성하되 전체 DB UK와 충돌하지 않는 전용 namespace를 쓴다.
- 동일 키 재실행 결과는 **건수와 의미가 동일**해야 한다. 권고 동작은 `검증 후 no-op`이다. 기존 시나리오가 일부만 존재하면 덮어쓰지 않고 실패하여 정리를 요구한다.
- 실제 행을 자연키 없이 추측하지 않는다. 모든 하위 행은 시나리오 사용자의 ID 및 결정적 public/idempotency key로 식별한다.

### 2.3 정리

- `cleanup ops-20-v1`은 dry-run을 선행하고 FK 역순으로 시나리오 행만 제거한다.
- 시나리오 생성 후 실제 사용자가 해당 데이터와 거래/채팅한 **외부 참조가 하나라도 있으면 정리를 거부**한다. 강제 정리 옵션은 제공하지 않는다.
- 삭제 순서: outbox/신고/차단/채팅 메시지/방 상태/방 → 메모 → 배송 → 수익원장 → 소유이력의 거래분 → 주문 → hold → bid → auction/shop → temp_storage → 시나리오 item 소유이력 → item_instance → money_exchange → balance → social account(없음) → user.
- `item_template`, `skill_definition`과 V9/V12/V13 데이터는 절대 정리 대상이 아니다.

## 3. 20인 페르소나와 재화

| 역할 | 인원 | 특징 |
|---|---:|---|
| 헤비 구매자 | 3 | 높은 잔액, 다중 입찰·즉시구매·미열람 대화 |
| 전문 판매자 | 4 | 경매/마켓 다수 등록, 판매 완료와 취소 이력 |
| 양방향 트레이더 | 6 | 구매·판매·채팅·쪽지 모두 활발 |
| 일반 이용자 | 5 | 소수 거래, 보통 인벤토리와 읽음 상태 |
| 신규/휴면 | 2 | 낮은 잔액, 적은 아이템과 아카이브 대화 |
| 합계 | **20** | 전원 일반 사용자, 관리자 권한 없음 |

- `cash_balance`: 0~300,000 범위, 0/소액/고액을 포함한다.
- 초기 `game_money_balance`: 80,000~30,000,000 범위로 분산한다.
- 최종 balance는 아래 거래·CAPTURED·판매자 정산을 반영한 결과여야 하며 음수가 될 수 없다.
- `game_money_held`는 최종 `HELD` 원장의 사용자별 합과 정확히 같아야 한다.

## 4. 정확한 데이터 규모와 상태 분포

### 4.1 아이템 160개

| 축 | 분포 |
|---|---|
| 위치 | INVENTORY 104 / TEMP 10 / LISTED 40 / IN_GAME 6 |
| 레벨 | 1~3: 30 / 4~6: 48 / 7~9: 50 / 10 이상: 32 |
| 스킬 수 | 무스킬 12 / 단일 48 / 이중 100 |
| skill_percent | 5~15: 32 / 16~30: 48 / 31~50: 48 / 51~80: 24 / 81~99: 8 |
| Gold Force | 없음 80 / 유효 56 / 만료 24 |

- 템플릿은 기존 마스터에서 상품군·대분류·속성·종류가 고르게 보이도록 최소 24개를 선택한다.
- 스킬은 기존 정의에서 최소 18개를 사용하고 공격/방어/회복/상태·보조 성격을 섞는다. 같은 템플릿·레벨이라도 스킬 조합과 확률이 다른 비교군을 둔다.
- Gold Force는 `gf_expire_at`: NULL 80건, 기준시각 이후 1~365일 56건, 기준시각 이전 1~90일 24건이다. 상대시각은 실행 기준시각 `T0`에서 계산한다.
- 모든 아이템은 최초 `SEED` 소유이력 1건을 가진다. 거래 완료 아이템은 추가 `TRADE` 이력 1건을 가진다.

### 4.2 경매·입찰·홀드

| 데이터 | 정확한 분포 |
|---|---|
| 경매 36 | SCHEDULED 4 / ACTIVE 16 / SOLD 10 / UNSOLD 3 / CANCELLED 3 |
| SOLD result | BID 7 / BUYNOW 3 |
| 입찰 120 | ACTIVE 16 / OUTBID 97 / WON 7 |
| money_hold 120 | HELD 16 / RELEASED 97 / CAPTURED 7 |

- 입찰이 있는 ACTIVE 경매는 정확히 16개이며 경매별 ACTIVE bid가 1건이다. SOLD(BID) 7개는 경매별 WON bid가 1건이다.
- SCHEDULED/UNSOLD/CANCELLED에는 ACTIVE/WON 입찰을 두지 않는다. 판매자 자기 입찰은 금지한다.
- ACTIVE 종료시각: 15분 이내 4, 1~6시간 6, 1~3일 6. SCHEDULED 시작시각은 T0 이후다. 종료 상태는 T0 이전이다.
- `money_hold.bid_id`는 1:1이며 상태는 ACTIVE→HELD, OUTBID→RELEASED, WON→CAPTURED로 기계 파생한다.

### 4.3 마켓·주문·정산·배송

| 데이터 | 정확한 분포 |
|---|---|
| shop 32 | ACTIVE 20 / SOLD 6 / EXPIRED 3 / CANCELLED 3 |
| sale_order 16 | AUCTION 10 / SHOP 6, 전부 SETTLED |
| platform_revenue_ledger | 16 (order 1:1) |
| item_delivery 16 | PENDING 5 / DEFERRED 2 / CLAIMED 1 / APPLIED 6 / FAILED 2 |

- AUCTION 주문 10건은 SOLD(BID 7 + BUYNOW 3), SHOP 주문 6건은 SOLD 6과 1:1이다.
- `fee_amount`는 `fee-policy-spec v1.0`의 누진 계산·반올림·cap·floor를 그대로 적용하고 `settle_amount=final_price-fee_amount`다.
- SOLD 거래마다 구매자 차감, 판매자 `settle_amount` 증가, 수익원장 `fee_amount` 1행, 소유권 TRADE 1행이 함께 존재한다.
- APPLIED 배송 6건의 아이템만 IN_GAME이다. PENDING/DEFERRED/CLAIMED/FAILED는 구매자 소유 INVENTORY 또는 TEMP이며, FAILED가 아닌 배송이 있는 아이템은 재리스팅하지 않는다.
- `CLAIMED`만 claim_token/claimed_at을 가진다. `APPLIED`는 applied_at을 가진다. 나머지 nullable 조합은 delivery 계약과 일치한다.

### 4.4 소셜 데이터

| 데이터 | 정확한 분포 |
|---|---|
| chat_room | 24개 1:1 방 |
| chat_room_member_state | 48개, 방별 구성원 2개 |
| chat_message | 420개(방별 8~30개) |
| 읽지 않은 메시지 | 전체 메시지 중 수신자 관점 96개 |
| archived member state | 6개 |
| chat_user_block | 3개 |
| chat_report | 4개(PENDING 2 / RESOLVED 2) |
| chat_report_daily_quota | 신고자별 실제 당일 신고 수와 일치하는 행 |
| chat_event_outbox | 48개 metadata-only 이벤트 |
| user_memo | 100개(USER 84 / SYSTEM type 0: 8 / SYSTEM type 14: 8) |
| memo 읽음 | 읽음 68 / 미읽음 32 |
| memo soft delete | 8(발신 또는 수신 목록에서 숨김을 표현) |

- 채팅은 거래 문의, 가격 협상, 낙찰/배송 확인, 일반 대화의 시간 흐름을 구성한다. 신고 대상 snapshot은 원 메시지와 일치한다.
- `chat_room.member_low_id < member_high_id`, 방별 sequence는 1부터 연속이고 `last_sequence=MAX(room_sequence)`, `last_activity_at=마지막 메시지 시각`이다.
- 각 member state의 `last_read_sequence`는 0~last_sequence이며 미읽음 수가 위 분포와 정확히 맞아야 한다.
- USER 메모는 sender/receiver가 모두 시나리오 사용자이고 sender≠receiver, `memo_type=5`다. SYSTEM 메모는 nullable sender와 시스템 닉네임을 허용한다. `is_read=true` iff `read_at IS NOT NULL`, `is_deleted=true` iff `deleted_at IS NOT NULL`로 생성한다.

## 5. 정합성 불변식

1. 모든 FK가 존재하며 시나리오 사용자/아이템 외의 기존 행을 변경하지 않는다.
2. `item_instance` 위치 XOR: INVENTORY만 slot 0~95, TEMP/LISTED/IN_GAME은 slot NULL. 사용자별 inventory slot은 유일하다. TEMP는 `temp_storage` 1:1이며 owner가 같다.
3. SCHEDULED/ACTIVE auction과 ACTIVE shop의 아이템은 판매자 소유 LISTED다. 종료된 UNSOLD/CANCELLED/EXPIRED 아이템은 판매자 INVENTORY/TEMP다.
4. SOLD 아이템 owner는 구매자이며, 주문의 seller/buyer/item/source가 원 판매 데이터와 일치한다.
5. `auction.highest_bid_amount/highest_bidder_id`는 ACTIVE 또는 WON 최고 입찰과 일치한다. 같은 경매에서 금액과 생성시각은 증가한다.
6. bid와 hold는 금액·사용자 1:1로 일치한다. 경매당 HELD≤1, 사용자별 `game_money_held=SUM(HELD.amount)`다.
7. 구매자의 최종 잔액은 모든 CAPTURED/즉시구매·shop 구매를 반영하고, 판매자의 최종 잔액은 모든 settle_amount를 반영한다. 원장 전후 산식 검증값을 시드 결과로 출력한다.
8. 주문당 수익원장·배송은 각 1행이고 금액/정책 버전, recipient/소유자, 아이템 스냅샷이 원본과 일치한다.
9. `SUM(구매자 차감)=SUM(판매자 정산)+SUM(platform fee)`가 성립한다.
10. 채팅·메모의 발신자 스냅샷은 해당 메시지 생성시각의 고정 페르소나 닉네임과 일치한다.

주입 직후 위 불변식을 SQL 검증하고 실패 항목이 하나라도 있으면 전체 실패로 처리한다.

## 6. 로그인 보안 계약

- 20개 계정은 모두 `is_admin=false`, OAuth 연결 없음, 검증용 이메일은 실제 도메인이 아닌 예약 도메인(`example.invalid`)을 쓰고 메일 발송 대상으로 사용하지 않는다.
- 평문 비밀번호와 hash를 저장소, SQL, 로그, 문서, Docker image에 넣지 않는다.
- 실행 시 `SEED_PASSWORD_HASH`(BCrypt)만 환경변수로 전달한다. 원문은 로컬에서 강한 무작위 값으로 생성하여 사용자에게 별도 전달하고 실행 종료 후 환경변수를 제거한다.
- 20개 계정의 공유 비밀번호 여부는 게이트2에서 정한다. 권고는 운영 검증 편의를 위한 **1회성 강한 공유 비밀번호**이며, 테스트 종료 즉시 계정 정리 또는 hash 회전이 전제다.
- 로그인 ID 목록은 보고할 수 있으나 비밀번호는 터미널/CI 로그에 출력하지 않는다. 공개 인터넷에 장기 존치시키지 않는다.

## 7. 구현 영향과 티켓 분해

### 영향 파일(예상)

- 추가: `backend/src/testFixtures/` 또는 `backend/src/main/.../support/seed/` 아래 전용 수동 runner(선택 방식에 따라 확정)
- 추가: 시나리오 정의/검증/정리 SQL 또는 Java fixture 파일
- 추가: `scripts/seed/seed-ops20.ps1`, `scripts/seed/cleanup-ops20.ps1`, `scripts/seed/status-ops20.ps1`
- 추가: 시드 runner 단위·통합 테스트
- 수정 가능: `.env.deploy.example`에는 값 없는 변수명/설명만 추가, `.gitignore`에 로컬 credential artifact 패턴 추가
- 무변경: V1~V28 migration, 엔티티/API 계약, frontend 코드

### 구현 티켓

1. **SEED-1 안전 실행기**: prod 차단, 확인 토큰, dry-run, 환경변수 secret, 멱등 상태 판정.
2. **SEED-2 페르소나·아이템 fixture**: 사용자/잔액/160 아이템/스킬·GF·소유이력.
3. **SEED-3 상거래 fixture**: 경매/입찰/hold/shop/order/ledger/delivery 및 재화 산식.
4. **SEED-4 소셜 fixture**: 24방/420 채팅/상태·차단·신고·outbox/100 memo.
5. **SEED-5 검증·정리기**: 불변식 SQL, 외부 참조 감지, FK 역순 안전 cleanup.
6. **SEED-6 배포 DB 적용**: dry-run 증거 → 사용자 재확인 → 1회 주입 → API/UI smoke 확인.

SEED-2·3은 같은 item/금전 행을 쓰므로 순차(`2→3`), SEED-4는 SEED-2 사용자 생성 후 병렬 가능하다. SEED-5 완료 후에만 SEED-6을 수행한다.

## 8. 게이트2 상신 항목

| ID | 결정 | 선택지 | architect 권고 |
|---|---|---|---|
| G1 | 주입 실행 형상 | A 전용 Spring/CLI runner / B 수동 SQL 묶음 / C Flyway | **A**. 검증·secret·트랜잭션·멱등/cleanup을 코드로 강제. C 금지 |
| G2 | 시나리오 식별 | A 결정적 자연키 namespace(스키마 무변경) / B scenario registry·marker 컬럼 신설 | **A**. 이번 규모에서는 형상 변경 없이 충분; 외부 참조 감지 필수 |
| G3 | 테스트 로그인 | A 강한 공유 임시 비밀번호 / B 계정별 무작위 비밀번호 / C 로그인 불가 | **A**. 실제 UI 검증 가능성과 전달 비용의 균형; 종료 후 정리/회전 |
| G4 | 배포 DB 직접 주입 | A 현재 운영형 Docker DB에 주입 / B 복제 DB에만 주입 | **A**, 사용자의 목적과 일치하나 dry-run 결과를 보고한 뒤 단발 실행 |
| G5 | 시간 기준 | A 실행시각 T0 상대값 / B 고정 절대시각 | **A**. 진행/임박/만료 화면이 주입 시점에 유효 |

게이트2 승인 전에는 runner 구현, 스키마 변경, 배포 DB 주입을 시작하지 않는다.
