# 운영 공개 리스팅 100건 보강 계약

상태: **게이트2 승인 확정 (2026-09-02, 스킬 재분배 변경 승인 2026-09-02)**
소유: architect
시나리오 키: `ops-listings-100-v1`
범위: 운영 환경에서 공개 조회 가능한 실시간 경매와 아이템 마켓 리스팅을 각각 정확히 100건으로 보강하는 독립 수동 시드

근거: `operations-seed-spec.md`, `operations-seed-v2-impact.md`, `item-domain-spec.md`, `auction-domain-spec.md`, `bid-domain-spec.md`, `shop-spec.md`, `search-spec.md`, `erd.md`.

## 1. 목적과 경계

- 신규 namespace가 소유하는 공개 가능한 `ACTIVE` 경매 **정확히 100건**과 `ACTIVE` 마켓 **정확히 100건**을 생성한다.
- 목표 수량은 기존 자연 데이터나 `ops-20-v2` 행을 포함한 총량이 아니라, 본 시나리오 namespace가 소유하는 수량이다.
- 경매와 마켓은 서로 다른 `item_instance`를 사용한다. 총 200개 아이템이 각각 하나의 listing에 귀속된다.
- 기존 `ops-20-v2`의 `OP2*` 행, 실제 사용자 데이터, 마스터 데이터, 기존 거래·채팅 데이터는 조회 외에는 건드리지 않는다.
- 신규 계정, 완료 거래, 주문, 정산, 배송, 채팅, 메모, Flyway migration, 스키마, API 계약은 만들거나 변경하지 않는다.
- 본 계약은 운영 데이터 보강 절차다. 서버 부팅이나 Flyway로 자동 실행하지 않는다.

## 2. 실행·멱등 계약

### 2.1 명령과 보호 장치

실행기는 `dry-run`, `apply`, `status`, `cleanup`, `redistribute-skills`를 제공한다.

1. `SEED_SCENARIO=ops-listings-100-v1`이 정확히 일치해야 한다.
2. DB host·port·database·scenario를 포함한 target fingerprint 확인값이 일치해야 한다.
3. 운영 실행은 별도 prod opt-in을 명시해야 한다. fingerprint와 prod opt-in 중 하나라도 없으면 실패한다.
4. 비밀번호·접속 문자열의 credential 부분은 출력하지 않는다.
5. MySQL named lock으로 동시 실행을 막고, `apply`는 단일 트랜잭션으로 수행한다.
6. dry-run은 마스터·판매자·잔액·충돌·예상 건수·분포·백업 가능 여부만 검증하며 데이터를 변경하지 않는다.

### 2.2 상태 머신과 멱등성

- `EMPTY`: 본 namespace 행이 전혀 없음. `apply` 가능.
- `COMPLETE`: §3~§6의 정확한 건수와 모든 불변식을 만족. 재실행은 검증 후 no-op.
- `PARTIAL`: 일부 행만 존재하거나 분포·관계·잔액이 불일치. `apply`와 자동 보정을 거부하고 원인 조사 및 안전 cleanup을 요구한다.

기존 데이터 수량 변화에 맞춰 부족분만 추가하는 top-up 방식은 금지한다. 같은 입력과 마스터 정렬에서 public ID, 타입·판매자·특성 배치가 결정적이어야 한다.

## 3. namespace와 공통 데이터 계약

### 3.1 식별자

- 시나리오: `ops-listings-100-v1`
- public ID prefix: item `OL1ITM`, auction `OL1AUC`, shop `OL1SHP`, bid `OL1BID`
- UUID나 별도 멱등 키가 필요한 경우 `OL1` 전용 결정적 namespace를 사용한다.
- prefix, status/cleanup 판별자, 검증 SQL은 한 정본 상수에서 생성한다.
- `OP2*`, `OPS*`, `SEED*` namespace를 재사용하지 않는다.

### 3.2 판매자와 소유권

- 기존 비관리자 계정 `test01`~`test20`을 판매자로 재사용한다.
- 판매자별 경매 5건과 마켓 5건, 합계 10건을 정확히 배치한다.
- 각 listing의 `seller_id`는 해당 `item_instance.owner_id`와 같다.
- 모든 신규 아이템은 `location=LISTED`, `slot_no=NULL`이며 최초 `SEED` 소유이력 1건을 가진다.

### 3.3 타입 배치

- 기준 집합 `T`는 dry-run 시작시각 T0에 `item_template`이 반환한 전건이다.
- 현재 계약은 row count와 distinct `type_code`가 모두 정확히 40이어야 한다. 다르면 조용히 축소하지 않고 실패하며 계약 재승인을 요구한다.
- 채널별 100건은 정렬된 40개 타입 중 20개 타입에 3건, 나머지 20개 타입에 2건을 배치한다.
- 경매와 마켓에서 3건을 받는 타입 집합을 서로 반대로 하여 두 채널 합산 시 각 타입이 정확히 5건이 되게 한다.

## 4. 아이템 특성 분포

아래 수량은 경매 100건과 마켓 100건에 **각각 동일하게** 적용한다.

### 4.1 레벨

| 레벨 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 합계 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 건수 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 12 | 100 |

레벨 10 이상은 이번 공개 보강에서 만들지 않는다.

### 4.2 스킬과 확률

- 스킬 없음 34 / 단일 스킬 33 / 이중 스킬 33.
- 스킬 없음은 `skill1_id=NULL`, `skill2_id=NULL`, `skill_percent=0`이다.
- 단일·이중 스킬은 기존 `skill_definition`에 존재하는 코드만 참조한다.
- template `sub_group`별 허용 스킬 축을 지킨다. 특히 마법 계열에 금지된 skill1을 배치하지 않는다.
- 스킬이 있으면 확률은 1 이상이며 다음 레벨별 상한 이하다.

| 레벨 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 최대 확률(%) | 9 | 15 | 19 | 23 | 25 | 27 | 31 | 33 | 36 |

`ops-20-v2`의 81~99% 구간 생성 로직은 복제하지 않는다.

### 4.4 기존 ACTIVE 등록 아이템 스킬 재분배 계약

`redistribute-skills`는 이미 적재된 `OL1ITM*` 중 **repair 트랜잭션 시작 시 ACTIVE listing에 연결된
아이템만** 대상으로 하는 명시적 운영 repair다. ACTIVE 수량은 실행 전에 고정하지 않는다. MySQL named
lock을 획득하고 트랜잭션을 시작한 뒤 채널별 ACTIVE listing 행과 연결 item 행을 잠가 수정 집합과 수량을
확정한다.
일반 `apply`의 `COMPLETE` no-op 의미를 바꾸지 않으며, 다른 namespace와 자연 데이터는 수정하지 않는다.
동일 namespace라도 트랜잭션 시작 시 비ACTIVE인 모든 listing과 그 item, listing에 연결되지 않은 INVENTORY
아이템은 대상에서 제외하고 기존 아이템 스킬·퍼센트와 listing snapshot을 그대로 보존한다.

- 채널별 잠금 시점 ACTIVE 수량을 `N`, `q=floor(N/3)`, `r=N mod 3`으로 둔다. 무스킬은
  `q + (r >= 1 ? 1 : 0)`, 스킬2 단일은 `q + (r >= 2 ? 1 : 0)`, 이중 스킬은 `q`건으로 배치한다.
  따라서 세 그룹의 수량 차이는 항상 1 이하이고, 나머지는 **무스킬 → 스킬2 단일 → 이중 스킬** 순서로
  결정적으로 배정한다. 예를 들어 `N=100`이면 34/33/33, `N=76`이면 26/25/25다.
- 무스킬은 `skill1_id=NULL`, `skill2_id=NULL`, `skill_percent=0`이다.
- 단일 스킬은 `skill1_id=NULL`, `skill2_id IS NOT NULL`이다. 마법의 구조적 스킬1 부재와 UI의 스킬2
  퍼센트 표시 계약을 함께 만족시킨다.
- 이중 스킬은 비마법 아이템에만 배치하며 `skill1_id IS NOT NULL`, `skill2_id IS NOT NULL`이다.
- 스킬1 코드는 `100~197`, 스킬2 코드는 `200~209` 또는 `300~435`에서만 고른다.
  미사용 코드 `198`, `199`, `210~299`는 배치하지 않는다.
- 코드 범위만 맞추는 것으로 충분하지 않다. `references/game-item-skill-format.md §5`의 적용 대상을 기준으로
  template의 `sub_group`, `kind`, `element`에 맞는 코드만 후보로 삼는다. 마법은 스킬1을 갖지 않으며,
  스킬2의 물·흙/불·바람 속성 분기도 지킨다.
- 스킬1과 스킬2의 허용 코드 대역을 분리하여 같은 아이템의 두 슬롯에 동일 코드가 들어갈 수 없게 한다.
  사후 검증도 `skill1_id=skill2_id`인 행이 0개인지 독립 확인한다.
- 랜덤 다양성의 회귀 하한으로 경매와 마켓 각 채널에서 `skill1`·`skill2`의 NULL이 아닌 코드를 합친
  **서로 다른 스킬 코드가 최소 10개**여야 한다.

랜덤처럼 다양한 결과와 재실행 멱등성을 함께 보장하기 위해 결정적 의사난수를 사용한다.

1. 고정 seed 문자열은 `ops-listings-100-v1:skills:v2`다.
2. 아이템 `public_id`와 목적 구분자 `group`, `skill1`, `skill2`, `percent`를 seed에 각각 결합한 뒤
   SHA-256 해시를 계산한다.
3. 그룹 배치는 채널별 잠긴 ACTIVE listing의 item public ID를 `group` 해시값으로 정렬한다. 위 산식의
   이중 스킬 수만큼 제약을 만족하는 비마법 아이템을 먼저 고르고, 남은 행을 같은 결정적 순서로 산식의
   무스킬 수와 스킬2 단일 수에 배치한다.
4. 스킬은 적용 가능한 후보 코드를 오름차순으로 정렬한 뒤 해당 슬롯 해시값을 후보 수로 나눈 나머지로
   선택한다. DB surrogate ID, 조회 행 순서, 실행시각은 난수 입력으로 사용하지 않는다.
5. 동일 DB 상태에서 반복 실행한 결과는 스킬 FK와 퍼센트까지 완전히 동일해야 한다.

`skill_percent`는 UI에서 스킬2 줄에 표시하지만 의미상 스킬2 자체의 속성이 아니라 아이템 강화도다.
무스킬은 0이고, 스킬 보유 아이템은 `1 + (percent 해시값 mod 레벨 상한)`으로 정한다. 표시 레벨 1~9의
상한은 각각 `9, 15, 19, 23, 25, 27, 31, 33, 36`이며 전건 `1..상한`을 만족해야 한다.
경매와 마켓 각 채널의 스킬 보유 아이템에서 0을 제외한 **서로 다른 `skill_percent`가 최소 10개**여야
한다. 이 두 distinct 하한은 결정적 의사난수 알고리즘이나 후보 풀이 퇴행해 소수 값만 반복되는 것을 막는
필수 회귀 검증이다.

repair 실행 전에는 다음 조건을 모두 만족해야 한다.

1. `OL1ITM*` 전체가 정확히 200건이고 기존 수량·거래 불변식을 만족한다. 채널별 ACTIVE 수량은 잠금 조회로
   확정하며 각 채널 **30건 이상**이어야 한다. 30건 미만이면 다양성 하한을 안전하게 보장할 수 없으므로
   갱신 없이 실패한다.
2. 대상 ACTIVE item/listing의 기존 입찰·소유 관계는 보존한다. 주문·정산·배송·소유권 이전으로 이미 거래가
   종결됐거나 취소된 비ACTIVE listing과 listing 미연결 INVENTORY 아이템은 수정 집합에 포함하지 않는다.
3. 최소 `item_instance`, `auction`, `shop`을 복원 가능한 dump로 백업하고 행 수와 checksum을 기록한다.
4. 스킬 마스터가 슬롯·아이템 종류별 후보 풀을 빠짐없이 제공하지 않으면 실행하지 않는다.

repair는 MySQL named lock 안의 단일 트랜잭션으로 잠금 시 확정한 ACTIVE item의 스킬 FK·퍼센트와 해당
ACTIVE auction/shop의 `item_spec_snapshot`을 함께 갱신한다. 비ACTIVE listing과 그 item 및 INVENTORY
아이템은 갱신 쿼리의 대상에서 제외하며, 실행 전후 값·snapshot checksum이 같은지 별도로 검증한다. 중간 검증 실패 시 전부
rollback하며 부분 갱신을 허용하지 않는다. 적용 후 위 채널별 분포, 슬롯별 코드 범위와 타입 적합성,
동일 슬롯 코드 금지, 레벨별 퍼센트 상한, snapshot 일치를 검증한다. 이어 §7과 동일하게 `IN_PLACE`
재색인을 실행하고 MySQL↔공개 API↔Elasticsearch의 잠금 시 확정된 ACTIVE 대상 전건에서 스킬
코드·이름·퍼센트가 일치하는지 대조한다.

### 4.3 Gold Force와 교차 분포

- 없음(`gf_expire_at=NULL`) 50 / 유효 50 / 만료 0.
- 유효값은 apply T0 기준 7~90일 뒤로 결정적으로 분산한다.
- 만료값은 공개 화면에서 사실상 없음으로 보이며 데이터 품질 결함을 재현할 수 있어 생성하지 않는다.

스킬×Gold Force 교차표는 채널별 다음과 같다.

| 스킬 | GF 없음 | GF 유효 | 합계 |
|---|---:|---:|---:|
| 없음 | 17 | 17 | 34 |
| 단일 | 16 | 17 | 33 |
| 이중 | 17 | 16 | 33 |
| 합계 | 50 | 50 | 100 |

## 5. listing별 계약

### 5.1 아이템 마켓 100건

- 전건 `status=ACTIVE`, `T0 < end_at`이다.
- 종료시각은 T0+7일, +14일, +21일, +30일에 각각 25건이다.
- 가격 범위는 10,000~10,000,000 G이며 다음 로그형 5구간에 각각 20건을 둔다.
  - 10,000 이상 100,000 미만
  - 100,000 이상 500,000 미만
  - 500,000 이상 1,000,000 미만
  - 1,000,000 이상 3,000,000 미만
  - 3,000,000 이상 10,000,000 이하
- `item_name_snapshot`과 `item_spec_snapshot`은 item/template 정본 값과 일치해야 한다.

### 5.2 실시간 경매 100건

- 전건 `status=ACTIVE`, `start_at <= T0 < end_at`이다.
- `base_end_at`, `max_end_at`, soft-close window/extend/count는 경매 도메인 불변식을 충족해야 한다.
- 종료시각은 T0 상대 다음 네 구간으로 분산한다.

| 종료 구간 | 건수 |
|---|---:|
| 5~15분 | 10 |
| 15분 초과~6시간 | 25 |
| 6시간 초과~24시간 | 35 |
| 1일 초과~7일 | 30 |

- 시작가는 10,000~5,000,000 G이며 §5.1과 같은 5개 로그형 축을 상한에 맞춰 각각 20건으로 분산한다.
- 즉시구매가는 정확히 50건에만 둔다. 시작가의 120~180%이며 10,000,000 G 이하이고 시작가보다 크다. 나머지 50건은 NULL이다.
- `item_name_snapshot`과 `item_spec_snapshot`은 item/template 정본 값과 일치해야 한다.

### 5.3 입찰과 hold

- 경매 70건은 최고 활성 입찰이 있고, 30건은 입찰이 없다.
- 입찰이 있는 70건 중 40건에는 선행 `OUTBID` 이력 1건을 추가한다.
- 총 bid 110건: `ACTIVE` 70 / `OUTBID` 40.
- 총 money_hold 110건: `HELD` 70 / `RELEASED` 40. bid와 hold는 1:1이다.
- bidder는 seller와 달라야 하며, 입찰액은 시작가보다 크고 같은 경매 안에서 생성시각과 금액이 단조 증가한다.
- `auction.highest_bid_amount`와 `highest_bidder_id`는 각 경매의 유일한 ACTIVE bid와 일치한다. 무입찰 경매의 두 필드는 NULL이다.
- `HELD.amount=bid.amount`, `HELD.user_id=bid.bidder_id`이고 사용자별 `game_money_held=SUM(HELD.amount)`가 성립해야 한다.
- 신규 HELD를 반영해도 각 bidder의 가용 게임머니가 음수가 되면 안 된다. dry-run에서 부족하면 금액을 임의 조정하지 않고 실패한다.

## 6. 백업·cleanup·검증

### 6.1 사전 백업

- apply 직전에 최소 `item_instance`, `item_ownership_history`, `auction`, `shop`, `bid`, `money_hold`, `user_balance`를 복구 가능한 SQL dump로 백업한다.
- timestamp 디렉터리와 대상 fingerprint, 테이블별 row count/checksum을 기록한다.
- 백업은 `backups/seed/` 아래 Git 제외 위치에 두며 credential을 파일명·로그·문서에 남기지 않는다.
- 백업 생성·읽기 검증에 실패하면 apply하지 않는다.

### 6.2 apply 후 필수 검증

다음 중 하나라도 실패하면 apply 전체를 실패 처리한다.

1. namespace item 200, auction 100, shop 100, bid 110, hold 110, 최초 소유이력 200.
2. §3~§5의 seller/type/level/skill/GF/가격/시간/입찰 분포가 정확히 일치.
3. item과 listing 1:1, 경매와 마켓 사이 item 공유 0, LISTED 위치 XOR와 FK/UK 무결성.
4. seller=owner, 스냅샷 정합, skill 실존·허용축·레벨 상한 정합.
5. bid/hold 상태·금액·사용자 1:1, 최고가·최고입찰자 및 잔액/held 정합.
6. 기존 `OP2*` 및 자연 데이터의 사전 row count/checksum 불변.
7. 공개 경매/마켓 API가 신규 ACTIVE 행을 조회하고 필터·정렬·페이지네이션 표본이 DB와 일치.

### 6.3 cleanup

- cleanup은 먼저 dry-run으로 삭제 대상과 외부 참조를 보고한다.
- 비-namespace bid/order/outbox/소유권 이전/거래 등 외부 참조가 하나라도 있으면 cleanup을 거부한다. 강제 삭제 옵션은 제공하지 않는다.
- 허용 시 FK 역순으로 hold/bid → auction/shop → 시나리오 소유이력 → item을 삭제하고, 신규 HELD가 반영한 `user_balance.game_money_held`를 정확히 원복한다.
- namespace 밖 행은 삭제·수정하지 않는다.
- cleanup 후 namespace 행 0, 기존 데이터 checksum 불변, 사용자별 held 불변식을 다시 검증한다.

## 7. Elasticsearch·CDC 검증

- MySQL이 유일한 정본이며 Elasticsearch `listings_search`는 파생 사본이다. 앱 dual-write를 추가하지 않는다.
- apply 후 Kafka Connect, Debezium, Elasticsearch health와 CDC lag를 먼저 확인한다.
- CDC 단일 테이블 문서만으로 코드축·레벨·스킬·Gold Force·종료시각 enrichment가 완전하다고 간주하지 않는다.
- 관리자 재색인 API `POST /api/v1/admin/search/reindex`를 `mode=IN_PLACE`로 1회 실행하고 job 성공과 `indexedCount`를 확인한다.
- ES에서 본 namespace `AUCTION=100`, `SHOP=100`을 확인하고 status/type/level/skill/GF/price/endAt 표본을 MySQL과 대조한다.
- 기본 절차에서 `REBUILD`나 alias switch를 수행하지 않는다. 인덱스 매핑 변경도 없다.
- cleanup 시 CDC delete/tombstone이 namespace 문서를 제거했는지 확인한다. `ListingIndexer.reindexAll()`은 upsert 중심이므로 IN_PLACE만으로 삭제 보장을 가정하지 않는다.
- cleanup 후 잔존 문서가 있으면 원인을 기록하고 namespace 한정 bulk delete 또는 `REBUILD`를 별도 승인 후 수행한다.

## 8. 작업 분해와 완료 기준

승인된 구현 범위는 기존 완료 티켓을 재개방하지 않고 신규 4개 하위 작업으로 분리한다.

1. architect: 본 계약 확정.
2. backend-impl: 기존 `OperationsSeedFixture`와 분리된 fixture·guard·CLI 구현.
3. backend-impl: 통합 테스트, 실행 스크립트, backup/status/cleanup 검증 구현.
4. reviewer/main: 통합 리뷰, 운영 dry-run·백업·apply, DB/API/ES smoke와 증거 기록.

완료는 정확 건수와 전 불변식, 기존 데이터 무변경, Elasticsearch 최종 수렴이 모두 증명된 때다. 운영 DB 적용과 cleanup은 각각 사용자 승인 범위 안에서만 수행한다.

## 9. 게이트2 승인 기록

| 결정 | 승인안 |
|---|---|
| 시나리오 격리 | 기존 `ops-20-v2`를 변경하지 않고 `ops-listings-100-v1` 신규 namespace 사용 |
| 목표 | namespace 소유 ACTIVE auction 100 + ACTIVE shop 100 |
| 분포 | 20 seller 균등, 40 type 균등, 레벨·스킬·GF·가격·종료시각 분산 |
| 입찰 | 70개 경매 활성 입찰, 그중 40개 OUTBID 이력; bid/hold 총 110 |
| 안전 | fingerprint+prod opt-in, named lock, 단일 트랜잭션, 사전 백업, PARTIAL 차단, 외부 참조 cleanup 거부 |
| 검색 | CDC 확인 후 IN_PLACE 재색인과 DB↔ES 대조; cleanup delete 별도 검증 |

사용자 승인일은 2026-09-02다. 이 계약의 수량·namespace·스키마/API·cleanup 또는 검색 복구 방식을 바꾸려면 architect가 영향 티켓을 먼저 산출하고 다시 게이트2 승인을 받아야 한다.
