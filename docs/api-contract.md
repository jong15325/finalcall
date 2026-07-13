# FinalCall API Contract (계약서)

상태: DRAFT v0 — G3 미승인 (기획 초안 → 총괄 검수 + 보안 게이트 1(D-013) + 사용자 승인 → v1 확정)
소유: 기획/설계 (변경은 확정 후 6절 절차)
근거: domain-spec v0.3, erd v0.2, D-035(형식 골격)·D-002(auth 우선)·D-065·B-004~009(기술 규약)
버전 규칙: G3 확정 = v1. 이후 변경은 계약 변경 절차(collaboration-guide 6절) 경유 + v+1.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0 | 2026-07-13 | 골격 착수 — 공통 규약 + auth 섹션. 리소스 엔드포인트는 후속 |

---

## 1. 공통 규약 (B-004~007)

계약 전체에 적용되는 규약. 개별 엔드포인트는 이 규약을 전제로 요청/응답만 기술한다.

### 1.1 URL·버전·식별자 (B-004)
- Base: `/api/v1`. 버전은 URI 경로 버저닝.
- 리소스는 복수형 명사: `/auctions`, `/shops`, `/bids`, `/items`, `/orders`, `/charges`, `/users`.
- 종속 리소스는 1단 중첩까지: `/auctions/{auctionId}/bids`.
- 상태 전이 액션은 동사 URL을 최소화하고 하위 리소스/필드로 표현(불가피할 때만 동사).
- 외부 노출 식별자는 `public_id`(ULID)를 URL·응답에 사용. 내부 `id`(BIGINT)는 노출하지 않는다.

### 1.2 인증·인가 (D-065, B-009)
- 서비스 자체 JWT. `Authorization: Bearer <accessToken>`.
- 사용자 식별은 서버가 토큰을 검증해 SecurityContext에서 얻는다. `X-User-Id` 등 헤더 신뢰 없음.
- 인증 필요 엔드포인트는 각 절 "인증: 필요"로 표기. 미인증 시 401, 권한 부족 시 403.
- 관리자 전용은 "인증: 필요(관리자)".

### 1.3 페이징·정렬·필터 (B-005~007)
- 목록 기본 페이징은 cursor(실시간 목록), 관리·소규모는 offset 예외.
  - cursor 요청: `?cursor=<opaque>&size=<n>`. 응답 `data: { content:[...], nextCursor: "<opaque>|null", hasNext: <bool> }`.
  - offset 요청: `?page=<n>&size=<n>`. 응답 `data: { content:[...], page, size, totalElements, totalPages }`.
- 정렬: `?sort=<field>,<asc|desc>` (다중 허용). 필드는 엔드포인트별 화이트리스트(ERD 인덱스와 1:1, B-006).
- 필터: 명명 파라미터 + 화이트리스트. 범위는 `minXxx`/`maxXxx`, enum 값은 대문자.

### 1.4 응답 envelope (B-007)
- 성공: `{ "success": true, "data": <object|null>, "timestamp": "<ISO-8601 UTC>" }`.
- 에러: `{ "success": false, "code": "<DOMAIN_NNN>", "message": "<사람용>", "errors": [ {field, reason} ]?, "timestamp": "..." }`.
  - `errors`는 검증 실패 시에만 포함.
  - `code`는 도메인 ErrorCode(`{DOMAIN}_{3자리}`), HTTP status는 별도. 공통 예: `COMMON_004 LOCK_ACQUISITION_FAILED` → 409.
- 시간 표기는 ISO-8601 UTC(Instant).

### 1.5 상태 코드 관례
- 200 조회/갱신, 201 생성, 204 본문 없음. 400 검증, 401 미인증, 403 권한, 404 없음, 409 상태 충돌(이미 종료·중복 선점·락 실패), 422 도메인 규칙 위반.

---

## 2. 인증 (auth) — D-002 우선

인증 API는 도메인보다 먼저 확정해 프론트에 전달한다. JWT 스켈레톤 기준(HS256, access 만료 CLAUDE.md).

### POST /api/v1/auth/signup — 회원가입
- 인증: 불요
- 요청(body): `{ loginId, password, nickname }`
- 응답 201: `{ userPublicId, nickname }`
- 에러: `AUTH_001` 중복 loginId(409), `AUTH_002` 중복 nickname(409), 검증 400

### POST /api/v1/auth/login — 로그인
- 인증: 불요
- 요청(body): `{ loginId, password }`
- 응답 200: `{ accessToken, refreshToken, accessExpiresAt }`
- 에러: `AUTH_003` 자격 불일치(401)

### POST /api/v1/auth/refresh — 액세스 토큰 재발급
- 인증: 불요(refreshToken으로 검증)
- 요청(body): `{ refreshToken }`
- 응답 200: `{ accessToken, accessExpiresAt }`
- 에러: `AUTH_004` refresh 만료·무효(401)

### POST /api/v1/auth/logout — 로그아웃
- 인증: 필요
- 동작: refreshToken 무효화(서버 보관 시). 응답 204
- 비고: 토큰 보관·회전 전략(무상태 vs 서버 저장)은 보안 게이트 1(D-013)에서 검토.

주: 회원 프로필·잔액 조회 등 user 리소스 엔드포인트는 3절(후속)에서 기술.

---

## 3. 경매·고정가·입찰 (후속)

## 4. 아이템·인벤토리·주문·화폐 (후속)

## 5. 공통 에러코드 표 (후속)

도메인별 `{DOMAIN}_{NNN}` 코드와 HTTP status 매핑을 엔드포인트 확정과 함께 정리한다.
