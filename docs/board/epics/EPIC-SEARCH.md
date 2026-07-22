---
id: EPIC-SEARCH
type: epic
jira_key: KAN-119
title: 마켓·경매 검색 — 전용 검색엔진(Elasticsearch) 도입 (②단계)
state: done
children: [FC-106, FC-107, FC-108, FC-109]
gate: null
---
## 게이트3 — Done (2026-07-23, 사용자)
- reviewer 2차 PASS + 보안 0건 + **총괄 라이브 실측**(ES 8.18.8+Debezium CDC 스택·/market?q=신발 24건 관련도순·nori) 후 마무리. FC-106~109 done. **push는 사용자**(미푸시 다수).
- **정합성은 후속 분리(FC-110)**: 사용자 결정 — 검색 기능은 완성, CDC 라이브 동기·화해 histogram·운영 초기색인은 추후 과제.
## 목표
자유문(`q`) 검색·한글 형태소·관련도 랭킹을 마켓(5천 고정가)·경매 목록에 제공한다. search-spec v0.1 **②단계(전용 검색엔진 도입)**를 구현. MySQL=SoT·검색엔진=파생 read-model, dual-write 금지·멱등 싱크·주기 화해.

## 게이트1 승인 (2026-07-22, 사용자)
- 다음 작업으로 마켓 검색 선택. 방식 = **B(전용 검색엔진 ES/OpenSearch)** — 포트폴리오 임팩트 우선(검색 인프라·동기·재색인 역량 시연). MySQL FULLTEXT(①단계)는 배제.
- **범위 = 마켓 + 경매**(item-templates 제외). q 자유문 필터는 공유 구조(C1).
- **등급 부스트(sellerGrade) 범위 밖** — EPIC-GRADE 의존(§6.1·A4). 관련도(BM25) + 한글까지.
- **★ 로컬 실행성 우선**: 포트폴리오 데모가 로컬(Windows/docker)에서 기동돼야 함. architect가 로컬 기동 가능 구성 우선 설계.

## 정본 (설계 근거)
- **`docs/spec/search-spec.md` v0.1** — §4 목표 아키텍처(CDC/Outbox·alias 재색인)·§5 인덱스 골격·§6 랭킹(function_score, 등급은 GRADE 의존)·§7 한글(nori+ngram)·§8 엔진 선택·§9 게이트2(A1~A5·C1~C3)·§10 도메인 정합(ES 정본 아님·정확성은 DB).
- api-contract §3(공통 목록 필터)·§4.1 · 기존 `ShopRepository`/`AuctionRepository` 목록·`nameSnapshot`.

## 분해안 (게이트1 승인, architect 델타로 조정 가능)
```
FC-106 architect  ②단계 구현 spec 확정(엔진·동기·인덱스 매핑·재색인·한글·로컬 기동성) + q/relevance 계약(C1~C3) → 게이트2(A1~A3 아키텍처·C1~C3 계약)
FC-107 backend    검색엔진 인프라(docker) + 동기(Outbox/CDC) + 색인/재색인 + q 검색 API(마켓+경매·relevance 정렬)
FC-108 frontend   검색바·검색 결과 UI(마켓+경매·q·relevance·빈결과)
FC-109 reviewer   검수(정합성·동기 불일치·화해·주입·성능·계약·ES 정본 아님 준수)
```
(backend는 인프라/동기 vs 검색API로 분할 가능 — architect 판단.)

## 게이트2 — 승인됨 (2026-07-22, 사용자) — FC-106
- **A2 엔진 = Elasticsearch**(+nori 플러그인·userdict). **A3 동기 = Debezium CDC**(MySQL binlog→Kafka KRaft→Kafka Connect Debezium source + ES sink, at-least-once·멱등 upsert `_id`=public_id·snapshot 백필). **A1 인프라 = 신규 컨테이너 3개**(elasticsearch·kafka·kafka-connect) + MySQL binlog 설정. **A5** alias 재색인 + `@Scheduled` count/histogram 화해.
- **C1** q(nameSnapshot 매칭·마켓+경매 공유)·**C2** relevance 정렬(무q relevance=400·search_after)·**C3** 2~64자·match/multi_match(인젝션 불요)·빈결과 200.
- **결정 성격**: architect 추천(OpenSearch+Outbox 경량)과 다르게 **포트폴리오 사실성 우선**으로 ES+CDC 선택 — 로컬 부담 큼(사용자 수용). sellerGrade 부스트 제외(GRADE 의존).
- 정합성: ES 정본 아님·MySQL 진실원·dual-write 금지·주기 화해(domain-spec §8).

## 온디맨드 보안 리뷰 (2026-07-23, 에픽 완료 직전) — 취약점 0건
- search 델타(cb91c64·edd9807·fcf7e03) 스코프. **HIGH/MEDIUM 0건**. DSL 인젝션 없음(multi_match·term/range만·query_string/script 미사용·q는 값 슬롯)·커서 디코드 400 안전·IDOR 신규 보안면 없음(공개 목록 additive)·데이터 노출 없음(민감필드 미색인·nickname 마스킹·_source 미반환·DB 하이드레이션)·인프라 로컬 전용·XSS 없음.

## 로컬 스택 기동·라이브 실측 (2026-07-23) — 검색 실동작 확인
- **트러블슈팅 3건(총괄 실측+backend 수정)**: ① kafka-connect 빌드가 Confluent Hub CDN DNS 차단으로 실패 → **Aiven ES sink(GitHub)** 재지정. ② ES 클라(8.18.8)↔서버(8.15.3) 불일치로 검색 503 → **ES 서버 8.18.8 상향 정합**. ③ create-index `//` 주석 결함으로 동적 text 매핑 자동생성→정렬 fielddata 오류 → **인덱스 템플릿 도입**(keyword 고정). 커밋 2301feb·79c4cff.
- **라이브 검증**: ES 8.18.8+nori + Kafka(KRaft) + Connect(Debezium+Aiven sink) 스택 기동·부팅 재색인 5040건·`GET /shops·/auctions?q=신발`→실결과(nori 매칭·스킬명·코드축)·C2/C3 규약(400/200)·ES health UP. **총괄 브라우저**: /market?q=신발 → "신발" 24건 관련도순. **포트폴리오급 실동작 확인.**
- **교훈(포트폴리오 가치)**: 폐쇄망 CDN 우회·라이브러리 버전 정합·인덱스 매핑 함정(동적매핑 vs 템플릿)·정렬 fielddata — 실무 검색 인프라 운영 트러블슈팅 사례. reviewer 코드리뷰(정적)가 못 잡은 매핑 버그를 라이브 실측이 잡음.

## 범위 밖 / 후속
- **FC-110(KAN-124)**: 검색 정합성 하드닝(CDC 라이브 동기·화해 histogram·운영 초기색인). 사용자 후속 분리(2026-07-23).
- 등급 부스트(EPIC-GRADE 선행) · 오타허용/동의어 고도화(엔진 도입 후 튜닝) · item-templates 검색 · 패싯 UI(엔진은 지원하나 UI는 후속) · 운영 클러스터(로컬 데모 우선).
