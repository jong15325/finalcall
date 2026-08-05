# 제안 — 게임 아이템 지급 연동(장터 → 게임 인벤토리 "다리") 아키텍처

- 상태: **v0.1 — 탐색·게이트2 상신용 분석 초안**(2026-08-05). 구현 착수 전. 스키마 형상은 **제안만**이며 확정은 게이트2(사용자 승인).
  - 반영 이력(2026-08-05, 게이트2 검토 확정 3건 반영 — 형상·결론 불변): (1) 게임 인벤 용량 불일치 삭제(게임도 웹과 동일 24→확장→최대 96 규칙), (2) 개발 순서 = 웹측 코어 먼저·게임 claim/boundary 실이식은 후속 별건(§9 못박음), (3) boundary 번역(itm_skill 패킹·level−1·usr_id 매핑)은 전적으로 게임 서버 소속 → U1·U3를 "미해결"에서 "게임 서버 조정 단계 구현 항목"으로 재분류(웹 비차단), §6.2 자족 스냅샷 권고 강화·§7.2 스냅샷 충분성 재확인.
- 성격: architect 소유 spec 초안. 이 문서는 정본이 아니다 — 승인 시 `erd.md`·`api-contract.md`·본 도메인 spec으로 이관된다.
- 목적: 장터에서 낙찰(SOLD)·즉시구매(BUYNOW)한 아이템을 **실제 게임(new_sp) 캐릭터 인벤토리에 도착**시키는 다리의 되돌리기 어려운 아키텍처 결정들을 사용자 게이트2 상신용으로 정리한다.
- 근거(정본·읽기 전용 인용):
  - `CLAUDE.md` §1(도메인·토폴로지 D-068), §4(전역 원칙: 정합성·시크릿·AOP·설정바인딩), §8~13(오케스트레이션·워크플로우·게이트2·티켓·미러·커밋).
  - `docs/spec/proposals/game-db-survey.md` v0.1 — §2.1 `user`(usr_id smallint≤32767·usr_name char16 비유니크·usr_inventory 기본24·usr_code 거래화폐), §2.2 `user_item`(itm_type 4자리·itm_skill 패킹·itm_uuid char40·itm_level·first/before_owner char15), §2.3 `user_item_trash`, §2.4 `user_equipments`(11부위·-1 센티널), §4 R1(닉네임 자연키)·R6(정수패킹), §5 U1(itm_skill 분해식 미해독)·U3(usr_id 클라 노출 폭).
  - `docs/spec/memo-domain-spec.md` v1.0 — 통합 방식·경계 포맷터 **선례**(§1.1 통합 스키마 단일 정본, §3 이중 writer·쓰기 소유자 규칙, §7.1 게임 lineage 테이블명 유지, §8 boundary 포맷터=게임 서버 소속, §7.4 레거시 임포트 별건).
  - `docs/spec/references/game-item-skill-format.md` — §1 `itm_skill` 포맷·§2 `itm_level` 0-based(★★ 표시레벨=+1)·§3 마법 스킬1 부재·§5 스킬 코드 사전.
  - `docs/spec/proposals/item-code-dictionary.md`(게이트2 승인 완료) — `itm_type`↔`type_code` 1:1(H3), element/kind 축 확정.
  - `docs/spec/item-domain-spec.md` v0.4 — §2.3 `item_instance`(location·slot·skill 3분해·gf_expire_at)·§3 location XOR 불변식·§3.3 capacity 96·§4 소유이력 트리거.
  - `docs/spec/purchase-spec.md` v1.0·`docs/spec/closing-domain-spec.md` v1.0 — 소유 이전이 **finalcall 내부 `item_instance`에서 완결**되는 지점(SOLD/BUYNOW §4.4·P-E: `owner_id=buyer, location∈{INVENTORY,TEMP}`), SettlementRecorder 공통 꼬리(§6), 게임머니 총량 보존 I-H.
  - `docs/spec/bid-domain-spec.md` v0.3 §4·§8 인용 — **"정합성은 DB, 처리량은 락. 분산락(Redisson)은 경합 완화 수단이지 정확성 보장 수단이 아니다"**. 입찰이 Redis 분산락 대신 DB 비관락을 택한 근거(Redis 장애 전파 회피)와 본 제안 §3(우편함 내구성)을 정합시킨다.
  - 물리 현황: `finalcall-mysql`(3306)에 `new_sp` 스키마 상존. 최신 Flyway = **V20**(`V20__user_memo.sql`) → 신규 = **V21**.

---

## 0. 되돌리기 어려운 게이트2 결정 요약표 (먼저 승인/조정)

| # | 결정 항목 | 옵션 | 권장안 | 근거(요지) | 되돌리기 비용 |
|---|---|---|---|---|---|
| **G1** | **살아있는 인벤토리 배치** | A 완전 통합(게임 user_item/equip을 finalcall 스키마로 이관·게임서버 재지향) / B 크로스-스키마(finalcall+new_sp 두 스키마 공존) | **B-지금 / A-목표** — 다리·우편함은 finalcall 네이티브(단일 스키마, 메모 선례), 게임 살아있는 인벤토리는 이번 에픽에서 이관 안 함(new_sp 유지). 우편함 계약을 재지향 가능하게 설계 | 인벤토리는 게임 최고 핫패스(접속 중 상시 쓰기)라 A 즉시 이관은 위험·대작업. 메모(비동기·저위험)와 성격이 다름 | **높음** — 스키마 정본 이동은 데이터 마이그레이션+게임서버 재컴파일. 그래서 이번엔 분리·이연 |
| **G2** | **우편함 전송 방식** | (i) DB 테이블 우편함 / (ii) 순수 Redis Stream+Consumer Group / (iii) 하이브리드(DB=내구 정본 + Redis=알림) | **(iii) 하이브리드** — DB 우편함이 내구 정본, Redis는 폴링 제거용 best-effort 알림. **순수 Redis(ii) 기각** | 아이템·금전 우편함은 유실 불가. Redis는 스냅샷/fsync 손실창·이중쓰기(별도 내구도메인)·장애전파가 있어 정확성 경계가 못 됨(bid §8 정신). DB는 정산 TX와 원자 enqueue 가능 | **매우 높음** — 전송 매체는 유실 시 아이템·금전 소실로 직결. §3에서 1급 쟁점 |
| **G3** | **enqueue 원자성** | 정산 TX와 **같은 TX**에 우편함 INSERT(트랜잭셔널 아웃박스) / 정산 후 별도 단계 enqueue | **같은 TX**(SettlementRecorder 꼬리에 포함) | 별도 단계는 정산 커밋 후 enqueue 실패 시 "팔렸는데 배송 없음"(이중쓰기). 같은 TX면 소유이전과 배송생성이 exactly-once로 묶임 | **높음** — 배선 후 바꾸면 정산 임계 경로 재검증 |
| **G4** | **claim 멱등 프로토콜** | 상태 CAS(PENDING→CLAIMED→APPLIED) + 리스 타임아웃 재청구 + **apply 멱등키(item uuid/delivery_id)** / 단순 삭제형 큐 | **상태 CAS + 리스 + 멱등 apply** | at-least-once 하에서 이중 지급 방지 = 재청구는 허용하되 apply를 멱등키로 무해화. itm_uuid(char40 UK)가 자연 멱등키 | 중간 — 상태·키 설계 변경은 게임/웹 양쪽 배선 |
| **G5** | **아이템 인스턴스 소유 모델** | item_instance=내구 소유정본 + 게임 user_item=플레이용 재료화 복제, **배송=게임으로 이동(location/state)** / 두 표현 무관 병존 | **이동 모델** — 배송 성공 시 item_instance는 "게임 이관됨" 상태로 전이, 게임 재료화와 이중존재 방지 | 같은 아이템이 웹·게임 양쪽 인벤토리에 동시 존재하면 재판매·중복. 소유 정본은 웹(premise #2) | 중간~높음 — 상태 축 사후 추가는 형상 변경 |
| **G6** | **실패 회수 정책** | 게임 만실·타임아웃 시 **우편함 내구 보관 + 멱등 재시도**(금전 미역전) / 배송 실패 시 판매 보상 롤백 | **내구 보관·재시도, 금전 미역전** — 판매는 이미 완결(I-H). 하드 실패만 관리자 개입 | 배송 실패로 판매를 되돌리면 총량 보존(I-H)·정산 원장이 깨짐. 우편함이 안전 보관소 | 낮음~중간 — 보상 정책은 후속 조정 가능 |
| **G7** | **신규 스키마(우편함)** | finalcall-native 신규 테이블 `item_delivery`(V21) / 기존 테이블 재사용 | **신규 `item_delivery`(V21) 제안** — 형상은 §7, 확정은 게이트2 | 우편함은 새 관심사(내구 배송 상태·멱등키·리스). item_instance/sale_order에 섞으면 관심사 혼재 | 중간 — append형 신규 테이블이라 원복 깨끗 |

> **선행 확인**(아래 §8): 닉네임↔usr_id 매핑(premise #5). U1(itm_skill 분해식)·U3(usr_id 노출 폭)·level−1은 **웹을 막지 않는다** — 전적으로 게임 서버 boundary 소속이며 게임 조정 단계의 구현 항목이다(§6.2·§8). 게임 인벤 용량은 웹과 동일 규칙(24→확장→최대 96)이라 불일치 없음(§6.2).

---

## 1. 문제 정의 — "단절 지점"은 어디인가

현재 장터의 소유권 이전은 **finalcall 내부 `item_instance`에서 완결**된다. 낙찰(closing-spec §4.4·I-E)·즉시구매(purchase-spec §4.4·P-E)는 모두:

```
item_instance.owner_id  → 구매자
item_instance.location  → INVENTORY(빈 슬롯) 또는 만실 시 TEMP
item_ownership_history  → (판매자→구매자, TRADE, sale_order_id) 1행 append
```

여기서 끝난다. **이 `item_instance`는 finalcall 스키마의 테이블이며, 게임(new_sp)이 실제로 읽고 쓰는 살아있는 인벤토리(`user_item`/`user_equipments`)와는 별개 표현이다.** 즉 구매자가 장터에서 아이템을 손에 넣어도, 그가 게임에 접속해 캐릭터 인벤토리를 열면 그 아이템이 **없다**. 이 괴리가 단절 지점이다.

이 에픽의 다리는 그 괴리를 닫는다: finalcall `item_instance`에 도착한 아이템을 **게임 캐릭터 인벤토리(`user_item`)에 실제로 materialize** 시킨다. premise #2·#3에 따라 **웹은 살아있는 인벤토리에 직접 쓰지 않고**(게임 접속 중 메모리 충돌 방지) 우편함에 enqueue만 하며, **게임이 claim해 자기 인벤토리에 넣는다.**

> **왜 "배송"이 필요한가 — 통합(A)이면 필요 없지 않나?** finalcall DB가 장차 게임 DB를 대체(premise #1)한다면 item_instance가 곧 게임 인벤토리이고 배송은 불필요해 보인다. 그러나 **인벤토리는 게임의 최고 핫패스**(접속 중 상시 쓰기)라 즉시 이관이 위험·대작업이다(§2). 이관이 완료되기 전까지 item_instance(웹)와 user_item(게임)은 **두 표현으로 공존**하고, 그 사이를 잇는 우편함이 곧 이 다리다. 우편함은 통합(A)이 완료돼도 "웹↔게임 인벤토리 이동 채널"로 재사용된다.

---

## 2. G1 — 통합 DB 배치 (완전 통합 A vs 크로스-스키마 B)

### 2.1 두 옵션

| 옵션 | 내용 | 장점 | 단점·마이그레이션 부담 |
|---|---|---|---|
| **A. 완전 통합** | 게임 인벤토리/캐릭터(`user_item`·`user_equipments`·`user_item_trash`·`user.usr_inventory` 등)를 finalcall 스키마로 재구성하고 **게임 서버를 finalcall 스키마로 재지향** | 단일 정본·변환 계층 0(궁극 목표, premise #1). item_instance가 곧 게임 인벤토리면 배송 자체가 소멸 | **게임 최고 핫패스 이관** — 접속 중 상시 인벤 쓰기를 새 스키마로 옮기며 게임 서버 재컴파일·데이터 마이그레이션·클라 계약(11부위·-1 센티널·char16·usr_inventory 용량) 전수 흡수. 무입찰 메모(V20)와 비교 불가한 위험 |
| **B. 크로스-스키마** | 같은 MySQL 인스턴스에 `finalcall`·`new_sp` 두 스키마 공존. 배송 대상 = new_sp의 살아있는 인벤토리(게임이 이미 소유) | 물리 현황과 일치(new_sp 상존). 게임 서버는 claim 로직만 최소 추가, 인벤 스키마 무변경 | 두 스키마 조인 필요 경로 발생. 궁극 단일 정본(premise #1)과 어긋난 과도기 상태를 유지 |

### 2.2 권장 — **B-지금 / A-목표 (메모 선례로 좌표 정합)**

메모 도메인(memo-domain-spec §7.1·§1.1)의 선례는 **finalcall이 자기 소유 자산은 네이티브 신규 테이블로 짓되(단일 스키마), 게임 lineage 테이블명을 계승해 장차 게임 서버가 그 테이블을 그대로 읽도록** 설계하는 것이다. 이 다리에 그대로 적용하면:

- **finalcall이 소유하는 새 자산(= 배송 우편함 `item_delivery`, §7)은 finalcall-native 단일 스키마**로 짓는다(메모 A 정신). 이것이 이번 에픽의 실제 산출물이다.
- **게임의 살아있는 인벤토리(`user_item` 등)는 이번 에픽에서 이관하지 않는다** — 게임이 계속 소유(new_sp, 물리 현황 B). claim 대상이 오늘은 new_sp이고, 장차 finalcall-native 게임 인벤토리로 **재지향 가능하도록** 우편함 계약을 매체 중립으로 둔다.
- 따라서 물리적으로는 오늘 크로스-스키마(B), 로드맵상 완전 통합(A)이며, **우편함이 그 이관을 무중단·점진적으로 가능케 하는 seam**이다. 살아있는 인벤토리의 finalcall 이관(A 완성)은 이번 에픽과 **분리된 더 큰 별건**으로 게이트2를 따로 받는다.

> 이 권장은 premise #1(궁극 통합)을 부정하지 않는다 — 통합의 *순서*를 정한다: 저위험 소유 자산(메모·상거래·우편함)부터 네이티브화하고, 게임 최고 핫패스(인벤토리) 이관은 seam(우편함)을 먼저 깐 뒤에 별도로 집행한다.

---

## 3. G2 — 우편함 전송 방식 (★ 핵심 · Redis 내구성 1급 쟁점)

### 3.1 세 방식 비교

| 방식 | 내구성 | 정산 TX 원자성(이중쓰기) | 장애 전파 | 폴링 부하 | 판정 |
|---|---|---|---|---|---|
| **(i) DB 테이블 우편함** | **강함**(InnoDB, 커밋=영속) | **원자**(정산과 같은 TX에서 INSERT 가능 → 이중쓰기 없음) | 없음(DB 하나) | 게임이 폴링해야 함(신호 없으면 빈 폴 부하) | 정확성 충족, 지연·부하는 §3.3로 보완 |
| **(ii) 순수 Redis Stream + Consumer Group** | **약함**(아래 §3.2) | **이중쓰기**(정산=MySQL, XADD=Redis, 공유 TX 없음) | **큼**(Redis 다운 = 배송 전면 중단) | 낮음(XREADGROUP 블로킹) | **기각** — §3.2 |
| **(iii) 하이브리드(DB 정본 + Redis 알림)** | **강함**(정본=DB) | **원자**(enqueue=DB in-TX, Redis는 커밋 후 best-effort 신호) | **없음**(Redis 실패=지연만, 정확성 무영향) | **낮음**(신호로 빈 폴 제거) | **권장** |

### 3.2 ★ 왜 순수 Redis 우편함은 아이템·금전에 부적격인가

아이템·금전이 걸린 우편함은 **유실 불가**(exactly-once/at-least-once + 멱등)를 요구한다. 순수 Redis는 이를 구조적으로 충족하지 못한다:

1. **손실창(durability window)**: RDB 스냅샷은 마지막 스냅샷 이후를 프로세스 재시작·크래시 시 통째로 잃는다(초~분 단위). AOF `everysec`는 최대 1초 손실, `always`는 처리량 급락에도 OS 크래시·AOF 손상 시 잔여 손실이 남는다. **어느 설정이든 "커밋=영속"을 DB만큼 보장하지 못한다.**
2. **이중쓰기(dual-write across durability domains)**: 정산(SOLD/BUYNOW)은 MySQL 트랜잭션이다. 배송 enqueue가 Redis라면 두 내구 도메인에 걸친 쓰기가 되어 **공유 트랜잭션이 없다** — MySQL은 커밋됐는데 XADD가 실패(또는 그 반대)하면 "팔렸는데 배송 없음"(아이템 미지급) 또는 "배송됐는데 판매 없음"(무자본 지급)이 발생한다. 총량 보존(closing/purchase I-H)·정산 원장의 정합이 매체 경계에서 깨진다.
3. **장애 전파**: Redis가 다운되면 enqueue가 실패해 **배송이 전면 중단**된다. 이는 입찰이 Redis 분산락 대신 DB 비관락을 택한 이유와 정확히 같은 실패 양식이다 — bid-domain-spec §8·§4: *"정합성의 최종 보증은 DB(조건부 원자 갱신 + 유니크 제약)가 맡고, 분산락(Redisson)은 경합 완화 수단이지 정확성 보장 수단이 아니다"*, 그리고 `@DistributedLock`은 watchdog 부재·Redis 장애 전파로 배제됐다(CLAUDE.md §1 bid 항목). **매체를 정확성 경계로 삼는 순간 그 매체의 장애가 도메인 전면 중단으로 번진다.**

→ **결론: 순수 Redis 우편함은 이 요구를 충족할 수 없다. 기각.** DB를 내구 정본으로 두고 Redis는 알림/폴링 제거용 보조로만 쓰는 하이브리드(iii)가 프로젝트 정신(bid §8)과 정합한다.

### 3.3 권장 — 하이브리드 (트랜잭셔널 아웃박스 + best-effort 알림)

```
[웹 정산 TX]                                   [게임 서버]
SettlementRecorder.record(...) {               loop / on-signal:
  ... sale_order INSERT                           claim(playerId)  ── DB 우편함에서 CAS 청구
  ... item_ownership_history append               apply → user_item materialize
  item_delivery INSERT (PENDING)   ◀── G3        ack → APPLIED
} COMMIT                                        }
      │ (커밋 후, best-effort)
      └─▶ Redis PUBLISH "delivery:{playerId}"  ── 신호만. 실패해도 정확성 무영향
```

- **정본 = DB 우편함(`item_delivery`)**. enqueue는 정산과 **같은 TX**(G3) → 소유이전과 배송생성이 exactly-once로 묶인다(이중쓰기 없음).
- **Redis = best-effort 알림**(pub/sub 또는 경량 신호). 게임은 신호를 받으면 즉시 claim해 빈 폴을 제거한다. **신호가 유실돼도(Redis 다운·미수신) 정확성은 무손상** — 저빈도 안전망 폴(예: 수 초~수십 초 간격) + **접속 시 claim**(login 시 무조건 우편함 조회)이 정확성 백스톱이다.
- 즉 Redis 실패의 최악 결과는 "배송이 다음 안전망 폴/다음 접속까지 지연"일 뿐, **아이템 유실은 없다.** 이것이 bid §8("락은 처리량, DB는 정확성")의 배송판 적용이다.
- 폴링 부하(§4)는 신호가 대부분 제거하고, 안전망 폴은 저빈도라 부하가 작다.

---

## 4. 공유 DB 성능 모델 (게임 핫패스 vs 웹 공유)

게임 서버(지연 민감·잦은 인벤 쓰기)와 웹이 같은 MySQL을 공유할 때의 경합 지점과 완충:

| 경합 지점 | 위험 | 완충 |
|---|---|---|
| **커넥션풀** | 게임·웹·마감 워커·배송 poller가 같은 인스턴스 `max_connections`를 나눠 씀 | 서비스별 풀 상한 분리 + 마감/배송 워커 풀을 작게 격리(폭주 시 게임 커넥션 고갈 방지) |
| **버퍼풀(핵심 실병목 추정)** | 웹의 대형 스캔(카탈로그·거래내역·목록)이 게임 핫 페이지(`user`·`user_item`·`user_equipments`·`user_active`)를 **evict** → 게임 인벤 조회 지연 스파이크 | 웹 목록/검색 읽기를 **ES(9200)+Kafka로 오프로드**(완충 자산). 무거운 읽기를 DB에서 걷어내 버퍼풀을 게임 핫셋에 양보 |
| **행 락** | 우편함이 유일한 공유 쓰기 테이블 | **쓰기 소유자 분리**(premise #2): 게임=live inventory 쓰기, 웹=우편함 enqueue(INSERT append)·상거래. **서로 다른 테이블이라 핫 테이블 행락 교차가 원천적으로 없다.** 우편함 내부도 enqueue=INSERT·claim=상태 CAS라 경합면이 좁다 |
| **폴링 부하** | 2440 유저가 접속 중 각자 1초 폴링 시 ≈2440 qps의 **빈 폴**(대부분 배송 없음) | §3.3 Redis 신호로 **빈 폴 제거** — 배송이 실제 있을 때만 claim. 안전망 폴은 저빈도 |

**정량 추정(개략)**: 실병목은 **락 경합이 아니라 버퍼풀 경합 + 폴 증폭**이다. 락은 쓰기 소유자 분리로 교차가 없어 표면이 작다. 따라서 최우선 완충은 (1) 웹 무거운 읽기의 ES/리플리카 오프로드, (2) Redis 알림으로 빈 폴 제거, (3) 우편함 행을 작고 짧게 유지(APPLIED 행은 주기 아카이브)해 우편함 스캔 비용을 낮게 유지. 정확한 임계는 실부하 측정 후 튜닝(bid §7.3 "선 측정 후 최적화" 정신).

---

## 5. G4 — claim 프로토콜 (멱등 · at-least-once 하 이중 지급 방지)

### 5.1 상태 머신

```
PENDING ──claim(CAS)──▶ CLAIMED(lease) ──apply 성공(ack)──▶ APPLIED
   ▲                        │
   └──리스 타임아웃 재청구────┘   (게임 크래시로 CLAIM~APPLY 사이 중단 시 재청구 가능)

하드 실패(스펙 불량·계정 밴) ──▶ FAILED (관리자 개입, §6)
```

- **claim = 조건부 CAS 단일 승자**: `UPDATE item_delivery SET status='CLAIMED', claimed_at=now, claim_token=? WHERE id=? AND status='PENDING'` — 영향행 1=청구 성공, 0=이미 다른 게임 인스턴스/재시도가 가져감 → skip(무부작용). closing/bid의 종료성 CAS 선례와 동류(closing §3.2 I-F).
- **at-least-once 재청구 허용**: CLAIMED 상태에서 게임이 크래시하면 `claimed_at + lease_timeout` 경과 후 그 행을 **PENDING으로 회수(재청구 가능)**. 이 재청구가 곧 at-least-once의 원천이다.
- **이중 지급 방지 = 멱등 apply**: 재청구로 같은 배송이 두 번 apply될 수 있으므로, **게임의 인벤 삽입이 멱등키로 무해화**돼야 한다. 자연 멱등키 = **`itm_uuid char(40)`**(§6.2). 배송 시점에 finalcall이 uuid를 미리 확정해 우편함 행에 실어 보내고, 게임 `user_item.itm_uuid`에 **UK**를 두면(또는 apply 원장으로) 같은 uuid 재삽입이 UK 충돌로 no-op → **at-least-once 전달 + 멱등 apply = exactly-once 효과**.
- **ack**: apply 성공 시 `UPDATE ... SET status='APPLIED' WHERE id=? AND status='CLAIMED'`. 이 ack도 CAS라 이중 ack 무해.

### 5.2 멱등 핵심 정리
- **전달은 at-least-once**(재청구로 최소 1회 이상 도달 보장), **효과는 exactly-once**(uuid UK로 중복 apply 무해). 이는 §3.2에서 순수 Redis가 못 주는 조합을 DB 정본이 주는 이유다.
- claim_token(청구 세션 식별자)으로 "누가 리스를 쥐었는지" 추적 — 만료된 토큰의 뒤늦은 ack는 CAS(`WHERE status='CLAIMED'`)와 토큰 대조로 무시.

---

## 6. G5 — 아이템 인스턴스 매핑 (경계 포맷터) + 이중 존재 방지

### 6.1 소유 모델 (이중 존재 방지)

- **소유 정본 = finalcall `item_instance`**(웹=상거래 소유, premise #2). 게임 `user_item`은 플레이어가 게임에 끌어와 쓰는 **재료화(materialized) 복제**다.
- **배송 = 이동(move-to-game)**: 배송 성공(APPLIED) 시 finalcall `item_instance`는 "게임으로 이관됨" 상태로 전이(예: `location`에 게임 이관 값 추가 또는 배송 상태 축)해 **같은 아이템이 웹 인벤토리와 게임 인벤토리에 동시 존재하지 않게** 한다. 이관된 아이템은 다시 리스팅·재판매되지 않는다(location XOR 불변식 item-spec §3.1의 연장).
- 역방향(게임 인벤 → 장터 출품)은 **이번 에픽 범위 밖**(withdraw/deposit 대칭, 후속). 이번 다리는 **웹→게임 단방향 지급**만.

> 주의: item-domain-spec §3.1의 location enum(INVENTORY/TEMP/LISTED)에 게임 이관 상태를 어떻게 표현할지(새 enum 값 vs 배송 상태 축 분리)는 **형상 변경이라 게이트2 대상**. §7에서 제안만.

### 6.2 경계 포맷터 (finalcall item_instance → 게임 user_item)

메모 선례(memo-domain-spec §8)대로 **finalcall은 정규화된 순수 데이터로 저장(우편함 자족 스냅샷)만 하고, 번역은 전혀 하지 않는다.** 클라 고정 계약(정수 패킹·0-based 레벨·usr_id 폭)을 재현하는 **boundary 포맷터는 전적으로 게임 서버(재컴파일 가능) 소속**이며 claim 시 수행된다 — finalcall 웹 API 계약이 아니다. 아래 표의 "변환 규칙"은 **게임 서버 조정 단계의 구현 명세**이지 웹측 작업이 아니다(웹은 좌측 정본 값을 우편함에 실을 뿐):

| finalcall(정본·우편함 스냅샷) | 게임 `user_item`(클라 고정 계약) | 게임 boundary 변환 규칙(게임 서버 소속) |
|---|---|---|
| `template.type_code`(INT 4자리) | `itm_type`(int) | **1:1 직결**(item-code-dictionary H3 승인). 변환 불요 |
| `level`(1-based, 1~9) | `itm_level`(0-based) | **`itm_level = level − 1`** — game-item-skill-format §2 ★★. 게임 boundary가 claim 시 −1. 웹은 1-based 그대로 저장 |
| `skill1_code`·`skill2_code`·`skill_percent`(분해 스냅샷) | `itm_skill`(패킹 int) | `itm_skill = [percent 1~2자리][skill1 3자리][skill2 3자리]`(game-item-skill-format §1). 게임 boundary가 재패킹. 마법 skill1 부재(§3) 처리 = 게임 조정 단계 항목(U1) |
| `gf_expire_at`(DATETIME6) | `itm_gf`(timestamp) | 골드포스 만료 절대시각 |
| `recipient_user_id`(BIGINT)·`recipient_nickname`(char16) | `itm_usr_id`(int unsigned, 게임 usr_id) | 게임 boundary가 닉네임(premise #5: user.nickname==usr_name)으로 usr_id 매핑·usr_id 폭(≤32767) 흡수(U3, 게임 조정 단계) |
| 배송 시 확정 `item_uuid`(char40) | `itm_uuid char(40)`(36자 UUID) | **멱등키**(§5). 웹이 발급·우편함 탑재, 게임이 그대로 이관. char15/char16 등 고정폭 절단은 게임 boundary(닉 스냅샷 first/before_owner char15 주의) |
| (게임 인벤 슬롯) | `itm_slot` | **게임이 claim 시 자기 인벤에서 빈 슬롯 배정.** finalcall은 게임 슬롯을 지정하지 않음(살아있는 인벤 쓰기 소유=게임, premise #2) |

- **용량 불일치 없음(확정)**: 게임 인벤도 **웹과 동일 규칙**이다 — 기본 24슬롯에서 사용자가 슬롯 확장 아이템으로 6칸/12칸씩 확장, **최대 96(웹과 동일 상한)**. 초기 조사의 "게임 24 < 웹 96 불일치"는 오해였고 삭제한다. 만실은 정상 규칙 안에서 여전히 발생 가능(현 확장 수준에서 실제로 꽉 참) → 이는 §7.1 우편함 안전 보관·재시도로 처리되는 정상 케이스일 뿐, 스키마 불일치가 아니다.
- **★ 자족 스냅샷 필수(강화)**: 우편함 행은 item_instance 참조에 의존하지 않고 **게임 번역에 필요한 정보를 빠짐없이 자체 보유**한다 — `type_code`·`level`(1-based)·`skill1_code`·`skill2_code`·`skill_percent`·`gf_expire_at`·`item_uuid`·`recipient_user_id`·`recipient_nickname`. 이유: (1) item_instance가 이후 변해도 배송이 불변·내구, (2) **웹은 번역하지 않으므로**(확정 3) 게임 boundary가 claim 시 위 값만으로 완전 재패킹할 수 있어야 한다. §7.2 스냅샷 컬럼 집합이 이 충분성을 만족하는지 재확인 대상.

---

## 7. G6·G7 — 실패 회수 + 신규 스키마(우편함) 제안

### 7.1 실패 회수 정책 (G6)

| 실패 유형 | 처리 |
|---|---|
| **claim 경합(다중 게임 인스턴스)** | CAS 단일 승자, 패자는 무부작용 skip(§5) |
| **게임 인벤 만실**(확장 상한 96 도달·현 확장 수준 초과) | 게임 claim이 "공간 없음" 반환 → 행을 **PENDING/DEFERRED로 되돌림**(우편함이 안전 보관소, 유실 없음). 플레이어 알림 후 슬롯 확보(확장 아이템·정리)·접속 시 재시도. 정상 규칙 안의 케이스이며 스키마 불일치가 아니다(§6.2). (게임 `gift_box` 선물함 오버플로우 활용은 후속 옵션 — 이번 결론에 불필요) |
| **타임아웃**(CLAIM~APPLY 중단) | 리스 만료 후 재청구(§5.1), 멱등 apply로 이중 지급 없음 |
| **하드 실패**(스펙 불량·계정 밴·매핑 불가 usr_id) | `FAILED` 상태로 격리 + 관리자 개입. **자동 금전 역전 안 함** |

- **보상 트랜잭션(금전 역전) 미채택**: 배송 실패로 판매(SOLD/BUYNOW)를 되돌리면 게임머니 총량 보존(closing/purchase **I-H**)·정산 원장(`platform_revenue_ledger`)·소유이력이 깨진다. 판매는 이미 완결됐고 **아이템은 유실이 아니라 우편함/ finalcall 커스터디에 안전 보관**되므로 역전이 불필요·유해하다. 이것이 §3에서 DB 내구성을 고집한 이유의 귀결이다.
- finalcall 측 상태: 배송 대기 중 item_instance는 구매자 소유로 **finalcall 커스터디(TEMP/배송대기 상태)** 에 머문다(기존 temp_storage 오버플로우 개념과 정합, item-spec §2.5). APPLIED 시 §6.1 이동 전이.

### 7.2 신규 테이블 `item_delivery` 형상 **제안**(확정=게이트2, V21)

> architect는 마이그레이션 실물을 쓰지 않는다. 아래는 확정 대상 **형상 제안**이며 실제 `V21__item_delivery.sql` 작성·채번은 backend-impl 소유(최신 V20 → V21).

| 컬럼 | 타입 | 널 | 키 | 설명 |
|---|---|---|---|---|
| id | BIGINT | N | PK | 내부 식별자(비노출) |
| public_id | CHAR(26) ULID | N | UK | 외부 식별자(B-004) |
| sale_order_id | BIGINT | N | UK, FK→sale_order | 정산 1건당 배송 1행(1:1). **UK가 이중 배송 생성 DB 차단**(closing I-C·platform_revenue_ledger 선례) |
| item_instance_id | BIGINT | N | FK→item_instance | 배송 대상(소유 정본 링크) |
| recipient_user_id | BIGINT | N | FK→user | 수령 구매자(= item_instance.owner_id) |
| recipient_nickname | VARCHAR(16) | N | | 수령 닉 스냅샷(게임 usr_name 매핑 계약, char16, R1) |
| item_uuid | CHAR(40) | N | UK | **멱등키**(§5). 게임 user_item.itm_uuid로 이관, 중복 apply UK 차단 |
| type_code | INT | N | | 배송 시점 분해 스냅샷(§6.2 자족) |
| level | INT | N | | finalcall 1-based(게임 이관 시 −1) |
| skill1_code | INT | Y | | 스냅샷(마법 등 부재 시 NULL) |
| skill2_code | INT | Y | | 스냅샷 |
| skill_percent | INT | N | | 스냅샷 |
| gf_expire_at | DATETIME(6) | Y | | 골드포스 만료 스냅샷 |
| status | VARCHAR(20) ENUM | N | | PENDING / CLAIMED / APPLIED / DEFERRED / FAILED |
| claim_token | VARCHAR(40) | Y | | 청구 세션 토큰(리스 소유자, §5) |
| claimed_at | DATETIME(6) | Y | | 청구 시각(리스 타임아웃 기준) |
| applied_at | DATETIME(6) | Y | | 게임 인벤 적용 완료 시각 |
| created_at | DATETIME(6) | N | | enqueue 시각. `BaseCreatedEntity`(append 원장, updated_at 없음 — 상태 시각은 claimed/applied가 담음) |

제안 인덱스:
- `(status, created_at)` — poller가 PENDING/DEFERRED를 오래된 순 스캔(closing findClosableIds 선례).
- `(recipient_user_id, status)` — 접속 시 claim(플레이어별 대기 배송 조회) + Redis 신호 수신 시 조회.

> **형상 상신 항목**: (a) `item_instance.location` 게임 이관 상태 표현 방식(enum 확장 vs 별도 배송 상태 축, §6.1) — item-spec 형상 변경이라 게이트2. (b) 게임 `user_item.itm_uuid` UK 신설 여부(게임 스키마 변경, 게임 서버·new_sp 영향). (c) sale_order_id 1:1 UK가 낙찰·즉시구매 양 경로를 모두 커버하는지(SettlementRecorder 공통 꼬리에 enqueue 삽입, purchase-spec §6 재사용).

---

## 8. 확인 필요 — 웹 비차단(게임 조정 단계) vs 웹 선행

### 8.1 게임 서버 조정 단계의 구현 항목 (웹 개발을 막지 않음 — 확정 3)
아래는 모두 **클라 고정 계약이며 게임 서버 boundary 포맷터가 claim 시 수행**한다. 웹은 finalcall-native 정규화 값만 우편함에 자족 스냅샷으로 저장하고 번역하지 않으므로(§6.2), 이 항목들은 "미해결"이 아니라 **게임 서버를 웹에 맞추는 후속 단계(§9)의 구현 항목**이다:
- **U1 — `itm_skill` 재패킹**: game-item-skill-format §1 `[percent][skill1 3][skill2 3]`, 마법 슬롯1 부재(§3). 게임 boundary가 스냅샷 3필드로 재패킹. 게임 서버 직렬화 코드로 1회 최종 확인(구현 항목).
- **level −1**: 게임 boundary가 claim 시 1-based→0-based 변환(§6.2).
- **U3 — `usr_id` 노출 폭(≤32767) 매핑**: 게임 boundary가 닉네임→usr_id 매핑·폭 흡수(premise #5).

### 8.2 웹 선행 확인 (이번 계약/DB 프로토콜에서 확정)
- **게임 `user_item.itm_uuid` UK 신설**: 멱등 apply의 전제(§5). 게임 스키마·서버 변경이라 게임 재컴파일 범위·new_sp 영향은 게임 조정 단계에서 흡수하되, **웹은 배송 시 item_uuid를 발급·우편함 탑재**(§7.2)로 선제 확정.
- **닉네임 자연키 정합(R1)**: recipient_nickname 스냅샷 + usr_name 매핑. 닉 변경 시 재매핑 정책(닉 스냅샷 vs id 정규화)은 메모 §6 선례 계승.
- **레거시 데이터·역방향(게임→장터 출품)**: 이번 에픽 범위 밖(단방향 지급만). 역방향 deposit·기존 게임 인벤 임포트는 후속 별건.
- **완전 통합(A) 인벤토리 이관 시점**: G1의 A-목표 집행(게임 살아있는 인벤토리 finalcall 이관·게임서버 재지향)은 별도 게이트2·별도 에픽.

---

## 9. 범위 · 개발 순서 · 인계 메모

### 9.1 ★ 개발 순서 — 웹 먼저, 게임 서버 나중 (확정 2)
게임 서버는 재컴파일 가능하고 클라이언트는 수정 불가다. 따라서 **웹측을 먼저 완성하고 게임 서버를 그 결과에 맞춰 조정**하는 것이 자연 순서다. 이번 에픽에서 순서를 못박는다:

- **1단계(이번 에픽 코어 = 웹측)**: finalcall-native 내구 우편함(`item_delivery`, V21) + 정산 TX 내 enqueue(SettlementRecorder 꼬리, G3) + 실패 안전 보관·멱등 재시도(§7.1) + Redis best-effort 알림(§3.3) + item_uuid 발급·자족 스냅샷(§6.2). **claim/apply의 계약·DB 프로토콜(상태 머신·CAS·리스·멱등키)도 이번에 확정**해 게임이 맞출 규격을 고정한다.
- **2단계(후속 별건 = 게임 서버 조정)**: 게임 claim 실이식 + boundary 포맷터(itm_skill 재패킹·level −1·usr_id 매핑, §6.2·§8.1) + `user_item.itm_uuid` UK. 게임 서버 소스·재컴파일이 필요하며 웹 1단계 완성 후 착수한다.

즉 **웹 개발은 게임 서버 조정을 기다리지 않는다** — 1단계는 계약(claim 프로토콜)을 확정하고 우편함까지 채우며, 게임은 그 계약에 맞춰 나중에 claim한다.

### 9.2 범위 · 재사용 · 반영 대상
- **이 에픽 코어(1단계 웹측)**: 위 9.1 1단계.
- **범위 밖**: 게임 살아있는 인벤토리 finalcall 이관(A 완성), 역방향 출품(게임→장터), 장착(user_equipments) 연동, 레거시 인벤 임포트, 게임 claim 실이식·boundary 포맷터(2단계).
- **재사용 자산**: closing/purchase의 `SettlementRecorder` 공통 꼬리(§6)에 enqueue 1행 삽입이 곧 G3의 원자 enqueue 지점. bid §8 정신(DB=정확성, Redis=처리량)이 §3 결론의 근거.
- 승인 후 반영 대상: `erd.md`(item_delivery §4·§5 인덱스·§6 Flyway V21), `api-contract.md`(게임 claim이 API인지 DB 직접인지 결정 시 그 계약), 본 도메인 spec 정본화.
