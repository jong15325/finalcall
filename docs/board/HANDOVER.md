# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-23** (EPIC-SHOP·MARKET-DATA·SHOP-MANAGE·SEARCH 완료 + 인벤토리 폴리시 + 검색 스택 라이브 — 마감 지시로 작성)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

---

## 지금 어디인가 — 한 문단

**오늘 백엔드/프론트 에픽 4종 완주 + 인벤토리 폴리시.** 순서대로: **EPIC-SHOP**(고정가 마켓 — 등록·구매·취소·만료, 정산 자산 재사용) → **FC-102**(인벤토리 슬롯 UI 폴리시 7건, 브라우저 실측) → **EPIC-MARKET-DATA**(스킬 마스터 244건 §5 시드·카드 스킬명 노출·**마켓 5천 대량 로컬 시드**) → **EPIC-SHOP-MANAGE**(마이페이지 '내 판매' 조회·내리기, GET /me/shops) → **EPIC-SEARCH**(마켓·경매 자유문 검색 — **Elasticsearch 8.18.8+nori + Kafka(KRaft) + Kafka Connect(Debezium+Aiven ES sink) CDC 스택**, q/relevance, 라이브 실측 24건). 각 에픽 게이트 절차(계약→구현→검수→보안→게이트3) 전건 통과·사용자 승인·기록됨. **검색 스택·앱이 지금 로컬에서 실행 중.** 미푸시 커밋 다수(오늘 작업 전부).

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13 숙지.
2. 이 파일 + `git log --oneline -40` + `git status`. **미푸시 다수** 있음(push는 사용자).
3. 메모리: `brand-identity`·`mockup-fidelity-only-fix`·`gate2-plain-language`·`main-session-no-direct-verify`·`options-need-html-mockup`·`jira-mirror-discipline`.
4. 계약 정본: `docs/spec/{shop-spec v1.0, purchase-spec, closing-domain-spec, fee-policy-spec, skill-exposure-spec v1.0, search-spec v0.3, erd v1.4, api-contract v1.13}` · `references/game-item-skill-format.md §5`(스킬 해독표).
5. **★ 앱·검색 스택이 실행 중일 수 있다**(아래). 다음 수로 진행.

---

## ★ 앱·검색 스택 실행 상태 (이 세션에서 띄워둠 — 새 세션 확인 필요)
- **실행 중**: docker `finalcall-mysql`·`finalcall-redis`(healthy) + **`finalcall-elasticsearch`(8.18.8·nori)·`finalcall-kafka`(KRaft)·`finalcall-kafka-connect`(Debezium+Aiven ES sink)** + 백엔드 `gradlew :backend:bootRun`(local·:8080) + 프론트 `npm run dev`(:5173). **재부팅/세션 종료 시 내려갈 수 있음** — 없으면 아래 "환경 기동".
- **검색 데모**: localhost:5173 → 마켓/경매 목록 상단 **검색바**에 `신발`·`불의`·`트리플`(2글자↑) → nori 한글 형태소 매칭·관련도순. ES 색인 **5040건**(부팅 재색인). q 1자·무q relevance는 400(계약 규약).
- **데모 계정**: `demo1`~`demo10` / `demo1234!`. 마켓 5천 시드(demo 판매자별 ~500건)·데모 계정 시드 멱등(demo1 마커). **★ 5천 재시드하려면 DB 리셋 필요**(`docker exec finalcall-mysql mysql -uroot -proot -e "DROP DATABASE IF EXISTS finalcall; CREATE DATABASE finalcall;"` 후 bootRun — 사용자 직접 실행, DROP은 에이전트 차단).

---

## ★ 완료된 에픽 (오늘, 전건 게이트3 done·사용자 승인)

### EPIC-SHOP (KAN-102) — 고정가 마켓 [done]
- shop-spec v0.2. 등록(INVENTORY→LISTED CAS)·구매(shop 행 FOR UPDATE+종료성 CAS+sale_order UK 이중판매 차단·잔액 user_id 오름차순·SettlementRecorder(SHOP) 재사용)·취소(releaseFromListing)·만료 워커. 기한=관리자 설정값(기본 7일)·무기한 지원. V15. reviewer PASS·보안 0.
- **재사용 하이라이트**: 정산 꼬리(SettlementRecorder·sale_order·수익원장·인벤 CAS)를 코드 변경 0으로 재사용. 포트폴리오 `docs/portfolio/shop.md`.

### FC-102 (KAN-114) — 인벤토리 슬롯 UI 폴리시 [done]
- 하단 이름 제거·이미지/아웃라인 꽉맞게·hover 확대(슬롯 밖 팝)·반응형 6/3/2·**페이지 간 크기 통일**(근본원인 `mx-auto` flex 수축→`w-full`, 총괄 브라우저 DOM 측정)·탭 라벨 추가슬롯1/2/3·모서리 각짐. 셀 72px 고정.

### EPIC-MARKET-DATA (KAN-108) — 스킬 마스터·스킬명·5천 시드 [done]
- skill_definition **244행**(§5 효과 서술, V16 UPDATE 5+INSERT 239). 카드/목록/상세 스킬명 노출(ShopItemView·AuctionItemView skill1Name/skill2Name, fetch join 재사용·N+1 없음). **마켓 5천 로컬 데모 시드**(LocalDemoSeeder 확장·다양가). reviewer PASS(code 140 §5 채택 정확)·보안 0.

### EPIC-SHOP-MANAGE (KAN-115) — 내 판매 조회·취소 [done]
- `GET /me/shops`→MyShopSummary(등록가+예상 정산액, 판매자 전용·서버 파생·공개 ShopSummary 무오염·IDOR 안전). 마이페이지 '내 판매' 섹션(내리기→기존 cancel API). 스키마 무변경(인덱스 재사용). reviewer PASS·보안 0·브라우저 실측.

### EPIC-SEARCH (KAN-119) — ES 검색 [done, 정합성 후속 분리]
- search-spec v0.3 §12. **Elasticsearch 8.18.8(nori) + Kafka(KRaft) + Kafka Connect(Debezium MySQL source + Aiven ES sink)** docker 스택. q(nameSnapshot nori+ngram)·relevance(search_after 커서)·마켓+경매. **CDC=스냅샷 필드 + 앱 부팅 재색인(ListingIndexer)=join 필드(코드축)** + 주기 화해. MySQL 정본·ES 파생·dual-write 금지.
- reviewer 1차 MAJOR-1(런북 비작동: camelCase↔snake_case·correct-on-drift off)→2차 PASS. 보안 0. **총괄 라이브 실측**: /market?q=신발 24건.
- **트러블슈팅 3건(라이브가 잡음)**: ①폐쇄망이 Confluent CDN 차단→Aiven 커넥터(GitHub) ②ES 클라(8.18.8)↔서버(8.15.3) 불일치→서버 8.18.8 상향 ③create-index `//` 결함→동적 text 매핑→정렬 fielddata 오류→**인덱스 템플릿** 도입.
- **★ 정합성은 후속 분리(FC-110/KAN-124)** — 사용자 결정: 검색 기능 완성, CDC 라이브 동기·화해 histogram·운영 초기색인은 추후 과제.

---

## 남은 것 / 후속 티켓 (done 안 막음)
- **FC-110 (KAN-124)**: 검색 정합성 하드닝(CDC 라이브 end-to-end·mysql binlog 재생성·화해 histogram·운영 초기색인 전략·Aiven sink 버전). ★ 사용자가 명시 이월.
- **FC-101 (KAN-113)**: 마켓 목록 대량 성능(ShopCard memo·per-second now 격리). 5천 깊은 스크롤 잰더.
- **FC-096**은 done(마이페이지 내 판매로 실현).
- **하드닝 백로그**: 마감 잔액 락 M1·초소액 settle M2·purchase×close 교차 데드락·운영 시드 오염(V13 전프로파일)·토큰 localStorage→쿠키·마스킹 게이트2·dev deps 취약점.

## 남은 백엔드 에픽 (동결 해제됨 — 게이트1부터)
- **EPIC-GRADE** (등급): 초안 grade-tier-spec v0.1·게이트2 8항목(D-102). 검색 등급 부스트(search-spec §6.1)가 이걸 소비.
- **준비중 자리 실기능화**: 충전(Toss)·커뮤니티 CRUD·알림·OAuth·이메일인증·슬롯확장.
- **EPIC-SHOP**(고정가)·**EPIC-SEARCH**는 done.

---

## 다음 수
1. **사용자 "출근" 후 지시 대기** — 후보:
   - **(a) FC-110** 검색 정합성 하드닝(CDC 라이브 동기 완성) — 검색 스택 이미 떠 있어 이어가기 좋음.
   - **(b) EPIC-GRADE**(등급) — 검색 부스트·아이템 가치 시연. 게이트2 확정 후.
   - **(c) 준비중 자리 실기능화**(충전/커뮤니티/알림) 또는 FC-101(마켓 성능)·하드닝 백로그.
2. **미푸시 커밋 push**(사용자) — 오늘 작업 백업. `git push`(훅이 에이전트 push 차단).

---

## 환경 기동 — ★ 함정 (검색 스택 추가)
```bash
# DB/캐시: docker start finalcall-mysql finalcall-redis
# 검색 스택(무거움·ES/Kafka/Connect): cd backend && docker compose -f docker-compose.local.yml up -d --build
#   ★ create-index: bash docker/search/create-index.sh (인덱스 템플릿+alias listings_search)
#   ★ 커넥터: docker exec -i finalcall-mysql mysql -uroot -proot < docker/search/mysql/debezium-user.sql; bash docker/search/register-connectors.sh
#   ★ 헬스: curl localhost:9200/_cluster/health · localhost:9200/listings_search/_count
# 백엔드: JAVA_HOME=C:\Users\howee\.jdks\ms-21.0.11 ; (루트에서) ./gradlew :backend:bootRun --args='--spring.profiles.active=local'
#   → 부팅 재색인(local reindex-on-startup=true)이 ES에 ~5040건 색인. Flyway V1~V16 자동.
# 프론트: cd frontend && npm run dev (localhost:5173, /api→8080 프록시+X-Gateway-Token)
```
- **함정 A(폐쇄망)**: Confluent Hub CDN(d1i4a15mxbxib1.cloudfront.net) DNS 차단됨 — ES sink는 Aiven(GitHub) 사용. 다른 플러그인도 packages.confluent.io/Maven/GitHub 등 도달 소스로.
- **함정 B(ES 버전)**: Boot 3.5.16 ES 클라=8.18.8 → **ES 서버도 8.18.8**여야 함(불일치 시 검색 503·health DOWN). 클라 다운핀 불가.
- **함정 C(인덱스 매핑)**: create-index는 **인덱스 템플릿**으로 keyword 매핑 고정(동적 text 매핑이면 정렬 fielddata 오류). listings-index.json은 template로 대체됨.
- **함정 D(mysql binlog)**: 기존 finalcall-mysql이 compose 밖에서 돌면 CDC 라이브 동기가 안 됨(binlog 옵션 미적용) → 전체 CDC 데모 시 `docker rm -f finalcall-mysql` 후 compose로 재생성(볼륨 보존=시드 유지). **검색 자체는 부팅 재색인이 주 populator라 CDC 없이도 동작**.
- **함정 E(gradlew cwd)**: bootRun은 **레포 루트에서** 실행(backend/에 gradlew 없음). 세션 중 cwd가 backend/로 남으면 `cd /d/Java/finalcall` 선행.
- **⚠ Flyway 체크섬**: 부팅 실패 시 `flyway repair`.

---

## 교훈 (오늘 추가)
1. **라이브 실측이 정적 리뷰를 보완한다.** EPIC-SEARCH 인덱스 매핑 버그(동적 text→정렬 fielddata)는 reviewer 코드리뷰가 못 잡고 실제 스택 기동·검색 실측이 잡았다. 인프라 무거운 에픽은 라이브 검증 필수.
2. **폐쇄망/버전 정합은 실무 트러블슈팅.** CDN 차단→커넥터 교체·클라↔서버 버전 정합·인덱스 템플릿 — 포트폴리오의 운영 역량 사례. 그대로 기록.
3. **정산·검색 자산 재사용 설계.** SettlementRecorder(SHOP), skill_definition/fetch-join(스킬명), ShopCursor/FeeCalculator(내 판매), 부팅 재색인(검색) — 기존 자산 재사용이 신규 에픽 속도를 만든다.
4. **게이트2 평이 언어 + 큰 결정은 사용자.** 검색 방식(DB내장 vs ES)·엔진(OpenSearch vs ES)·동기(Outbox vs CDC)는 장단점 논의 후 사용자 결정(포트폴리오 임팩트로 ES+CDC 선택).
5. **스택 기동 시 mysql 재생성 주의.** binlog 적용엔 컨테이너 재생성 필요(볼륨 보존). 검색은 CDC 없이 부팅 재색인으로 동작하니, 무거운 CDC 데모는 FC-110에서.
