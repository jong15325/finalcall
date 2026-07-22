# FinalCall Search Design Spec (검색 엔진 도입 설계문서 · 초안)

상태: **v0.3**(2026-07-22, architect) — **게이트2 사용자 승인 반영**. 인프라/아키텍처 A1·A2·A3·A5 **확정**: **엔진 = Elasticsearch**, **동기 = Debezium CDC**(사용자가 architect 추천 OpenSearch+Outbox와 다르게 **포트폴리오 사실성 우선**으로 결정 — 로컬 부담이 큰 구성임을 인지하고 선택). §12가 이 확정을 반영한 구현 결정 정본이다.
계약 **C1~C3(`q`·`relevance`)는 여전히 PROPOSAL**(별건 게이트2 미확정) — api-contract는 PROPOSAL 블록 유지, 정본 반영은 승인 후 §9.3 절차. §1~§11은 v0.1 원문(설계 근거·목표 아키텍처)을 유지하고, §12가 구현 결정 정본이다.
구현은 소유 에픽 **EPIC-SEARCH**(FC-107 backend·FC-108 frontend)에 귀속한다. 코드·인프라·계약 파일은 architect가 무변경 — 인프라·커넥터·색인은 backend-impl이 구현한다.
소유: architect (spec). 본 문서는 **의사결정 근거·목표 아키텍처·승격 경로**의 단일 참조점이며, 정본(api-contract·erd·domain-spec)을 대체하지 않는다.
근거: api-contract v1.11 §3(공통 목록 필터·§3.3 스키마·§3.3.1 코드 사전)·§4.1, domain-spec v0.6 §8(정합성은 DB·락은 정확성 수단 아님), item-domain-spec v0.4 §2.1(item_template)·§5(응답), bid-domain-spec v0.3, fee-policy-spec(EPIC-CLOSING). 리서치 결론(MySQL FULLTEXT vs ES/OpenSearch·nori·CDC/Outbox·function_score·alias 재색인) 요지 인용.
범위: 초안이다. 아래 어떤 항목도 **구현 착수 근거가 아니다**(동결 해제 + 게이트 통과가 선행). 스키마·계약 변경이 필요한 항목은 §9로 상신 대상 표시한다.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1 | 2026-07-21 | EPIC-SEARCH 설계 초안 착수 — 현 검색 한계 진단, 3안 옵션 비교, 단계적 표준안, 목표 아키텍처(ES=파생 read-model·CDC 싱크), 인덱스 골격, 랭킹(function_score·등급 부스트), 한글(nori+ngram), 엔진 선택 기준, 게이트2 분리(§9). 백엔드 동결이라 설계만 |
| v0.2 | 2026-07-22 | ②단계 구현 결정(§12 신설, 게이트1 승인 후) — architect 추천안: 엔진=OpenSearch·동기=Outbox 릴레이(Kafka 불요). 게이트2 상신용. **v0.3에서 사용자 결정으로 대체됨(아래)** |
| **v0.3** | 2026-07-22 | **게이트2 사용자 승인** — architect 추천과 다르게 결정: **엔진 = Elasticsearch**(nori 플러그인 설치), **동기 = Debezium CDC**(MySQL binlog→Kafka(KRaft)→Kafka Connect: Debezium source + ES sink, 멱등 upsert·Debezium 초기 스냅샷 백필). **포트폴리오 사실성 우선**(로컬 부담 큰 구성 인지 선택). 인덱스(단일 통합 `listings`·nori+ngram·코드축 keyword)·재색인(alias)·랭킹(BM25 relevance)·sellerGrade 제외 = v0.2 유지. 로컬 docker = mysql(binlog on)+redis+**elasticsearch(nori)·kafka(KRaft)·kafka-connect(debezium+es-sink)**(+선택 kibana). 계약 C1~C3는 PROPOSAL 유지 |

---

## 1. 현 검색 한계 진단

현행 목록·검색은 **코드 축 필터 전용**이다(api-contract §3 공통 목록 필터). 자유문/이름 검색이 없다.

- **자유문 검색 `q` 부재**: 계약 §3의 공통 목록 필터는 `mainCategory·subGroup·element·kind·minLevel/maxLevel·skill1/skill2·goldforceActive·minPrice/maxPrice·status`뿐이다. **`q`(이름·자유문) 파라미터가 계약에 없다.** 사용자가 "불 검"을 텍스트로 찾는 경로가 없고, 코드 축 4단(대분류→속성→종류→레벨)을 UI로 좁혀야만 한다.
- **코드 축의 한계**: `kind`는 `subGroup`에 의존하는 다의 축이라(계약 §3.3.1·§4.1 경고) 단독 텍스트 검색을 대체하지 못한다. 표시명은 `item.nameSnapshot`(등록 시점 스냅샷, D-045)에만 존재하고 **인덱싱된 검색 대상이 아니다** — 현재는 필터 결과의 표시용일 뿐이다.
- **한글 처리 부재**: `nameSnapshot`은 한글(예: "불의 검 +7")이다. LIKE `%불%`류의 부분일치는 (1) 인덱스를 못 타 마감 직전 트래픽에서 풀스캔 비용이 크고, (2) 형태소·오타·동의어를 처리하지 못한다. 대규모 트래픽 경매라는 테마와 정면으로 충돌하는 지점이다.
- **랭킹 부재**: 정렬은 화이트리스트(`price·endAt·createdAt·highestBidAmount`)의 **단일 필드 정렬**뿐이라, 관련도(relevance) 개념이 없다. 등급제(EPIC-GRADE)의 "우선노출"을 얹을 자리가 없다.

요약: 현 검색은 **탐색(browse)**은 되지만 **검색(search)**은 안 된다. `q`·한글·관련도·등급 부스트가 전부 공백이다.

---

## 2. 옵션 비교표 (기준별 충분/필요)

리서치 의사결정 요지: 규모 **수만~수십만**이고 검색이 **보조면 MySQL FULLTEXT로 ~80% 커버**. **수백만+ · 전문검색 · 형태소 · 패싯 · 튜닝 가능한 관련도 · 오타허용**이 핵심 UX면 ES/OpenSearch가 필요.

| 기준 | ① MySQL FULLTEXT(+ngram) | ② ES / OpenSearch |
|---|---|---|
| 추가 인프라 | **없음**(MySQL SoT 내장) | **색인 클러스터 신설**(관리형 or ECK) — §9 게이트2 |
| 한글 정밀도 | ngram(bigram 고정분할) = 재현율↑·부분일치↑ but 노이즈 | nori 형태소(decompound·userdict·품사필터) = **정밀도 우위** |
| 관련도 튜닝 | BM25 유사(FULLTEXT relevance), 세밀 제어 약함 | **BM25 + function_score** 세밀 제어 |
| 등급 부스트 | 애플리케이션 정렬로 근사(제약 큼) | **field_value_factor 곱셈 부스트**(설명가능) |
| 패싯(값별 카운트) | 별도 집계 쿼리·비용 | **aggs**(자기-필터-제외) 네이티브 |
| 오타허용/동의어 | 없음 | fuzzy·synonym 네이티브 |
| 운영 복잡도 | **낮음**(백업·모니터링 기존 MySQL) | 높음(동기·재색인·클러스터 운영. 국내 PoC 사례 3~5개월) |
| 규모 적합 | 수만~수십만 | 수백만+ |
| 정합성 리스크 | **SoT 단일**(불일치 없음) | 파생 read-model → **동기 불일치 리스크**(§4) |

리서치 국내 사례(요지): 배민 ES 운영(categoryId integer→keyword로 980ms→104ms, 약 9.4x), 당근 ECK 이관(PoC 3개월·프로덕션 5개월) — ES 승격은 **가치가 크지만 운영 부담·이관 기간이 실재**함을 보여준다.

---

## 3. 권장안 — 단계적 표준안 (3안 비교)

| 안 | 내용 | 채택 판단 |
|---|---|---|
| 보수안 | MySQL FULLTEXT(ngram)만. ES 미도입, 영구 유지 | 규모가 수십만에 머물고 검색이 계속 보조면 충분. 그러나 형태소·등급랭킹·패싯 요구가 오면 재현율·노이즈 벽에 부딪힘 |
| **표준안(권장)** | **①단계: MySQL FULLTEXT(ngram) `q` MVP → ②단계: 요구 실측 시 ES/OpenSearch 승격** | **조기 최적화 회피 + 승격 경로 문서화.** 지금 ES 없이 출시 가능하게 하고, 승격 트리거를 명문화 |
| 공격안 | 처음부터 ES/OpenSearch 도입 | 검색이 처음부터 핵심 UX·수백만 규모가 확실하면 합리적. 우리 현 규모·동결 상황엔 과잉(운영·이관 3~5개월 선투자) |

### 3.1 표준안 ①단계 — MySQL FULLTEXT(ngram) `q` MVP

- `nameSnapshot`(+선택적 `specSnapshot`)에 **ngram FULLTEXT 인덱스**를 걸어 `q` 자유문 검색을 제공한다. MySQL SoT 단일이라 **동기 문제·추가 인프라가 없다**.
- 계약에 `q` 파라미터 신설 + 정렬에 `relevance` 추가가 필요하다 → **계약 변경(게이트2, §9)**. 인프라 게이트2는 불요(MySQL 내장).
- 커버리지 목표: 이름·부분일치 검색 ~80%. 형태소 정밀도·오타허용·패싯은 이 단계 범위 밖(의도적 미제공).

### 3.2 표준안 ②단계 — ES/OpenSearch 승격 (트리거 기반)

아래 트리거 중 하나라도 **실측**되면 ②단계로 승격한다(추정 아닌 데이터로 판단, 조기 최적화 회피):

- 검색이 **보조에서 핵심 기능으로 승격**(검색 유입/전환이 주 동선).
- **형태소 정밀도** 요구(ngram 노이즈로 인한 오검색 불만이 지표로 확인).
- **패싯 UI**(값별 카운트) 요구.
- **등급 랭킹(EPIC-GRADE 우선노출)**을 관련도와 곱해 반영해야 하고 애플리케이션 정렬 근사가 한계.
- 데이터 규모가 수백만+로 진입하거나 FULLTEXT 응답 지연이 SLA를 위협.

승격 시 목표 아키텍처는 §4, 인덱스 골격은 §5, 랭킹은 §6이다.

---

## 4. 목표 아키텍처 (②단계 승격 후)

핵심 원칙: **MySQL = SoT(진실원). ES = 파생 read-model(정본 아님).**

```
[클라이언트] --q/필터/정렬--> [SCG] --> [모놀리식 검색 API]
                                              |  질의는 ES alias로만
                                              v
   [MySQL 8 = SoT] --변경 이벤트--> [Outbox/CDC] --멱등 upsert--> [ES/OpenSearch 파생 인덱스(alias)]
        ^                                                                    |
        +--------------------- 주기적 화해(count/histogram) <-----------------+
```

- **ES는 정본이 아니다.** 거래·잔액·소유의 진실은 MySQL이며, ES는 검색·랭킹 전용 read-model이다. ES 유실·재구축은 **재색인으로 복구 가능**해야 한다(정본 데이터 손실 아님).
- **동기 = dual-write 금지(명문화).** 애플리케이션이 MySQL과 ES에 동시에 쓰는 방식은 **금지**한다 — 원자성이 없고(2PC 부재), 재시도가 중복을 만들며, 불일치가 사실상 보장되는 안티패턴이다(리서치 핵심 리스크). 대신:
  - **Outbox 패턴** 또는 **Debezium CDC**로 MySQL 변경을 단일 원천에서 캡처하고,
  - **멱등 upsert 싱크**로 ES에 반영한다. Debezium은 at-least-once라 **싱크 멱등이 필수**(문서 id = auction/instance public_id 기준 upsert, 중복 이벤트 무해).
- **무중단 재색인 = alias 스위치.** 신규 인덱스 생성 → `_reindex` 백필 → 검증(카운트/샘플) → `_aliases` **원자 스위치** → 앱은 항상 **별칭으로만 질의**한다. 매핑 변경·재색인이 서비스 중단 없이 이뤄진다.
- **백스톱 = 주기적 화해.** CDC 유실·순서 역전 대비로 MySQL↔ES **카운트·히스토그램(가격대·상태별) 주기 대조**로 드리프트를 탐지·보정한다(bid 도메인의 "정합성은 DB" 백스톱 사상과 동형 — domain-spec §8).

이 절의 정합성 서사는 §10의 도메인 서사 정합과 연결된다.

---

## 5. 검색 문서(인덱스) 골격 (②단계)

파생 read-model의 문서 스키마. **정본은 항상 MySQL**이며 아래는 색인 사본이다.

```
SearchDoc {
  auctionId | shopId | itemInstanceId   // 문서 id(멱등 upsert 키) = 리스팅 public_id
  nameSnapshot   : text  (멀티필드: nori 분석 + ngram 서브필드)   // 한글 검색 본체
  specSnapshot?  : text  (nori)                                    // 선택 색인
  mainCategory   : keyword(integer→keyword, §5 주)   // 코드 축(정확 매칭·패싯)
  subGroup       : keyword
  element        : keyword
  kind           : keyword
  level          : integer                            // 범위 필터·정렬
  skill1?, skill2?: keyword                            // 스킬 코드 필터
  goldforceActive: boolean                            // gf_expire_at > now 파생(색인 시점)
  price          : long                               // startPrice/현재가/고정가 — 범위·정렬
  highestBidAmount?: long
  sellerGrade    : keyword | rank_feature 후보         // 등급 부스트용(§6) — EPIC-GRADE 의존
  status         : keyword                            // ACTIVE/SCHEDULED/... 필터
  endsAt         : date
  createdAt      : date
}
```

- **무엇을 색인하나**: 검색·필터·정렬·랭킹에 필요한 **표시·탐색 축만** 색인한다. 자금(홀드·잔액)·소유자 실명 등 민감·비검색 필드는 **색인하지 않는다**(계약 §3.3의 마스킹·비노출 정책 연장, SEC-007).
- **무엇을 SoT로 유지하나**: 위 전 필드의 진실은 MySQL이다. 특히 `price`·`highestBidAmount`·`status`·`endsAt`는 입찰/마감으로 실시간 변하므로 **CDC로 지연 반영**되고, 정확한 값이 필요한 경로(입찰 검증·정산)는 **ES를 신뢰하지 않고 MySQL을 읽는다**. ES는 목록·검색 표시용이다.
- **정수 코드 축은 keyword로 색인**(리서치: 배민 categoryId integer→keyword 980ms→104ms). 코드 축은 범위가 아니라 정확 매칭·패싯 대상이라 keyword가 적합하다. `level`·`price`만 numeric.
- **`goldforceActive`는 색인 시점 파생값**이라 시간이 지나면 스테일해질 수 있다 → 시간제 필드는 화해(§4)·주기 재색인 대상으로 관리하거나, 정확성이 필요하면 필터를 `gfExpireAt` 범위로 대체한다(구현 시 확정).

---

## 6. 랭킹 (②단계)

### 6.1 등급 부스트 — function_score field_value_factor

다중 비즈니스 신호(관련도 × 등급) 결합은 **function_score + field_value_factor** 권장(리서치 결론):

```
function_score {
  query: <BM25 텍스트 매칭>,
  field_value_factor: { field: sellerGrade(수치화), modifier: ln1p, factor: <튜닝> },
  boost_mode: multiply,
  score_mode: sum
}
// 결과: final = BM25 × (1 + ln(1 + gradeValue × factor))
```

- **곱셈(multiply)**이라 관련도 위에 등급이 **비례 부스트**로 얹히고(관련 없는 문서를 등급만으로 끌어올리지 않음), `ln1p`로 상위 등급의 과도한 지배를 완충한다. **설명가능**(explain)해 튜닝·감사에 유리하다.
- `rank_feature`는 **단순 가산·고속**(track_total_hits=false로 스킵 최적화) 경로에만 고려한다. 다신호 결합·설명가능성이 필요한 우리 요구엔 function_score가 정본. (function_score 폐기설은 사실무근 — 정식 지원.)
- **EPIC-GRADE 우선노출과의 연결**: 등급제의 "우선노출"은 별도 정렬 우회로가 아니라 **이 부스트 필드(`sellerGrade`)로 표현**한다. 등급 정의·수치화·부스트 계수는 **EPIC-GRADE가 소유**하고 본 스펙은 그 값을 소비한다(상호 참조 §10). ⚠ 현 스키마에 판매자 등급 필드가 없다(D-073로 아이템 등급 축 제거됨) — **`sellerGrade`는 EPIC-GRADE 신설에 의존**하며 색인·계약 반영은 그 이후다.

### 6.2 패싯

- **선택된 필터 반영** = `post_filter`(히트 집합에만 적용, 집계에는 미적용).
- **값별 카운트** = `aggs`의 **자기-필터-제외 filter 집계**(size:0). 즉 "속성=불" 패싯 카운트를 낼 때 element 필터는 제외하고 나머지 필터만 적용해, 다중 선택 UI에서 각 축의 잔여 카운트가 자연스럽게 나온다.
- 코드 축(keyword)은 terms agg로 그대로 패싯화된다.

---

## 7. 한글 처리 (②단계)

- **형태소 = nori(analysis-nori)**: mecab-ko-dic 기반. `decompound`(복합어 분해)·`userdict`(게임 용어 사용자 사전)·품사필터(조사·어미 제거)로 **정밀도 우위**. OpenSearch도 nori 지원(AWS 2023-10).
- **n-gram = 재현율·부분일치 보완**: bigram 고정분할이라 부분일치·재현율은 강하나 노이즈가 있다.
- **실무 절충 = 멀티필드 동시 색인**: `nameSnapshot`을 **nori(정밀) + ngram(재현) 서브필드로 동시 색인**하고, 질의에서 두 필드에 가중치를 달리 매겨(예: nori 매칭 우선, ngram 폴백) 정밀도·재현율을 함께 취한다(§5 문서 골격의 멀티필드).
- **userdict**: 게임 아이템 고유어(스킬명·아이템명)를 사용자 사전에 등록해 형태소 분해 오류를 줄인다. 사전 운영은 EPIC-SEARCH 구현 티켓에서.

---

## 8. 엔진 선택 기준 (OpenSearch vs Elasticsearch)

②단계 승격 시 엔진 선택. **게이트2(인프라)에서 사용자 결정**한다.

| 기준 | OpenSearch | Elasticsearch |
|---|---|---|
| 라이선스 | Apache 2.0(LF 거버넌스) — 자유 | 2024-08 AGPLv3 옵션 추가(+ 상용) |
| 한글(nori) | 지원(AWS 2023-10) | 지원 |
| security/CCR | 무료 포함 | 상용 계층 일부 |
| 관리형 | AWS 관리형(OpenSearch Service) | Elastic Cloud 등 |
| 생태계·성능 | 충분 | 생태계 성숙·성능 우위 주장 |
| 권장 조건 | **라이선스 자유·AWS 관리형 선호** | **생태계·성능 우선** |

판단 가이드: 라이선스 자유도와 관리형(AWS) 통합이 우선이면 **OpenSearch**, 생태계 성숙·성능 극대화가 우선이면 **Elasticsearch**. 우리 배포 타깃(AWS 힌트, Stage G)·라이선스 리스크 회피 성향이면 OpenSearch가 기본 후보다. 최종 확정은 게이트2.

---

## 9. 게이트/계약 파급 (상신 대상 — 동결 해제 시)

**이 절의 항목은 전부 게이트 대상이며, 본 초안은 어느 것도 확정하지 않는다.**

### 9.1 게이트2 — 계약 변경 (①단계 진입 시)

| # | 변경 | 계약 위치 | 성격 |
|---|---|---|---|
| C1 | **`q` 자유문 파라미터 신설** | api-contract §3 공통 목록 필터(경매·고정가·아이템 검색 공유) + §4.1 | **계약 변경**. 공유 필터라 3개 목록 엔드포인트(`GET /auctions`·`/shops`·`/item-templates`)에 일괄 파급 |
| C2 | **정렬 화이트리스트에 `relevance` 추가** | §3 정렬 화이트리스트(`price·endAt·createdAt·highestBidAmount`) | **계약 변경**. `q` 있을 때만 유효한 정렬(무 `q` 시 400 or 무시 — 규칙 확정 필요) |
| C3 | `q`의 매칭 범위·최소 길이·이스케이프·빈결과 규약 | §1.3 필터 규약 | 계약 세부(C1 동반) |

- ①단계(MySQL FULLTEXT)는 **인프라 게이트2 불요**(MySQL 내장), 계약 게이트2(C1~C3)만 대상이다.

### 9.2 게이트2 — 아키텍처/인프라 (②단계 승격 시)

| # | 결정 | 성격 |
|---|---|---|
| A1 | **색인 인프라(ES/OpenSearch) 도입** | **아키텍처 게이트2** — 되돌리기 큰 결정. 클러스터·비용·운영 |
| A2 | **엔진 선택**(OpenSearch vs ES, §8) | 게이트2(A1 동반) |
| A3 | **동기 방식 선택**(Outbox vs Debezium CDC) | 아키텍처 게이트2 — 성능·운영 영향 |
| A4 | **`sellerGrade` 색인·부스트** | **EPIC-GRADE 의존** — 등급 스키마·계약 신설이 선행(별도 게이트2) |
| A5 | 재색인 파이프라인·화해 잡 도입 | 운영 게이트2 |

### 9.3 계약 확정 후 변경 절차

`q`·`relevance` 계약 반영은 **contract-first 파급 관리** 대상이다 — 확정 후 변경이 필요하면 architect가 **영향받는 티켓 목록을 먼저 제시 → 사용자 확인 후** api-contract를 수정한다(CLAUDE.md §10, 본 초안은 계약 파일 무수정).

---

## 10. 소유 에픽·도메인 정합

- **소유 에픽 = EPIC-SEARCH**(신설 예정). **백엔드 동결이라 본 문서는 설계만**이고, 구현(①단계 MVP·②단계 승격)은 **동결 해제 후로 이연**한다. 어떤 코드·스키마·계약도 본 초안으로 착수하지 않는다.
- **EPIC-GRADE 정합**: 등급제의 "우선노출"은 본 스펙 §6.1의 **function_score 등급 부스트(`sellerGrade` 필드)로 구현**한다. 등급 정의·수치화는 EPIC-GRADE가 소유하고 검색은 이를 랭킹 신호로 소비한다(상호 참조). 현 스키마에 등급 필드 부재(D-073) → EPIC-GRADE 선행 의존.
- **EPIC-CLOSING 정합**: `price`·`status`·`highestBidAmount`는 입찰·마감·정산으로 변하는 값이다. 검색 인덱스는 이들의 **파생 사본**일 뿐이고, 정산·수수료(fee-policy-spec)·낙찰 판정 같은 **정확성이 필요한 경로는 ES가 아닌 MySQL(SoT)을 읽는다** — EPIC-CLOSING의 종료성 CAS·단일 승자 패턴은 검색 계층과 무관하게 DB에서 성립한다.
- **bid 도메인 서사 정합("락은 정확성 수단이 아니다", domain-spec §8)**: 본 설계의 "**ES는 파생 read-model, 정본은 DB, 화해가 백스톱**"은 bid의 "**정합성은 DB, 락은 처리량**"과 동형이다 — 검색 성능(ES)은 처리량 최적화 수단이지 정확성 보증 수단이 아니며, 정확성의 최종 보증은 항상 MySQL이다. dual-write 금지·멱등 싱크·주기 화해가 이 원칙의 검색판 구현이다.

---

## 11. 미해결·이연

- ①/②단계 착수 = **백엔드 동결 해제 + 게이트 통과** 선행(본 초안은 착수 근거 아님).
- `sellerGrade` 정의·수치화 = EPIC-GRADE 선행(§10).
- 시간제 필드(`goldforceActive`) 색인 스테일 처리 방식 = 구현 시 확정(§5).
- 엔진(OpenSearch/ES)·동기(Outbox/CDC) 최종 선택 = ②단계 게이트2(§9.2).
- `q` 무입력 시 `relevance` 정렬 처리 규칙(400 vs 무시) = 계약 게이트2(§9.1 C2)에서 확정. **→ §12.7 C2에서 추천안 확정(게이트2 상신).**

---

## 12. v0.3 구현 결정 (EPIC-SEARCH ②단계 — 게이트2 확정)

**전제(게이트1 승인 2026-07-22 사용자)**: 방식 **B(전용 검색엔진)** — MySQL FULLTEXT(①단계) 배제, 포트폴리오 임팩트(검색 인프라·동기·재색인 역량) 우선. 범위 = **마켓(`/shops`) + 경매(`/auctions`)**, item-templates 제외. **등급 부스트(`sellerGrade`) 범위 밖**(EPIC-GRADE 의존, §6.1·A4) — 관련도(BM25)+한글까지.
**게이트2 확정(2026-07-22 사용자)**: **엔진 = Elasticsearch**, **동기 = Debezium CDC**. architect 추천(OpenSearch+Outbox, 로컬 경량)과 다르게 사용자가 **포트폴리오 사실성 우선**으로 선택 — 실무 표준 스택(ES + binlog CDC + Kafka Connect)을 그대로 시연한다. **★ 이 구성은 로컬 부담이 크다**(신규 컨테이너 3개 + MySQL binlog 설정 변경): 사용자가 이 부담을 인지하고 포트폴리오 가치를 위해 채택했다. §12.1에 로컬 구성·기동 절차 골격을 명시한다.

### 12.1 A1 로컬 docker 구성 (★ 부담 큰 구성 — 사용자 선택)

현 로컬(`backend/docker-compose.local.yml`) = **MySQL 8 + Redis 7**(2개). Debezium CDC + Elasticsearch 채택으로 **신규 컨테이너 3개**(+선택 Kibana 1개) 및 MySQL binlog 설정 변경이 추가된다. **backend-impl(FC-107)이 구현**하며 아래는 골격이다:

| 컨테이너 | 이미지(예) | 역할 | 헬스체크 |
|---|---|---|---|
| `mysql`(변경) | `mysql:8.0` + **binlog 옵션** | SoT + binlog 소스 | 기존 mysqladmin ping |
| `elasticsearch`(신규) | `elasticsearch:8.x` + **analysis-nori** | 검색 read-model | `GET /_cluster/health` |
| `kafka`(신규) | `bitnami/kafka` 또는 `confluentinc/cp-kafka` **KRaft 모드**(Zookeeper 없음) | CDC 이벤트 버스 | 브로커 API 준비 |
| `kafka-connect`(신규) | `debezium/connect` 또는 Connect + **Debezium MySQL source · ES sink 플러그인** | 커넥터 런타임 | `GET /connectors` (REST 8083) |
| `kibana`(선택) | `kibana:8.x` | 데모 시각화 | 미기동해도 검색 동작 |

- **MySQL binlog 활성화(필수)**: `command`(또는 `my.cnf` 마운트)에 `--log-bin=mysql-bin`·`--binlog-format=ROW`·`--binlog-row-image=full`·`--server-id=1`·`--gtid-mode=ON`·`--enforce-gtid-consistency=ON`(GTID는 스냅샷·재개 견고성용, 선택). Debezium 캡처용 계정 권한(`REPLICATION SLAVE`, `REPLICATION CLIENT`, `SELECT`) 부여.
- **Elasticsearch(nori)**: 로컬은 단일 노드·보안 off(`discovery.type=single-node`, `xpack.security.enabled=false`), heap 512m~1g. **nori는 기본 미동봉** → `elasticsearch-plugin install analysis-nori`를 **베이스 이미지에 구운 커스텀 Dockerfile**로 고정(런타임 설치 취약성 회피). userdict 파일도 이미지에 동봉(§12.6).
- **기동 순서·의존**: mysql→kafka→kafka-connect(커넥터 등록)→elasticsearch(먼저 떠 있어도 무방). compose `depends_on` + healthcheck `condition: service_healthy`로 배선. Connect 기동 후 **커넥터를 REST(POST `/connectors`)로 등록**(Debezium source 1개 + ES sink 1개) — backend가 등록 스크립트(curl/init 컨테이너)를 제공.
- **커넥터 등록 골격(REST)**:
  - Debezium MySQL source: `database.hostname/port/user/password`, `topic.prefix`, `table.include.list`(auction·shop·bid 관련 테이블), `snapshot.mode=initial`(초기 백필).
  - ES sink(`camel`/`kafka-connect-elasticsearch`): `connection.url`(elasticsearch:9200), `topics`, `key.ignore=false`(도큐먼트 `_id`=리스팅 public_id), `behavior.on.null.values=delete`(삭제 전파), `write.method=upsert`(멱등).
- 시크릿 없음(로컬 전용 일회성 값). 배포(AWS, Stage G 힌트) = 관리형/매니지드 CDC로 매핑 가능(로컬≠운영 배선 주의).
- **로컬 부담 명시**: 컨테이너 5~6개 + MySQL binlog·JVM heap 다수 → 이 PC 메모리·기동시간 부담이 크다. 데모 기동이 무거우면 Kibana를 빼고(선택), ES/Kafka heap을 낮춰 운용한다. 부담은 사용자가 포트폴리오 사실성 대가로 수용한 결정이다.

### 12.2 A2 엔진 = Elasticsearch (게이트2 확정)

- **확정 = Elasticsearch**(사용자 게이트2). 실무 최다 채택·**이름 인지도**가 높아 포트폴리오 사실성이 크다는 판단(architect 추천 OpenSearch의 라이선스 자유·AWS 정합보다 사용자가 사실성을 우선).
- **한글 nori = 플러그인 설치 필요**: ES는 `analysis-nori`가 **기본 미동봉**이다 → **커스텀 ES 이미지**(`FROM elasticsearch:8.x` + `RUN elasticsearch-plugin install --batch analysis-nori`)로 굽거나, init 단계 `elasticsearch-plugin install`. userdict를 함께 동봉(§12.6). 버전 = 8.x 안정(로컬 single-node·보안 off).
- **라이선스 주의(각주)**: Elasticsearch는 2021년 Apache 2.0 → SSPL/Elastic License 2.0, 2024-08 **AGPLv3 옵션 추가**로 라이선스가 변동돼 왔다. 포트폴리오·비상업 데모 범위에선 문제 없으나, 상업 배포 시 라이선스 조건(특히 매니지드 서비스 재판매 제약·AGPL copyleft)을 검토해야 한다. (OpenSearch는 Apache 2.0으로 이 부담이 없다 — 선택되지 않았으나 트레이드오프로 기록.)
- A2는 A1 확정에 종속(색인 인프라 = ES 클러스터).

### 12.3 A3 동기 = Debezium CDC (게이트2 확정)

**확정 = Debezium CDC**(사용자 게이트2, architect 추천 Outbox 아님). MySQL binlog를 단일 원천으로 캡처해 Kafka→ES로 흘린다. 앱 코드 무침습(도메인 쓰기 경로에 outbox emit 불요)이 장점이며, **표준 CDC 스택을 실물로 시연**하는 포트폴리오 가치가 채택 이유다.

파이프라인:

```
[MySQL 8 = SoT] --binlog(ROW)--> [Debezium MySQL source] --> [Kafka(KRaft) 토픽]
                                                                    |
                                          [ES sink connector] --멱등 upsert(_id=public_id)--> [Elasticsearch(alias)]
                                                                    |
        [앱 @Scheduled 화해(count/histogram)] <----- 주기 대조 ----- MySQL ↔ ES
```

- **MySQL binlog 캡처**: `binlog_format=ROW`·`binlog_row_image=full`(§12.1). Debezium이 `auction`·`shop`·`bid` 관련 테이블 변경을 토픽으로 발행.
- **Kafka = KRaft 모드**(Zookeeper 없이 단일 컨테이너) — 로컬 부품 수 최소화. Kafka Connect가 Debezium source + ES sink 커넥터를 호스팅.
- **at-least-once → 멱등 sink 필수**: Debezium·Kafka는 **at-least-once** 전달이라 중복·재전송 이벤트가 발생한다. ES sink는 문서 **`_id = 리스팅 public_id`**(auctionPublicId·shopPublicId, ULID 상호 무충돌) 기준 **upsert**로 멱등 반영(중복 무해, 마지막 값 수렴). 삭제(취소/만료)는 tombstone→sink delete로 전파.
- **초기 백필 = Debezium 스냅샷**: `snapshot.mode=initial`로 커넥터 최초 등록 시 대상 테이블 전수를 스냅샷해 ES에 적재(별도 백필 배치 불요). 이후 binlog 스트리밍으로 증분 반영.
- **dual-write 금지 준수(§4)**: 앱은 MySQL만 쓴다. ES의 **유일한 writer = ES sink 커넥터**. 도메인 코드에 ES 쓰기·outbox emit이 없다(Debezium이 binlog에서 캡처하므로 앱 무침습).
- **백스톱 = 주기 화해 유지**: CDC 유실·순서역전·커넥터 정지 대비로 앱 내부 `@Scheduled`가 MySQL↔ES **count(상태·listingType별)+price histogram** 대조 → 드리프트 리스팅 재색인. domain-spec §8·§10 정합(§12.5).
- **트레이드오프(명시)**: (1) 로컬 컨테이너 3개+binlog 설정으로 **기동·운영 부담 큼**(§12.1). (2) 파이프라인 단계가 많아(binlog→Debezium→Kafka→sink→ES) 장애 지점·모니터링 대상이 늘어난다(Connect·토픽·lag). (3) 반영은 근실시간이나 커넥터 lag만큼 지연(ES는 표시용 read-model이라 허용 — 정확값은 DB).

### 12.4 인덱스 매핑 = 단일 통합 `listings` (§5 구체화)

**통합 vs 분리**: `/shops`·`/auctions`가 **동일한 공통 목록 필터(§3)+item 블록**을 쓰고 `q`가 공유 필터라, **단일 통합 인덱스 `listings` + `listingType` 판별 keyword**를 추천(대안=인덱스 2개 분리).

- 통합 추천 근거: 인덱스·alias·재색인 파이프라인·**ES sink 타깃**이 **1벌**(운영 단순, 로컬 부담↓), 향후 통합 검색 확장 용이. 두 엔드포인트는 `listingType` term 필터만 추가한다. **CDC 소스 테이블이 여러 개(auction·shop·bid)여도 sink가 동일 `listings` 인덱스로 라우팅**(sink 매핑에서 토픽→인덱스 통합).
- 분리 트레이드오프: 매핑이 더 깔끔(auction 전용 `highestBidAmount`·`endsAt` semantic 발산 제거)·독립 재색인 가능하나, 파이프라인 2벌이라 로컬·운영 부담↑. **데모 규모엔 통합이 유리** → 통합 추천(발산 필드는 nullable).

문서 스키마(파생 read-model — **정본은 항상 MySQL**, sellerGrade 제외):

```
listings (단일 인덱스, _id = 리스팅 public_id)
  listingType   : keyword                 // AUCTION | SHOP (판별·엔드포인트 필터)
  nameSnapshot  : text (analyzer=nori_kr) // 한글 본체
    └ .ngram    : text (analyzer=ngram_kr)// 부분일치·재현율 폴백 서브필드
    └ .keyword  : keyword                 // 정확·정렬용(선택)
  specSnapshot  : text (analyzer=nori_kr) // 선택 색인
  mainCategory  : keyword                 // 코드 축 — integer→keyword 색인(정확매칭)
  subGroup      : keyword
  element       : keyword
  kind          : keyword
  skill1?,skill2?: keyword
  level         : integer                 // 범위 필터·정렬
  price         : long                    // startPrice/현재가/고정가 — 범위·정렬
  highestBidAmount? : long                // AUCTION 전용(SHOP=null)
  gfExpireAt?   : date                    // 골드포스 만료 — 질의시점 gfExpireAt>now 로 active 파생(스테일 회피, §5 주 해소)
  status        : keyword                 // ACTIVE/SCHEDULED/SOLD/... 필터
  sellerNickname: keyword                 // 표시용(선택)
  endsAt?       : date                    // auction endAt / shop endAt(자동계산)
  createdAt     : date
  // sellerGrade : (제외) — EPIC-GRADE 신설 후 rank_feature/keyword 색인. 자리만 문서화(A4·§6.1)
```

- **정수 코드 축은 keyword 색인**(§5·배민 사례: categoryId integer→keyword 980ms→104ms). 범위 아님·정확매칭/필터 대상. `level`·`price`·`highestBidAmount`만 numeric.
- **`goldforceActive` 스테일 해소(§5·§11 미해결 확정)**: 색인 시점 boolean 대신 **`gfExpireAt`(date)를 색인**하고 질의에서 `range gfExpireAt > now`로 활성 판정 → 시간경과 스테일 제거. `goldforceActive` 필터는 이 range로 매핑.
- **비색인 정책(SEC-007)**: 자금(홀드·잔액)·소유자 실명 등 민감·비검색 필드는 색인하지 않는다(계약 §3.3 마스킹 연장). 소유자는 `sellerNickname`(마스킹 표시)만.
- **정확값 경로는 ES 미신뢰**: `price`·`highestBidAmount`·`status`는 입찰/마감으로 변하는 파생 사본이다. 입찰 검증·정산·낙찰 판정은 **MySQL(SoT)을 읽는다**(§4·§10, domain-spec §8).

### 12.5 A5 재색인/화해 (게이트2 확정 — CDC 파이프라인 정합)

- **무중단 재색인 = alias 스위치**: 앱은 **읽기 alias `listings_search`로만 질의**. 매핑/분석기(userdict 포함) 변경 시 → 신규 `listings_v{n}` 생성 → 백필 → count/샘플 검증 → `_aliases` **원자 스위치** → 구 인덱스 폐기. **CDC 스택에서의 백필 = ES sink 커넥터의 target 인덱스를 신 인덱스로 재지정 + Debezium `snapshot.mode`(예 `schema_only_recovery`/재스냅샷)로 리플레이**하거나, Kafka 토픽을 신 인덱스로 재소비(sink 오프셋 리셋)해 채운다. 스위치 후 sink는 신 인덱스로 이어쓴다.
- **백스톱 = 주기적 화해**: 앱 내부 `@Scheduled`가 MySQL↔**Elasticsearch** **count(상태·listingType별) + price histogram** 주기 대조로 드리프트 탐지 → 불일치 리스팅 보정(대상 행 재색인 트리거: 예 no-op 업데이트로 binlog 이벤트 유발하거나 직접 bulk upsert). **CDC 유실·순서역전·커넥터 정지 대비.** bid의 "정합성은 DB" 백스톱과 동형(domain-spec §8·§10).
- 로컬 부담: 화해 잡은 **앱 내부 스케줄러**(신규 컨테이너 0)이나, 재색인은 **Kafka Connect 커넥터 재구성**(REST)을 수반한다(CDC 스택 특성). A5 = 게이트2 확정.

### 12.6 한글(§7)·랭킹(§6) 구체화

- **한글 = nori + ngram 멀티필드**(§7·§12.4): `nori_kr` 분석기 = `nori_tokenizer`(decompound_mode=mixed) + userdict + 품사필터(조사·어미 제거) + lowercase. `ngram_kr` = ngram(min 2, max 3)로 부분일치·재현율 보완. 질의는 `multi_match`로 `nameSnapshot^3`(nori 정밀 우선) + `nameSnapshot.ngram^1`(재현 폴백) 가중.
- **userdict 운영**: 게임 고유어(아이템·스킬명)를 사용자 사전 파일로 등록, **커스텀 이미지에 동봉**(§12.1). 사전 변경 = 분석기 변경 → **재색인 파이프라인(§12.5) 경유**(alias 스위치). 초기엔 시드 사전 소량 + 운영 중 추가.
- **랭킹 = BM25 relevance(등급 부스트 제외)**: 텍스트 매칭은 기본 BM25. `relevance` 정렬 = `_score desc`. **등급 부스트(function_score field_value_factor)는 이번 범위 밖**(§6.1·A4, EPIC-GRADE 의존) — 매핑·랭킹에 `sellerGrade` **자리만 문서화**하고 색인·질의에 넣지 않는다. 즉 이번 랭킹은 `multi_match`(nori+ngram) 순수 관련도.
- **패싯(aggs)은 이번 범위 밖**(게이트1: 관련도+한글까지). §6.2는 향후.

### 12.7 계약 C1~C3 (api-contract 델타 — PROPOSAL, 게이트2 상신)

`q`·`relevance`는 **공통 목록 필터(§3)** 확장이라 **`GET /auctions`·`GET /shops` 두 엔드포인트에 파급**한다(item-templates는 이번 범위 밖 — §4.1 `q` 미추가). 계약 파일은 승인 전 PROPOSAL 블록으로만 표기(§9.3).

| # | 변경 | 계약 위치 | 추천 규약 |
|---|---|---|---|
| **C1** | **`q` 자유문 파라미터 신설** | §3 공통 목록 필터 + §3.1 `GET /auctions` + §3.2 `GET /shops` | `q`(string, optional). 매칭 대상 = `nameSnapshot`(주) + `specSnapshot`(선택). 코드 축 필터와 **AND 결합**(q=query context, 코드축=filter context). 결과 = **cursor 페이지**(§1.3, 검색도 실시간 목록). item-templates 제외 |
| **C2** | **정렬 화이트리스트에 `relevance` 추가** | §3 정렬 화이트리스트(현: `price·endAt·createdAt·highestBidAmount`) | `relevance`는 **`q` 있을 때만 유효**. 정렬 기본: **q 있고 sort 생략 → `relevance`**, **q 없고 sort 생략 → 기존 기본(`createdAt desc`)**. **q 없이 `sort=relevance` → 400(COMMON 검증)** 추천(무의미 요청 명시 거부; 대안=무시하고 기본정렬 폴백 — 게이트2 택일). cursor+relevance = `search_after(_score desc, publicId asc)` 안정 타이브레이커(keyset) |
| **C3** | `q` 매칭 범위·최소길이·이스케이프·빈결과 규약 | §1.3 필터 규약(C1 동반) | **최소 길이 2**(ngram min_gram=2 정합), 미만 → 400(COMMON 검증; 대안=무시). **최대 길이 64**(비용 상한, 초과 400). **이스케이프 불요 — `match`/`multi_match`(분석 쿼리)만 사용, `query_string` DSL 미사용**이라 사용자 입력이 질의 문법으로 해석되지 않음(DSL 인젝션 원천 차단). **빈 결과 = 200 빈 페이지**(에러 아님) |

- **파급 관리(§9.3)**: 위는 확정 계약이 아니라 델타 초안이다. 게이트2 승인 후 architect가 **영향 티켓(프론트 검색 UI·백엔드 목록 쿼리)** 을 제시 → 사용자 확인 후 api-contract 정본 반영(버전 v+1).

### 12.8 정합성 서사 준수 확인 (§10 연결)

- **ES는 정본이 아니다**: Elasticsearch = 검색·랭킹 전용 파생 read-model. 정확성(거래·잔액·소유·낙찰)의 최종 보증은 **MySQL(SoT)**. ES 유실은 재색인으로 복구(정본 손실 아님).
- **domain-spec §8 정합**: "정합성은 DB, 처리량은 락"의 검색판 = "정본은 DB, 검색속도는 ES". dual-write 금지(앱은 MySQL만 write) + **멱등 CDC sink upsert** + 주기 화해가 이 원칙의 구현.
- **EPIC-CLOSING/BID 정합**: `price`·`status`·`highestBidAmount`는 파생 사본. 종료성 CAS·단일 승자·정산은 검색 계층과 무관하게 DB에서 성립. 검색은 이들을 지연 반영할 뿐 신뢰 원천이 아니다.
- **EPIC-GRADE 의존 격리**: `sellerGrade` 부스트(A4)는 자리만 문서화, 이번 색인·랭킹·계약에 미포함.
