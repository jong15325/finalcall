# FinalCall API Contract (계약서)

상태: v1.7 — G3 확정(2026-07-14) + 6절 계약 변경 7건(D-070, D-073, 엣지 오류 명세/057, 회원 리소스 공백 보완/069, 게이트2 탈퇴 주체 401/COMMON_005, EPIC-ITEM ITEM_003 등재, EPIC-AUCTION 게이트2 AUCTION_001 403단일·취소 SCHEDULED|ACTIVE 정밀화). 이후 변경은 계약 변경 절차(`common/rules.md [6]`) 경유 + v+1.
소유: 기획/설계 (변경은 확정 후 6절 절차)
근거: domain-spec v0.5, erd v0.7, D-035(형식 골격)·D-002(auth 우선)·D-065·B-004~009(기술 규약)
버전 규칙: G3 확정 = v1. 이후 변경은 계약 변경 절차(`common/rules.md [6]`) 경유 + v+1.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0 | 2026-07-13 | 골격 착수 — 공통 규약 + auth 섹션 |
| v0.1 | 2026-07-13 | 전 섹션 초안 완성 — §3 경매·고정가·입찰, §4 아이템·인벤토리·주문·화폐, §5 에러코드. G3 검수 대기 |
| v0.2 | 2026-07-14 | 보안 게이트 1 findings 반영 — SEC-001·002(충전 confirm 인증·서버검증·pg_tx_id 멱등), SEC-003(자기구매 차단), SEC-004(교환 멱등키), SEC-006(토큰 회전), SEC-007(열거 완화), SEC-009(시간 검증) + item_template 식별자 typeCode 통일(035). 보안 델타 재확인 대기 |
| v1 | 2026-07-14 | G3 확정 — 총괄 검수 + 보안 게이트 1(S-002) + 사용자 승인. 설계 3종 확정, 구현(G4-n) 진입. 이후 변경은 6절 절차 |
| v1.1 | 2026-07-14 | 6절 계약 변경 — §2 /refresh 응답에 refreshToken 추가 + 회전 정책(1회성·재사용 탐지) 명시. 사유: D-070/SEC-006(refresh 회전 구현 정합) |
| v1.2 | 2026-07-14 | 6절 계약 변경 — 등급 필터 제거(D-073), §3.3 목록/상세 응답 스키마 구체화(a안). 사유: 원게임 무등급 + 프론트·QA 단일 진실 |
| v1.3 | 2026-07-14 | 6절 계약 변경 — §1.6 게이트웨이 엣지 오류 응답 명세 추가(429 rate limit·403 직접접근 차단을 서비스 envelope로 통일) + §5 GATEWAY_* 코드. 사유: D-068 엣지 게이트웨이 429 포맷 통일, 총괄 056(안건1 A)·지시 057 |
| v1.4 (메타 정정, 2026-07-14) | — | **내용 무변경·버전 미상향.** 근거 줄 참조 버전 전사 누락 정정(domain-spec v0.3→v0.5, erd v0.2→v0.7). 엔드포인트·스키마·에러코드 무변경이라 6절 대상 아님(총괄 090 승인). 전파 불요 |
| v1.4 | 2026-07-14 | 6절 계약 변경 — §2.5 회원 리소스 신설(GET/PATCH/DELETE `/me`) + §2 제목 "인증·회원" + `MEMBER_001`·`MEMBER_002` §5 등재 + §2 말미 전방 참조 미이행 정정("3절" → §2.5·§4.4). 사유: 회원 프로필·수정·탈퇴 계약 부재(backend/022 발견, 068 승인, 지시 069). 탈퇴 잔액 소멸 동의 = D-080 |
| v1.5 | 2026-07-17 | 6절 계약 변경 — §2.5 GET·PATCH·DELETE `/me` 탈퇴(soft delete) 주체가 만료 전 access로 호출한 경우를 401 `COMMON_005`(세션 무효)로 명시. 미인증·만료 토큰 401과 동일 코드·포맷이라 탈퇴 여부가 응답으로 드러나지 않는다. 사유: 게이트2 승인 — 회원 열거 방지(SEC-007) |
| v1.6 | 2026-07-18 | 6절 계약 변경 — §5에 `ITEM_003`(relocate 대상 아이템이 임시보관 TEMP 상태 아님, 409) 등재 + §4.2 relocate 에러 목록에 반영. 사유: EPIC-ITEM 구현 정합(FC-022 신설 코드, 도메인 enum↔계약 1:1 규약 · 프론트 분기 명확). 총괄 등재 승인 |
| v1.7 | 2026-07-18 | 6절 계약 변경 — EPIC-AUCTION 게이트2(FC-025) 결정 반영: (f) §3.1 등록·§5 `AUCTION_001`을 "403/409" → **403 단일**로 정밀화(미소유·미보유·미존재 통일, enum↔계약 1:1 + SEC-007 열거 방지; "이미 출품중"만 `AUCTION_002` 409). (G6) §3.1 취소 대상 상태를 "ACTIVE만" → **"SCHEDULED\|ACTIVE & 입찰0(highest_bidder_id IS NULL)"**로 정밀화(예약 경매 에스크로 잠김 해소, domain-spec §5 정합). 사유: 게이트2 승인(2026-07-18), auction-domain-spec v0.2 |

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

### 1.6 게이트웨이 엣지 오류 (D-068, 057)
엣지 게이트웨이(SCG)가 서비스 도달 전에 반환하는 오류도 서비스와 동일한 에러 envelope(1.4)로 통일한다. 클라이언트가 엣지/서비스 오류를 구분 처리하지 않도록 하기 위함이다(총괄 056 안건1 A).
- 형식: `{ "success": false, "code": "GATEWAY_NNN", "message": "<사람용>", "timestamp": "<ISO-8601 UTC>" }`. `errors`는 미포함(필드 검증 오류는 서비스 전용).
- `code`는 `GATEWAY_` 프리픽스의 엣지 발생 코드로, 도메인 ErrorCode enum과 1:1 대상이 아니다(엣지 예외 — 5절 주석). 게이트웨이가 직접 세팅한다. envelope 포맷 자체는 서비스와 동일하며 변경하지 않는다.
- 엣지 오류 목록:
  - `GATEWAY_429` rate limit 초과(인증 계열 등, SEC-005) → 429. 재시도 대기를 위해 `Retry-After` 헤더를 동반한다.
  - `GATEWAY_403` 게이트웨이 미경유 직접접근 차단(X-Gateway-Token 불일치, 서비스측 GatewayAccessFilter) → 403. 정상 경유 클라이언트는 만나지 않으며, QA·보안의 음성 테스트 기준으로만 명세한다(프론트 별도 처리 불요).

---

## 2. 인증·회원 (auth · member) — D-002 우선

인증 API는 도메인보다 먼저 확정해 프론트에 전달한다. JWT 스켈레톤 기준(HS256, access 만료 CLAUDE.md).

토큰 전략(SEC-006 확정): access는 무상태 JWT(짧은 만료). refresh는 서버 저장(해시된 값)·재발급 시 회전(이전 refresh 폐기)·재사용 탐지 시 해당 세션 무효화. logout은 refresh 무효화 필수. 자금 시스템이라 탈취·로그아웃 대응이 가능한 서버 저장 방식을 채택한다.

요청 제한(SEC-005): 인증 계열(login·signup·refresh)은 엣지 게이트웨이(SCG, D-068)의 rate limit이 담당한다(앱 레벨 rate limit off 유지, CLAUDE.md E2). 계약 무영향.

### POST /api/v1/auth/signup — 회원가입
- 인증: 불요
- 요청(body): `{ loginId, password, nickname }`
- 응답 201: `{ userPublicId, nickname }`
- 에러: `AUTH_001` 중복 loginId(409), `AUTH_002` 중복 nickname(409), 검증 400
- 회원 열거 방지(SEC-007): loginId 존재 여부가 무차별 열거되지 않도록 가입 실패 응답은 구체 사유를 최소화하고, 게이트웨이 rate limit(D-068)로 시도를 제한한다. nickname 중복은 표시용이라 유지.

### POST /api/v1/auth/login — 로그인
- 인증: 불요
- 요청(body): `{ loginId, password }`
- 응답 200: `{ accessToken, refreshToken, accessExpiresAt }`
- 에러: `AUTH_003` 자격 불일치(401)

### POST /api/v1/auth/refresh — 액세스 토큰 재발급
- 인증: 불요(refreshToken으로 검증)
- 요청(body): `{ refreshToken }`
- 응답 200: `{ accessToken, refreshToken, accessExpiresAt }` (회전된 신규 refreshToken 포함)
- 회전(SEC-006, D-070): 재발급마다 이전 refreshToken을 폐기(1회성 회전)하고 신규 refreshToken을 발급한다. 폐기된 토큰 재사용이 탐지되면 해당 refresh 세션을 무효화한다.
- 에러: `AUTH_004` refresh 만료·무효·재사용(401)

### POST /api/v1/auth/logout — 로그아웃
- 인증: 필요
- 동작: refreshToken 무효화(서버 저장분 폐기 필수, SEC-006). 응답 204

### 2.5 회원 리소스 (member) — 069, v1.4

계정 생애주기 중 가입·인증은 위 2절이 담당하고, 이 절은 나머지(프로필 조회·수정·탈퇴)를 규정한다. **잔액 조회는 화폐 관심사라 §4.4 `GET /me/balance`에 두며 여기서 중복 명세하지 않는다.** 도메인 규칙 근거는 domain-spec §6.1.

주(v1.4 정정): v1.3까지 이 자리에 있던 "user 리소스 엔드포인트는 3절(후속)에서 기술"은 **전방 참조 미이행**이었다(§3은 경매·고정가·입찰). 본 절이 그 참조를 이행한다 — 프로필·수정·탈퇴는 §2.5, 잔액은 §4.4.

주(v1.5, 게이트2): 아래 세 엔드포인트(GET·PATCH·DELETE `/me`)는 인증 필요이며, 토큰은 유효하나 주체가 탈퇴(soft delete)된 계정이 만료 전 access로 호출한 경우 **401 `COMMON_005`**(세션 무효)로 응답한다. 미인증·만료 토큰 401과 **동일 코드·포맷**이라 탈퇴 여부가 응답으로 드러나지 않는다(회원 열거 방지, SEC-007). 세 엔드포인트 공통이므로 각 "에러:" 줄에서 반복하지 않는다.

#### GET /api/v1/me — 내 프로필 조회
- 인증: 필요
- 응답 200: `{ userPublicId, nickname, isAdmin, createdAt }`
- 노출 범위: `loginId`·`passwordHash`는 응답에 싣지 않는다(노출 이득 없음, 열거 리스크 SEC-007). `isAdmin`은 관리자 UI 노출 제어용으로 포함하되 **인가는 서버 권위**다(§1.2 — 클라 플래그는 표시 제어일 뿐).
- 타인 프로필 조회(`/users/{publicId}`)는 **범위 밖**이다. 목록·상세의 소유자·최고입찰자 마스킹(§3.3)과 상충하고 회원 열거 노출면(SEC-007)을 넓힌다(domain-spec §6.1).
- 에러: 401(미인증)

#### PATCH /api/v1/me — 프로필 수정 (nickname 한정)
- 인증: 필요
- 요청(body): `{ nickname }` — 수정 가능 필드는 nickname뿐이다. 비밀번호 변경은 범위 밖(별도 안건).
- 응답 200: `{ userPublicId, nickname, isAdmin, createdAt }` (조회와 동일 스키마)
- 변경 빈도 제한 없음(domain-spec §6.1)
- 에러: `MEMBER_001` 닉네임 중복(409), 검증 400, 401(미인증)

#### DELETE /api/v1/me — 탈퇴 (soft delete)
- 인증: 필요
- 요청(body): `{ balanceForfeitAcknowledged: true }` — 잔존 잔액 소멸·복구 불가에 대한 **명시 동의**(D-080). 미동의·누락 시 400. 잔액이 0이어도 필드는 필수다(클라 분기 제거·감사 추적 일관성).
- 응답 204
- 동작: soft delete + **refresh 세션 전부 폐기**(SEC-006 — 탈퇴 후 잔여 세션으로 접근 불가). 잔존 캐시·게임머니는 소멸하며 복구되지 않는다(D-080, 환불·역환전은 범위 밖).
- 차단 조건: 진행 중 경매(판매자)·홀드 보유 입찰·미완료 주문이 하나라도 있으면 `MEMBER_002`(409). 잔액 잔존은 **차단 사유가 아니다**(D-080).
- 재가입: login_id·nickname 재사용 허용(domain-spec §6.1, erd 1절 soft delete UK 규약)
- 에러: `MEMBER_002` 진행 중 거래 보유(409), 400(동의 누락), 401(미인증)

---

## 3. 경매·고정가·입찰

공통 목록 필터(경매·고정가·아이템 검색 공유, ERD 인덱스·§7.7 정합): `mainCategory, subGroup, element, kind, minLevel/maxLevel, skill1/skill2(스킬 코드), goldforceActive(bool), minPrice/maxPrice, status`. (등급 필터 없음 — D-073) 정렬 화이트리스트: `price, endAt, createdAt, highestBidAmount`(경매), `price, endAt, createdAt`(고정가). 목록은 cursor 기본.

### 3.1 경매 (auction)

POST /api/v1/auctions — 경매 등록
- 인증: 필요(판매자 = 등록자)
- 요청(body): `{ itemInstancePublicId, startPrice, buyNowPrice?, startAt?, endAt, softCloseWindowSec?, softCloseExtendSec?, maxEndAt }`
- 동작: 아이템을 인벤토리→출품 에스크로(location LISTED)로 CAS 이동(중복 출품 차단). SCHEDULED(startAt 있으면)/ACTIVE로 생성.
- 서버 검증(SEC-009): `endAt > now`, `startAt ≤ endAt`(startAt 있으면), `maxEndAt ≥ endAt`, `softCloseWindowSec·softCloseExtendSec`는 양수·상한 이내. 위반 시 422.
- 응답 201: `{ auctionPublicId, status, endAt }`
- 에러: `AUCTION_001` 아이템 미소유·미보유·미존재(403), `AUCTION_002` 이미 출품중(409), `AUCTION_003` buyNowPrice ≤ startPrice(422), `AUCTION_008` 시간 파라미터 위반(422)
  - 주(v1.7, EPIC-AUCTION 게이트2): `AUCTION_001`은 **403 단일**이다. 미소유(not-owner)·미보유(소유하나 인벤토리에 없음, 예: TEMP)·미존재(item-not-found)를 403으로 통일한다 — 도메인 ErrorCode enum ↔ 계약 1:1(§5) 준수 + 소유·보유 여부가 403/409 차이로 누설되지 않게(SEC-007 열거 방지). "이미 출품중"(LISTED 상태 충돌)만 `AUCTION_002` 409로 분리한다(상태 충돌 노출은 무해).

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
- 규칙(SEC-003): 판매자 본인 구매 금지(입찰 BID_003 대칭, wash trade 방지).
- 응답 201: `{ orderPublicId, finalPrice }`
- 에러: `AUCTION_005` 즉시구매 미설정(422), `AUCTION_006` 이미 종료(409), `AUCTION_009` 판매자 자기구매(403), `BID_005` 잔액 부족(422)

POST /api/v1/auctions/{auctionPublicId}/cancel — 판매자 취소
- 인증: 필요(판매자 본인). 관리자 강제 취소는 별도 관리자 API(4절).
- 동작: 입찰 0건 & (SCHEDULED | ACTIVE)일 때만 CANCELLED. 아이템 에스크로 해제(인벤토리 복귀, 만실 시 임시보관).
  - 주(v1.7, EPIC-AUCTION 게이트2): 취소 대상 상태를 **SCHEDULED|ACTIVE**로 정밀화한다(종전 "ACTIVE만" → 예약 경매의 에스크로가 startAt 도달 전까지 묶이는 문제 해소, domain-spec §5 "SCHEDULED|ACTIVE→CANCELLED" 정합). "입찰 0건" 판정은 `highest_bidder_id IS NULL` 앵커(입찰=EPIC-BID). 종료 상태(SOLD/UNSOLD/CANCELLED)면 `AUCTION_006`.
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
- 규칙(SEC-003): 판매자 본인 구매 금지(wash trade 방지).
- 응답 201: `{ orderPublicId, finalPrice }`
- 에러: `SHOP_004` 이미 판매/종료(409), `SHOP_005` 게임머니 잔액 부족(422), `SHOP_006` 판매자 자기구매(403)

POST /api/v1/shops/{shopPublicId}/cancel — 판매자 취소
- 인증: 필요(판매자 본인)
- 동작: ACTIVE(미판매)일 때 CANCELLED. 아이템 에스크로 해제(인벤토리 복귀, 만실 시 임시보관).
- 응답 200: `{ status }` / 에러 `SHOP_004` 이미 종료(409)

### 3.3 응답 스키마 — 목록/상세 (6절, D-073)

목록/상세 응답의 구체 필드(프론트·QA·디자인 단일 진실). erd 필드·표시 스냅샷 기준. 등급 없음(D-073). 소유자·최고입찰자는 마스킹, 골드포스는 만료시각(활성/잔여는 클라 파생).

item 블록(공통):
```
item: { typeCode, mainCategory, subGroup, element, kind, level,
        skill1?, skill2?, skillPercent, goldforceExpireAt?,
        nameSnapshot, specSnapshot }
```

AuctionSummary (GET /auctions content 항목):
```
{ auctionPublicId, status, item, startPrice, buyNowPrice?,
  highestBidAmount?, bidCount, startAt?, endAt, sellerNickname }
```
AuctionDetail (GET /auctions/{id}): AuctionSummary + `{ resultType?, highestBidderMasked?, extensionCount, maxEndAt, createdAt }`

ShopSummary (GET /shops content 항목):
```
{ shopPublicId, status, item, price, endAt?, sellerNickname }
```
ShopDetail (GET /shops/{id}): ShopSummary + `{ createdAt }`

주: item.nameSnapshot/specSnapshot은 등록 시점 스냅샷(D-045). 실시간 값(현재 소유자 등)은 상세에서 마스킹 노출. 필드 추가는 6절 절차.

## 4. 아이템·인벤토리·주문·화폐

`me` 접두는 인증 주체(SecurityContext) 기준 리소스다.

### 4.1 아이템·시세

GET /api/v1/item-templates — 아이템 정의 카탈로그(검색 메타)
- 인증: 불요
- 쿼리: `mainCategory, subGroup, element, kind`(필터, 등급 없음 D-073)
- 응답 200: offset 페이지(템플릿 = 대분류·중분류·속성·종류·표시명·typeCode)
- 용도: 검색 필터 UI 구성, 원게임 시드 기준(D-067)
- 비고(035 관찰): item_template 외부 식별자는 `typeCode`(고정 시드·유일 조합). public_id를 별도로 두지 않는다 — erd와 일치.

GET /api/v1/items/{itemInstancePublicId} — 아이템 인스턴스 상세
- 인증: 불요(공개 범위) / 소유자 부가정보는 인증 시 노출
- 응답 200: 템플릿·레벨·스킬1/2·발동확률·골드포스 만료·현재 위치(공개 가능한 범위) + 소유자(마스킹)
- 에러: `ITEM_001` 없음(404)

GET /api/v1/market-prices — 시세 집계 조회
- 인증: 불요
- 쿼리: `typeCode, level, skill1?, skill2?` — 시세 집계 단위(D-044 조건, §7.7). item_template 참조는 typeCode(035)
- 응답 200: `{ key:{template,level,skill1,skill2}, avgPrice, minPrice, maxPrice, recentPrice, sampleCount, windowDays }`
- 비고: 집계는 sale_order 기준. 골드포스는 집계 키에서 제외(시간제, D-066) — 필터로만.

### 4.2 인벤토리

GET /api/v1/me/inventory — 내 정규 인벤토리(96칸)
- 인증: 필요
- 쿼리: `sort=slotNo,asc`(기본)
- 응답 200: `{ capacity:96, used, items:[ {itemInstancePublicId, slotNo, 요약} ] }`

GET /api/v1/me/temp-storage — 내 임시보관(오버플로우)
- 인증: 필요
- 응답 200: cursor 페이지(`items:[ {itemInstancePublicId, storedAt, expireAt?} ]`)

POST /api/v1/me/temp-storage/{itemInstancePublicId}/relocate — 임시보관→정규 슬롯 이동
- 인증: 필요(소유자)
- 요청(body): `{ slotNo? }`(미지정 시 빈 슬롯 자동 배정)
- 동작: 정규 슬롯 여유 필요. location TEMP→INVENTORY 이동(temp_storage 행 제거).
- 응답 200: `{ slotNo }`
- 에러: `INV_001` 인벤토리 만실(409), `INV_002` 슬롯 점유(409), `ITEM_002` 소유자 아님(403), `ITEM_003` 대상 아이템이 임시보관(TEMP) 상태 아님(409)

### 4.3 주문(거래)

GET /api/v1/me/orders — 내 거래 내역
- 인증: 필요
- 쿼리: `role=BUYER|SELLER, sourceType=AUCTION|SHOP`(필터), 페이징(cursor)/정렬(`createdAt`)
- 응답 200: cursor 페이지(주문 요약: 상대·아이템·최종가·정산액·시각)

GET /api/v1/orders/{orderPublicId} — 주문 상세
- 인증: 필요(구매자·판매자 당사자만)
- 응답 200: 주문 상세(출처·아이템·최종가·수수료·정산액·상태)
- 에러: `ORDER_001` 없음(404), `ORDER_002` 당사자 아님(403)

### 4.4 화폐(잔액·충전·교환)

GET /api/v1/me/balance — 내 잔액
- 인증: 필요
- 응답 200: `{ cashBalance, gameMoneyBalance, gameMoneyHeld, gameMoneyAvailable }`

POST /api/v1/charges — 캐시 충전 시작(토스 테스트 결제)
- 인증: 필요
- 요청(body): `{ amount }`
- 응답 201: `{ chargePublicId, amount, paymentClientKey, status:"READY" }`
- 비고: 결제창 연동은 클라이언트. 실제 캐시 반영은 승인 콜백에서.

POST /api/v1/charges/confirm — 충전 승인 처리
- 인증: 필요(호출자 JWT) + charge 소유자 검증(`charge.user_id == 호출자`, SEC-002)
- 요청(body): `{ paymentKey, chargePublicId }` (클라이언트 amount는 받지 않거나 대조용일 뿐 근거 아님)
- 동작(SEC-001·002): 토스 서버-투-서버 승인 API(시크릿 키)로 승인·금액을 재조회해 확정한다(클라이언트 amount 신뢰 금지). 캐시 반영은 `pg_tx_id`(=paymentKey) 기준 멱등 — `charge.pg_tx_id` UK로 동일 승인 재반영을 DB에서 차단. 거래 TX와 분리(D-053).
- 응답 200: `{ status:"APPROVED", cashBalance }`
- 에러: `CHARGE_001` 승인 검증 실패(422), `CHARGE_002` 금액 불일치(토스 승인액과 charge 불일치, 422), `CHARGE_003` 충전 소유자 불일치(403). 중복 승인은 200(멱등 no-op)

GET /api/v1/me/charges — 충전 내역
- 인증: 필요 / 응답 200: cursor 페이지

POST /api/v1/exchanges — 캐시↔게임머니 교환
- 인증: 필요
- 요청(header): `Idempotency-Key`(필수, SEC-004) — 동일 키 재요청은 1회만 처리(재시도 안전)
- 요청(body): `{ direction:"CASH_TO_GAME", cashAmount }` (역방향 환전은 범위 밖, domain-spec §12)
- 동작: 교환 비율 파라미터 적용(비율 ON-HOLD, 확정 전 스텁). 캐시 차감은 조건부 원자 갱신(가용 이내), 게임머니 지급. 멱등키로 이중 제출·재시도 무해화.
- 응답 201: `{ gameMoneyAmount, appliedRate }`
- 에러: `EXC_001` 캐시 잔액 부족(422), `EXC_002` 역방향 미지원(422)

### 4.5 관리자

POST /api/v1/admin/auctions/{auctionPublicId}/force-cancel — 관리자 강제 취소
- 인증: 필요(관리자)
- 동작: 상태 무관 강제 CANCELLED(정책 위반 등). 입찰 홀드 전량 해제·아이템 에스크로 해제.
- 응답 200: `{ status }` / 에러 `AUTH_005` 권한 없음(403)

## 5. 에러코드 표

`{DOMAIN}_{NNN}` 코드 ↔ HTTP status. 응답 envelope의 `code`에 실린다(1.4). 백엔드 도메인 ErrorCode enum과 1:1. 단 게이트웨이 엣지 코드(`GATEWAY_*`, 1.6)는 엣지에서 발생하므로 이 1:1 규칙의 예외다(도메인 enum 미등재).

| 코드 | 의미 | HTTP |
|---|---|---|
| COMMON_004 | 분산락 획득 실패(LOCK_ACQUISITION_FAILED) | 409 |
| COMMON_005 | 세션 무효(탈퇴 주체 등, §2.5) | 401 |
| AUTH_001 | 중복 loginId | 409 |
| AUTH_002 | 중복 nickname | 409 |
| AUTH_003 | 로그인 자격 불일치 | 401 |
| AUTH_004 | refresh 토큰 만료·무효 | 401 |
| AUTH_005 | 권한 없음(관리자 등) | 403 |
| MEMBER_001 | 닉네임 중복(프로필 수정, §2.5) | 409 |
| MEMBER_002 | 진행 중 거래 보유로 탈퇴 불가(§2.5) | 409 |
| AUCTION_001 | 아이템 미소유·미보유·미존재(출품 불가) | 403 |
| AUCTION_002 | 이미 출품중 | 409 |
| AUCTION_003 | buyNowPrice ≤ startPrice | 422 |
| AUCTION_004 | 경매 없음 | 404 |
| AUCTION_005 | 즉시구매 미설정 | 422 |
| AUCTION_006 | 이미 종료 | 409 |
| AUCTION_007 | 입찰 존재로 취소 불가 | 409 |
| AUCTION_008 | 경매 시간 파라미터 위반(SEC-009) | 422 |
| AUCTION_009 | 판매자 자기구매(즉시구매, SEC-003) | 403 |
| BID_001 | 최소 증분 미달 | 422 |
| BID_002 | buyNowPrice 이상 | 422 |
| BID_003 | 자기 경매 입찰 | 403 |
| BID_004 | 연속(최고가 보유자) 입찰 | 409 |
| BID_005 | 게임머니 잔액 부족 | 422 |
| BID_006 | 마감/종료됨 | 409 |
| SHOP_001 | 아이템 미소유·미보유 | 403/409 |
| SHOP_002 | 이미 출품중 | 409 |
| SHOP_003 | 고정가 없음 | 404 |
| SHOP_004 | 이미 판매/종료 | 409 |
| SHOP_005 | 게임머니 잔액 부족 | 422 |
| SHOP_006 | 판매자 자기구매(SEC-003) | 403 |
| ITEM_001 | 아이템 없음 | 404 |
| ITEM_002 | 소유자 아님 | 403 |
| ITEM_003 | relocate 대상 아이템이 임시보관(TEMP) 상태가 아님(§4.2) | 409 |
| INV_001 | 인벤토리 만실 | 409 |
| INV_002 | 슬롯 점유 | 409 |
| ORDER_001 | 주문 없음 | 404 |
| ORDER_002 | 당사자 아님 | 403 |
| CHARGE_001 | 승인 검증 실패 | 422 |
| CHARGE_002 | 금액 불일치(토스 승인액 대조) | 422 |
| CHARGE_003 | 충전 소유자 불일치(SEC-002) | 403 |
| EXC_001 | 캐시 잔액 부족 | 422 |
| EXC_002 | 역방향 교환 미지원 | 422 |
| GATEWAY_429 | rate limit 초과(엣지, SEC-005·D-068) | 429 |
| GATEWAY_403 | 게이트웨이 미경유 직접접근 차단(엣지) | 403 |

주: 검증 실패(형식) 400 + `errors[]`(1.4). 코드 목록은 엔드포인트 추가 시 확장.
