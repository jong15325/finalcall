# 스킬 노출·마켓 실데이터 spec (skill-exposure-spec)

상태: v1.0 초안 — 2026-07-22 작성(FC-097, EPIC-MARKET-DATA). **게이트2 상신 전제.**
소유: architect(계약/spec). 구현 = FC-098(backend-impl).
정본 관계: 이 문서는 `api-contract.md`·`erd.md`의 **하위 상세**다. 계약과 어긋나면 계약이 이긴다.
근거: `game-item-skill-format.md §5·§6·§7`(스킬 코드 사전, 권위 참조) · `api-contract.md §3.3`(공통 item 블록) · `item-domain-spec §2.2/§2.3` · V6/V8/V9/V12/V13/V15 실측 · `ShopItemView`·`AuctionItemView`·`ShopRepositoryImpl`·`AuctionRepositoryImpl`·`LocalDemoSeeder`·`LocalDemoDataService` 실측.

---

## 0. 목적·범위

마켓을 "실제처럼" 보이게 하는 세 가지를 확정한다.

1. **스킬 마스터 확충** — `skill_definition`을 §5 스킬 코드 사전대로 채운다(현 V9 5건은 효과와 불일치하는 임시값).
2. **스킬명 노출** — 카드/목록/상세에서 현재 "스킬 #{code}" 중립표기를 실제 스킬명으로 바꾼다.
3. **마켓 5천 대량 시드** — 고정가(shop) 마켓에 실데이터 규모의 리스팅을 로컬 데모로 채운다.

**제품 결정(사용자 확정 2026-07-22, 이 문서는 반영분)**: 스킬명 = **§5 효과 서술 그대로**(창작 고유명 금지). 표시 형식 = `스킬1 [효과] / 스킬2 [효과] [퍼센트]%`(예: "스킬1 공격시간 3 감소 / 스킬2 트리플샷 33%"). 표시 형식 조립은 프론트 책임이며 계약은 재료(skill1Name·skill2Name·skillPercent)만 제공한다.

**게이트2 대상(기술 결정)**: 아래 §2 노출 방식(뷰 필드 추가) · §3 시드 프로파일 격리 · §1 미사용 코드 처리. 제품 결정(스킬명=효과)은 확정이라 상신 대상 아님.

---

## 1. skill_definition 시드 규칙

### 1.1 매핑 규칙

`skill_definition(skill_code, name, description)`.

- **`name` = §5 효과 서술 그대로**(값 포함). 코드가 특정 수치를 가지면 그 수치를 넣은 전체 효과 문구다.
  - 예: `202` → `트리플샷` · `119` → `공격데미지 4 증가` · `131` → `공격시간 3 감소` · `372` → `가신 6초`.
- **`description` = 적용 대상 + 보강**. §5의 "적용" 열 약어를 풀어 쓴다(`도`→도끼·`지`→지팡이·`칼`→검·`활`→활·`방`→방패·`갑`→갑옷·`신발`→부츠·`펜던트`·`마법`). 필요 시 효과 범주 한 줄.
  - 예: `202` → `지팡이·활 전용`. `119` → `도끼·지팡이·검·활 적용`.
- **길이**: `name` VARCHAR(50)·`description` VARCHAR(255). §5 전 효과 문구의 최장이 한국어 ~20자라 50 이내에 들어간다 — **스키마 폭 확장 불요**(V6 무변경).

### 1.2 코드 인벤토리 (시드 대상 확정)

§5는 그룹 표기라 flat `(code→name)` 해독이 애매하다. **아래 인벤토리가 시드 행수·경계의 정본**이다.

| 슬롯 | 정의된 코드 | 건수 | 미사용(시드 제외) |
|---|---|---|---|
| 스킬1 | **100~197 연속** | 98 | `198`·`199` |
| 스킬2 | **200~209 + 300~435** | 10 + 136 = 146 | `210~299`(90건) |
| **합계** | | **244** | 92 |

- "435 커버"는 **코드 상한**을 뜻하지 행수가 아니다. 실제 시드 행수 = **244**.
- **미사용 코드(198·199·210~299)는 시드에서 제외**한다(§1.5 권고 근거).

### 1.3 해독 위치 규칙 (FC-098 집행 지침)

§5의 한 행이 `codeA·codeB·codeC [속성] v1·v2·v3 [증감]` 형태면 **나열 순서대로 1:1**로 값을 매핑한다(codeA→v1, codeB→v2, ...). §5가 "주 코드"(100번대 대표값)를 값 사이에 끼워 넣은 행도 코드 나열 순서 = 값 나열 순서다.
- 예: `156·110·157·158·159 가속도 3·3.5·4·4.5·5 증가` → 156=3, **110=3.5**, 157=4, 158=4.5, 159=5.

**★ 그룹 공유값 행(원문 그대로 전사 — 정규화 금지)**: 일부 §5 행은 여러 코드가 **하나의 값을 공유**한다. 원본 등급 축의 흔적이며 §5 verbatim이 정답이다. 아래 행은 FC-098이 "중복이니 고치자"고 정규화하지 말 것:
- `127·128·129` → 전부 `공격시간 1 감소`(130=2 감소, 131=3 감소).
- `132·133` → 전부 `mp소모 4.5 감소`(134=5, 135=5.5, 136=6).
- `113·168·169·170·171` → 전부 `가속도 증가 + bp소모 감소 복합`(값 미세분).
- `150·192·193` → 전부 `타격후지연 1 감소`(151=2, 107=3).
- `308·357·358` → 전부 `프텍 0.5초`(359=1, 360=1.5).
- 그 외 §5.1/§5.2에서 코드가 그룹으로 묶여 단일 값에 붙은 모든 행 동일 적용.

**검증 의무(reviewer)**: FC-098의 시드는 §5.1/§5.2와 **행 단위로 대조**해 검수한다. 행수 244·경계(100·197·200·209·300·435)·그룹 공유값을 체크리스트로 확인한다.

### 1.4 Flyway 방식 (append-only)

- **신규 마이그레이션 V16**(현 최신 V15 다음, 파일 무편집 규율 준수).
- **V9 5건은 DELETE 하지 않는다** — `item_instance.skill1_id/skill2_id` FK가 그 행 id를 참조한다. DELETE→재INSERT는 id를 바꿔 FK를 깬다.
- 따라서 V16 = **(a) 기존 5개 코드 UPDATE**(§5-정합 name/description으로 교정) + **(b) 나머지 239개 코드 INSERT**.
  - 교정 대상 5건(V9 임시값 → §5 정합): `100` 치명타→**공격데미지 6 증가** · `110` 흡혈→**가속도 3.5 증가** · `120` 관통→**공격데미지 3 증가** · `130` 보호막→**공격시간 2 감소** · `140` 신속→**크리데미지 50 증가**.
- **마스터 데이터라 전 프로파일 적용**(로컬·dev·prod). 불변·멱등(코드 UK).

### 1.5 미사용 코드 처리 — 시드 제외 (권고, 게이트2)

**추천: 198·199·210~299를 시드하지 않는다.**
- 근거: 효과 의미가 없다. 임시 placeholder name을 넣으면 V9가 겪은 "효과와 불일치" 문제를 그대로 재생산한다.
- 안전성: 어떤 item_instance도 미사용 코드를 참조하지 않는다(시드·데모 전부 정의된 코드만 사용). skill FK는 nullable이라 부재가 무해하다.
- 함의: 장차 미사용 코드가 실데이터에 등장하면(가능성 낮음) 그때 계약 변경 없이 V17로 추가한다(마스터 append).

---

## 2. 스킬명 노출 방식 (게이트2 핵심)

### 2.1 결정: (a) 뷰에 skill1Name·skill2Name 필드 추가 — 추천

`ShopItemView`·`AuctionItemView`(공통 item 블록)에 `skill1Name`·`skill2Name`(String, nullable)을 추가한다. 출처 = `skill_definition.name`(이미 조인된 엔티티에서 `.getName()`).

### 2.2 N+1 우려는 근거가 없다 (결정적)

- **목록·상세 쿼리가 이미 skill1·skill2 SkillDefinition을 fetch join한다.**
  - `ShopRepositoryImpl.findByCursor`/`findDetailByPublicId`: `.leftJoin(ITEM.skill1, SKILL1).fetchJoin().leftJoin(ITEM.skill2, SKILL2).fetchJoin()`.
  - `AuctionRepositoryImpl` 목록·상세 동일(스킬 코드 필터 `skill1Eq`/`skill2Eq`도 이 조인을 씀).
- 뷰는 이미 `item.getSkill1().getSkillCode()`로 그 엔티티를 만진다. **`.getName()` 추가는 추가 쿼리·추가 조인 0**이다. 5천 목록에서도 페이지당 쿼리 1회는 불변(스킬명은 그 결과에 이미 실려 있다).
- 즉 (a)의 유일한 "성능 비용"으로 지목된 N+1은 **현 코드에 이미 없다**. 순수 추가 비용 = 응답 문자열 2개.

### 2.3 (b) GET /skills 딕셔너리 — 비추천

- 신규 엔드포인트(계약 추가) + 프론트가 244행 fetch·맵 구성·캐시 신선도 관리가 필요하다.
- 그럼에도 **skillPercent는 딕셔너리로 못 준다**(인스턴스별 값이라 뷰에서만 나온다). 즉 (b)를 택해도 뷰 의존은 안 사라진다 — (a)의 상위집합 작업량.
- (b)의 유일한 이점으로 거론된 "목록 스킬 필터 부활"은 **이미 충족**이다: 필터는 스킬 **코드**(skill1/skill2)로 동작하고 뷰·쿼리가 이미 지원한다. 필터 드롭다운 UI용 스킬명 목록이 필요하면, 그것은 `GET /item-templates` 류의 메타 조회로 후속 독립 처리할 사안이지 카드에서 스킬명을 빼둘 이유가 아니다.

### 2.4 skillPercent 노출 위치 — 이미 노출됨(변경 없음)

- `ShopItemView.skillPercent`·`AuctionItemView.skillPercent`(`int`)로 **이미 뷰에 존재**하고, 계약 §3.3 item 블록에도 등재돼 있다(출처 `item_instance.skill_percent`).
- 따라서 이번 델타는 skillPercent를 건드리지 않는다. 표시 형식의 `%`는 프론트가 skillPercent로 조립한다.
- §6 함의 반영: skillPercent = **아이템 강화도**(스킬2 종속 아님). 표시에서 %를 스킬2 줄에 붙이는 건 UX 관례일 뿐 의미상 아이템 속성이다.

### 2.5 마법 아이템(스킬1 부재, §6) 표시

- 마법 카드는 스킬1이 **구조적으로 없다**(skill1=null → skill1Name=null). 프론트는 "스킬1 없음"을 결함이 아니라 정상으로 렌더한다(계약 §3.3 폴백 의무 연장).

---

## 3. 마켓 5천 대량 시드 설계

### 3.1 방식: LISTED-direct (정식 register 경로 회피)

- **정식 `ShopService.register` 회피 사유**: (1) 아이템이 먼저 INVENTORY 슬롯을 점유해야 하는데 정원 96칸이라 5천 발행 불가, (2) 호출마다 SecurityContext 주체 세팅, (3) 5천 트랜잭션 마찰.
- **LISTED-direct**: item_instance를 처음부터 `location=LISTED`·`slot_no=NULL`로 발행한다.
  - `slot_key` 생성 컬럼은 `location='INVENTORY'`일 때만 값을 갖고 그 외 NULL이다(V8). LISTED는 slot_key NULL → **UK 충돌 없음**(V13 경매 LISTED 아이템과 동형).
- **shop 직접 INSERT**: `status='ACTIVE'`, `price`(분포), `end_at`(동적), `item_name_snapshot`(템플릿 display_name), `item_spec_snapshot`(V13식 CONCAT: `Lv.N / skill... / GF=...`), seller = 데모 판매자.
- item_ownership_history 첫 행(SEED) append(발행 규약 유지, LocalDemoDataService 기존 패턴).

### 3.2 프로파일 격리 — LocalDemoSeeder 확장 (추천, 게이트2)

**추천: `LocalDemoSeeder`/`LocalDemoDataService`를 확장한다(전용 마이그레이션 아님).**

- **결정적 사유 — 운영 오염 회피**: Flyway 마이그레이션은 **전 프로파일(dev·prod 포함)에서 실행**된다. 5천 리스팅을 Vn으로 넣으면 prod DB가 데모 데이터로 오염된다(티켓이 경계한 "이월 백로그"). 마이그레이션은 환경별 데모 데이터의 도구가 아니다.
- LocalDemoSeeder는 이미 `@Profile("local")` + `demo.seed.enabled`(기본 on) + 멱등 마커(demo1)를 갖는다 → 격리·멱등이 **구조적으로 보장**된다.
- LocalDemoDataService는 이미 register를 우회한 직접 엔티티 발행 패턴(`createInventoryItem` = 엔티티 빌더 + SEED 이력)과 skill/template 캐시를 갖는다. 여기에 `createListedShopItem(...)`(location=LISTED 발행 + shop row INSERT)을 추가하면 재사용된다.
- **동적 end_at**: `Instant.now().plus(N일)` — 시더가 경매에서 이미 쓰는 패턴. V13 정적 timestamp가 시간 경과로 전건 만료해 죽는 함정을 원천 회피한다.
- **성능 주의(FC-098 구현 지침)**: 5천 행을 엔티티 `save` 반복하면 부팅이 느리다. `JdbcTemplate.batchUpdate`로 item_instance·shop·ownership_history를 배치 INSERT한다(도메인 불변식은 LISTED-direct라 register 경로를 안 타므로 배치가 안전하다).
- **마스터(skill_definition) 시드는 예외적으로 Flyway V16**(§1.4) — 마스터·불변이라 전 프로파일 적용이 옳다. "마스터=마이그레이션, 데모 리스팅=로컬 시더"로 층을 나눈다.

### 3.3 다양성·규모

- **판매자 분산**: demo1~demo10(기존 데모 계정) 또는 전용 시드 판매자에 리스팅을 분산 → `sellerNickname`·`counterpartyMasked`가 다양하게 보인다.
- **아이템 다양성**: item_template 40종 × skill_definition(244) 조합, level 1~9, skillPercent 분포(§2 레벨별 상한 존중은 데모라 필수 아님), 골드포스 활성/비활성 혼합.
- **가격 분포**: 배경 "고정가 5천"은 대량 데모 목적이므로 가격을 넓게 분포(저가~고가)시켜 정렬·필터가 실감나게 한다. (티켓 배경의 "고정가 5천"은 규모 표현으로 해석 — 단일가 고정이 아니라 다양가 5천 리스팅 권장. **단일가 고정이 제품 의도라면 게이트2에서 확인** 필요.)
- **멱등**: 기존 demo1 마커 가드가 재부팅 시 재삽입을 막는다(5천도 동일 가드에 포섭).

---

## 4. api-contract 델타 (PROPOSAL — 게이트2 승인 전 확정 아님)

`api-contract.md §3.3` 공통 item 블록에 **필드 2개 추가**(스키마·엔드포인트·에러코드 무변경).

```
item 블록(공통) — 추가 필드:
  skill1Name?  string  nullable  출처 skill_definition.name  (skill1이 null이면 null)
  skill2Name?  string  nullable  출처 skill_definition.name  (skill2가 null이면 null)
```

| 필드 | 타입 | null | 출처 | 설명 |
|---|---|---|---|---|
| `skill1Name` | `string` | **Y** | `skill_definition.name` | 슬롯1 스킬명(§5 효과 그대로). skill1=null이면 null(예: 마법 카드) |
| `skill2Name` | `string` | **Y** | `skill_definition.name` | 슬롯2 스킬명(§5 효과 그대로). skill2=null이면 null |

- 적용 범위 = **공통 item 블록**이므로 `AuctionItemView`·`ShopItemView` 양쪽에 대칭 추가(§5 파급 참조).
- `skill1`·`skill2`(코드)·`skillPercent`는 무변경(기존 유지). 이름은 코드에 **부가**되지 코드를 대체하지 않는다(필터·아트 매핑은 코드 유지).
- 폴백 의무 연장: skill1Name/skill2Name이 null일 때 프론트는 스킬 미보유(또는 마법 스킬1 부재)로 정상 렌더.
- 승인 시 반영 문구(초안): `v1.14 — 6절 계약 변경: §3.3 공통 item 블록에 skill1Name·skill2Name(string, nullable, 출처 skill_definition.name) 추가. 스킬 코드 중립표기→실제 스킬명 노출(EPIC-MARKET-DATA). skill1/skill2 코드·skillPercent 무변경(이름은 코드에 부가). 목록·상세 쿼리가 skill_definition을 이미 fetch join하므로 N+1 없음. 정본 skill-exposure-spec v1.0. 구현 FC-098.`

---

## 5. 파급 분석 (EPIC-AUCTION done 소급 여부)

**결론: 안전한 additive 변경이다. EPIC-AUCTION 로직을 재개방하지 않는다.**

- item 블록은 계약 §3.3에서 **"공통"**으로 정의돼 auction·shop·order 뷰가 공유한다. 따라서 skill1Name/skill2Name 추가는 자연히 `AuctionItemView`에도 미친다 — 이는 파괴가 아니라 **대칭 유지**다(shop만 이름을 주고 auction은 안 주면 오히려 계약 분열).
- **비파괴(backward-compatible)**: 응답에 nullable 필드 2개 추가. 기존 소비자는 미지 필드를 무시한다. 경매 상태머신·CAS·쿼리 **무변경**(스킬 조인은 이미 존재).
- **소급 아님**: EPIC-AUCTION의 어떤 DoD·불변식도 건드리지 않는다. 뷰 record에 필드 2개, 계약 §3.3 델타뿐이다. 게이트2/6절 계약 변경 절차로 처리하되 EPIC-AUCTION 티켓을 되돌리지 않는다.
- **OrderItemView(§4.3)**: 같은 item 블록 규약을 쓰나 스냅샷/템플릿 displayName 기반이고 거래내역은 FC-097 범위 밖이다. skill1Name/skill2Name을 order 뷰에도 줄지는 **선택**(낮은 우선순위, 동형 패턴이라 후속 무통증). FC-098 범위 = auction·shop 뷰로 한정 권고.

---

## 6. 게이트2 상신 항목 (요약)

| # | 기술 결정 | 추천 | 한 줄 근거 |
|---|---|---|---|
| G1 | 스킬명 노출 방식 | **(a) 뷰에 skill1Name·skill2Name 추가** | 목록·상세 쿼리가 스킬을 이미 fetch join → N+1 없음, 순비용 문자열 2개. (b)는 신규 API+프론트 매핑+캐시로 더 비싸고 skillPercent 의존도 못 없앤다 |
| G2 | 미사용 코드(198·199·210~299) | **시드 제외** | 효과 의미 없음 · placeholder는 V9 "불일치" 재발 · 참조 인스턴스 없어 안전 |
| G3 | 5천 시드 격리 | **LocalDemoSeeder 확장(로컬 전용), 마이그레이션 아님** | Flyway는 prod 포함 전 프로파일 실행 → 운영 오염("이월 백로그"). 시더는 @Profile(local)+멱등이 구조적 보장 |
| G4 | 스킬 마스터 시드 | **Flyway V16(전 프로파일), UPDATE 5건+INSERT 239건** | 마스터·불변이라 전 프로파일 옳음. V9 DELETE는 FK 파괴 → UPDATE로 교정 |
| — | 스킬명=§5 효과 그대로 | (확정, 상신 아님) | 사용자 제품 결정 반영분 |

**제품 확인 1건(게이트2 겸)**: 배경의 "고정가 5천"이 **단일 고정가**인지 **다양가 5천 리스팅**인지. spec은 정렬·필터 실감을 위해 다양가를 권고하나, 단일가가 의도면 반영한다.
