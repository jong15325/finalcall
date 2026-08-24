# 도시에: Elasticsearch·CDC 검색

- **에픽**: EPIC-SEARCH + FC-110 + 운영 재색인 코어
- **상태**: 검색·정합성 하드닝·재색인 코어 완료, 관리자 API는 범위 밖
- **기간**: 2026-07-22 이후
- **관련 티켓**: FC-106~110

## 1. 개요

5천 건 규모 마켓과 경매에 한글 자유문·관련도 검색을 제공하기 위해 MySQL을 정본으로 유지하고 Elasticsearch를
파생 read model로 도입했다. Kafka KRaft와 Debezium source, Aiven Elasticsearch sink로 at-least-once CDC를
구성하고, 앱 재색인기가 조인/enrichment가 필요한 문서를 보완한다. 정적 코드리뷰 뒤 실제 스택을 기동하면서
플러그인 다운로드, 버전, 동적 매핑·fielddata 문제를 발견하고 고쳤다.

## 2. 해결한 기술 도전과 해법

- **한글 검색**: ES 8.18.8에 nori analyzer와 ngram 하위필드를 구성하고 `multi_match`에서 이름 nori 정밀
  매칭에 더 큰 가중치를 주었다. query_string/script 대신 값 슬롯만 사용한다.
- **정본 분리**: MySQL 쓰기와 ES dual-write를 금지했다. DB 변경은 binlog→Debezium→Kafka→Aiven sink로
  전달하고 `_id=public_id` upsert로 재전달을 멱등화했다.
- **단일 테이블 CDC의 한계**: 검색 문서는 item template·skill 등 조인이 필요하다. `ListingIndexer`가 fetch
  join으로 완전한 문서를 만들고 부팅 색인·드리프트 보정·운영 재색인에서 재사용한다.
- **드리프트 감시**: `SearchReconciliationWorker`가 MySQL과 ES를 listing type별 총량·상태 분포·가격
  histogram으로 비교하고 meter를 남긴다. 옵션에 따라 전건 재색인으로 보정한다.
- **무중단 재색인 코어**: 새 물리 인덱스를 만들고 계약을 검증한 뒤 alias를 원자 전환하며, 이전 인덱스는
  보존 시간 후 청소한다. 동시 실행 guard와 실패 시 in-place 복구 경로를 둔다.

## 3. 핵심 결정과 근거

- **Elasticsearch+CDC 선택**: MySQL FULLTEXT나 경량 Outbox보다 로컬 부담은 크지만 형태소·랭킹·동기·재색인
  운영 경험을 실제로 검증하기 위해 선택했다. sellerGrade 부스트는 선행 도메인이 없어 제외했다.
- **MySQL이 항상 정본**: 검색 결과는 후보 public id만 반환하고 최종 응답은 DB로 하이드레이션한다. ES 장애나
  지연이 금전·재고 정합성에 영향을 주지 않는다.
- **alias 전환**: in-place 재색인의 단순함 대신 새 인덱스 구축 비용을 지불하고 부분 색인 노출을 피했다.

## 4. 라이브 장애와 해결

1. Confluent Hub CDN DNS 차단으로 Kafka Connect 빌드 실패 → sink를 Aiven GitHub 배포본으로 교체
   (`2301feb0`).
2. Java client 8.18.8과 서버 8.15.3 불일치로 검색 503 → 서버를 8.18.8로 맞춤(`79c4cffa`).
3. `create-index` 스크립트의 `//` 주석 때문에 생성이 실패하고 동적 text 매핑이 생김 → keyword 정렬에서
   fielddata 오류. 인덱스 템플릿으로 필드 타입·analyzer를 선고정(`79c4cffa`).
4. reviewer가 CDC 필드/enrichment 경로의 런북 비동작을 major로 판정 → `edd98075` 수정 후 재검 통과.
5. fresh MySQL의 Debezium 계정과 Kafka Connect 내부 토픽 문제는 각각 `858cc133`, `04055368`에서 후속 복구했다.

## 5. 증거

- `docs/spec/search-spec.md` §12, `docs/board/epics/EPIC-SEARCH.md` — 아키텍처·게이트·라이브 기록.
- 코드: `backend/src/main/java/com/finalcall/domain/search/service/ListingSearchService.java`,
  `backend/src/main/java/com/finalcall/domain/search/service/ListingIndexer.java`,
  `backend/src/main/java/com/finalcall/domain/search/service/ListingBootIndexer.java`,
  `backend/src/main/java/com/finalcall/domain/search/service/SearchReconciliationWorker.java`,
  `backend/src/main/java/com/finalcall/domain/search/service/SearchReindexService.java`,
  `backend/src/main/java/com/finalcall/domain/search/service/SearchIndexManager.java`.
- 인프라: `backend/docker-compose.local.yml`, `backend/docker/search/**`의 이미지·인덱스·connector 설정.
- 라이브 실측: ES 8.18.8+nori·Kafka KRaft·Debezium+Aiven sink 기동, 부팅 재색인 **5,040건**,
  `/market?q=신발` 24건 관련도순과 `/shops`, `/auctions`의 q·400/200 규약 확인
  (`EPIC-SEARCH.md` 완료 기록).
- 커밋: `cb91c64d`, `fcf7e032`, `2301feb0`, `79c4cffa`, `edd98075`, `db3f0005`, `142403bc`.

### 정직한 한계

5,040건과 24건은 2026-07-23 로컬 seed 실측값이지 운영 트래픽 지표가 아니다. 운영 재색인 코어는 구현됐지만
관리자 API는 `9c168f1a`에서 롤백·분리됐다. 운영 클러스터·등급 부스트·오타/동의어 고도화는 구현으로 쓰지 않는다.
