# 목업 설계용 정보 브리프 (design-brief)

작성: architect · 2026-07-20 · 대상 에픽: **EPIC-FE-REBUILD**(목업 정본 선행)
목적: 사용자가 목업을 그릴 때 옆에 띄워둘 실용 문서. **죽은 기능(404)을 그리지 않도록**, 그리고
**계약이 이미 내려주는 필드를 빠짐없이** 반영하도록 페이지별 정보를 정리한다.

**정본 출처**: `docs/spec/api-contract.md` v1.10 + 백엔드 컨트롤러 실측(`backend/src/**/*Controller.java`).
이 문서는 계약을 **가리키는** 요약이지 계약의 사본이 아니다. 필드가 의심되면 계약 원문·컨트롤러를 본다.

> ★ **이 문서를 만든 방식**: 계약(§2~§5)과 실제 컨트롤러 10개를 전수 대조했다. "계약에 있음"과
> "백엔드에 매핑 있음"을 갈라, 후자가 없는 것은 전부 **[미구현·404]**로 표기했다. 필드는 계약뿐
> 아니라 응답 DTO(record)까지 열어 실측했다(예: `sellerNickname` 원문 노출은 DTO에서 확인).

---

## A. 사이트 전체 지도 (페이지 인벤토리)

**분류 기준** — [구현됨]=백엔드 컨트롤러에 매핑 실재(지금 그리면 작동) / [계약·미구현]=계약엔 있으나
컨트롤러 없음(그리면 404) / [미래·백로그]=계약 밖 아이디어.

### [구현됨] — 지금 그리면 바로 작동 (13개 화면)

| 화면 | 라우트(제안) | 목적 | 뒷받침 엔드포인트 |
|---|---|---|---|
| 홈/랜딩 | `/` | 진입·경매 프리뷰·검색 유도 | `GET /auctions`(프리뷰 목록으로 재사용) |
| 경매 목록 | `/auctions` | 필터·정렬·카드 그리드 탐색 | `GET /auctions`(cursor) + `GET /item-templates`(필터 선택지) |
| 경매 상세 | `/auctions/{id}` | 아이템·현재가·입찰 | `GET /auctions/{id}`, `GET /auctions/{id}/bids` |
| 입찰(시트/모달) | 상세 내부 | 금액 입력·입찰 | `POST /auctions/{id}/bids` |
| 로그인 | `/login` | 인증 | `POST /auth/login` |
| 회원가입 | `/signup` | 계정 생성 | `POST /auth/signup` |
| 로그아웃 | (액션) | 세션 종료 | `POST /auth/logout` |
| 내 프로필/설정 | `/me` | 닉네임 조회·수정·탈퇴 | `GET/PATCH/DELETE /me` |
| 잔액/지갑 | `/me/wallet` | 캐시·게임머니·홀드 표시 + 교환 | `GET /me/balance`, `POST /exchanges` |
| 인벤토리 | `/me/inventory` | 보유 아이템 96칸 | `GET /me/inventory` |
| 임시보관 | `/me/temp-storage` | 오버플로우·정규슬롯 이동 | `GET /me/temp-storage`, `POST …/relocate` |
| 아이템 인스턴스 상세 | `/items/{id}` | 아이템 스펙·스킬(이름 포함) | `GET /items/{id}` |
| 판매(경매 등록) | `/sell/auction` | 인벤토리 아이템 출품 | `POST /auctions` |

### [계약·미구현] — 그리면 404 (호출 금지)

| 화면 | 계약 절 | 상태 | 함정 |
|---|---|---|---|
| 고정가(상점) 목록/상세/구매 | §3.2 `/shops/*` | **컨트롤러 없음** | ShopController 부재. FC-048이 계약만 보고 넣었다가 홈에 에러 배너 |
| **즉시구매 버튼** | §3.1 `POST /auctions/{id}/purchase` | **매핑 없음** | `AuctionController`에 `purchase` 없음. `buyNowPrice`는 **정보 표기로만**, 버튼 만들면 404 |
| 시세 조회 | §4.1 `/market-prices` | 컨트롤러 없음 | 시세 위젯·차트 그리지 말 것 |
| 거래(주문) 내역/상세 | §4.3 `/me/orders`, `/orders/{id}` | 컨트롤러 없음 | "구매/판매 내역" 페이지는 지금 데이터원이 없다 |
| 캐시 충전 | §4.4 `/charges`, `/charges/confirm`, `/me/charges` | 컨트롤러 없음 | 토스 결제창·충전내역 미구현. 잔액은 있으나 **채울 경로가 없음** |
| 관리자 강제취소 | §4.5 `/admin/*` | 컨트롤러 없음 | admin 화면 전체 미구현 |

> ★ 미구현 목록은 HANDOVER "★ 계약엔 있으나 미구현"과 일치한다. **버튼·링크·탭을 만들되
> 클릭 시 404가 나는 화면을 그리지 마라.** 필요하면 "준비 중" 비활성 상태로만 자리를 남긴다.

### [미래·백로그] — 계약 밖 (그리려면 게이트2/계약 변경 선행)

| 아이디어 | 근거·공백 |
|---|---|
| 자유문 검색(키워드) | 계약 목록 필터에 `q` 없음(코드 축 필터만). 검색바를 그리려면 계약 확장 |
| 인기순 정렬 | `sort` 화이트리스트에 `bidCount` 없음 → "인기순" 불가(현재 `price·endAt·createdAt·highestBidAmount`만) |
| OAuth 로그인 | 자리만 확보(메모리). 백엔드 미지원 |
| 게임 프로필/전적 | EPIC-GAME-PROFILE 백로그 |
| 타인 프로필 조회 | 계약 §2.5가 **범위 밖**으로 명시(마스킹·열거 리스크) |
| 알림(낙찰/상위입찰) | 도메인 후보(notification), 미착수 |

---

## B. 페이지별 상세

각 페이지: ① 목적 ② 표시 데이터(필드·출처) ③ 액션(결과/에러) ④ 상태 ⑤ 승계된 함정.
필드 출처 표기: `계약 §x.x` = 계약서 절, `DTO` = 실제 응답 record(백엔드 실측).

### B-1. 홈/랜딩 `/` [구현됨]

- **목적**: 첫 진입. 경매 프리뷰 몇 건 + "지금 마감 임박" 유도, 탐색 시작.
- **표시 데이터**: `GET /auctions` 프리뷰(아래 목록과 동일 `AuctionSummary`). 별도 홈 전용 엔드포인트 없음.
- **액션**: 목록으로 이동, 로그인/가입 유도(비로그인 시).
- **상태**: 로딩(스켈레톤)·빈(경매 0건)·에러(전송 실패 배너).
- **함정**: **캐시 키를 `preview`/`browse`로 분리하라**(HANDOVER 보존 이유). 홈 프리뷰가 목록 필터
  변경에 딸려 무효화되면 홈이 깜빡인다. **미구현 `/shops` 등을 홈에서 호출하지 마라**(FC-048 사고).

### B-2. 경매 목록 `/auctions` [구현됨]

- **목적**: 필터·정렬로 경매 카드 그리드 탐색. cursor 무한스크롤.
- **표시 데이터** — `AuctionSummary` (계약 §3.3 / `AuctionSummaryResponse` DTO 실측, **10필드**):

  | 필드 | 타입 | 비고 |
  |---|---|---|
  | `auctionPublicId` | string(ULID) | URL·키 |
  | `status` | enum | `SCHEDULED·ACTIVE·SOLD·UNSOLD·CANCELLED`. **lazy 파생**(SCHEDULED이고 startAt≤now면 ACTIVE로 내려옴) |
  | `item` | 객체 | 공통 item 블록(아래 C 참조, 12필드) |
  | `startPrice` | long | 시작가(현재가 아님) |
  | `buyNowPrice` | Long? | 즉시구매가. **null 가능** |
  | `highestBidAmount` | Long? | 현재 최고가. 입찰 없으면 null |
  | `bidCount` | long | 입찰 수 |
  | `startAt` | Instant? | 예약 시작. null 가능 |
  | `endAt` | Instant | 마감 시각(카운트다운 기준) |
  | `sellerNickname` | string | **★ 마스킹 없이 원문**(아래 함정) |

- **필터**(계약 §3 공통 목록 필터): `mainCategory, subGroup, element, kind, minLevel/maxLevel,
  skill1/skill2, goldforceActive, minPrice/maxPrice, status`. **`kind`는 `subGroup` 종속**(아래 C).
  필터 선택지는 `GET /item-templates`로 구성.
- **정렬**: `price, endAt, createdAt, highestBidAmount`만(화이트리스트). **인기순(bidCount) 없음.**
- **액션**: 카드 클릭→상세. 필터 적용·정렬 변경.
- **상태**: 로딩·빈결과("조건에 맞는 경매 없음")·에러·`hasNext` 무한스크롤 종료.
  성립불가 조합(마법 subGroup=3 & kind≥3)은 **에러 아니라 빈결과**.
- **함정**:
  - **FilterSheet 초점 강탈**(FC-064 C-1) — 필터 변경 시 리렌더가 매초 리렌더와 겹치면 초점 튐.
    시트는 **내부에서 닫고** 콜백을 ref로. (보존 lib에 해법 인코딩됨)
  - **시트 열고 데스크톱 폭 리사이즈 시 스크롤 잠금 잔존**(m-6). `lg:hidden`만으로 부족, 상태도 닫아야.

### B-3. 경매 상세 `/auctions/{id}` [구현됨]

- **목적**: 아이템 아트·스펙·현재가·입찰 이력 + 입찰 진입.
- **표시 데이터** — `AuctionDetail` (계약 §3.3 / `AuctionDetailResponse` DTO 실측 = Summary 10 + 7,
  **총 17필드**). Summary 필드에 더해:

  | 추가 필드 | 타입 | 비고 |
  |---|---|---|
  | `resultType` | enum? | **항상 null**(EPIC-CLOSING 미구현). 낙찰/유찰 표기에 쓰지 마라 |
  | `highestBidderMasked` | string? | 최고입찰자 마스킹(`앞2자+***`). 입찰 없으면 null |
  | `extensionCount` | int | 소프트클로즈 연장 횟수 |
  | `maxEndAt` | Instant | 연장 상한 시각 |
  | `createdAt` | Instant | 등록 시각 |
  | `minNextBidAmount` | Long? | **다음 최소 입찰가(서버 파생)**. 종료 상태면 null. ★ 클라가 증분표 복제 금지 |

- **입찰 이력** — `GET /auctions/{id}/bids`, `BidSummary`(계약 §3.3 / `BidSummaryResponse` DTO, **5필드**):
  `bidPublicId`, `bidderMasked`(마스킹), `amount`(long), `status`(`ACTIVE·OUTBID·WON`), `createdAt`.
  offset 페이징(`?page=&size=`), **정렬 `amount desc` 고정**(파라미터 없음), **size 상한 100**(서버 정규화).
  자금(홀드·잔액) 정보 없음.
- **액션**:
  - "입찰하기"→입찰 시트/모달(B-4).
  - **즉시구매 버튼 = 404**(백엔드 미구현). `buyNowPrice`는 **표기만**.
  - 판매자 본인이면 "취소"(`POST /auctions/{id}/cancel`) — 입찰 0건 & SCHEDULED|ACTIVE만 성공.
- **상태**(★ 이 화면 핵심):
  - **진행(live)**: `now < endAt` && status ACTIVE — 입찰 가능.
  - **예약(scheduled)**: status SCHEDULED && startAt>now — 입찰 시 `BID_007`(미개시).
  - **마감(ended)**: **`now >= endAt`로 클라가 판정**(★ 서버 status를 믿지 마라 — 마감 강등 워커가
    없어 endAt 지난 경매도 `status: ACTIVE`로 내려온다). 보존 lib `auctionPhase.ts`가 유일 판정처.
  - 취소(CANCELLED)·종료 상태는 `TERMINAL_STATUSES` 조기종료(안전 방향)에만 status 신뢰.
  - 비로그인: 입찰 폼 대신 "로그인하고 입찰" 유도. 판매자 본인: 입찰 폼 숨김 + 취소 노출.
- **함정(FC-064 전부 이 화면)**:
  1. **모달 초점 강탈**(C-1, critical) — 카운트다운 매초 리렌더 + 인라인 콜백 → 초점 매초 강탈 →
     모바일 키보드 닫힘. **구조로 막아라**(ref+`[open]` 의존). 규칙(useCallback 요구)은 표류한다.
  2. **금액 입력 덮어쓰기**(M-1, major·금전) — `minNextBidAmount` 변할 때 사용자 입력을 무조건
     치환하면 스나이핑 금액이 하향 치환. `refetchOnWindowFocus`면 탭 전환만으로 발동, 되돌리기 불가.
     → 프리필/사용자입력 구분, **미만일 때만 상향**, 상승은 안내로만.
  3. **비활성은 DOM 속성으로**(`disabled`/`aria-disabled`) — `opacity-50`만은 보조기술에 활성으로 노출(WCAG 4.1.2).
  4. **스킬 라벨 슬롯 번호**(m-5) — `skill1`이 null이고 `skill2`만 있으면 "스킬 1"로 오표기 금지.
     **마법(subGroup=3)은 구조적으로 skill1 없음**. 슬롯 번호 먼저 매기고 걸러라.
  5. **`minNextBidAmount`는 서버가 내려준다** — `AuctionService`·`BidService`가 같은 증분설정 사용.
     증분표를 클라에 복제하지 마라(드리프트).
  6. **입찰 응답 `endAt`은 소프트클로즈 연장 반영 후** 값 — 카운트다운 재동기화에 사용.

### B-4. 입찰 시트/모달 [구현됨]

- **목적**: 금액 입력·확인·전송.
- **표시**: 현재 최고가, `minNextBidAmount`(프리필), 잔액(가용 게임머니, `GET /me/balance`).
- **액션**: `POST /auctions/{id}/bids` `{ amount }` → 201 `{ bidPublicId, amount, currentHighestAmount, endAt }`.
- **에러코드**(계약 §3.1·§5 / `BidErrorCode` 실측 — 전문은 아래 C):
  `BID_001`(최소증분·시작가 미달 422) · `BID_002`(buyNowPrice 이상 422) · `BID_003`(자기경매 403) ·
  `BID_004`(연속입찰 409) · `BID_005`(잔액부족 422) · `BID_006`(마감 409) · `BID_007`(미개시 409) ·
  `AUCTION_004`(경매없음 404).
  ★ **`BID_001`=최소증분 미달, `BID_002`=buyNowPrice 이상**(총괄이 티켓에 뒤집어 적었던 그것 — 계약이 정본).
- **상태**: 로딩·성공(`role="status"`)·실패(`role="alert"`)·전송중 버튼 비활성(DOM 속성).
- **함정**: `<form noValidate>`(브라우저 말풍선과 커스텀 검증이 이중으로 실패 표시되는 것 방지).
  지수표기·안전정수 초과 상한 가드(m-3). 제출 버튼 `disabled` 실제 전달(m-1).

### B-5. 로그인 `/login` [구현됨]

- **표시/액션**: `POST /auth/login` `{ loginId, password }` → 200 `{ accessToken, refreshToken, accessExpiresAt }`.
- **에러**: `AUTH_003` 자격 불일치(401, 단일 코드 — 열거 완화). 검증 400.
- **상태**: 로딩·에러(자격 불일치 단일 문구)·성공 후 리다이렉트.
- **함정**: 아이디 존재 여부를 문구로 노출 금지(SEC-007). 토큰 저장소 = 현재 `localStorage`
  (판정 근거는 "제약상 셋 다 XSS 등가", HANDOVER 미결4).

### B-6. 회원가입 `/signup` [구현됨]

- **액션**: `POST /auth/signup` `{ loginId, password, nickname }` → 201 `{ userPublicId, nickname }`.
  **토큰 미발급**(가입 후 로그인 별도).
- **에러**: `AUTH_001` 중복 loginId(409, 최소화 문구) · `AUTH_002` 중복 nickname(409, 표시용 유지) · 검증 400.
- **함정**: FC-043 인증 판단 대기 4건(약관 문장 vs 체크박스·네이버 대비 1.94:1·가입 CTA 문구·폼 좌측 배치) — 백로그.

### B-7. 내 프로필/설정 `/me` [구현됨]

- **표시** — `MemberProfileResponse`(계약 §2.5, **4필드**): `userPublicId`, `nickname`,
  `isAdmin`(bool, **표시 제어용**·인가는 서버), `createdAt`. **loginId·passwordHash 없음.**
- **액션**:
  - 닉네임 수정: `PATCH /me` `{ nickname }` → 200(동일 스키마). 에러 `MEMBER_001` 중복(409).
  - 탈퇴: `DELETE /me` `{ balanceForfeitAcknowledged: true }`(명시 동의 필수, 누락 400) → 204.
    에러 `MEMBER_002`(진행 중 거래 보유 409). 잔액 잔존은 차단 아님.
- **상태**: 관리자면 admin 진입점 노출 가능(단 admin 화면은 미구현·404). 탈퇴 시 잔액 소멸 경고 모달.
- **함정**: 비밀번호 변경은 **범위 밖**(계약). 탈퇴는 refresh 세션 전부 폐기·복구 불가 경고 필요(D-080).

### B-8. 잔액/지갑 `/me/wallet` [구현됨]

- **표시** — `MemberBalanceResponse`(계약 §4.4, **4필드**): `cashBalance`, `gameMoneyBalance`,
  `gameMoneyHeld`(입찰 홀드), `gameMoneyAvailable`(파생=잔액−홀드).
- **액션**: 캐시→게임머니 교환 `POST /exchanges` (헤더 `Idempotency-Key` **필수**)
  `{ direction:"CASH_TO_GAME", cashAmount }` → 201 `{ gameMoneyAmount, appliedRate }`.
  에러 `EXC_001` 캐시부족(422) · `EXC_002` 역방향 미지원(422).
- **★ 미구현**: **충전(`/charges`) 없음** → 캐시를 채울 경로가 없다. "충전" 버튼 만들면 404.
  역방향 환전도 미지원. 지갑은 **표시 + 교환**까지만.
- **상태**: 홀드가 있으면 "입찰 중 묶인 금액" 구분 표시. 잔액 0 빈상태.

### B-9. 인벤토리 `/me/inventory` [구현됨]

- **표시** — `InventoryResponse`(계약 §4.2): `{ capacity:96, used, items:[{itemInstancePublicId, slotNo, 요약}] }`.
  요약은 `typeCode` 등 코드 기반(아트·배지 파생은 클라, 아래 C).
- **액션**: 아이템 클릭→인스턴스 상세(`/items/{id}`) 또는 판매(출품) 진입.
- **상태**: 96칸 그리드·빈 슬롯·used/capacity 표시.

### B-10. 임시보관 `/me/temp-storage` [구현됨]

- **표시** — `TempStorageResponse`(계약 §4.2, cursor): `items:[{itemInstancePublicId, storedAt, expireAt?}]`.
- **액션**: 정규 슬롯 이동 `POST /me/temp-storage/{id}/relocate` `{ slotNo? }`(미지정 시 자동배정) → 200 `{ slotNo }`.
  에러 `INV_001` 만실(409) · `INV_002` 슬롯점유(409) · `ITEM_002` 소유자아님(403) · `ITEM_003` TEMP 아님(409).
- **상태**: 만실 시 이동 불가 안내. expireAt 임박 경고.

### B-11. 아이템 인스턴스 상세 `/items/{id}` [구현됨]

- **표시** — `ItemInstanceDetailResponse`(계약 §4.1 / DTO 실측):
  `itemInstancePublicId`, `template`(=`ItemTemplateResponse`), `level`, `skill1`/`skill2`
  (=`ItemSkillResponse{skillCode, name}` — **★ 스킬 이름 여기서 내려옴**), `skillPercent`,
  `goldforceExpireAt?`, `location`(enum 3값), `ownerMasked`, `slotNo?`(소유자 & INVENTORY일 때만).
- **함정**: ★ **경매 상세(`AuctionItemView`)에는 스킬 이름이 없다** — 코드(정수)만 있고
  `itemInstancePublicId`도 없어 이 페이지로 링크가 끊긴다. 경매 상세에서 스킬은 `스킬 #{code}`
  중립 표기가 **계약 준수**(§3.3 폴백 의무). 스킬 이름이 필요하면 이 인스턴스 상세로 와야 함.

### B-12. 판매/경매 등록 `/sell/auction` [구현됨]

- **액션**: `POST /auctions` `{ itemInstancePublicId, startPrice, buyNowPrice?, startAt?, endAt,
  softCloseWindowSec?, softCloseExtendSec?, maxEndAt }` → 201 `{ auctionPublicId, status, endAt }`.
- **에러**: `AUCTION_001` 미소유·미보유·미존재(**403 단일**) · `AUCTION_002` 이미 출품중(409) ·
  `AUCTION_003` buyNowPrice≤startPrice(422) · `AUCTION_008` 시간 파라미터 위반(422).
- **상태**: 인벤토리에서 아이템 선택→가격·시간 입력. 시간 검증(endAt>now, startAt≤endAt, maxEndAt≥endAt).

---

## C. 횡단 관심사 (전 페이지 공통)

### C-1. 인증/헤더 상태

- **JWT**: `Authorization: Bearer <accessToken>`. access 짧은 만료, refresh 서버 저장·**회전**
  (재발급마다 이전 refresh 폐기, 재사용 탐지 시 세션 무효). 401 시 `/auth/refresh`로 회전 후 재시도.
- **비로그인 vs 로그인 vs 판매자 본인**: 헤더에 로그인/가입 vs 프로필·지갑·로그아웃. 경매 상세에서
  비로그인은 "로그인하고 입찰", 판매자 본인은 입찰 폼 숨김+취소.
- **`X-Gateway-Token`**: 프론트→게이트웨이 공유비밀(프록시가 주입). 정상 클라이언트는 `GATEWAY_403`
  을 만나지 않음. `GATEWAY_429`(rate limit, `Retry-After` 헤더)는 인증 계열에서 만날 수 있음.
- **isAdmin**: `GET /me`의 표시 제어 플래그일 뿐 — admin 화면 자체가 미구현이라 링크는 자리만.

### C-2. 아이템 아트 렌더링 규칙 (보존 lib `itemArt.ts`·`itemCode.ts` 인코딩)

- **크로마키**: 원본 PNG는 **알파 없음**(colorType 2), 네 귀퉁이 `#0000FF`. `predev`/`prebuild`가
  `pngChromaKey`로 **복사본만** RGBA 변환(`public/art`, gitignore). 정본 `docs/game_ui`는 읽기만.
  **스크립트 건너뛰면 모서리 파랑.** 새 프론트도 이 처리 필요.
- **원본 도트 크기**: `l`(대형) **50×93**, `s`(소형) 26×28. **둘 다 세로형** — 가로 비율 슬롯으로
  잡으면 우표처럼 뜬다.
- **확대**: **정수배만**(1·2·3·4) + `image-rendering: pixelated`. 비정수 확대는 픽셀아트 뭉갬.
- **아트 경로**: `/art/items/level{1..9}/{l|s}/{water|fire|earth|wind}/{axe|wand|sword|bow|shield|pendant|armor|boots|magic}.png`.
  **레벨은 1~9만 존재**(범위 밖은 null→플레이스홀더). **마법 kind 1·2는 `magic.png` 공유**(2:1).
  ★ 우리 `level`은 표시 레벨(1~9)이라 **0-based 보정 금지**(원게임 이식 때만 보정).

### C-3. 아이템 코드 체계 (계약 §3.3.1 — 정본)

- **산식**: `typeCode = mainCategory×1000 + subGroup×100 + element×10 + kind`. 원게임 `itm_type`과 1:1.
  스코프 = `mainCategory=1`(아이템 카드)만 거래 대상.
- **subGroup(대분류)**: 1=무기 · 2=방어구 · 3=마법.
- **element(속성)**: 1=물 · 2=불 · 3=흙 · 4=바람 (정확히 4값).
- **★ kind는 subGroup 종속** — 같은 숫자가 대분류마다 다름:

  | kind | 무기(1) | 방어구(2) | 마법(3) |
  |---|---|---|---|
  | 1 | 도끼 | 방패 | 일반 |
  | 2 | 완드 | 펜던트 | 특수 |
  | 3 | 검 | 갑옷 | — (없음) |
  | 4 | 활 | 신발 | — (없음) |

  **마법은 kind 2값뿐**(subGroup=3 & kind≥3 성립불가→빈결과). 필터 UI는 `kind`를 `subGroup`에
  **종속**시키고, subGroup 미선택 시 kind 비활성 또는 "전 대분류 합집합" 명시(계약 §4.1 경고).
- **폴백 의무**: 사전에 없는 코드는 중립 표기("속성 N")로, 코드 집합 크기 하드코딩 금지.
- **표시 우선순위**: 실제 표시는 `nameSnapshot`·`specSnapshot`(등록 스냅샷) 우선. 사전은 필터·배지·아트 매핑용.
- **공통 item 블록**(계약 §3.3 / `AuctionItemView` DTO, **12필드**): `typeCode, mainCategory, subGroup,
  element, kind, level`(전부 **정수**) + `skill1?, skill2?`(정수 코드, **null 가능**) + `skillPercent`(int) +
  `goldforceExpireAt?`(ISO string, null 가능) + `nameSnapshot`, `specSnapshot`(string).
  ★ **`itemInstancePublicId` 없음**(B-11 링크 끊김).

### C-4. 골드포스 아웃라인 (design-system §5.12 — 원본 실측값, 쓸지는 사용자 결정)

- **용도**: `goldforceExpireAt`(nullable, 활성/잔여는 **클라 파생**) 있는 아이템의 **아트 프레임**
  표시(카드 외곽선 아님). 적용 위치 = 아이템 아트 박스 안쪽.
- **원본 실측**(`docs/game_ui/item_info/out_line/`): `l/gold.png` 50×93, 네 변 **정확히 2px, 1px씩 2겹**.
  바깥 1px=밝은 금 그라데이션(`#B9840F→…→#FFFF83`), 안쪽 1px=어두운 금 베벨(좌 `#99770C`·상
  `#987309`·우 `#8B6100`·하 `#9D7C10`). 흰 셰인은 별도 9프레임 스트립(정적 금 링 + 흰 셰인 2패스).
- **두께 = `--art-scale` 파생**: `--gf-bright: min(calc(1px*scale + 1px), 5px)`,
  `--gf-bev: min(calc(1px*scale), 4px)`. **상한 합계 9px**(아트 4배). 링은 안쪽으로만 자람(padding).
- **접근성**: 색 단독 정보 금지 — 배지·본문 "N일 남음"·sr-only 3경로. `prefers-reduced-motion`에
  셰인만 정지. `box-shadow`/`filter` 애니메이션 금지(정적 그라데이션만).
- **★ 결정 대상**: 목업이 이 아웃라인을 쓰면 실측값 승계, 안 쓰면 그때 폐기(선제 폐기 금지).
  속도(3s)·잔여 노출 범위·임박 기준(24h)은 **미결**(사용자 판단).

### C-5. 금전/카운트다운 규칙

- **`minNextBidAmount`는 서버 파생** — 클라가 증분표 복제 금지(드리프트). 종료 상태면 null.
- **첫 입찰 하한 = `startPrice`**, 후속 = `현재 최고가 + 구간 증분`(계단식, 서버 설정).
- **소프트클로즈**: 마감 직전 입찰이 endAt 연장(`extensionCount`·`maxEndAt` 상한). 입찰 응답 `endAt`이
  연장 반영값 → 카운트다운 재동기화.
- **단일 타이머**: `useNow()` 하나로 전 카운트다운 구동(보존 lib). ★ 매초 리렌더가 초점 강탈·effect
  재실행의 원인이니 불안정 의존(인라인 콜백·객체 리터럴) 있는 effect를 이 서브트리에 넣지 마라(FC-064).

### C-6. 에러 봉투/코드

- **성공**: `{ success:true, data, timestamp }`. **에러**: `{ success:false, code, message, errors?, timestamp }`.
  `errors[]`는 검증(400) 때만. `code`는 `{DOMAIN}_{NNN}`, HTTP status는 별도.
- **핵심 코드**(위 페이지별 + 게이트웨이): `BID_001~007`·`AUCTION_004`(입찰) / `AUCTION_001~009`(경매) /
  `MEMBER_001~002`·`AUTH_001~005`·`COMMON_005`(회원·인증) / `EXC_001~002`·`INV_001~002`·`ITEM_002~003` /
  `GATEWAY_429`·`GATEWAY_403`(엣지). 전문은 계약 §5.
- 보존 lib `bidErrors.ts`가 `BID_*`·`AUCTION_004` 코드별 문구를 인코딩(재사용).

### C-7. 반응형 요구 (★ 사용자 지속 원칙)

- **"반응형은 배치 변경이 아니다. 웹은 웹, 모바일은 모바일."** "좁아지면 1열로 접는다"류는
  설계로 인정 안 됨. **목업이 웹/모바일 각각 필요할 수 있다.**
- **모바일은 입찰+카드 동시 노출** 요구(상세에서 스크롤 없이 입찰 진입).
- **모바일 우선 CSS**: 루트 `overflow-x-hidden`, `grid-cols-1` 시작, flex 자식 **`min-w-0`**
  (`min-width:auto`가 320~1024 깨짐의 근본 원인, FC-058 실증).
- 목업이 데스크톱만 정의하면 **모바일 설계는 우리 몫이고 그 자체가 승인 대상**.

---

## D. 컴포넌트 어휘 (목업에서 정의돼야 할 것)

계약·리뷰에서 필요성이 드러난 컴포넌트. 각 상태 변형 명시(★ **비활성은 클래스 아니라 DOM 속성**).

| 컴포넌트 | 용도 | 상태 변형 |
|---|---|---|
| 버튼 1차(CTA) | 입찰·구매·등록 | 기본·hover·`disabled`(DOM 속성)·로딩(스피너) |
| 버튼 2차 | 취소·닫기·보조 | 기본·`disabled` |
| 버튼 위험 | 탈퇴·강제취소 | 기본·확인 필요 |
| 폼 필드(text/number) | 금액·닉네임·로그인 | 기본·포커스·에러(`aria-invalid`)·`<form noValidate>` |
| 모달/시트 | 입찰·필터·확인 | open/closed(**`[open]` 의존**)·초점 가둠·Escape·스크롤 잠금(닫을 때 해제) |
| 표(입찰 이력) | BidSummary offset | 헤더·행·빈상태·페이지네이션 |
| 카드(경매) | 목록 그리드 | 아트·가격·카운트다운·상태 배지·골드포스 프레임 |
| 카운트다운 | endAt까지 | live·임박(색 변화)·**ended(now≥endAt 판정)** |
| 배지 | 속성·대분류·상태·골드포스 | element 색·status·골드포스(색 단독 금지→텍스트 동반) |
| 빈상태 | 목록·잔액·인벤토리 0 | 안내 문구 + 액션 유도 |
| 토스트/알림 | 입찰 성공/실패 | 성공 `role="status"`·실패 `role="alert"` |
| 아트 슬롯 | 아이템 이미지 | 정수배·pixelated·플레이스홀더(자산 없음)·CLS 방지(width/height 속성) |

---

## E. 목업 받을 때 확정해야 할 결정들 (열린 결정)

1. **골드포스 아웃라인(§5.12) 사용 여부** — 쓰면 실측값 승계, 안 쓰면 폐기. 속도·임박기준·잔여
   노출 범위는 미결.
2. **아트 슬롯 크기** — 원본 50×93(대형)/26×28(소형) 세로형, 정수배 확대 필수. 슬롯 크기가 배율 결정.
3. **★ 마스킹 불일치(게이트2 미결)** — 계약 §3.3 서두는 "소유자·최고입찰자 마스킹"인데 **구현은
   `sellerNickname`을 원문 노출**(DTO 실측 확인). `isSeller` 판정이 이 원문 노출에 의존하므로,
   나중에 문구대로 마스킹이 들어오면 화면이 조용히 깨진다. **어느 쪽을 정본으로 할지 확정 필요**
   (문서만, 백엔드 무변경). `highestBidderMasked`는 실제 마스킹됨.
4. **스킬 이름 링크 끊김** — 경매 상세에 스킬 이름·`itemInstancePublicId` 없음. 당분간 `스킬 #{code}`
   중립 표기(계약 준수). 이름 노출 원하면 백엔드 동결 해제 후 `AuctionItemView`에 필드 추가 vs
   `GET /skills` 사전 신설 택일(후자는 목록 스킬 필터도 되살림).
5. **웹/모바일 별도 목업** — 데스크톱만 오면 모바일 설계는 우리 몫(승인 대상). 모바일 입찰+카드 동시 노출.
6. **빌드 툴체인 지위**(HANDOVER 미결1) — Vite6/React19/Tailwind4/vitest는 기반이라 유지 기본이나,
   템플릿 유래 설정(prettier·CSS 레이어)은 재검토. 툴체인 갈아엎으면 보존 45파일 테스트 재배선 필요.
7. **정본 문서 정리**(HANDOVER 미결5) — `PRODUCT.md`·`DESIGN.md`에 폐기된 퍼플 팔레트가 정본처럼
   남아 있음. 새 에픽 착수 시 참조하면 죽은 시각 언어 되살아남.

---

## 부록: 실측 근거 (계약↔구현 대조 결과)

- **구현 확인 컨트롤러 10종**: Auth, Member, Exchange, ItemInstance, Inventory, ItemTemplate,
  Auction, Bid, Notice(참조구현), Sample. → 위 [구현됨] 13화면의 근거.
- **미구현 확정**(컨트롤러 부재): Shop, Charge, Order, MarketPrice, Admin, **Auction의 purchase 매핑**.
- **DTO 실측 필드수**: AuctionSummary 10 · AuctionDetail 17 · item 블록 12 · BidSummary 5 ·
  MemberProfile 4 · MemberBalance 4 · ItemInstanceDetail 10 · ItemSkill 2(skillCode+name).
- **미구현 도메인 상태**: `resultType` 항상 null, status는 워커 부재로 SOLD/UNSOLD 자동 전이 없음
  (BidStatus WON·AuctionStatus SOLD/UNSOLD는 EPIC-CLOSING 소유·미구현). → 마감은 `now>=endAt` 클라 판정.
</content>
</invoke>
