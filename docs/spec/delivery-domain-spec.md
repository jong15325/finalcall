# FinalCall Delivery Domain Spec (아이템 지급·우편함 도메인 스펙)

상태: **v1.1 — FC-185(EPIC-ITEM-DELIVERY 계약 정본화, architect) 산출 + FC-191 리뷰 MAJOR-2 정합화(재판매 가드 상태집합).** `game-item-delivery-proposal-v0.1`(게이트2 확정 G1~G7 + 확정 3건)을
확정 spec으로 승격한다. 장터에서 낙찰(SOLD)·즉시구매(BUYNOW)한 아이템을 **웹측 내구 우편함(`item_delivery`)까지 도착**시키는 다리의
계약·설계 정본이다. 게임이 실제로 받아가는 실이식(claim 구현·boundary 번역)은 게임 서버 조정 단계(후속 별건, §12.2)로 분리한다.
소유: architect(spec). **게이트2 형상 3건(§13)은 사용자 승인 대상**이며, 승인분이 `erd.md`(item_delivery·V21)·`api-contract.md`(배송 상태 조회·게임 claim DB 프로토콜)·`item-domain-spec.md`(location IN_GAME 확장)에 반영된다.

범위(코어 = 웹측 1단계): **finalcall-native 내구 우편함(`item_delivery`, V21)** + **정산 TX 내 enqueue**(SettlementRecorder 공통 꼬리, G3) +
**실패 안전 보관·멱등 재시도**(§7) + **Redis best-effort 알림**(§3.3) + **item_uuid 발급·자족 스냅샷**(§6) + **claim/apply DB 프로토콜 계약 확정**(§5, 게임이 맞출 규격) + **구매자 배송 상태 조회**(§10).
**범위 밖(후속 별건, §12)**: 게임 서버 claim 실이식·boundary 포맷터(itm_skill 재패킹·level−1·usr_id 매핑) · `user_item.itm_uuid` UK 신설 · 게임 살아있는 인벤토리 완전 통합(A) · 역방향 출품(게임→장터) · 장착(user_equipments) 연동 · 레거시 인벤 임포트.

근거(정본): **game-item-delivery-proposal-v0.1**(§0 G1~G7 결정표·§3 하이브리드·§5 claim·§6 매핑·§7 스키마·§9.1 개발 순서), **closing-domain-spec v1.0**(§4 SOLD 정산 TX·§6 불변식 I-A~I-H·SettlementRecorder 공통 꼬리 §4.5·PC clear 함정), **purchase-spec v1.0**(§6-A SettlementRecorder 추출·§1.1 재사용 원칙·P-A~P-H), **memo-domain-spec v1.0**(통합 스키마 단일 정본·이중 writer 쓰기 소유자 §3·게임 lineage 테이블명 계승 §7.1·boundary 포맷터=게임 서버 소속 §8), **bid-domain-spec v0.3 §4·§8**("정합성은 DB, 처리량은 락 — 분산락은 정확성 보장 수단이 아니다"), **item-domain-spec v0.4 §3**(location XOR 불변식·markListedIfInInventory CAS), erd v1.6(§4.2 sale_order·platform_revenue_ledger·§4.3 item_instance·§5 인덱스·§6 Flyway V20), api-contract v1.21(§2.6 memo·§4.3 orders). CLAUDE.md 섹션 4·5.

물리 현황: `finalcall-mysql`(3306)에 `new_sp` 스키마 상존(게임 살아있는 인벤토리 `user_item`). finalcall 최신 Flyway = **V20**(`V20__user_memo.sql`) → 신규 = **V21**.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1.1 | 2026-08-05 | FC-191 리뷰 MAJOR-2 정합화 — §5.4↔§6.1 재판매 가드 상태집합 불일치 해소. 가드 정의를 **"item_instance에 FAILED 아닌 배송(PENDING/CLAIMED/DEFERRED/APPLIED) 존재 시 출품 차단"**으로 통일(종전 §6.1이 APPLIED를 제외해 게임 apply~웹 IN_GAME 전이 lag 창에서 재출품→이중 존재 D-F 위반 가능했다). §5.4·§6.1·§7.2·§8(D-F·시나리오6)·§11·§14(FC-188) 정합. FAILED 제외 근거(관리자 개입·게임 미재료화) 명시. **형상·계약·G1~G7·erd·api-contract 불변**(가드 상태집합 서술만 정정, backend FC-188이 이 정의대로 확장 중). |
| v1.0 | 2026-08-05 | FC-185 계약 정본화 — proposal v0.1(게이트2 확정 G1~G7) 승격. §1 단절 지점·§2 G1 배치(B-지금/A-목표)·§3 G2 하이브리드 전송·§4 성능 모델·§5 G4 claim 프로토콜(상태 머신·CAS·리스·멱등)·§6 G5 소유 이동+경계 포맷터·§7 G6·G7 실패 회수+`item_delivery` 스키마·§8 불변식(D-A~D-H)·§9 상태 전이표·§10 계약 델타·§11 프론트 영향·§12 범위/개발 순서·§13 게이트2 형상 3건. erd V21·api-contract 배송조회+게임 claim DB 프로토콜·item-spec location IN_GAME 확장에 반영. |

---

## 1. 문제 정의 — "단절 지점"은 어디인가

현재 장터의 소유권 이전은 **finalcall 내부 `item_instance`에서 완결**된다. 낙찰(closing-spec §4.4·I-E)·즉시구매(purchase-spec §4.4·P-E)는 모두 `item_instance.owner_id → 구매자`,
`location → INVENTORY(빈 슬롯)` 또는 만실 시 `TEMP`, `item_ownership_history`에 (판매자→구매자, TRADE, sale_order_id) 1행 append로 끝난다.

**이 `item_instance`는 finalcall 스키마의 테이블이며, 게임(new_sp)이 실제로 읽고 쓰는 살아있는 인벤토리(`user_item`)와는 별개 표현이다.** 즉 구매자가
장터에서 아이템을 손에 넣어도 게임에 접속해 캐릭터 인벤토리를 열면 그 아이템이 **없다.** 이 괴리가 단절 지점이다.

이 에픽의 다리는 그 괴리를 닫는다: finalcall `item_instance`에 도착한 아이템을 **게임 캐릭터 인벤토리(`user_item`)에 실제로 materialize**시킨다.
premise #2·#3에 따라 **웹은 살아있는 인벤토리에 직접 쓰지 않고**(게임 접속 중 메모리 충돌 방지) 내구 우편함(`item_delivery`)에 enqueue만 하며,
**게임이 claim해 자기 인벤토리에 넣는다.** 우편함이 웹↔게임 인벤토리 사이의 seam(다리)이며, 완전 통합(A)이 완료돼도 "웹↔게임 인벤토리 이동 채널"로 재사용된다.

---

## 2. G1 — 통합 DB 배치 (B-지금 / A-목표)

메모 도메인 선례(memo-domain-spec §1.1·§7.1)를 계승한다 — **finalcall이 소유하는 자산은 네이티브 신규 테이블로 짓되, 게임 lineage는 장차 게임이 그대로 읽도록 설계**한다.

- **finalcall이 소유하는 새 자산(= 배송 우편함 `item_delivery`, §7)은 finalcall-native 단일 스키마**로 짓는다. 이것이 이번 에픽의 실제 산출물이다.
- **게임의 살아있는 인벤토리(`user_item` 등)는 이번 에픽에서 이관하지 않는다** — 게임이 계속 소유(new_sp). claim 대상이 오늘은 new_sp이고, 장차 finalcall-native 게임 인벤토리로 **재지향 가능**하도록 우편함 계약을 매체 중립으로 둔다.
- 따라서 물리적으로는 오늘 크로스-스키마(B), 로드맵상 완전 통합(A)이며, **우편함이 그 이관을 무중단·점진적으로 가능케 하는 seam**이다. 살아있는 인벤토리의 finalcall 이관(A 완성)은 **별도 에픽·별도 게이트2**(§12.3).

---

## 3. G2 — 우편함 전송 방식 = 하이브리드 (★ 핵심 · Redis 내구성 1급 쟁점)

### 3.1 결론: DB 내구 정본 + Redis best-effort 알림

| 방식 | 내구성 | 정산 TX 원자성(이중쓰기) | 장애 전파 | 판정 |
|---|---|---|---|---|
| (i) DB 테이블 우편함 | 강함(InnoDB, 커밋=영속) | 원자(정산과 같은 TX INSERT) | 없음 | 정확성 충족 |
| (ii) 순수 Redis Stream+Consumer Group | **약함**(§3.2) | **이중쓰기**(MySQL↔Redis 공유 TX 없음) | **큼**(Redis 다운=배송 전면 중단) | **기각(§3.2)** |
| **(iii) 하이브리드(DB 정본 + Redis 알림)** | 강함(정본=DB) | 원자(enqueue=DB in-TX, Redis는 커밋 후 best-effort) | 없음(Redis 실패=지연만) | **채택** |

### 3.2 ★ 왜 순수 Redis 우편함은 아이템·금전에 부적격인가 (기각 근거)

아이템·금전이 걸린 우편함은 **유실 불가**(at-least-once + 멱등)를 요구한다. 순수 Redis는 구조적으로 못 준다:
1. **손실창**: RDB 스냅샷은 마지막 스냅샷 이후를 크래시 시 통째로 잃고, AOF `everysec`는 최대 1초 손실 — 어느 설정도 "커밋=영속"을 DB만큼 보장하지 못한다.
2. **이중쓰기**: 정산(SOLD/BUYNOW)은 MySQL TX다. enqueue가 Redis면 두 내구 도메인에 걸친 쓰기라 공유 TX가 없다 → "팔렸는데 배송 없음"(미지급) 또는 "배송됐는데 판매 없음"(무자본 지급). 총량 보존(closing/purchase I-H)이 매체 경계에서 깨진다.
3. **장애 전파**: Redis 다운 시 enqueue 실패로 배송 전면 중단 — 입찰이 Redis 분산락 대신 DB 비관락을 택한 것과 같은 실패 양식(bid-spec §8, `@DistributedLock` watchdog 부재·Redis 장애 전파로 배제, CLAUDE.md §1). **매체를 정확성 경계로 삼는 순간 그 매체 장애가 도메인 전면 중단으로 번진다.**

→ **순수 Redis 우편함 기각.** DB=내구 정본, Redis=알림/폴링 제거 보조가 프로젝트 정신(bid §8)과 정합.

### 3.3 하이브리드 배선 (트랜잭셔널 아웃박스 + best-effort 알림)

```
[웹 정산 TX]                                   [게임 서버(후속 별건, §12.2)]
SettlementRecorder.record(...) {               loop / on-signal:
  ... sale_order INSERT                           claim(usrId)  ── DB 우편함에서 CAS 청구(§5)
  ... item_ownership_history append               apply → user_item materialize(멱등키 item_uuid)
  item_delivery INSERT (PENDING)   ◀── G3        ack → APPLIED (CAS)
} COMMIT                                        }
      │ (커밋 후, best-effort)
      └─▶ Redis PUBLISH "delivery:{recipientUserId}"  ── 신호만. 실패해도 정확성 무영향
```

- **정본 = DB 우편함(`item_delivery`)**. enqueue는 정산과 **같은 TX**(G3, §7.3) → 소유이전·배송생성이 exactly-once로 묶인다(이중쓰기 없음).
- **Redis = best-effort 알림**(pub/sub 경량 신호, FC-189). 게임은 신호를 받으면 즉시 claim해 빈 폴을 제거한다. **신호가 유실돼도(Redis 다운) 정확성 무손상** — 저빈도 안전망 폴 + **접속 시 무조건 우편함 조회**가 정확성 백스톱.
- Redis 실패의 최악 결과는 "배송이 다음 안전망 폴/다음 접속까지 지연"일 뿐 **아이템 유실 없음**(bid §8 배송판 적용).

---

## 4. 공유 DB 성능 모델 (게임 핫패스 vs 웹 공유)

게임 서버(지연 민감·잦은 인벤 쓰기)와 웹이 같은 MySQL을 공유할 때의 경합·완충:

| 경합 지점 | 위험 | 완충 |
|---|---|---|
| 커넥션풀 | 게임·웹·마감/배송 워커가 `max_connections` 공유 | 서비스별 풀 상한 분리 + 마감/배송 워커 풀을 작게 격리 |
| **버퍼풀(핵심 실병목 추정)** | 웹 대형 스캔이 게임 핫 페이지(`user`·`user_item`·`user_equipments`)를 evict → 게임 인벤 조회 지연 스파이크 | 웹 무거운 읽기를 **ES(9200)+Kafka로 오프로드**해 버퍼풀을 게임 핫셋에 양보 |
| 행 락 | 우편함이 유일 공유 쓰기 테이블 | **쓰기 소유자 분리**(§5.4): 게임=live inventory, 웹=우편함 enqueue(INSERT). **서로 다른 테이블이라 핫 테이블 행락 교차 원천 부재.** 우편함 내부도 enqueue=INSERT·claim=상태 CAS라 경합면이 좁다 |
| 폴링 부하 | 접속 유저 각자 폴링 시 대량 빈 폴 | §3.3 Redis 신호로 빈 폴 제거, 안전망 폴은 저빈도 |

실병목은 **락 경합이 아니라 버퍼풀 경합 + 폴 증폭**이다. 최우선 완충 = (1) 웹 무거운 읽기 ES/리플리카 오프로드, (2) Redis 알림으로 빈 폴 제거, (3) `(status, created_at)` 인덱스로 우편함 스캔을 오래된 순 좁게 유지 + APPLIED 행 주기 아카이브. 정확한 임계는 실부하 측정 후 튜닝(bid §7.3 "선 측정 후 최적화").

---

## 5. G4 — claim 프로토콜 (멱등 · at-least-once 하 이중 지급 방지)

### 5.1 상태 머신

```
PENDING ──claim(CAS)──▶ CLAIMED(lease) ──apply 성공(ack CAS)──▶ APPLIED
   ▲                        │
   │◀──리스 타임아웃 재청구──┘   (게임 크래시로 CLAIM~APPLY 사이 중단 시 회수)
   │◀──게임 만실 defer──────┐
DEFERRED ──재청구(CAS)─────┘   (슬롯 확보·재접속 후 재시도)

하드 실패(스펙 불량·계정 밴·매핑 불가 usr_id) ──▶ FAILED (관리자 개입, §7.1)
```

### 5.2 DB CAS 절차 (게임 = DB 직접, 웹 REST API 아님 — §13 (b))

게임은 **finalcall MySQL에 DB 직접 접근**해 아래 CAS로 청구·적용한다(웹 REST API가 아니다 — 통합 스키마·read 통합/write 소유자 모델, memo boundary 선례). SQL은 계약 규격이며 실제 게임 서버 코드는 후속 별건(§12.2).

```sql
-- (1) discover: 대기 배송 조회 (Redis 신호 수신 시 또는 접속 시 또는 안전망 폴)
SELECT id, item_uuid, type_code, level, skill1_code, skill2_code, skill_percent,
       gf_expire_at, recipient_user_id, recipient_nickname
  FROM item_delivery
 WHERE recipient_user_id = :usrId AND status IN ('PENDING','DEFERRED')
 ORDER BY created_at ASC;                 -- 인덱스 (recipient_user_id, status)

-- (2) claim (조건부 CAS · 단일 승자): 영향행 1=청구 성공, 0=이미 다른 인스턴스/재시도가 가져감 → skip(무부작용)
UPDATE item_delivery
   SET status='CLAIMED', claim_token=:token, claimed_at=NOW(6)
 WHERE id=:id AND status IN ('PENDING','DEFERRED');

-- (3) apply: 게임이 자족 스냅샷(§6.2) + boundary 번역(itm_skill 재패킹·level−1·usr_id 매핑, §6.2·§12.2)으로
--     user_item INSERT. itm_uuid = item_delivery.item_uuid. user_item.itm_uuid UK가 중복 apply를 no-op화.
--     슬롯(itm_slot)은 게임이 자기 인벤에서 빈 칸 배정(살아있는 인벤 쓰기 소유=게임).

-- (4) ack (조건부 CAS · 토큰 대조): 만료 토큰의 뒤늦은 ack는 여기서 무시됨
UPDATE item_delivery
   SET status='APPLIED', applied_at=NOW(6)
 WHERE id=:id AND status='CLAIMED' AND claim_token=:token;

-- (5) defer (게임 만실): status='DEFERRED'로 되돌림(우편함 안전 보관, 유실 없음)
UPDATE item_delivery SET status='DEFERRED' WHERE id=:id AND status='CLAIMED' AND claim_token=:token;
```

- **claim = 조건부 CAS 단일 승자**(closing/bid 종료성 CAS 동류). 다중 게임 인스턴스가 같은 행을 집어도 영향행 1인 쪽만 성립.
- **at-least-once 재청구**: CLAIMED에서 게임 크래시 시 `claimed_at + lease_timeout` 경과 후 그 행을 **PENDING으로 회수**(리스 만료 sweeper — 쓰기 소유 = 웹, §5.4). 이 재청구가 at-least-once의 원천.
- **이중 지급 방지 = 멱등 apply**: 재청구로 같은 배송이 두 번 apply될 수 있으므로 게임 인벤 삽입이 멱등키로 무해화돼야 한다. 자연 멱등키 = **`itm_uuid char(40)`**. 웹이 배송 시점에 uuid를 미리 확정해 우편함 행에 실어 보내고, 게임 `user_item.itm_uuid`에 **UK**를 두면 같은 uuid 재삽입이 UK 충돌로 no-op. → **at-least-once 전달 + 멱등 apply = exactly-once 효과**.
- **ack도 CAS + 토큰 대조**라 이중 ack 무해, 만료 토큰의 뒤늦은 ack 무시.

### 5.3 멱등 핵심 정리
- **전달은 at-least-once**(재청구로 최소 1회 이상 도달), **효과는 exactly-once**(uuid UK로 중복 apply 무해). §3.2에서 순수 Redis가 못 주는 조합을 DB 정본이 준다.
- `claim_token`(청구 세션 식별자)으로 리스 소유자를 추적.

### 5.4 쓰기 소유자 (이중 writer 모델 · memo §3 선례)

통합 스키마라 `item_delivery`에 쓰는 주체가 둘이다. 행위별로 못박는다:

| 행위 | 소유자(writer) | 비고 |
|---|---|---|
| enqueue (INSERT PENDING) | **웹(finalcall)** | 정산 TX 꼬리, G3. finalcall-native 자산의 발생점 |
| claim (PENDING/DEFERRED→CLAIMED) | **게임 서버** | DB 직접 CAS(§5.2), 후속 별건 §12.2 |
| apply/ack (CLAIMED→APPLIED) | **게임 서버** | DB 직접 CAS |
| defer (CLAIMED→DEFERRED, 만실) | **게임 서버** | DB 직접 CAS |
| 리스 만료 재청구 (CLAIMED→PENDING) | **웹(finalcall)** | sweeper — 우편함 내구 정본을 웹이 소유 |
| 하드 실패 격리 (→FAILED) | **웹(finalcall)/관리자** | §7.1 |
| item_instance.location → IN_GAME (APPLIED 관측 시) | **웹(finalcall)** | 소유 정본=웹(§6.1·premise #2). 게임은 item_instance를 쓰지 않는다 |

- **게임은 `user_item`(live inventory)과 `item_delivery`의 claim/apply 전이만 쓴다. `item_instance`는 절대 쓰지 않는다**(소유 정본=웹, 쓰기 소유자 규칙).
- **APPLIED → IN_GAME 전이는 웹 소관**: 웹 reconciler가 `status='APPLIED'`이나 아직 IN_GAME 아닌 배송을 관측해 `item_instance.location`을 IN_GAME으로 CAS 전이(§6.1). 게임 apply와 웹 전이 사이 짧은 lag이 있으나, **재판매 가드의 상태집합이 `APPLIED`를 포함**하므로(§6.1 — 가드 = FAILED 아닌 모든 배송) 이 lag 창에서 재출품이 막혀 이중 존재(D-F)가 발생하지 않는다. IN_GAME 전이 완료 후에는 location XOR CAS가 이어받아 차단한다.

---

## 6. G5 — 아이템 인스턴스 소유 모델 (이동 · 이중 존재 방지) + 경계 포맷터

### 6.1 소유 모델 (이중 존재 방지) — location IN_GAME 확장 (§13 (a) 확정)

- **소유 정본 = finalcall `item_instance`**(웹=상거래 소유, premise #2). 게임 `user_item`은 플레이어가 게임에 끌어와 쓰는 **재료화(materialized) 복제**다.
- **배송 = 이동(move-to-game)**: 배송 성공(APPLIED) 시 finalcall `item_instance.location`을 **`IN_GAME`(신규 enum 값)** 으로 전이한다(§13 (a) — location enum 확장 채택, 별도 상태축 기각). 같은 아이템이 웹 인벤토리와 게임 인벤토리에 **동시 존재하지 않게** 한다.
- **재판매 차단 불변식(location XOR 연장, item-spec §3.1)**:
  - `IN_GAME` ⇒ `slot_no` NULL · `temp_storage` 행 없음 · 활성 리스팅 없음(웹 커스터디에서 이탈) · 게임 `user_item`에 재료화 존재(멱등키 item_uuid 1:1).
  - **출품 CAS `markListedIfInInventory`(`WHERE location='INVENTORY'`)가 IN_GAME 아이템 출품을 자동 배제** → 이관된 아이템은 다시 리스팅·재판매되지 않는다(별도 가드 불요).
- **배송 존재 창 재판매 차단(★ 가드 상태집합 = FAILED 아닌 모든 배송)**: item_instance는 SOLD 직후 구매자 소유로 INVENTORY/TEMP에 있으나(P-E 보존), **해당 item_instance에 `FAILED`가 아닌 배송(= `PENDING`·`CLAIMED`·`DEFERRED`·`APPLIED`)이 존재하는 동안에는 출품(재판매)을 차단**한다. 출품 경로(auction/shop 등록)가 location='INVENTORY' CAS에 더해 "해당 item_instance에 FAILED 아닌 배송 부재"를 검증한다(FC-188 소유. 구현 기법 = 리스팅 경로 배송 존재 가드. 부분 유니크 제약 대안은 backend 재량).
  - **★ APPLIED를 반드시 포함하는 이유(FC-191 MAJOR-2 정합화)**: 게임 apply(status=APPLIED)와 웹 reconciler의 `location→IN_GAME` 전이 사이에는 짧은 **lag 창**이 있다(§5.4 — 게임과 웹이 서로 다른 시각에 각자 테이블을 쓴다). 이 창에서 item_instance는 아직 INVENTORY/TEMP인데 아이템은 이미 게임 인벤에 재료화돼 있다. 가드가 APPLIED를 제외하면 이 창에서 재출품이 뚫려 **웹·게임 이중 존재(D-F 위반)** 가 발생한다. 따라서 가드는 APPLIED까지 포함해 lag 창 전체를 덮고, IN_GAME 전이가 완료되면 그 이후는 location XOR CAS(`WHERE location='INVENTORY'`)가 출품을 차단한다 — **두 방어선(배송 존재 가드 → location XOR)이 lag 창을 이음매 없이 연결한다.**
  - **`FAILED`가 가드에서 제외되는 이유**: FAILED는 하드 실패(스펙 불량·계정 밴·매핑 불가 usr_id)로 격리돼 **관리자 개입 대상**이며(§7.1) 게임 인벤에 재료화되지 않았다 — 아이템은 여전히 웹 커스터디에만 있으므로 재출품·재처리를 막을 이유가 없다. FAILED 건은 관리자가 재발행/취소로 정리한다.
  - 이로써 같은 item_instance에 대한 **2건 이상 배송 발생을 원천 차단**(item_delivery.item_instance_id는 FK·비유니크지만 FAILED 아닌 배송은 사실상 최대 1건).
- 역방향(게임 인벤→장터 출품)은 **범위 밖**(§12). 이번 다리는 **웹→게임 단방향 지급**만.

### 6.2 경계 포맷터 (finalcall → 게임 user_item) — 전적으로 게임 서버 소속

메모 선례(memo §8)대로 **finalcall은 정규화된 순수 데이터로 저장(우편함 자족 스냅샷)만 하고 번역하지 않는다.** 클라 고정 계약(정수 패킹·0-based 레벨·usr_id 폭)을 재현하는 **boundary 포맷터는 전적으로 게임 서버(재컴파일 가능) 소속**이며 claim 시 수행된다 — finalcall 웹 API 계약이 아니다. 아래 "변환 규칙"은 **게임 서버 조정 단계(§12.2)의 구현 명세**이지 웹측 작업이 아니다(웹은 좌측 정본 값을 우편함에 실을 뿐).

| finalcall(정본·우편함 스냅샷) | 게임 `user_item`(클라 고정 계약) | 게임 boundary 변환 규칙(게임 서버 소속) |
|---|---|---|
| `type_code`(INT 4자리) | `itm_type`(int) | **1:1 직결**(item-code-dictionary H3). 변환 불요 |
| `level`(1-based 1~9) | `itm_level`(0-based) | **`itm_level = level − 1`**(game-item-skill-format §2). 웹은 1-based 그대로 저장 |
| `skill1_code`·`skill2_code`·`skill_percent`(분해 스냅샷) | `itm_skill`(패킹 int) | `itm_skill = [percent][skill1 3][skill2 3]`(§1 포맷). 게임 boundary가 재패킹. 마법 skill1 부재(§3) 처리 = 게임 조정 항목(U1) |
| `gf_expire_at`(DATETIME6) | `itm_gf`(timestamp) | 골드포스 만료 절대시각 |
| `recipient_user_id`·`recipient_nickname`(char16) | `itm_usr_id`(int unsigned) | 게임 boundary가 닉네임(premise #5: user.nickname==usr_name)으로 usr_id 매핑·usr_id 폭(≤32767) 흡수(U3) |
| `item_uuid`(char40) | `itm_uuid char(40)`(36자 UUID) | **멱등키**(§5). 웹이 발급·우편함 탑재, 게임이 그대로 이관 |
| (게임 인벤 슬롯) | `itm_slot` | **게임이 claim 시 자기 인벤에서 빈 슬롯 배정.** finalcall은 게임 슬롯을 지정하지 않음 |

- **용량 규칙**: 게임 인벤도 웹과 동일(기본 24 → 확장 → 최대 96). 만실은 정상 규칙 안의 케이스(§7.1 DEFERRED 처리)이며 스키마 불일치가 아니다.
- **★ 자족 스냅샷 필수**: 우편함 행은 item_instance 참조에 의존하지 않고 게임 번역에 필요한 정보를 **자체 보유**한다(`type_code`·`level`·`skill1_code`·`skill2_code`·`skill_percent`·`gf_expire_at`·`item_uuid`·`recipient_user_id`·`recipient_nickname`). 이유: (1) item_instance가 이후 변해도 배송이 불변·내구, (2) 웹은 번역하지 않으므로 게임 boundary가 claim 시 이 값만으로 완전 재패킹 가능해야 한다. §7.2 컬럼 집합이 이 충분성을 만족한다.

---

## 7. G6·G7 — 실패 회수 + 신규 스키마(우편함)

### 7.1 실패 회수 정책 (G6)

| 실패 유형 | 처리 |
|---|---|
| claim 경합(다중 게임 인스턴스) | CAS 단일 승자, 패자 무부작용 skip(§5) |
| **게임 인벤 만실**(확장 상한 96 도달) | 게임 claim이 "공간 없음" 반환 → 행을 **DEFERRED로 되돌림**(우편함 안전 보관, 유실 없음). 슬롯 확보·재접속 시 재시도. 정상 규칙 안 케이스(§6.2) |
| 타임아웃(CLAIM~APPLY 중단) | 리스 만료 후 재청구(§5, 웹 sweeper), 멱등 apply로 이중 지급 없음 |
| 하드 실패(스펙 불량·계정 밴·매핑 불가 usr_id) | `FAILED` 격리 + 관리자 개입. **자동 금전 역전 안 함** |

- **보상 트랜잭션(금전 역전) 미채택**: 배송 실패로 판매(SOLD/BUYNOW)를 되돌리면 게임머니 총량 보존(closing/purchase **I-H**)·정산 원장·소유이력이 깨진다. 판매는 이미 완결됐고 **아이템은 유실이 아니라 우편함/finalcall 커스터디에 안전 보관**되므로 역전이 불필요·유해하다.
- finalcall 측 상태: 배송 대기 중 item_instance는 구매자 소유로 finalcall 커스터디(INVENTORY/TEMP, P-E 보존)에 머물며 재판매는 §6.1 가드로 차단. APPLIED 시 §6.1 IN_GAME 이동.

### 7.2 신규 테이블 `item_delivery` 형상 (확정=게이트2, V21)

> **architect는 마이그레이션 실물을 쓰지 않는다.** 아래는 확정 대상 **형상**이며 실제 `V21__item_delivery.sql` 작성·채번은 backend-impl(FC-186) 소유(최신 V20 → V21). 정본 = erd.md §4.4·§5·§6.

| 컬럼 | 타입 | 널 | 키 | 설명 |
|---|---|---|---|---|
| id | BIGINT | N | PK | AUTO_INCREMENT, 내부 식별자(비노출) |
| public_id | CHAR(26) ULID | N | UK | 외부 식별자(B-004). 배송 상태 조회 경로 리소스 |
| sale_order_id | BIGINT | N | UK, FK→sale_order | 정산 1건당 배송 1행(1:1). **UK가 이중 배송 생성을 DB 차단**(§13 (c), platform_revenue_ledger 선례). 낙찰·즉시구매 양 경로가 SettlementRecorder 공통 꼬리에서 생성 |
| item_instance_id | BIGINT | N | FK→item_instance | 배송 대상(소유 정본 링크) |
| recipient_user_id | BIGINT | N | FK→user | 수령 구매자(= item_instance.owner_id) |
| recipient_nickname | VARCHAR(16) | N | | 수령 닉 스냅샷(게임 usr_name 매핑 계약 char16, R1) |
| item_uuid | CHAR(40) | N | UK | **멱등키**(§5). 게임 user_item.itm_uuid로 이관, 중복 apply UK 차단 |
| type_code | INT | N | | 배송 시점 분해 스냅샷(§6.2 자족) |
| level | INT | N | | finalcall 1-based(게임 이관 시 −1) |
| skill1_code | INT | Y | | 스냅샷(마법 등 부재 시 NULL) |
| skill2_code | INT | Y | | 스냅샷 |
| skill_percent | INT | N | | 스냅샷 |
| gf_expire_at | DATETIME(6) | Y | | 골드포스 만료 스냅샷 |
| status | VARCHAR(20) | N | | PENDING / CLAIMED / APPLIED / DEFERRED / FAILED |
| claim_token | VARCHAR(40) | Y | | 청구 세션 토큰(리스 소유자, §5) |
| claimed_at | DATETIME(6) | Y | | 청구 시각(리스 타임아웃 기준) |
| applied_at | DATETIME(6) | Y | | 게임 인벤 적용 완료 시각 |
| created_at | DATETIME(6) | N | | enqueue 시각. `BaseCreatedEntity`(append 원장 — `updated_at` 없음, 상태 시각은 claimed/applied가 담음. item_ownership_history·platform_revenue_ledger 선례) |

인덱스:
- `(status, created_at)` — poller가 PENDING/DEFERRED를 오래된 순 스캔(closing findClosableIds 선례, 만료 리스 재청구 sweeper 포함).
- `(recipient_user_id, status)` — 접속 시 claim(플레이어별 대기 배송) + Redis 신호 수신 시 조회 + 구매자 배송 상태 조회(§10).

`item_delivery` 주:
- `public_id` 부여(외부 노출 — 구매자 배송 상태 조회 §10). `updated_at` 미도입(append 원장, 상태 시각은 `claimed_at`/`applied_at`).
- `sale_order_id` UK 1:1이 이중 배송을 차단하므로 재판매 가드(§6.1, 상태집합=FAILED 아닌 배송)와 함께 item_instance당 FAILED 아닌 배송 최대 1건이 사실상 보장된다.
- soft delete 없음(배송은 소멸이 아니라 상태 전이. APPLIED 행 아카이브는 §4 성능 완충).

### 7.3 enqueue 원자성 (G3) — SettlementRecorder 공통 꼬리

배송 생성을 **정산 TX와 같은 TX**에 넣는다(트랜잭셔널 아웃박스). purchase-spec §6-A에서 추출한 `SettlementRecorder.record(...)` 공통 꼬리(판매자 크레딧 → sale_order INSERT → 수익원장 INSERT → 아이템 이전 → 소유이력 append)의 **말미에 `item_delivery` INSERT(PENDING) 1행**을 추가한다. 이 한 곳이 낙찰(CloseService)·즉시구매(PurchaseService) 양 경로가 공유하는 지점이므로 배송 enqueue도 양 경로에 자동 적용된다(§13 (c)).

- `item_delivery.item_uuid`는 enqueue 시점에 웹이 발급(UUID 표준 36자, char40 저장)해 스냅샷과 함께 심는다.
- PC clear 함정(closing §4.2·purchase §3.4) 준수: enqueue는 fresh INSERT(`getReferenceById` FK)로 수행, 판정 근거는 잔액 호출 전 스냅샷 복사.
- 스냅샷 소스: `sale_order`·`item_instance`(type_code·level·skills·gf_expire_at)·수령자(owner_id·nickname). enqueue 시점 값을 자족 복사(§6.2).

---

## 8. 불변식 목록 (reviewer/테스트 정본)

closing I-A~I-H·purchase P-A~P-H를 승계하고(배송은 정산 꼬리에 결합되나 금전·소유 불변식을 훼손하지 않는다), 배송 고유 불변식을 추가한다. 테스트는 **DB 상태 직접 검증**.

| # | 불변식 | 위반 시 의미 |
|---|---|---|
| **D-A** | SOLD/BUYNOW 성립 1건마다 `item_delivery` 정확히 1행(status=PENDING) 생성. `sale_order_id` UK가 이중 배송을 DB 차단. 낙찰·즉시구매 양 경로 공통(§13 (c)) | 배송 누락·이중 배송 |
| **D-B** | enqueue는 정산과 **같은 TX**. 정산 커밋 ⟺ 배송 PENDING 존재(exactly-once 결합). 정산 롤백 시 배송도 롤백 | 이중쓰기("팔렸는데 배송 없음"/"배송됐는데 판매 없음") |
| **D-C** | 배송 행은 **자족**: `type_code`·`level`·`skill1_code`·`skill2_code`·`skill_percent`·`gf_expire_at`·`item_uuid`·`recipient_user_id`·`recipient_nickname`을 자체 보유해 item_instance 참조 없이 게임 번역이 가능 | 스냅샷 불충분(게임 재패킹 불가) |
| **D-D** | claim은 **idempotent CAS 단일 승자**. 같은 배송에 claim을 N회(동시 포함) 호출해도 최대 1인이 CLAIMED. 리스 만료 재청구는 status를 PENDING으로 회수 | 다중 인스턴스 이중 청구 |
| **D-E** | 전달 at-least-once + apply exactly-once. 재청구로 같은 배송이 여러 번 apply돼도 `user_item.itm_uuid` UK로 게임 인벤에 정확히 1개만 존재 | 이중 지급 |
| **D-F** | 이중 존재·재판매 원천 차단. **item_instance에 `FAILED`가 아닌 배송(PENDING/CLAIMED/DEFERRED/APPLIED)이 존재하면 출품(재판매) 불가**(§6.1 배송 존재 가드). APPLIED 후 웹 reconciler가 `location=IN_GAME`으로 전이하며, IN_GAME ⇒ slot_no NULL·temp_storage 없음·활성 리스팅 없음이고 그 이후는 location XOR CAS가 출품을 차단한다. **가드가 APPLIED를 포함하므로 게임 apply~IN_GAME 전이 lag 창까지 이음매 없이 덮인다.** FAILED는 게임 미재료화·관리자 개입 대상이라 가드 제외(§7.1) | 웹·게임 이중 존재·재판매(특히 apply~IN_GAME lag 창) |
| **D-G** | 배송 실패(만실·타임아웃·하드)는 **금전 미역전**. 판매(sale_order·CAPTURED/직접차감·수익원장)는 불변. 아이템은 우편함/커스터디에 안전 보관 | 총량 보존(I-H) 파괴·판매 원장 붕괴 |
| **D-H** | 상태는 단조 전이(PENDING→CLAIMED→APPLIED, CLAIMED↔DEFERRED, CLAIMED→PENDING 재청구). APPLIED·FAILED는 종착. 각 전이는 CAS(WHERE 현재상태[+토큰])라 잘못된 순서 전이·만료 토큰 ack 무효 | 상태 오전이·유령 지급 |

**필수 시나리오(테스트)**:
1. SOLD enqueue — 낙찰 정산 TX에서 배송 1행 PENDING·자족 스냅샷. D-A·D-B·D-C.
2. BUYNOW enqueue — 즉시구매 정산에서 동일. D-A·D-B(양 경로 공통 꼬리).
3. 정산 롤백 — 정산 실패 시 배송도 롤백(고아 배송 없음). D-B.
4. claim 동시 N회 — 정확히 1인 CLAIMED, 패자 skip. D-D.
5. 재청구 후 이중 apply 시도 — item_uuid UK로 게임 인벤 1개만. D-E.
6. 재판매 차단 전 구간 — (a) PENDING/CLAIMED/DEFERRED 창 출품 차단, (b) **APPLIED 직후 IN_GAME 전이 전 lag 창에서도 출품 차단**(가드 상태집합에 APPLIED 포함), (c) IN_GAME 전이 후 location XOR CAS 0행 차단. FAILED 건은 출품 허용(가드 제외). D-F.
7. 만실 DEFERRED·타임아웃 재청구·하드 FAILED에서 금전 미역전. D-G.

---

## 9. 상태 전이표

### 9.1 item_delivery.status

| from | to | 트리거 | writer | 조건(CAS WHERE) |
|---|---|---|---|---|
| (신규) | PENDING | 정산 TX enqueue(G3) | 웹 | INSERT |
| PENDING / DEFERRED | CLAIMED | 게임 claim | 게임 | `status IN ('PENDING','DEFERRED')` |
| CLAIMED | APPLIED | 게임 apply 성공 ack | 게임 | `status='CLAIMED' AND claim_token=?` |
| CLAIMED | DEFERRED | 게임 인벤 만실 | 게임 | `status='CLAIMED' AND claim_token=?` |
| CLAIMED | PENDING | 리스 타임아웃 재청구 | 웹(sweeper) | `status='CLAIMED' AND claimed_at < now−lease` |
| PENDING / DEFERRED / CLAIMED | FAILED | 하드 실패 격리 | 웹/관리자 | 관리자 개입 |

### 9.2 item_instance.location (배송이 채우는 전이)

| from | to | 트리거 | writer | 조건 |
|---|---|---|---|---|
| INVENTORY / TEMP | IN_GAME | 배송 APPLIED 관측 reconciler | 웹 | 대응 배송 status=APPLIED |

- SOLD/BUYNOW 직후 item_instance는 INVENTORY/TEMP(closing I-E·purchase P-E 불변). 배송 진행 창 동안 재판매만 차단(§6.1). IN_GAME은 APPLIED 후에만.

---

## 10. api-contract 델타 (계약 파급)

정본 = api-contract §4.6(신설 — 구매자 배송 상태 조회) + §4.6 말미 게임 claim DB 프로토콜 주. 아래 요지.

### 10.1 구매자 배송 상태 조회 (신규 웹 REST)

- `GET /api/v1/me/deliveries` — 내 배송 목록(cursor). 인증 필요, `recipient_user_id=주체` 스코프(IDOR 설계 차단, `/me` 접두). 응답 `CursorResponse<DeliverySummary>`.
- `GET /api/v1/me/deliveries/{deliveryPublicId}` — 배송 상세. 당사자(recipient=주체)만. 미존재·비당사자는 `DELIVERY_001`(404, ULID라 열거 무해로 404 통일).
- `DeliverySummary` = `{ deliveryPublicId, status, item(요약), itemInstancePublicId, createdAt, appliedAt? }`. `status` ∈ PENDING/CLAIMED/APPLIED/DEFERRED/FAILED(그대로 노출 — 게임 배송 진행 표시). `item` = §3.3 item 블록 요약 재사용.
- **claim_token·claimed_at은 미노출**(내부 리스 메커니즘, 구매자 무관).
- 프론트(FC-190)는 인벤/구매내역에서 이 상태를 "게임으로 배송중(PENDING/CLAIMED/DEFERRED)·도착(APPLIED)·보류(FAILED)"로 표기. 인벤토리·주문 응답 스키마는 **불변**(형상 보존) — 프론트가 `itemInstancePublicId`로 배송 상태를 교차 조회한다.

### 10.2 게임 claim = DB 직접 프로토콜 (웹 REST API 아님 — §13 (b))

- **게임의 claim/apply/ack는 웹 REST 엔드포인트가 아니다.** 게임 서버가 finalcall MySQL에 **DB 직접 접근**해 §5.2 CAS로 수행한다(통합 스키마·read 통합/write 소유자 모델, memo boundary 포맷터=게임 서버 소속 선례). api-contract는 이를 **비-API 프로토콜**로 문서화만 하며, 요청/응답 envelope·에러코드 체계에 편입하지 않는다.
- boundary 번역(itm_skill 재패킹·level−1·usr_id 매핑)은 전적으로 게임 서버 소속(§6.2)이며 웹 계약이 아니다.
- 웹이 게임에 제공하는 계약면 = (1) `item_delivery` 스키마·상태 머신(§5·§7), (2) 자족 스냅샷 컬럼 집합(§6.2), (3) item_uuid 멱등키 규약, (4) Redis 신호 채널 `delivery:{recipientUserId}`(best-effort).

### 10.3 에러코드
- `DELIVERY_001` 배송 없음(존재하지 않거나 비당사자 public_id) — 404. (열거 방지 404 통일)
- 게임 claim은 DB 프로토콜이라 도메인 에러코드 대상 아님(CAS 영향행으로 판정).

---

## 11. 프론트 영향 (FC-190)

- **배송 상태 표시**: 구매자 인벤토리·구매내역에서 아이템별 "게임으로 배송중(PENDING/CLAIMED/DEFERRED) / 도착(APPLIED) / 보류(FAILED)" 배지. 데이터원 = `GET /me/deliveries`(§10.1), `itemInstancePublicId`로 인벤/주문 항목과 교차.
- **인벤토리·주문 응답 스키마 불변**: 신규 계약은 `/me/deliveries`뿐이며 기존 `/me/inventory`·`/me/orders` 응답 형상은 건드리지 않는다(형상 보존).
- **게임 도착 후(APPLIED)**: item_instance가 IN_GAME으로 이동해 웹 인벤토리에서 빠진다 → 프론트는 "게임 도착" 상태로 표기하고 인벤 목록에서 제외. 재판매(출품) 버튼은 **FAILED 아닌 배송(배송중·도착)·IN_GAME 아이템에 비활성**(백엔드 가드가 최종 방어선, §6.1).
- **게임 claim은 프론트 무관**(DB 프로토콜, 게임 서버 후속 별건).

---

## 12. 범위 · 개발 순서

### 12.1 이 에픽 코어 (1단계 = 웹측)
finalcall-native 내구 우편함(`item_delivery`, V21) + 정산 TX 내 enqueue(SettlementRecorder 꼬리, G3) + 실패 안전 보관·멱등 재시도(§7) + Redis best-effort 알림(§3.3) + item_uuid 발급·자족 스냅샷(§6.2) + **claim/apply DB 프로토콜 계약 확정**(§5, 게임이 맞출 규격) + 구매자 배송 상태 조회(§10) + 리스 만료 재청구 sweeper + APPLIED→IN_GAME reconciler(§5.4).

### 12.2 후속 별건 (2단계 = 게임 서버 조정)
게임 claim 실이식 + boundary 포맷터(itm_skill 재패킹·level−1·usr_id 매핑, §6.2) + `user_item.itm_uuid` UK 신설. 게임 서버 소스·재컴파일 필요, 웹 1단계 완성 후 착수. **웹 개발은 게임 서버 조정을 기다리지 않는다** — 1단계가 계약(claim 프로토콜)을 확정하고 우편함까지 채우며, 게임은 그 계약에 맞춰 나중에 claim한다(확정 2, proposal §9.1).

### 12.3 범위 밖
게임 살아있는 인벤토리 finalcall 완전 통합(A, 별도 게이트2·별도 에픽) · 역방향 출품(게임→장터 deposit) · 장착(user_equipments) 연동 · 레거시 게임 인벤 임포트.

### 12.4 재사용 자산
closing/purchase의 `SettlementRecorder` 공통 꼬리(purchase §6-A)에 enqueue 1행 삽입이 곧 G3 원자 enqueue 지점. bid §8 정신(DB=정확성, Redis=처리량)이 §3 결론 근거. Redis 신호는 EPIC-BID/알림 인프라 재사용.

---

## 13. 게이트2 형상 3건 (FC-185 확정 대상 · 사용자 승인)

proposal §7.2가 "형상 상신 항목"으로 남긴 3건을 architect 확정안으로 정리한다. G1~G7 결론·하이브리드·개발 순서는 이미 게이트2 확정분(불변)이며, 아래 3건은 그 안에서의 형상 결정이다.

### (a) item_instance "게임 이관됨" 상태 표현 = **location enum 확장(`IN_GAME`)** (별도 상태축 기각)
- **채택**: `item_instance.location`에 값 `IN_GAME` 추가.
- **근거**: (1) location은 단일 디스크리미네이터(플래그 B). 별도 boolean/status 축을 두면 디스크리미네이터가 둘이 되어 모순 상태(location=INVENTORY ∧ delivered=true = 웹·게임 이중 존재)를 표현 가능 — G5가 막으려는 바로 그 상태. 단일 축 확장이 이중 존재를 **구조적으로 불가능**하게 한다. (2) 재판매 차단이 자동: 출품 CAS `markListedIfInInventory`(`WHERE location='INVENTORY'`)가 IN_GAME을 자동 배제(별도 가드 불요). (3) XOR 표 연장이 자연스럽다(§6.1). item-spec §3.1 XOR 표·erd item_instance 불변식에 IN_GAME 행 추가로 반영.

### (b) 게임 claim = **DB 직접 프로토콜** (웹 REST API 아님)
- **채택**: 게임의 claim/apply/ack는 finalcall MySQL DB 직접 CAS(§5.2). 웹 REST 엔드포인트 미신설.
- **근거**: (1) 통합 스키마·read 통합/write 소유자 모델(memo 선례) — 게임 서버는 이미 MySQL을 직접 말하며 REST 클라이언트·JSON·인증을 얹는 것은 무겁고 부자연. (2) 지연 민감 경로에 네트워크 홉·직렬화를 더하지 않음. (3) 웹이 쓰는 것과 동일 CAS 원시(단일 승자) + item_uuid UK로 exactly-once 효과. (4) boundary 포맷터=게임 서버 소속(memo §8)과 정합. 웹은 스키마·상태 머신·자족 스냅샷·멱등키·Redis 신호 채널만 계약면으로 제공(§10.2).

### (c) `sale_order_id` 1:1 UK가 낙찰·즉시구매 양 경로 커버 = **확정**
- **채택**: `item_delivery.sale_order_id` UK(1:1)가 낙찰(closing)·즉시구매(purchase) 양 경로의 이중 배송을 DB 차단.
- **근거**: 두 경로 모두 purchase-spec §6-A `SettlementRecorder.record(...)` 공통 꼬리에서 sale_order를 생성하고, 배송 enqueue(G3)를 그 꼬리 말미에 삽입하므로 SOLD(BID)·BUYNOW 양쪽이 정산 1건당 배송 1행을 생성한다. `sale_order.id`는 source_type(AUCTION/SHOP)·result_type(BID/BUYNOW) 무관 전역 유일이라 UK가 모든 정산 경로를 균일 커버(향후 EPIC-SHOP source_type=SHOP도 동일 recorder 재사용 시 자동 포함). platform_revenue_ledger.sale_order_id UK 선례(closing §2.3·I-C) 동류.

---

## 14. 구현 인계 (계약 확정 후)

- **FC-186 (backend-impl · 우편함 스키마)**: `V21__item_delivery.sql`(§7.2, 최신 V20→V21) + `ItemDelivery` 엔티티·`ItemDeliveryRepository`(+Custom/Impl). enum `DeliveryStatus`(PENDING/CLAIMED/APPLIED/DEFERRED/FAILED). `item_instance.location`에 `IN_GAME` 값 추가(enum·§13 (a)). feature 배치 = `com.finalcall.domain.settlement.*`(정산 응집) 또는 `com.finalcall.domain.delivery.*`(응집 판단 backend 재량, closing/purchase 선례).
- **FC-187 (backend-impl · enqueue)**: `SettlementRecorder.record(...)` 꼬리에 `item_delivery` INSERT(PENDING) 1행 + item_uuid 발급 + 자족 스냅샷 복사(§7.3). 낙찰·즉시구매 양 경로 자동 적용(§13 (c)). PC clear 함정 준수. 불변식 D-A·D-B·D-C.
- **FC-188 (backend-impl · 소유 이동·재판매 차단·실패 안전보관)**: APPLIED→IN_GAME reconciler(웹 소유, §5.4·§6.1) + **재판매 가드 = "item_instance에 FAILED 아닌 배송(PENDING/CLAIMED/DEFERRED/APPLIED) 존재 시 출품 차단"**(리스팅 경로, apply~IN_GAME lag 창까지 커버 — §6.1·D-F) + 리스 만료 재청구 sweeper + DEFERRED/FAILED 처리(§7.1). 불변식 D-D·D-F·D-G·D-H.
- **FC-189 (backend-impl · Redis 알림)**: 정산 커밋 후 `delivery:{recipientUserId}` best-effort PUBLISH(§3.3). 실패 무해(정확성 무영향). AOP self-invocation·커밋 후 발행 타이밍 주의.
- **FC-190 (frontend-impl · 배송 상태 UI)**: `GET /me/deliveries` 소비, 인벤/구매내역 배송 상태 배지(§10.1·§11). 기존 인벤/주문 응답 형상 불변. 새 표시라 디자인 게이트 여부는 총괄 판단(단순 배지면 자동).
- **FC-191 (reviewer · 통합 리뷰)**: 정산 TX 원자성(D-B)·멱등(D-D·D-E)·이중 존재 차단(D-F)·금전 미역전(D-G) 중점. 정산 최고위험 → end-of-turn 리뷰 한시 on 검토.
- **게임 서버 조정(2단계, §12.2)**: claim/apply 실이식 + boundary 포맷터 + `user_item.itm_uuid` UK. 웹 1단계 완성 후 별건.
