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
| finalcall-elasticsearch | 커스텀(elasticsearch:8.15.3 + analysis-nori) | 검색 read-model | 9200 |
| finalcall-kafka | apache/kafka:3.8.0 (KRaft) | CDC 이벤트 버스 | 9092(내부)/29092(호스트) |
| finalcall-kafka-connect | 커스텀(debezium/connect:2.7 + ES sink) | 커넥터 런타임 | 8083 |

- 앱은 MySQL 만 write 한다. **ES 의 유일한 writer = ES sink 커넥터**(dual-write 금지, §12.3).
- 문서 `_id` = 리스팅 `public_id`(멱등 upsert). auction·shop 두 소스 → 단일 `listings` 인덱스 라우팅.

## 기동 절차

```bash
cd backend

# 1) 스택 기동(첫 실행은 ES/Connect 이미지 빌드로 수 분 소요)
docker compose -f docker-compose.local.yml up -d --build

# 2) Debezium 캡처 계정 생성(기존 MySQL 볼륨 보존 → initdb 자동 실행 안 되므로 수동 1회)
docker exec -i finalcall-mysql mysql -uroot -proot < docker/search/mysql/debezium-user.sql

# 3) listings 인덱스 + alias 생성(nori/ngram 매핑)
bash docker/search/create-index.sh

# 4) 커넥터 등록(Debezium source + ES sink) — snapshot.mode=initial 로 기존 행을 스냅샷 백필
bash docker/search/register-connectors.sh
```

## 헬스체크

```bash
curl -s localhost:9200/_cluster/health | jq .status         # green/yellow
curl -s localhost:8083/connectors?expand=status | jq .      # 두 커넥터 RUNNING
curl -s localhost:9200/listings_search/_count | jq .count   # 스냅샷 백필된 문서 수
```

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

## 한계·후속 (★ 반드시 확인)

- **코드축/레벨/스킬/gf 필드 enrichment**: `auction`/`shop` 행에는 `nameSnapshot`·`specSnapshot`·`price`·`status`·
  `highestBidAmount`·`endsAt` 가 비정규화돼 있어 **텍스트/가격/상태 검색은 순수 단일 테이블 CDC 로 완전히 흐른다**.
  그러나 코드축(`mainCategory`/`subGroup`/`element`/`kind`)·`level`·`skill1/2`·`gfExpireAt` 은
  `item_instance`/`item_template` 에 있어 **단일 테이블 CDC 로는 채워지지 않는다**(조인 필요). 두 경로로 채운다:
  1. **CDC(주 경로)**: 텍스트·가격·상태·시각 필드를 근실시간 반영.
  2. **앱 화해/재색인(보정 경로, `ListingIndexer`)**: MySQL 조인을 읽어 코드축 포함 전체 문서를 bulk upsert.
     `SearchReconciliationWorker`(@Scheduled)가 count 드리프트를 탐지하고 이 경로로 보정한다(§12.5, "직접 bulk upsert").
  → 코드축 필터를 CDC 만으로 완전 지원하려면 리스팅 행에 코드축을 비정규화(스키마 변경=게이트2)하거나 stream-join
     enrichment 를 도입해야 한다. **후속 티켓 후보**로 남긴다(계약 이탈 아님 — 매핑·검색 API 는 전체 필드 지원).
- **삭제**: `auction`/`shop` 은 hard delete 가 없다(soft-status 전이만) → tombstone/delete 전파는 방어적 설정.
