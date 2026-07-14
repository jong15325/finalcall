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

## B-012. Flyway 버전 정합 — user/balance는 V3 (스켈레톤 V1/V2 선점) (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to erd §6, B-001. G4-1 유닛 A(006) 구현 이슈. escalated to 기획·총괄(outbox/014)
- 결정: user·user_balance 마이그레이션은 `V3__user_and_balance.sql`로 작성. erd §6이 지시한 V1은 스켈레톤이
  이미 소비(V1 init_schema, V2 notice_auditor) → append-only 원칙상 재사용 불가. 파일 범위는 user·user_balance만
  (charge/money_exchange/money_hold는 화폐 도메인 후속 단위 별도 버전).
- 이유: Flyway append-only·불변 이력 원칙. 실제 소비 상태 기준으로 다음 번호 채번이 유일한 정합 방법.
- 후속: erd §6 매핑표(V1=user_and_money)가 실제 파일 번호와 어긋남 → 기획·총괄에 §6 정정 요청(확정 스펙은 기획만 수정).
- 비고: ULID는 `@JdbcTypeCode(SqlTypes.CHAR)`로 CHAR(26) 정합(validate 통과). AUTH_005(권한)는 관리자 API 단계로 유보.

---

## B-013. refresh 토큰 만료 — 14일(잠정) (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-011, SEC-006. 유닛 B(007) 구현값. 보안 게이트2 검토 대상
- 결정: refresh 만료 `jwt.refresh-exp-days=14`(잠정). access 만료는 CLAUDE.md F1(JWT_ACCESS_EXP_MIN=30) 유지.
- 이유: 계약·CLAUDE.md에 refresh 만료 미정의 → 자금 시스템 통상값 14일로 잠정 설정(재로그인 빈도·탈취 노출창 균형).
- 후속: 보안 게이트2에서 만료 정책(기간·기기별 세션 상한) 확정 시 조정. two-way door(설정값).

---

## B-014. access 토큰 클레임 포맷 단일화 (2026-07-13) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-009, 스켈레톤 common/security. 유닛 B(007) 구현 결정 흡수
- 결정: access 토큰을 subject-only 데모 포맷에서 클레임 기반으로 단일화 — subject=userId + `publicId`·`isAdmin` 클레임(`TokenClaims` record).
  필터 principal=userId, `isAdmin`→`ROLE_ADMIN` 부여(관리자 인가 AUTH_005 선반영). 데모 API(generateToken/validateAndGetSubject) 제거.
- 이유: 두 토큰 포맷 공존(필터 양쪽 파싱)의 잠재 버그 회피, 단일 포맷 확정. 데모 자산 정리.
- 파급: JwtAuthenticationFilter·데모 AuthController·토큰 테스트 2건 동반 갱신(전부 통과). 로그인 로직은 미포함(008~011 소관).

---

## B-015. API 라우팅 — 컨트롤러 클래스 레벨 경로 명시 (/api/v1/<도메인>) (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to api-contract §Base(/api/v1), B-004(URI 경로 버저닝). 008 완료 보고 이슈1
- 결정: 실도메인 컨트롤러는 클래스 레벨 `@RequestMapping("/api/v1/<도메인>")`으로 전체 경로를 명시하고
  메서드는 상대 경로. 전역 접두 config(WebMvcConfigurer `addPathPrefix`·`server.servlet.context-path`) 미도입.
- 이유: 스켈레톤 bare 엔드포인트(sample·notice·데모 auth)와 actuator가 공존 → 전역 접두는 이들에 예외 처리를
  강제(이중 접두 `/api/v1/api/v1/...`·URL 변경 위험). 명시 방식은 예외 없음, URL grep 가능, 계약 최종 URL과 1:1.
  계약 URL 불변이라 경계·계약 무영향(자율 결정, two-way door).
- 기각된 대안: base package 한정 `addPathPrefix`(스켈레톤 예외·"숨은 접두" 추적성 저하), `context-path`(actuator 등 앱 전역 영향).
- 후속: 실도메인 컨트롤러가 크게 늘어 클래스 레벨 반복이 부담되면 base package 한정 `addPathPrefix`로 리팩터(two-way door).
  데모 `AuthController`→`AuthDemoController` 개명은 login/logout 실구현 후 데모 제거로 정리.

---

## B-016. 비밀번호 검증 정책 — 잠정(@Size max=72)·강화 이월 (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to 008 signup, SEC-007. 보안 게이트2 검토 대상
- 결정: signup password 검증은 `@NotBlank + @Size(max=72)`(BCrypt 72바이트 한계)만 잠정 적용.
  최소 길이·복잡도 정책은 계약·스펙 미정 → 미도입, 보안 게이트2에서 확정.
- 이유: 계약/도메인 스펙에 password 규칙 부재. 최소길이·복잡도는 프론트 검증·UX·보안이 함께 걸리는 사안 →
  임의 도입보다 보안 검토로 확정이 정합. `max=72`는 BCrypt 기술 한계라 지금 필수.
- 후속: 보안 게이트2에서 정책 확정 시 강화(프론트 검증 메시지 정합 병행). two-way door.

---

## B-017. 로그인 타이밍 사이드채널 완화 — 보안 게이트2 이월 (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to 009 login, B-016(정책 이월 동궤), SEC-007. 보안 게이트2 검토 대상
- 결정: 없는 loginId는 BCrypt `matches`를 건너뛰어 응답 시간이 짧아지는 타이밍 사이드채널이 남는다.
  더미 해시 상수시간 비교 등 완화는 이번 유닛 범위 밖 → 보안 게이트2 이월. 이번 유닛 미도입 유지.
- 이유: 응답 코드는 이미 AUTH_003 단일화로 열거 완화. 타이밍 완화는 자금 시스템에서 유효하나 정책·구현이
  보안 검토와 함께 확정될 사안. 현 단계 미도입이 정합.
- 후속: 보안 게이트2에서 완화 방식 확정(더미 BCrypt 상수시간 처리 등). two-way door.

---

## B-018. refresh 회전 vs 탈퇴 계정 순서 — member 탈퇴 구현 시 조정 (이월) (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to 010 refresh, B-011. member 탈퇴 도메인 구현 시 검토
- 결정: rotate(Lua CAS 원자)가 신규 refresh를 먼저 저장한 뒤 소유자 `isDeleted`를 판정 → 탈퇴 계정의 신규
  refresh 해시가 TTL까지 Redis에 잔존하는 미세 엣지. 사용자 삭제 엔드포인트 미구현이라 현재는 이론적. 현 단계 미조정.
- 이유: 탈퇴 플로우(member) 미구현 상태에서 순서 조정은 실익 없음. 회전 결과 access 발급은 어차피 AUTH_004로
  차단되어 재발급 자체는 성립 안 함(방어됨). 잔존 해시는 TTL로 자연 폐기.
- 후속: member 탈퇴 구현 시 (a) 회전 전 소유자 유효성 선검증 또는 (b) 탈퇴 시 refresh 세션 일괄 폐기로 해소. two-way door.

---

## B-019. 204 No Content 응답 — ApiResponse 미적용(void + @ResponseStatus) (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to 011 logout, api-contract §1.5·§2, CLAUDE.md §5(컨트롤러 ApiResponse). 011 완료 보고 이슈2
- 결정: 204 No Content(본문 없는) 응답 엔드포인트는 `void` + `@ResponseStatus(HttpStatus.NO_CONTENT)`로 처리하고
  `ApiResponse<T>`로 감싸지 않는다. logout이 최초 적용. 향후 DELETE 등 no-content 응답에 동일 적용.
- 이유: RFC 7231상 204는 메시지 본문을 포함할 수 없다. `ApiResponse<T>`로 감싸면 본문이 생겨 204와 모순.
  근거 위계상 확정 스펙(계약 §2 logout 204) > CLAUDE.md 컨벤션이라 계약 준수가 우선. CLAUDE.md §5 "항상
  ApiResponse"는 본문이 있는 응답(2xx+body / 4xx 에러)에 대한 규칙으로 해석.
- 기각된 대안: 204를 200 + ApiResponse(빈 data)로 변경(계약 위반), ApiResponse를 204 body로 강제(RFC 위반).
- 후속: CLAUDE.md §5 컨벤션 문구에 "204/no-content 예외"를 명문화할지 총괄 확인(지침 수정은 총괄 승인). auth 완료 묶음 보고에 포함.

---

## B-020. 코드 스타일 자동화 도입 — Naver 핵데이 + Spotless/Checkstyle (스페이스4) (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to CLAUDE.md §4·§5, D-075(CLAUDE.md 섹션7 반영). 사용자 지시(업계 레퍼런스 조사·적용). 작업 프롬프트 backend/outbox/015
- 결정: 스타일 강제 층으로 Naver 캠퍼스 핵데이 컨벤션 채택. Checkstyle(naver-checkstyle-rules.xml, 검사) +
  Spotless(eclipse=naver-eclipse-formatter, 자동교정) 조합. 들여쓰기는 하드탭(Naver 기본) 대신 스페이스4로
  커스터마이즈. `.editorconfig`(UTF-8·LF·space4·max120) 공유.
- 이유: 국내 실무 표준·한글 친화·Checkstyle 룰셋/포맷터 기성 제공. 스페이스4는 기존 코드(533줄 스페이스)·
  IntelliJ 기본 정합이고, 하드탭 전환은 전면 리포맷·diff 노이즈 유발. 아키텍처 규약(§5)은 스타일 가이드
  미포함 영역이라 병존한다.
- 기각된 대안: google-java-format(2-space 강제, 국내 관례 충돌), `.editorconfig`+Checkstyle만(자동교정 부재),
  하드탭 유지(기존 코드 전면 변경).
- 범위: 스타일 층만. §5 아키텍처 규약 불변. CLAUDE.md §5 문구 반영은 총괄 승인(에스컬레이션).
- 후속: 도입은 Claude Code(백엔드 리팩토링). 첫 spotlessApply는 단독 style 커밋(로직 무변경). CLAUDE.md 반영 총괄 승인.

---

## B-021. Checkstyle 버전 — 10.20.2 (Java 21 record 지원) (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-020, D-075. 015 도입 이슈1. Naver 권장 "8.24 이상" 충족
- 결정: checkstyle `toolVersion`을 8.24 대신 10.20.2로 확정. Naver 룰셋(8.24 기준)은 10.20.2에서 로딩·구동 확인.
- 이유: 8.24는 Java 21 `record`를 파싱 못함(DTO 전부 record → LoginRequest.java record 토큰 에러). record 지원이
  필수라 상위 버전 불가피. Naver 문서도 "Checkstyle 8.24 이상"이라 상충 없음.
- 기각된 대안: 8.24 고정(record 미지원, 근본 불가), DTO record 회피(계약·§5 DTO record 규약 위반).
- 후속: 10.x 일부 모듈 속성 호환성은 잔여 정합(B-022)에서 함께 검증. two-way door.

---

## B-022. 스타일 포맷터↔Checkstyle 정합 정책 — 포맷터 튜닝 우선 (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-020·B-021, D-075. 015 이슈2. 코드리뷰(홀드) 일부 겹침
- 결정: 포맷터(naver-eclipse-formatter)와 Checkstyle(Naver 룰) 불일치는 Naver 룰을 완화하지 않고 포맷터 튜닝으로 정합.
  (a) Indentation 14건 → continuation indent 8·120자 미만 불필요 강제개행 억제, (b) braces 6건 → 빈 블럭 `{}` 축약을
  Naver 5.3(허용)에 정합. 이 둘은 이번 유닛에서 완결. (c) 1글자명 4건(var-lower-camelcase)은 네이밍 사안 → Naver 2.13
  짧은 스코프 임시변수(람다·catch·comparator)면 `// @checkstyle:ignore`로 정당화, 넓은 스코프면 의미명 리네임.
  코드리뷰(홀드) 대상 로직은 불변경, 최소 처리.
- 이유: 정본은 Naver 표준(D-075). 룰 완화는 표준 훼손 → 포맷터를 표준에 맞추는 게 정합. 네이밍은 포맷과 성격이 달라 스코프 기준 개별 판단.
- 후속: 그린화(checkstyle 위반 0) 후 maxWarnings 0 강제 유지. 1글자명 최종 정리는 코드리뷰 반영 단계와 조율. .gitattributes(*.java eol=lf) 추가(CRLF 재발 방지).

---

## B-023. 테스트 메서드명 한국어 허용 — *Test.java suppress (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-020·B-022, D-075, CLAUDE.md 언어 규약(주석·테스트 한국어). 015 이슈1
- 결정: Naver `MethodName`(^[a-z]...)·`AbbreviationAsWordInName`을 `*Test.java`에 한해 naver-checkstyle-suppressions.xml로
  제외. 프로덕션 코드는 그대로 강제(메인 enforcement 불변).
- 이유: 테스트 메서드명 한국어는 CLAUDE.md 언어 규약 + 국내 실무 관례(가독성). Naver 2.9도 테스트 메서드명 예외
  (언더스코어)를 인정. suppressions는 Naver 공식 제외 메커니즘(B.6). 테스트 스코프 한정이라 룰 완화(B-022 금지)가
  아니라 룰 적용 범위를 프로젝트 컨벤션에 정합시키는 것.
- 기각된 대안: 테스트명 영어화(CLAUDE.md 언어 규약 위배 + 15파일 대규모 변경 + 가독성 손실), `MethodName` 전역
  완화(프로덕션 enforcement 훼손).
- 후속: 새 세션은 CLAUDE.md 언어 규약대로 한글 테스트명 작성 → suppressions로 자동 통과. two-way door.

---

## B-024. signup 중복 409 정합 — 제약 위반 예외 매핑 (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to api-contract §2(AUTH_001/002), B-015. 코드리뷰 M1(병합 차단)
- 결정: signup 중복은 (1) `existsBy` 선검사(UX 빠른 409, 일반 케이스) + (2) save 시 `DataIntegrityViolationException`
  catch로 UK 위반을 구분해 AUTH_001(loginId)/AUTH_002(nickname) 재던짐(경쟁·더블클릭 TOCTOU 안전망). 이중 방어.
- 이유: check-then-save는 동시 요청에 TOCTOU → 둘 다 save → DB UK 위반 → 전역 미매핑 500(계약 409 위반).
  전역 핸들러만으론 어느 UK인지 구분 불가 → 서비스가 컨텍스트로 구분. 선검사 유지로 일반 케이스 빠른 실패,
  제약 안전망으로 경쟁 케이스 정합.
- 기각된 대안: 선검사만(경쟁 시 500 잔존), 전역 `DataIntegrityViolationException`→409 단일 매핑(어느 필드
  중복인지 구분 불가), 락 직렬화(과설계).
- 후속: UK 제약명(uk_user_login_id/uk_user_nickname)으로 구분. 수정 Claude Code backend/outbox/017.

---

## B-025. refresh 만료 정책 — 회전 슬라이딩 현행 + 절대 상한 보안게이트2 이월 (2026-07-14) [ACCEPTED]

- 소유: 백엔드 / 관련: relates-to B-011·B-013, SEC-006. 코드리뷰 m1. 보안 게이트2 검토 대상
- 결정: 현 rotate는 회전마다 TTL을 refreshExpDays로 리셋 = 슬라이딩 만료(현행 동작 명문화). 절대 상한(iat 기준
  max lifetime) 도입 여부·기간은 보안 게이트2에서 확정. 현 단계 구현 변경 없음.
- 이유: 자금 시스템에서 슬라이딩만으론 refresh 세션 무기한 연명 우려(탈취 refresh가 정상 회전을 이어가면).
  절대 상한이 표준(OAuth absolute+sliding 병행)이나 상한 기간은 보안 정책이고 iat 저장 등 스토어 변경 수반 →
  정책 확정 선행. 재사용 탐지(B-011)가 부분 방어.
- 기각된 대안: 지금 절대 상한 임의 도입(정책값·구현 미정), 회전 시 잔여 TTL 유지(재로그인 빈도 급증·UX 저하).
- 후속: 보안 게이트2 확정 시 B-013 연장 갱신 or 신규 발번. 절대 상한 도입 시 rotate에 iat 검증 추가.

---
