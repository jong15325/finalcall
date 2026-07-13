# 백엔드 결정 로그 (B-xxx)

협업 가이드(docs/management/collaboration-guide.md) 4절 티켓 규약(D-009~D-011)을 따른다.
- ID: B-<3자리>, 접두어별 독립 증가, 불변, 재사용·재번호 금지. 1결정=1번호.
- 상태 라벨: PROPOSED / ACCEPTED / ON-HOLD / SUPERSEDED(대체 ID 명시).
- 필드: ID · 제목 · 상태 · 소유역할 · 결정 · 이유 · 기각된 대안 · 관련(참조 ID) · 날짜.
- 참조 키워드: depends-on / relates-to / supersedes / escalated-as.
- 에스컬레이션 4기준에 걸린 사안은 총괄 로그(D-xxx)가 정본. 여기서는 "escalated-as D-xxx" 참조만 남긴다(내용 중복 기록 금지).
- 총괄로 보내는 모든 프롬프트 끝에 "신규 발번 ID: ..." 1줄 첨부 → 마스터 인덱스(management/decision-index.md) 동기화.
- 근거 위계: 확정 스펙(domain-spec/erd/api-contract) > 총괄 D-로그(ACCEPTED) > 이 로그 > 타 역할 로그(맥락) > 작업 노트.
- 필독: CLAUDE.md(컨벤션), docs/domain-spec.md, 총괄 D-로그.

논의 순서(D-035 조기 기동): 테이블·컬럼 네이밍 → API URL·페이징·정렬/필터 → 공통 응답/에러 포맷 재확인

---

## B-001. 물리 네이밍 규칙 — 테이블 단수 + snake_case 자동변환 (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to D-035, depends-on CLAUDE.md 섹션 3(ISO-8601)·5
- 결정: (1) 테이블명은 단수(`member`, `item`, `auction`, `bid`, `settlement`).
  (2) 엔티티 필드는 CamelCase, 물리 컬럼·테이블은 Hibernate `CamelCaseToUnderscoresNamingStrategy`
  로 snake_case 자동 변환(개별 `@Column(name)` 남발 금지).
- 이유: Hibernate 기본 매핑이 단수 엔티티명 기준 → 복수는 전 엔티티 `@Table` 필요(보일러플레이트·불일치 리스크).
  물리 네이밍 자동변환으로 매핑 코드 최소화·일관성 확보. REST URL 복수형은 표현 계층 관례라 안건2에서 분리.
- 기각된 대안: 테이블 복수형(Rails 관례) — JPA 매핑 오버헤드. 수동 `@Column` 네이밍 — 누락·불일치.
- 비고: 사용자 확정(단수) 2026-07-13. ERD/계약에 영향 → 확정 후 D-024 정보 공유 예정.

---

## B-002. PK 규칙 — BIGINT AUTO_INCREMENT 단일 대리키 (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-001, D-035
- 결정: 전 테이블 PK는 `id BIGINT AUTO_INCREMENT` 단일 대리키. 자연키·복합키 PK 금지(유니크 제약으로 표현).
- 이유: InnoDB 클러스터드 인덱스에 순차 삽입 → 페이지 분할 최소·write 성능 최상(마감 직전 입찰 폭주 write-heavy에 최적).
  8바이트로 FK·인덱스 크기 작음. UUIDv4 PK는 랜덤 삽입으로 페이지 분할 유발(입찰 폭주 최악)이라 기각.
- 기각된 대안: UUID PK(C) — write 저하·인덱스 비대. 자연/복합키 PK — 조인·변경 비용.
- 이월: 외부 노출 식별자(`public_id` ULID, enumeration 대응)는 URL 노출 범위와 결합 → 안건2(API URL)에서 확정.

---

## B-003. FK·시간·boolean/soft delete 네이밍 규칙 (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-001, B-002, depends-on CLAUDE.md 섹션 3·4·5, D-044
- 결정:
  - FK 컬럼: `<참조테이블>_id`. 동일 대상 다역할 참조는 역할 접두(`seller_id`/`buyer_id`), 자기참조 계층은 `parent_id`.
    FK 제약은 물리 FK로 시작(정합성 우선), 부하 실측에서 병목 시 hot 테이블(bid 등)만 논리 FK로 완화(two-way door).
  - 시간: `Instant`(UTC) → MySQL `DATETIME(6)`. `TIMESTAMP` 불가(2038·세션 타임존 변환). 접미사 `_at`.
    `created_at`/`updated_at`은 `BaseTimeEntity` 상속.
  - boolean: `is_` 접두, `TINYINT(1)`. soft delete는 `is_deleted` + `deleted_at`, 기본 조회 `is_deleted=false`.
    soft delete 테이블의 유니크 제약은 삭제 식별 컬럼(`deleted_at` 등)을 포함해 삭제행-신규행 충돌 회피(세부는 도메인 ERD).
- 이유: MySQL/InnoDB·JPA 관례 정합, 대량 write 성능(물리 FK 완화 여지), UTC 저장 일관성, 부분 인덱스 부재(MySQL) 우회.
- 기각된 대안: `TIMESTAMP`(범위·타임존), soft delete 없는 hard delete(이력·복구 불가), 물리 FK 전면 제거(초기 정합성 손실).

---

## B-004. 노출 식별자 + API URL 규칙 (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-002(이월분 해소), D-035. 계약(G3)에 직접 영향 → 정보 공유 예정
- 결정:
  - 노출 식별자: 외부 노출 리소스(auction, item)는 `public_id`(ULID) 컬럼을 URL에 노출. 내부 조인·FK는 `id`(BIGINT) 유지.
    인증 뒤 내부 전용(member 등)은 `id` 직접 노출 허용. ULID 선택 이유: 시간정렬성(인덱스 지역성) + 추측 방지.
  - URL: URI 경로 버저닝 `/api/v1/...`. 리소스 복수형(`/auctions`,`/items`,`/bids`,`/settlements`).
    종속 관계는 1단 중첩까지(`/auctions/{id}/bids`). 상태 전이는 동사 URL 최소화, 리소스·하위 리소스로 표현.
- 이유: 순차 ID 노출은 거래량·신규 매물 수 추측(경매 도메인 비즈니스 리스크). URI 경로 버저닝은 캐싱·가시성·디버깅 유리.
- 기각된 대안: 내부 id 전면 노출(A, enumeration), 헤더 버저닝(캐싱·가시성 열위), 깊은 중첩 URL.
- 이월: 개별 엔드포인트 목록·상태전이 액션 명세는 계약(G3, 기획 api-contract) 확정 사안.

---

## B-005. 페이징 규칙 — 하이브리드(cursor 기본 / offset 예외) (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-004, D-035. 계약(G3)에 직접 영향
- 결정: 실시간 변동이 큰 주요 목록(경매 목록, 입찰 내역)은 cursor(keyset) 기본.
  페이지 점프가 필요한 소규모·관리성 목록(정산 내역, 관리자)은 offset(`page`/`size`) 허용.
  cursor 규약: 응답 `nextCursor`(불투명 base64 토큰 = 정렬키+id), `size`, tie-break `id`. 커서는 서버 인코딩/디코딩, 클라이언트 불투명 취급.
- 이유: offset은 깊은 페이지 스캔 성능 저하 + 실시간 삽입 시 중복·누락(경매 목록 UX 직접 훼손).
  cursor는 인덱스 seek로 깊이 무관 성능·삽입 안정. 페이지 점프가 실제 필요한 곳만 offset 예외.
- 기각된 대안: offset 전면(실시간 목록 중복·누락), cursor 전면(관리 화면 페이지 점프 불가).

---

## B-006. 정렬·필터 파라미터 규칙 (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-005, D-035, D-044(검색·시세 축). 계약(G3)·ERD 인덱스에 직접 영향
- 결정:
  - 정렬: `sort={field},{asc|desc}` (Spring Data 관례), 다중 정렬 허용. 허용 필드 화이트리스트만.
    cursor 목록은 정렬키=커서키라 인덱스 있는 소수 필드로 제한.
  - 필터: 명시적 명명 파라미터 + 화이트리스트. 범위는 `minXxx`/`maxXxx` 접두쌍, enum은 대문자 코드.
    RSQL·동적 쿼리 DSL 등 범용 필터 문법 지양. 정렬·필터 가능 필드는 ERD 인덱스와 1:1.
- 이유: 임의 필드 정렬·범용 필터 DSL은 인덱스 없는 풀스캔·슬로우 쿼리를 유발. 화이트리스트로 원천 통제.
- 기각된 대안: 임의 필드 정렬 허용, RSQL/동적 필터 DSL(인덱스 통제 곤란·과설계).
- 이월: 도메인별로 어떤 필드를 정렬·필터에 열지는 계약(G3) 확정 사안.

---

## B-007. 페이징 응답 표준 — CursorResponse 차용 (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-005, depends-on On-Race common/response/CursorResponse.java(참고). 계약(G3) 영향
- 결정: cursor 응답은 `{ content: List<T>, nextCursor: String|null, hasNext: boolean }`(On-Race 검증 패턴 차용).
  구현: `fetchSize+1` 조회로 hasNext 판정, nextCursor=마지막 원소 정렬키(다중 정렬키셋 지원). offset은 별도 `PageResponse`(page/size/totalElements/totalPages). 둘 다 `ApiResponse.data`에 래핑.
  성공/에러는 스켈레톤대로 분리 타입(`ApiResponse`/`ErrorResponse`) 유지 — On-Race 단일 통합안 미채택.
- 이유: 팀 기존 패턴 재사용으로 프론트 친숙·구현 단순. 초기 `items+pageInfo` 자체안 폐기(중첩 불필요·비검증).
- 기각된 대안: `items+pageInfo` 중첩(비검증), On-Race식 성공/에러 단일 `ApiResponse` 통합(스켈레톤 의도적 분리 뒤집을 이유 약함).

---

## B-008. [SUPERSEDED-BY D-065·에스컬레이션] 아키텍처 — SCG 게이트웨이/MSA + 인증 모델 (2026-07-13)

- 소유: 백엔드(제안) / 관련: escalated-as D-064(VOID·롤백) → superseded-by D-065(ACCEPTED), relates-to CLAUDE.md 섹션1·4·F1, D-035
- 상태: 종결 — 총괄 최종 회신 D-065(mgmt/outbox/031). 최종 결정: 안건1 (A) 단일 서비스 유지·게이트웨이 없음,
  안건2 (A) 서비스 자체 JWT 검증·SecurityContext·X-User-Id 미도입. (중간 D-064 MSA 채택은 사용자 롤백으로 VOID.)
- 근거·선택지·추천은 outbox/002 참조. 게이트웨이/대기열/MSA는 향후 필요·여력 시 재검토(현재 미채택).

---

## B-009. 사용자 식별 규약 — SecurityContext 기준 (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: depends-on D-065(단일 서비스·서비스 JWT 검증), relates-to CLAUDE.md F1, B-003·B-008
- 결정: 컨트롤러/서비스의 인증 주체 식별은 `SecurityContext`(서비스 자체 JWT 검증) 기준. `@RequestHeader("X-User-Id")` 미사용.
  게이트웨이 헤더 주입 모델은 D-065로 미도입.
- 이유: D-065로 단일 서비스·서비스 JWT 검증 확정. 게이트웨이 부재로 X-User-Id 신뢰 경계가 성립하지 않음.
- 비고: outbox/003의 "사용자 식별 헤더 보류" 항목 해소. 게이트웨이 재검토 시 함께 재논의.

---

## B-010. sale_order 다형 출처 참조 — B-001 물리 FK 예외 승인 (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-001, depends-on D-066(sale_order)·erd.md §4.2·§5. design/outbox/016 회신
- 결정: `sale_order`의 출처 참조는 `source_type(AUCTION/SHOP)` + `source_id` 폴리모픽 유지(기획 ERD 안 수용).
  출처가 두 테이블(`auction`/`shop`)이라 단일 물리 FK가 성립하지 않으므로 B-001 "물리 FK 시작"의 정당한 예외.
  조건: (1) DB 물리 FK 부재를 애플리케이션 레벨 참조 무결성 강제로 보완(존재 검증·삭제 정책),
  (2) 역참조용 `(source_type, source_id)` 보조 인덱스 유지(erd §5 이미 반영).
- 이유: 출처 2종으로 안정적이고 "출처 무관 주문 조회"가 잦아 폴리모픽이 실용적. 두 nullable FK+XOR CHECK
  대안은 DB 정합성을 지키나 컬럼·분기 증가 대비 이득이 2종 출처에선 낮음.
- 기각된 대안: `auction_id`/`shop_id` 두 nullable FK + XOR CHECK(정합성↑이나 과설계), 물리 FK 강제(불가능).

---

## B-011. refresh 토큰 저장소 — Redis (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: depends-on api-contract §2(SEC-006 토큰 전략), relates-to CLAUDE.md E1·F1, D-002. mgmt/outbox/040 G4-1
- 결정: refresh 토큰은 Redis에 해시(SHA-256) 저장. 키 `auth:refresh:{userId}:{sessionId}`, TTL=refresh 만료.
  회전(재발급 시 신규 저장+구 폐기), 재사용 탐지(제시 토큰≠저장분 → 해당 세션 무효화), logout 시 폐기.
  refresh 토큰 자체는 opaque 난수(≥256bit) + Redis 매핑(탈취·즉시 무효화 대응).
- 이유: SEC-006(서버 저장·회전·재사용 탐지·즉시 무효화)을 Redis로 전부 충족. erd에 refresh 테이블 없음 →
  DB 테이블 신설은 6절 스펙 변경(무겁다). Redis는 스택 내재·TTL 자연 폐기·On-Race TokenStoreService 패턴 정합.
- 기각된 대안: DB 테이블(감사·다기기 유리하나 ERD 변경 필요), 하이브리드 Redis+DB(현 단계 과설계).

---
