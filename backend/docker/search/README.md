# EPIC-SEARCH 로컬 검색 스택 런북 (FC-107)

Elasticsearch(nori) + Kafka(KRaft) + Kafka Connect(Debezium MySQL source → ES sink) CDC 파이프라인을
로컬에서 기동·검증하는 절차다. 정본 설계 = `docs/spec/search-spec.md` v0.3 §12.

> ★ 이 스택은 **로컬 부담이 크다**(신규 컨테이너 3개 + MySQL binlog). 사용자 게이트2 승인분(포트폴리오 사실성 우선).
> Windows 로컬에서 전체 CDC 스택 통합테스트는 무거우므로 **아래 수동 절차로 검증**한다. 색인/검색 쿼리 로직 자체는
> `ListingSearchIntegrationTest`(ES Testcontainer)가 자동 검증한다.

## 구성

| 컨테이너 | 이미지 | 역할 | 포트 |
|---|---|---|---|
| finalcall-mysql | mysql:8.0 (+binlog) | SoT + binlog 소스 | 3306 |
| finalcall-elasticsearch | 커스텀(elasticsearch:8.18.8 + analysis-nori) | 검색 read-model | 9200 |
| finalcall-kafka | apache/kafka:3.8.0 (KRaft) | CDC 이벤트 버스 | 9092(내부)/29092(호스트) |
| finalcall-kafka-connect | 커스텀(debezium/connect:2.7 + Aiven ES sink) | 커넥터 런타임 | 8083 |

- 앱 도메인 쓰기(등록·입찰·구매)는 MySQL 만 write 한다(dual-write 금지, §12.3). ES 에는 두 writer 가 있다:
  1. **CDC sink 커넥터** — auction/shop 행의 **스냅샷 필드**(nameSnapshot·price·status·listingType)를 근실시간 반영.
     sink SMT 가 snake_case→camelCase rename + 소스 토픽별 listingType 주입을 한다(그래야 색인·질의 필드와 정합).
  2. **앱 enrichment(`ListingIndexer`)** — item 소재라 CDC 로 못 채우는 **join 필드**(코드축·level·skill·gfExpireAt·
     endsAt)를 정본 조인으로 읽어 upsert. 부팅 재색인 + 주기 화해로 실행된다(비동기 재색인이라 dual-write 아님).
- 문서 `_id` = 리스팅 `public_id`(멱등 upsert). auction·shop 두 소스 → 단일 `listings` 인덱스 라우팅.
- ★ **검색 문서 = CDC(스냅샷 필드) + 앱 enrichment(join 필드)의 합**이다. enrichment 가 실행돼야 코드축 필터까지
  온전히 동작하고, 텍스트 검색은 CDC/enrichment 어느 쪽 문서로도 걸린다(둘 다 nameSnapshot·listingType 채움).

## 기동 절차

```bash
cd backend

# 1) 스택 기동(첫 실행은 ES/Connect 이미지 빌드로 수 분 소요)
docker compose -f docker-compose.local.yml up -d --build

# 2) fresh volume은 Debezium 캡처 계정을 initdb에서 자동 생성한다.
#    기존 MySQL 볼륨에 계정이 없다면 아래 SQL을 수동 1회 적용한다.
docker exec -i finalcall-mysql mysql -uroot -proot < docker/search/mysql/debezium-user.sql

# 3) 인덱스 템플릿(listings*) 등록 + listings_v1 + alias 생성 — ★ 앱 부팅 재색인/커넥터 전에 실행
#    템플릿이 매핑(publicId 등 keyword)을 고정한다. 템플릿 없이 문서가 먼저 써지면 인덱스가 동적 매핑(text)으로
#    자동 생성돼 앱의 publicId 정렬이 실패(검색 503)한다 — 템플릿이 이 함정을 원천 차단한다.
bash docker/search/create-index.sh

# 4) 커넥터 등록(Debezium source + ES sink) — snapshot.mode=initial 로 기존 행을 스냅샷 백필(CDC 스냅샷 필드)
bash docker/search/register-connectors.sh

# 5) 앱 기동(local 프로파일) — ApplicationReadyEvent 에서 전체 enrichment 재색인이 1회 실행돼(코드축·join 필드)
#    검색 가능 문서를 보장한다(search.reindex-on-startup=true, local 기본). 이후 CDC 가 스냅샷 필드를 근실시간 갱신.
#    ★ 반드시 create-index(3) 이후에 기동해야 재색인이 alias 에 쓴다. 로그 "검색 부팅 재색인 완료" 확인.
JAVA_HOME=... ./gradlew :backend:bootRun     # 또는 기존 앱 실행 방식
```

> enrichment 를 수동으로 다시 돌리려면 앱을 재기동하거나(부팅 재색인), 주기 화해(`SearchReconciliationWorker`,
> 로컬 `correct-on-drift=true`)가 count 드리프트 탐지 시 자동 재색인하도록 둔다.

## 헬스체크

```bash
curl -s localhost:9200/_cluster/health | jq .status         # green/yellow
curl -s localhost:8083/connectors?expand=status | jq .      # 두 커넥터 RUNNING
curl -s localhost:9200/listings_search/_count | jq .count   # ★ > 0 이어야 검색 가능(0 이면 재색인/커넥터 확인)
# 문서에 camelCase 필드 + listingType 이 실렸는지 확인(rename SMT·enrichment 정합)
curl -s "localhost:9200/listings_search/_search?size=1" | jq '.hits.hits[0]._source | {listingType,nameSnapshot,status}'
```

`_count == 0` 이면: (1) 앱 부팅 재색인 로그 확인(create-index 이후 기동했는지), (2) 커넥터 RUNNING·에러 여부
(`curl localhost:8083/connectors/finalcall-elasticsearch-sink/status`), (3) 인덱스/alias 존재 여부를 점검한다.

## 검색 스모크

```bash
# 앱(8080)을 통한 q 검색 — auction
curl -s "localhost:8080/api/v1/auctions?q=%EA%B2%80&sort=relevance" | jq .
# shop
curl -s "localhost:8080/api/v1/shops?q=%EA%B2%80" | jq .

# ES 직접 확인(멀티매치 nori + ngram)
curl -s localhost:9200/listings_search/_search -H 'Content-Type: application/json' -d '{
  "query": { "multi_match": { "query": "검", "fields": ["nameSnapshot^3","nameSnapshot.ngram^1"] } }
}' | jq '.hits.hits[]._source.nameSnapshot'
```

## CDC 반영 확인

```bash
# 앱으로 새 경매 등록 후, 커넥터 lag 만큼 지연되어 ES 에 upsert 되는지 확인
curl -s localhost:9200/listings_search/_doc/<public_id> | jq ._source
```

## 재색인(alias 스위치, §12.5)

매핑/분석기(userdict) 변경 시:
1. `INDEX=listings_v2 bash docker/search/create-index.sh` 로 신 인덱스 생성.
2. `POST _reindex`(listings_v1→v2) 또는 sink 오프셋 리셋으로 재적재.
3. `POST _aliases` 로 `listings_search` 를 v1→v2 원자 스위치.
4. 구 인덱스 폐기. 앱은 항상 alias 로만 질의하므로 무중단.

## 역할 분담·한계·후속 (★ 반드시 확인)

- **CDC 가 채우는 것(스냅샷 필드)**: `auction`/`shop` 행에 비정규화된 `nameSnapshot`·`specSnapshot`·`price`·
  `status` + sink 가 주입하는 `listingType`·`publicId`. sink SMT 가 snake_case→camelCase rename 을 하므로
  **텍스트 검색·상태/종류 필터·가격은 CDC 문서만으로도 걸린다**. (rename SMT 가 없으면 CDC 문서가 질의에 한 건도
  안 걸린다 — 이 정합이 검색 동작의 전제다.)
- **앱 enrichment 가 채우는 것(join 필드)**: 코드축(`mainCategory`/`subGroup`/`element`/`kind`)·`level`·`skill1/2`·
  `gfExpireAt`·`endsAt` 은 `item_instance`/`item_template` 소재라 **단일 테이블 CDC 로는 못 채운다**. `ListingIndexer`
  가 MySQL 조인을 읽어 코드축 포함 전체 문서를 bulk upsert 한다. **부팅 재색인(local 기본 on)** + 주기 화해
  (`SearchReconciliationWorker`, 드리프트 시 재색인)로 실행된다.
- **★ 커넥터 트레이드오프(Aiven ES sink)**: Confluent Hub CDN DNS 차단으로 ES sink 를 Aiven
  `elasticsearch-connector-for-apache-kafka`(GitHub releases · Apache 2.0)로 재지정했다. Aiven 커넥터는
  `_id`(=public_id) 기준 문서를 **전체 교체**한다(멱등 upsert-by-id — §12.3 충족). Confluent 의 `write.method=upsert`
  (부분 병합)는 미지원이라 **CDC 이벤트는 문서를 통째로 교체**해 그 순간 코드축(불변 join 필드)이 사라진다 →
  **주기 화해/부팅 재색인이 코드축을 재적용**한다(코드축은 리스팅 동안 불변이라 재적용으로 수렴). 텍스트/상태/가격
  검색은 CDC 문서만으로 항상 동작한다. 부분 병합이 필요하면 Confluent 커넥터(현 네트워크 미도달) 또는 ES 8 지원
  Aiven 릴리스가 필요하다 — **환경 제약이지 설계 결함 아님**.
  - 버전 정합 주의: Aiven v7.0.0 은 ES 7.17 클라이언트를 동봉한다. 본 스택 ES 서버는 8.18 라 sink 는 typeless
    bulk(`_id` index/delete)로 동작한다(우리 사용 범위에서 호환). 런타임에 8.x 가 요청을 거부하면 (a) ES 를 7.17 로
    맞추거나 (b) ES 호환 모드를 쓴다. **커넥터 플러그인 로드·빌드는 검증됨**(`GET /connector-plugins` 에
    `io.aiven.connect.elasticsearch.ElasticsearchSinkConnector` 노출), 엔드투엔드 CDC 반영은 런북 스모크로 확인한다.
- **후속 티켓 후보**: 코드축까지 CDC 만으로 채우려면 리스팅 행에 코드축을 비정규화(스키마 변경=게이트2)하거나
  Kafka Streams/ksqlDB join enrichment 를 도입한다. 현재는 앱 enrichment 로 정합(계약 이탈 아님 — 매핑·검색 API 는
  전체 필드 지원). 화해는 현재 count 대조까지이며 price histogram 은 후속.
- **삭제**: `auction`/`shop` 은 hard delete 가 없다(soft-status 전이만) → tombstone/delete 전파는 방어적 설정.
- **시간 필드 rename 미적용 이유**: Debezium 이 DATETIME 을 에폭(정수)으로 발행해 `date` 매핑과 충돌할 수 있어
  sink 에서 `end_at`/`created_at` 을 rename 하지 않는다 — 날짜(`endsAt`/`createdAt`/`gfExpireAt`)는 enrichment 가
  ISO-8601 로 채운다.
