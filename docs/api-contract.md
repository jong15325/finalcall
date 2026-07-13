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

## 3. 경매·고정가·입찰

공통 목록 필터(경매·고정가·아이템 검색 공유, ERD 인덱스·§7.7 정합): `mainCategory, subGroup, element, kind, grade, minLevel/maxLevel, skill1/skill2(스킬 코드), goldforceActive(bool), minPrice/maxPrice, status`. 정렬 화이트리스트: `price, endAt, createdAt, highestBidAmount`(경매), `price, endAt, createdAt`(고정가). 목록은 cursor 기본.

### 3.1 경매 (auction)

POST /api/v1/auctions — 경매 등록
- 인증: 필요(판매자 = 등록자)
- 요청(body): `{ itemInstancePublicId, startPrice, buyNowPrice?, startAt?, endAt, softCloseWindowSec?, softCloseExtendSec?, maxEndAt }`
- 동작: 아이템을 인벤토리→출품 에스크로(location LISTED)로 CAS 이동(중복 출품 차단). SCHEDULED(startAt 있으면)/ACTIVE로 생성.
- 응답 201: `{ auctionPublicId, status, endAt }`
- 에러: `AUCTION_001` 아이템 미소유·미보유(403/409), `AUCTION_002` 이미 출품중(409), `AUCTION_003` buyNowPrice ≤ startPrice(422)

GET /api/v1/auctions — 경매 목록
- 인증: 불요
- 쿼리: 공통 목록 필터 + 페이징(cursor)/정렬
- 응답 200: cursor 페이지(`content`: 경매 요약 + item 표시 스냅샷)

GET /api/v1/auctions/{auctionPublicId} — 경매 상세
- 인증: 불요
- 응답 200: 경매 상세 + 현재 최고가·최고입찰자(마스킹)·남은 시간 + item 스냅샷
- 에러: `AUCTION_004` 없음(404)

POST /api/v1/auctions/{auctionPublicId}/bids — 입찰 (bid)
- 인증: 필요
- 요청(body): `{ amount }`
- 동작: 경매 단위 직렬화(D-008). 검증 통과 시 게임머니 홀드(에스크로), 직전 최고입찰자 홀드 즉시 해제(P-008), 소프트클로즈 연장 판단(동일 단위). 최고가 갱신.
- 응답 201: `{ bidPublicId, amount, currentHighestAmount, endAt }`
- 에러: `BID_001` 최소 증분 미달(422), `BID_002` buyNowPrice 이상(422), `BID_003` 자기 경매 입찰(403), `BID_004` 연속(현재 최고가 보유자) 입찰(409), `BID_005` 게임머니 잔액 부족(422), `BID_006` 마감/종료됨(409)

GET /api/v1/auctions/{auctionPublicId}/bids — 입찰 내역
- 인증: 불요(입찰자 식별은 마스킹)
- 응답 200: offset 페이지(입찰 이력)

POST /api/v1/auctions/{auctionPublicId}/purchase — 즉시구매(buyNow)
- 인증: 필요
- 동작: 종료성 CAS 단일 승자(SOLD, resultType=BUYNOW). Order 생성·정산·소유 이전 단일 TX(D-053).
- 응답 201: `{ orderPublicId, finalPrice }`
- 에러: `AUCTION_005` 즉시구매 미설정(422), `AUCTION_006` 이미 종료(409), `BID_005` 잔액 부족(422)

POST /api/v1/auctions/{auctionPublicId}/cancel — 판매자 취소
- 인증: 필요(판매자 본인). 관리자 강제 취소는 별도 관리자 API(4절).
- 동작: 입찰 0건 & ACTIVE일 때만 CANCELLED. 아이템 에스크로 해제(인벤토리 복귀, 만실 시 임시보관).
- 응답 200: `{ status }`
- 에러: `AUCTION_007` 입찰 존재로 취소 불가(409), `AUCTION_006` 이미 종료(409)

### 3.2 고정가 (shop)

POST /api/v1/shops — 고정가 등록
- 인증: 필요(판매자)
- 요청(body): `{ itemInstancePublicId, price, endAt? }`
- 동작: 아이템 출품 에스크로(LISTED) CAS 이동. ACTIVE 생성.
- 응답 201: `{ shopPublicId, status }`
- 에러: `SHOP_001` 아이템 미소유·미보유(403/409), `SHOP_002` 이미 출품중(409)

GET /api/v1/shops — 고정가 목록
- 인증: 불요
- 쿼리: 공통 목록 필터 + 페이징(cursor)/정렬
- 응답 200: cursor 페이지

GET /api/v1/shops/{shopPublicId} — 고정가 상세
- 인증: 불요
- 응답 200: 상세 + item 스냅샷 / 에러 `SHOP_003` 없음(404)

POST /api/v1/shops/{shopPublicId}/purchase — 구매
- 인증: 필요
- 동작: 원자적 선점 CAS 단일 승자(SOLD). Order 생성·정산·소유 이전 단일 TX(D-053).
- 응답 201: `{ orderPublicId, finalPrice }`
- 에러: `SHOP_004` 이미 판매/종료(409), `SHOP_005` 게임머니 잔액 부족(422)

POST /api/v1/shops/{shopPublicId}/cancel — 판매자 취소
- 인증: 필요(판매자 본인)
- 동작: ACTIVE(미판매)일 때 CANCELLED. 아이템 에스크로 해제(인벤토리 복귀, 만실 시 임시보관).
- 응답 200: `{ status }` / 에러 `SHOP_004` 이미 종료(409)

## 4. 아이템·인벤토리·주문·화폐 (후속)

## 5. 공통 에러코드 표 (후속)

도메인별 `{DOMAIN}_{NNN}` 코드와 HTTP status 매핑을 엔드포인트 확정과 함께 정리한다.
