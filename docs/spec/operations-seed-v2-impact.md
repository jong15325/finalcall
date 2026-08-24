# ops-20-v2 계약 변경 영향 분석

상태: **게이트2 승인 — 2026-08-24**
작성: architect
기준 계약: `docs/spec/operations-seed-spec.md` v0.1 (`ops-20-v1`)
현재 상태: 배포 DB의 v1 시나리오는 `COMPLETE`; 본 문서는 구현·DB 변경 없이 v2 전환 계약만 제안한다.

## 1. 변경 요구와 계약 델타

1. 로그인 ID를 `test01`~`test20`으로 단순화하고, 20계정이 동일한 기억 가능한 임시 비밀번호를 사용한다.
2. 공개 아이템 마켓에서 무스킬/단일/이중 스킬과 Gold Force 없음/유효/만료가 모두 실제 조회된다.
3. 실시간 경매와 고정가 아이템 마켓의 진행 중 데이터를 늘린다.
4. **현재 `item_template`의 모든 type_code**가 최소 1개 이상의 `INVENTORY` 또는 진행 중 listing에 존재한다. 권고안은 이보다 강하게 모든 type_code를 ACTIVE shop에 정확히 1건씩 노출한다.

기존 API·엔티티·V1~V28 스키마·마스터 데이터는 바꾸지 않는다. 시나리오 키와 결정적 public ID namespace만 `ops-20-v2`로 올린다.

## 2. 영향받는 기존 티켓

| 티켓 | 영향 | 필요한 후속 변경 |
|---|---|---|
| **FC-370** | 직접 | v1 계약을 v2 수량·계정·전체 type coverage 계약으로 개정 |
| **FC-371** | 직접 | `SeedGuard.SCENARIO`, 확인 fingerprint, COMPLETE 판정 namespace를 v2로 변경; v1 cleanup 명령 호환 유지 |
| **FC-372** | 직접 | 로그인 ID, 사용자/아이템 수, 전체 template 순환 배정, 스킬/GF 교차분포 변경 |
| **FC-373** | 직접 | 경매·shop·bid/hold 수량과 실시간 종료시각 분포 변경; ACTIVE shop 40건을 전체 type_code와 1:1 배치 |
| FC-374 | **무영향** | 사용자 PK를 런타임 조회하므로 소셜 건수·의미는 유지. 로그인 문자열 하드코딩이 발견될 때만 기계 치환 |
| **FC-375** | 직접 | v2 건수/분포/모든 type coverage 검증, v1→v2 cleanup-reapply, 외부참조 탐지, 스크립트 인자 변경 |
| **FC-376** | 직접 | 변경분 재리뷰, v1 cleanup dry-run→cleanup→v2 dry-run→apply→API/UI smoke 증거 갱신 |

후속 구현 티켓은 기존 완료 티켓을 소급 재개하지 않고 `derived_from`으로 새로 발급해야 한다. 권고 분해는 계약 개정, fixture v2, validator/upgrade, 배포 재적용·리뷰 4개다.

## 3. 안전한 v1 → v2 전환

### 3.1 in-place UPDATE 금지

v1의 자연키·public ID·건수·listing 관계를 부분 UPDATE하지 않는다. 사용자 login_id만 바꾸고 하위 fixture를 덧붙이면 COMPLETE 판정과 cleanup namespace가 혼재하고, 외부 참조 판정이 모호해진다.

### 3.2 전환 프로토콜

1. 현재 v1 `status`와 전체 불변식 검증이 `COMPLETE`인지 확인한다.
2. v1 cleanup dry-run으로 외부 거래·대화·OAuth 등 시나리오 밖 참조가 0건인지 검사한다.
3. 외부 참조가 있으면 전환을 중단한다. 강제 cleanup이나 참조 행 흡수는 하지 않는다.
4. DB 백업 또는 Docker MySQL volume snapshot을 확보한다.
5. **v1 runner 보존본**으로 v1 cleanup을 FK 역순 단일 트랜잭션 수행한다.
6. v1 row count가 전부 0이고 기존 V9/V12/V13 및 마스터 row count가 불변인지 확인한다.
7. v2 dry-run에서 `item_template count=40`, `distinct type_code=40`, skill master 최소 18, slot/UK 충돌, 예상 건수를 검사한다.
8. v2 apply 후 v2 COMPLETE·금전/소유권·전체 type coverage 검증을 수행한다.
9. API/UI smoke가 실패하면 v2만 cleanup하고 백업 복원 여부를 사용자에게 상신한다. v1을 자동 재주입하지 않는다.

v1과 v2를 동시에 유지하지 않는다. 동일 20인 페르소나의 이중 계정·이중 거래가 화면을 왜곡하고 단순 ID UK 충돌 가능성을 만든다.

## 4. v2 정확한 수량과 분포

### 4.1 사용자·아이템

| 데이터 | v2 정확한 값 |
|---|---|
| 사용자 | 20 (`test01`~`test20`, 모두 non-admin) |
| item_instance | **240** |
| 위치 | INVENTORY 148 / TEMP 10 / LISTED 76 / IN_GAME 6 |
| 스킬 수 | 무스킬 48 / 단일 72 / 이중 120 |
| Gold Force | 없음 96 / 유효 96 / 만료 48 |
| 레벨 | 1~3: 48 / 4~6: 72 / 7~9: 72 / 10 이상: 48 |

- `skill_percent`: 무스킬은 0으로 고정한다. 스킬 보유 192건은 5~15: 40 / 16~30: 56 / 31~50: 56 / 51~80: 32 / 81~99: 8이다.
- Gold Force 유효는 T0 이후 1~365일, 만료는 T0 이전 1~90일이다.
- 모든 type_code는 전체 240개에서 최소 6번 순환 배정된다(현재 template 40개 기준).

### 4.2 공개 마켓 노출 교차분포

ACTIVE shop은 **40건**이며 현재 40개 type_code와 오름차순 1:1로 배치한다.

| ACTIVE shop 축 | 정확한 분포 |
|---|---|
| 스킬 | 무스킬 12 / 단일 14 / 이중 14 |
| Gold Force | 없음 14 / 유효 14 / 만료 12 |
| 가격 | 30,000~8,800,000 G; 수수료 구간 4개를 모두 포함 |
| type_code | 현재 distinct 40개 각각 정확히 1건 |

스킬×Gold Force 3×3 조합은 각 셀 최소 4건을 보장하되 총 40건을 다음처럼 고정한다.

|  | GF 없음 | GF 유효 | GF 만료 | 합계 |
|---|---:|---:|---:|---:|
| 무스킬 | 4 | 4 | 4 | 12 |
| 단일 | 5 | 5 | 4 | 14 |
| 이중 | 5 | 5 | 4 | 14 |
| 합계 | 14 | 14 | 12 | 40 |

### 4.3 경매·마켓·입찰

| 데이터 | v2 정확한 분포 |
|---|---|
| auction 56 | SCHEDULED 4 / ACTIVE 32 / SOLD 10 / UNSOLD 5 / CANCELLED 5 |
| SOLD result | BID 7 / BUYNOW 3 |
| bid 200 | ACTIVE 32 / OUTBID 161 / WON 7 |
| money_hold 200 | HELD 32 / RELEASED 161 / CAPTURED 7 |
| shop 56 | ACTIVE 40 / SOLD 6 / EXPIRED 5 / CANCELLED 5 |
| sale_order / ledger / delivery | 각 16, v1 상태분포 유지 |

ACTIVE 경매 종료시각은 T0 기준 5분 이내 6, 5~30분 8, 30분~6시간 10, 6시간~3일 8이다. 최소 24개 ACTIVE 경매에 입찰 2건 이상을 둬 최고가 변화가 화면에 보이게 한다. SCHEDULED 4개는 T0 이후 15분/1시간/6시간/1일에 시작한다.

LISTED 76건은 SCHEDULED+ACTIVE auction 36건과 ACTIVE shop 40건의 합과 정확히 일치한다. 두 listing이 같은 item_instance를 공유하면 안 된다.

### 4.4 소셜·정산 유지

chat_room 24, chat_message 420, user_memo 100, order/ledger/delivery 16 등 v1의 소셜·완료거래 분포는 유지한다. 사용자 자연키만 v2 계정으로 바뀐다.

## 5. 단순 계정 보안안

- ID는 `test01`~`test20`으로 고정한다. 닉네임은 기존 페르소나명을 유지한다.
- 비밀번호는 사용자 게이트2 선택에 따라 **20계정 공통 약한 임시 비밀번호**로 한다. 실제 값은 별도 전달하며, 구현에는 평문을 하드코딩하지 않고 실행 시 `SEED_PASSWORD_HASH` BCrypt hash만 주입한다. SQL·Docker image·로그에는 평문을 남기지 않는다.
- 모든 계정은 `is_admin=false`, OAuth 없음, `example.invalid` 이메일, 실제 메일 발송 금지다.
- 선택된 값은 공개적으로 추측 가능한 약한 공통 비밀번호다. 사용자는 이 위험을 명시적으로 수용했다. 따라서 **공개 도메인의 gateway rate limit 유지**, non-admin·실데이터와 분리, 테스트 기간 한정 사용을 필수 조건으로 한다.
- 테스트 종료 즉시 `ops-20-v2` cleanup을 수행한다. 계정을 남겨야 하는 예외 상황에는 먼저 강한 새 hash로 회전해야 하며, 약한 공통 비밀번호 상태로 장기 존치할 수 없다.

## 6. “모든 타입” 정의와 검증

### 6.1 정의

- 기준 집합 `T` = v2 dry-run 시작시각 T0에 `SELECT type_code FROM item_template`이 반환한 **모든 행**이다. `item_template`에는 soft delete가 없으므로 제외 조건도 없다.
- 현재 V9+V12 정본의 기대 집합은 distinct **40개**다. type_code 자체가 식별자이며 `main_category/sub_group/element/kind` 범위 추정으로 대체하지 않는다.
- dry-run에서 전체 row count와 distinct type_code가 40이 아니면 v2는 실패한다. 새 마스터 타입이 추가된 경우 조용히 일부만 생성하지 않고 계약/수량 재산정을 요구한다.
- coverage 대상 `C` = v2 item 중 `(location='INVENTORY')` 또는 진행 listing에 귀속된 행이다. 진행 listing은 auction status `SCHEDULED|ACTIVE` 또는 shop status `ACTIVE`다.
- 필수조건은 `T - type_code(C) = ∅`. 추가 권고/본 계약은 ACTIVE shop 40건이 T와 정확히 1:1이다.

### 6.2 검증 SQL

```sql
-- 1) 마스터 기준 집합 자체가 현재 계약(40개)과 일치
SELECT COUNT(*) AS rows, COUNT(DISTINCT type_code) AS distinct_types
FROM item_template;
-- 기대: 40, 40

-- 2) inventory 또는 진행 listing에 하나도 없는 타입: 반드시 0행
SELECT t.type_code, t.display_name
FROM item_template t
WHERE NOT EXISTS (
    SELECT 1
    FROM item_instance i
    LEFT JOIN auction a
      ON a.item_instance_id = i.id
     AND a.status IN ('SCHEDULED', 'ACTIVE')
    LEFT JOIN shop s
      ON s.item_instance_id = i.id
     AND s.status = 'ACTIVE'
    WHERE i.template_id = t.id
      AND i.public_id LIKE 'OP2ITM%'
      AND (i.location = 'INVENTORY' OR a.id IS NOT NULL OR s.id IS NOT NULL)
);

-- 3) ACTIVE shop이 모든 타입과 정확히 1:1인지: 반드시 0행
SELECT t.type_code, COUNT(s.id) AS active_shop_count
FROM item_template t
LEFT JOIN item_instance i
  ON i.template_id = t.id
 AND i.public_id LIKE 'OP2ITM%'
LEFT JOIN shop s
  ON s.item_instance_id = i.id
 AND s.public_id LIKE 'OP2SHP%'
 AND s.status = 'ACTIVE'
GROUP BY t.id, t.type_code
HAVING COUNT(s.id) <> 1;

-- 4) 공개 마켓의 스킬×GF 교차표
SELECT
  CASE WHEN i.skill1_id IS NULL AND i.skill2_id IS NULL THEN 'NONE'
       WHEN i.skill1_id IS NOT NULL AND i.skill2_id IS NULL THEN 'SINGLE'
       ELSE 'DOUBLE' END AS skill_group,
  CASE WHEN i.gf_expire_at IS NULL THEN 'NONE'
       WHEN i.gf_expire_at > :t0 THEN 'ACTIVE'
       ELSE 'EXPIRED' END AS gf_group,
  COUNT(*) AS cnt
FROM shop s
JOIN item_instance i ON i.id = s.item_instance_id
WHERE s.public_id LIKE 'OP2SHP%' AND s.status = 'ACTIVE'
GROUP BY skill_group, gf_group;
-- 기대 행렬: 4/4/4, 5/5/4, 5/5/4
```

public ID prefix `OP2*`는 제안 namespace다. 실제 구현 prefix가 달라지면 SQL과 cleanup 판별자를 같은 상수에서 생성해야 한다.

## 7. 게이트2 결정사항 — 승인 기록

| ID | 결정 | 선택지 | architect 권고 |
|---|---|---|---|
| V2-G1 | 업그레이드 방식 | A v1 cleanup 후 v2 재적용 / B in-place 수정 / C v1·v2 공존 | **A 승인** |
| V2-G2 | 시나리오 키 | A `ops-20-v2` 신규 namespace / B v1 키 재사용 | **A 승인**. 상태/cleanup 혼동 차단 |
| V2-G3 | 단순 로그인 | A 강한 공유 임시 비밀번호 / B 별도 전달된 약한 공통 비밀번호 / C 계정별 비밀번호 | **B 사용자 선택 승인**. 공개 노출 위험 수용, §5 조건부 |
| V2-G4 | 모든 타입 기준 | A T0의 item_template 전건, 현재 40 고정 검증 / B 대표 24개 / C main category만 | **A 승인** |
| V2-G5 | 공개 노출 강도 | A 모든 40 타입을 ACTIVE shop에 1:1 / B inventory 또는 listing 중 하나만 | **A 승인** |
| V2-G6 | 규모 | A item240·auction56·shop56·bid200 / B 기존 규모에서 재배치 | **A 승인** |

승인 형상은 V2-G1=A, G2=A, G3=B, G4=A, G5=A, G6=A다. 구현·배포는 §3 전환 프로토콜과 §5의 공개 도메인 안전 조건을 준수해야 한다.
