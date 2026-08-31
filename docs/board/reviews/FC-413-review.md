# FC-413 홈 추천 마켓 통합 리뷰

판정: changes-requested

## Major

### 후보 선절단으로 다양성 완화 순서 왜곡

- `ShopRecommendationService`와 저장소가 이유별 후보를 30건으로 먼저 제한
- 제한 밖에 다른 판매자의 적격 매물이 있어도 실제 후보 부족으로 오판 가능
- 동일 판매자 제한을 유지할 수 있는데도 판매자 제한까지 완화해 한 판매자의 매물을 여러 건 노출할 수 있음
- 31건 이상 경계 데이터와 제한 밖 다양 후보 회귀 테스트 필요

### 실행계획 증거 부재

- 공개 홈 요청마다 무캐시 후보 조회와 완료판매 집계 실행
- `status + created_at` 복합 인덱스가 없고 검증 판매자 쿼리는 join·group by·count 정렬 수행
- 계약과 FC-409 DoD가 요구한 운영 규모 상당 fixture의 `EXPLAIN ANALYZE` 증거가 없음
- 검사 행 수·scan/filesort·집계 계획을 기록해 현 인덱스 유지 또는 별도 게이트2 상신 판단 필요

## 정상 확인

- 공개 GET 한 경로만 permitAll이며 프론트는 `auth:false`
- 단일 Clock, ACTIVE·미만료, 24시간 경계, 이유별 순서와 응답 형상 정합
- 판매 완료 건수 배치 집계로 N+1 없음
- 무캐시, 구매 성공 후 추천 캐시 무효화
- 로딩·빈값·오류·부분결과와 390·1280 워크벤치 테스트 통과
- ShopCard·구매 모달 재사용과 production residue 없음

## 선행 결함 분리

- `OAuthMetrics$Result` ConventionArchitectureTest 위반은 기존 결함
- navigation-layout WorkbenchRoutes 4건 실패는 기존 결함

## 재검토 조건

- 후보 선절단 없이 계약된 다양성·완화 의미 보장
- 31건 이상 경계 회귀 테스트 통과
- 운영 규모 상당 fixture의 `EXPLAIN ANALYZE` 증거 기록

## 재검토 2026-08-31

판정: changes-requested

- 최초 major인 30건 후보 절단과 조기 완화 문제는 해소됨
- V29 인덱스가 ACTIVE 10,000건 첫 페이지에서 reverse scan 30행·무정렬을 사용하는 증거 확인
- 다만 동질 후보가 이어지면 30건 OFFSET 순회가 전체 후보 소진까지 반복되어 공개 요청 한 번에 수백 DB round trip 가능
- GENERAL 완화 단계마다 offset 0부터 재탐색해 데이터량 비례 쿼리 증폭 발생
- 실행계획 테스트가 실제 fetch join QueryDSL이 아닌 단일 shop 축약 SQL인 점은 minor

재검토 조건

- DB 왕복 수가 전체 데이터량이 아니라 최대 6개 결과에 비례하는 명확한 상한을 가질 것
- 10,000건 동질 후보 서비스 경로에서 쿼리 수와 요청 수렴을 검증할 것
- 실제 fetch join 쿼리와 동형 실행계획 증거를 보강할 것

## 최종 재검토 2026-08-31

판정: passed

- 추천 경로의 OFFSET 순차 탐색 완전 제거
- 선택 shop·판매자·제한 도달 템플릿을 DB에서 제외하고 후보 ID 단건 선택 후 PK fetch join hydrate
- 빈 exclusion은 predicate 생략, 템플릿은 2건 선택 시에만 제한
- 제한 유지 후보가 실제 없을 때만 템플릿→판매자 순으로 완화
- 코드 구조상 서비스 SQL 최대 25회, 동질 ACTIVE 10,000건 실측 18회
- 상위 30건 동일 판매자 뒤의 다양한 후보 회귀 통과
- V29 reverse index scan·정렬 제거와 PK hydrate 계획 확인
- 단일 Clock, ACTIVE·미만료, 쿼터·reason, ShopSummary, 판매완료 배치 집계, 무캐시, 프론트 계약 유지

critical·major·minor 발견 0건으로 FC-413 통과

## 완료 직전 온디맨드 보안 리뷰 2026-08-31

판정: changes-requested

### Major

- 공개 추천 API가 게이트웨이 일반 `/api/v1/**` 경로에서 rate limit 없이 요청당 다중 SQL과 검증 판매자 집계를 실행
- 인증·직접접근 차단은 정상 게이트웨이 경유 반복 요청의 DB CPU·temporary table 증폭을 제한하지 못함
- 추천 경로 전용 rate limit·짧은 캐시·read model 등 비용 제한 결정 필요

### Minor

- V29 `CREATE INDEX`의 MySQL 8 온라인 DDL·metadata lock 사전 점검·중단 기준이 운영 절차에 명시되지 않음

### 정상 확인

- SQL 최대 25회와 exclusion set 최대 크기는 데이터량과 무관
- QueryDSL 바인딩으로 SQL 주입 없음
- 공개 ShopSummary 외 민감정보 없음, XSS·open redirect·구매 CAS 우회 없음
- permitAll은 GET 단일 경로이며 dev-only production residue 없음

## 보안 재검토 2026-08-31

판정: changes-requested

- 홈 전용 limiter 빈이 `RedisRateLimiter` 타입으로 등록돼 기본 limiter 자동 구성에 영향을 주고 기존 auth/chat route까지 fail-closed로 바꿀 가능성 major
- V29가 runbook에서 요구한 명시적 `ALGORITHM=INPLACE, LOCK=NONE` 형식과 불일치 minor
- 환경변수 replenishRate 변경 시 고정 `Retry-After: 1`이 실제 회복 시간과 달라질 수 있음 minor
- exact GET 우선 route, IP resolver, 기본 1/10/1, burst 429, Redis 장애 하류 0건 자체는 통과

## 보안 2차 재검토 2026-08-31

판정: changes-requested

- 홈 limiter composition 분리와 기존 auth/chat 정책 보존, Redis 장애 홈 429·하류 0건은 통과
- rate-limit 환경값 양수·관계 검증 부재로 `requestedTokens=0` 설정 시 보호 무력화 가능 major
- Retry-After 문서가 고정 1초로 남아 동적 구현과 불일치 minor
- V29 online DDL과 runbook 정합은 통과

## 최종 보안 재검토 2026-08-31

판정: passed

- 공개 추천 exact GET에 검증된 IP 토큰버킷 적용
- 잘못된 rate 설정은 gateway 부팅 단계에서 차단
- 홈 전용 fail-closed limiter와 기존 auth/chat limiter 분리
- Redis 장애에서 홈 429·하류 0건, 기존 auth 정책 유지
- Retry-After는 동일 검증 프로퍼티로 overflow 없이 계산
- SQL 주입·민감정보 노출·인증인가 우회·XSS·open redirect·구매 CAS 우회·workbench residue 없음
- V29 online DDL과 운영 runbook 검증

critical·major·minor 발견 0건으로 보안 PASS
