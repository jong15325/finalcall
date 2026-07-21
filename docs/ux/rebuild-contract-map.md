# 프론트 재구축 계약 매핑 (rebuild-contract-map)

작성: architect · 2026-07-21 · 대상 에픽: **EPIC-FE-REBUILD**(FC-066) · 상태: 확정
목적: 사용자 목업(장터, Vuexy Bootstrap5)을 **기존 계약(api-contract v1.11)에 정합**시키는 관문 문서.
게이트1에서 확정된 두 결정을 문서로 못 박는다 —
1. **범위 = 백엔드가 준비된 화면만 실연동**(백엔드 동결 유지). 나머지는 "준비 중" 자리로만.
2. **계약 충돌 = 기존 api-contract가 정본.** 목업이 도입한 추가 개념은 **데이터가 뒷받침될 때만 렌더, 없으면 표준 폴백**. 백엔드·계약·ERD **무변경**.

**정본 출처**: `docs/spec/api-contract.md`(v1.11) · `docs/spec/erd.md` · `docs/ux/design-brief.md`(계약↔구현 대조) ·
`docs/board/epics/EPIC-FE-REBUILD.md`(보존 45 / 폐기 318).
**목업 핸드오프**(레포 밖·읽기 전용, 사용자 소유): `…\game-market\HANDOVER_FULLSTACK.md`(§4~§28) ·
`HANDOVER_ITEM_CARD.md` · `item-frame.css`.

> ★ **이 문서의 지위**: 계약을 **가리키는** 정합표이지 계약의 사본·수정본이 아니다. 필드가 의심되면
> `api-contract.md` 원문을 본다. 이 문서와 계약이 어긋나면 **계약이 정본**이고 이 문서를 고친다.
> ★ **승계 lib 실측 정정(총괄, 호스트 도구 확인 2026-07-21)**: 보존 45파일
> (`frontend/src/features/**/lib` 32 + `frontend/src/lib` 13)은 **워킹트리에 전부 존재한다**
> (`auctionPhase.ts`·`bidErrors.ts`·`bidAmount.ts`·`itemCode.ts`·`itemArt.ts`·`api/client.ts` 등).
> 재구축은 이를 **그대로 승계**한다 — 재생성·덮어쓰기 금지. (초안의 "삭제됨" 서술은 사실 오류로 정정.)
> 폐기 대상 318(`components/ui`·`components/template`·`views` 등)도 아직 워킹트리에 있다(총 src 569파일).

---

## 0. 요약 (먼저 읽는 표)

| 구분 | 개수 | 목록 |
|---|---|---|
| **실연동 화면** | 13 | 홈(경매 프리뷰만)·경매 목록·경매 상세·입찰 시트·로그인·회원가입·로그아웃·내 프로필/설정·지갑(표시+교환)·인벤토리·임시보관·아이템 인스턴스 상세·판매(경매 등록) |
| **준비 중 자리** | 9+ | 고정가 마켓·코드 충전·커뮤니티 CRUD·본인 인증·알림·OAuth·이메일 인증·슬롯 확장·즉시구매 버튼(+AI시세·거래내역·비교 스킬데이터) |
| **범위 제외(게이트1)** | — | 위 준비 중 항목 전부 = 백엔드 동결로 이번 에픽에서 구현 안 함(자리만) |

design-brief [구현됨 13화면]과 **1:1 정합**한다(홈·경매목록·경매상세·입찰·로그인·회원가입·로그아웃·프로필/설정·지갑·인벤토리·임시보관·인스턴스상세·판매).

---

## 1. 라우트 지도 (목업 17 해시 라우트 → 판정)

목업 §4 해시 라우트를 [실연동]/[준비 중 자리]/[범위 제외]로 판정한다. 실연동은 **실측 컨트롤러**(design-brief 부록:
Auth·Member·Exchange·ItemInstance·Inventory·ItemTemplate·Auction·Bid·Notice·Sample 10종)로 뒷받침을 명시한다.
React Router URL은 목업 §4 권장안을 따르되 **계약 리소스 경로와 일치**시킨다.

| # | 목업 해시 | 화면 | 라우트(확정) | 판정 | 뒷받침 엔드포인트(실측) |
|---|---|---|---|---|---|
| 1 | `#home` | 홈 | `/` | **실연동(부분)** | `GET /auctions`(프리뷰 재사용). ★ 배너·추천마켓·공지는 자리보류(아래 5) |
| 2 | `#market` | 아이템 마켓(고정가) | `/market` | **준비 중 자리** | ShopController **없음**(§3.2 `/shops` 미구현). 고정가 거래 전체 동결 |
| 3 | `#auction` | 실시간 경매 목록 | `/auctions` | **실연동** | `GET /auctions`(cursor) + `GET /item-templates`(필터 선택지) |
| 4 | `#auction-detail` | 경매 상세·입찰 | `/auctions/:id` | **실연동** | `GET /auctions/{id}`, `GET /auctions/{id}/bids` |
| 5 | (상세 내부) | 입찰 시트/모달 | 상세 내부 | **실연동** | `POST /auctions/{id}/bids`, `GET /me/balance` |
| 6 | `#compare` | 아이템 비교 | `/compare` | **실연동(부분·클라)** | 클라 sessionStorage. **경매 아이템만** 데이터 실재, 마켓 아이템·스킬이름은 공백(아래 5) |
| 7 | `#sell` | 판매(경매 등록) | `/sell` | **실연동(부분)** | `POST /auctions`. ★ 고정가 방식·수수료 확정은 자리보류(아래 3·5) |
| 8 | `#board` | 커뮤니티 | `/community` | **준비 중 자리** | 커뮤니티 CRUD 없음. Notice 컨트롤러는 **읽기전용 참조구현**(사용자 게시 아님) |
| 9 | `#mypage` | 마이페이지 통합 홈 | `/me` | **실연동(부분)** | `GET /me`, `GET /me/balance`. ★ "최근 거래내역"은 `/me/orders` 미구현→자리보류 |
| 10 | `#inventory` | 인벤토리 | `/me/inventory` | **실연동(부분)** | `GET /me/inventory`(96칸). ★ 슬롯 확장(`expansions`)은 미구현→자리보류 |
| 11 | `#temp-storage` | 임시 보관함 | `/me/temp-storage` | **실연동** | `GET /me/temp-storage`, `POST …/{id}/relocate` |
| 12 | `#item-detail` | 보유 아이템 상세 | `/items/:id` | **실연동** | `GET /items/{id}`(스킬 이름 포함) |
| 13 | `#wallet` | 지갑 | `/me/wallet` | **실연동(부분)** | `GET /me/balance`, `POST /exchanges`. ★ 충전(`/charges`)은 미구현→자리보류 |
| 14 | `#verify` | 본인 인증 | `/me`(통합) | **준비 중 자리** | 이메일·휴대폰 인증 백엔드 **없음**. 표시만 |
| 15 | `#settings` | 설정 | `/me`(통합) | **실연동(부분)** | `PATCH /me`(닉네임), `DELETE /me`(탈퇴). 그 외 설정 항목은 자리보류 |
| 16 | `#payment` | 코드 충전 | `/wallet/charge` | **준비 중 자리** | `/charges`·Toss 승인 컨트롤러 **없음** |
| 17 | `#login` | 로그인 | `/login` | **실연동** | `POST /auth/login`(+ 로그아웃 `POST /auth/logout`) |
| 18 | `#signup` | 회원가입 | `/signup` | **실연동(부분)** | `POST /auth/signup`. ★ 이메일 인증·아이디중복확인 API는 미구현→자리/클라검증 |

> **URL 규약**: design-brief는 지갑을 `/me/wallet`, 인스턴스 상세를 `/items/{id}`로 확정했다. 목업 §4의
> `/wallet/charge`·`/me/items/:itemId`와 다르되, **계약 리소스(`/me/balance`·`/items/{id}`) 경로에 맞춘
> design-brief를 정본**으로 한다(충전 라우트만 `/wallet/charge`로 자리 유지). 라우트 문자열은 계약 대상이
> 아니라 프론트 재량이나, 재구축 산출물 내 일관성을 위해 이 표를 따른다.

---

## 2. 데이터 모델 매핑 (목업 §7 → 기존 계약)

목업 `GameItem`/`ItemVisualState`/`ItemSkill`/`ItemListingSummary`(§7)를 계약의 **공통 item 블록(12필드)**·
`AuctionSummary`(10)·`AuctionDetail`(17)에 필드 대 필드로 매핑한다.
분류: **[드롭]**=계약에 개념 없음·렌더 안 함 / **[폴백]**=데이터 없으면 표준값으로 / **[이름만 상이·동일개념]**=필드명만 다르고 의미 동일.

### 2.1 목업 `GameItem` → 계약 공통 item 블록 (`AuctionItemView`, 12필드)

| 목업 필드(§7) | 계약 대응 | 분류 | 처리 |
|---|---|---|---|
| `itemId` | `item.itemInstancePublicId` **없음**(item 블록 미포함) | **[드롭]** | ★ 경매 item 블록엔 인스턴스 ID가 없다(design-brief B-11 링크 끊김). 목업이 `itemId`로 상세 링크를 걸면 **경매 카드→인스턴스 상세 링크 불가**. 목록/상세에서 링크 만들지 말 것 |
| `catalogId` | `typeCode` | [이름만 상이·동일개념] | `typeCode`(정수)로 대체. 별도 catalogId 없음 |
| `imageKey` | (파생) `element`+`kind`+`level`로 아트 경로 조립 | [이름만 상이·동일개념] | imageKey 필드 없음 → 코드축에서 아트 경로 파생(아래 6) |
| `name` | `nameSnapshot` | [이름만 상이·동일개념] | 등록 스냅샷(D-045)이 표시 정본 |
| `category` | `subGroup`(대분류) + `kind`(종류) | [이름만 상이·동일개념] | 단일 문자열 아님. `subGroup`→`kind` 종속 표(§3.3.1)로 해석 |
| `grade` | **없음** | **[드롭]** | ★ **원게임 무등급**(D-073, v1.2에서 등급 필터 제거). 계약에 grade 개념 자체가 없다. "전체 등급" 필터·등급 배지 **렌더 금지** |
| `element` (6값: EARTH/FIRE/WATER/WIND/**BLACK/EVENT**) | `element`(정수 4값: 1물·2불·3흙·4바람) | **[폴백]** | 계약 element는 **정확히 4값**(§3.3.1). BLACK·EVENT는 계약에 없음 → 사전에 없는 코드는 중립표기("속성 N") 폴백. BLACK/EVENT 아트 분기 금지 |
| `enhancementLevel?` | `level`(정수) | [이름만 상이·동일개념] | 계약 `level`=표시 레벨 1~9. **0-based 보정 금지**(아래 6) |
| `description` | `specSnapshot` | [이름만 상이·동일개념] | 등록 스냅샷 |
| `skills: [ItemSkill\|null, ItemSkill\|null]` | `skill1?`·`skill2?`(정수 코드) + `skillPercent`(int) | **[폴백]**(부분 드롭) | ★ 경매 item 블록은 **스킬 코드(정수)만**, 이름·효과·slot 객체 없음. 목업의 `name`·`effectText`·`special`은 **경매 맥락에서 [드롭]** → `스킬 #{code}` 중립표기(§3.3 폴백 의무). 스킬 이름은 `GET /items/{id}`(인스턴스 상세)에서만 (아래 2.4) |
| `visual: ItemVisualState` | `goldforceExpireAt?`만 대응 | **[폴백]** | 아래 2.2 |

### 2.2 목업 `ItemVisualState` → 계약

| 목업 필드(§7) | 계약 대응 | 분류 | 처리 |
|---|---|---|---|
| `frameType`(STANDARD/BLACK/GOLDFORCE/SILVERFORCE/AVATAR/PET/EVENT) | `goldforceExpireAt?`만 | **[폴백]** | ★ 계약이 뒷받침하는 프레임은 **골드포스뿐**(`goldforceExpireAt` nullable). SILVERFORCE·PET·AVATAR·BLACK·EVENT는 계약 데이터 없음 → **전부 STANDARD 폴백**(아래 6) |
| `goldforceRemainingDays?` | (파생) `goldforceExpireAt`−now | [이름만 상이·동일개념] | ★ 잔여일은 **클라 파생**. 서버가 days를 내리지 않음. 만료시각에서 계산, 1~999 보정(아래 6) |
| `silverforceRemainingDays?` | **없음** | **[드롭]** | 실버포스 데이터 없음 |
| `hasSkill` | (파생) `skill1\|\|skill2 != null` | [이름만 상이·동일개념] | 코드 존재로 파생 |
| `specialSkill` | **없음** | **[드롭]** | 일반/특수 스킬 구분 데이터 없음 → S 마크만(SS 렌더 금지) |
| `eventElement` | **없음** | **[드롭]** | EVENT 속성 개념 없음(2.1 element 참조) |

### 2.3 목업 `ItemListingSummary` → 계약 `AuctionSummary`(10) / 고정가

| 목업 필드(§7) | 계약 대응 | 분류 | 처리 |
|---|---|---|---|
| `listingId` | `auctionPublicId`(ULID) | [이름만 상이·동일개념] | 경매는 auctionPublicId |
| `listingType`(FIXED_PRICE/AUCTION) | (AUCTION만) | **[폴백]** | FIXED_PRICE는 준비 중(고정가 미구현). 목록은 경매 단일 타입 |
| `item` | `item`(공통 블록 12필드) | [동일개념] | 2.1 |
| `price?` | (고정가) → **없음** | **[드롭]** | 고정가 미구현 |
| `currentBid?` | **`highestBidAmount?`**(Long, 입찰없으면 null) | **[이름만 상이·동일개념]** | ★ 목업 `currentBid` = 계약 `highestBidAmount`. null 처리 필수(입찰 0건) |
| `nextMinimumBid?` | **`minNextBidAmount?`**(Long, 서버 파생, 종료시 null) | **[이름만 상이·동일개념]** | ★ 목업 `nextMinimumBid` = 계약 `minNextBidAmount`. **AuctionDetail에만 존재**(Summary엔 없음). 목록 카드에서 "다음 최소가"가 필요하면 상세 진입 후 표기. 클라 증분표 복제 금지 |
| `auctionEndsAt?` | `endAt`(Instant) | [이름만 상이·동일개념] | 카운트다운 기준. Summary·Detail 공통 |
| `seller` | `sellerNickname`(string, **마스킹 없이 원문**) | [이름만 상이·동일개념] | ★ 마스킹 미결(아래 8) |
| — (목업 없음) | `startPrice`(long), `buyNowPrice?`(Long), `bidCount`(long), `startAt?`, `status` | (계약 추가) | 목업에 없는 계약 필드 = 렌더에 반영. `buyNowPrice`는 **표기만**(즉시구매 버튼 404, 아래 5) |

### 2.4 `AuctionDetail` 추가 7필드 (Summary 10 + 7 = 17)

`resultType?`(**항상 null**, 낙찰/유찰 표기 금지) · `highestBidderMasked?`(마스킹, 입찰없으면 null) ·
`extensionCount`(int) · `maxEndAt`(Instant) · `createdAt`(Instant) · `minNextBidAmount?`(위 2.3).
→ 목업 §10 입찰 응답의 `version`은 **[드롭]**(아래 4). `serverTime`은 계약 응답에 없음 → **[드롭]**, 카운트다운은
`endAt` + 클라 `useNow()` 단일 타이머로 구동(design-brief C-5).

### 2.5 스킬 이름·효과의 소재 (링크 끊김 승계)

- 경매 상세 `AuctionItemView`: 스킬 **코드(정수)만**. 이름·효과·`itemInstancePublicId` 없음 →
  경매 맥락 스킬 표기 = `스킬 #{code}` 중립표기(§3.3 폴백 의무 = **계약 준수**).
- 스킬 **이름**은 `GET /items/{id}`(`ItemInstanceDetailResponse.skill1/skill2 = {skillCode, name}`)에서만 내려온다.
- **[미결·백로그]** 경매 상세에서 스킬 이름 노출을 원하면 백엔드 동결 해제 후 `AuctionItemView` 필드 추가
  vs `GET /skills` 사전 신설 택일(design-brief E.4). **이번 에픽 범위 밖.**
- **비교(§11)의 스킬 데이터 공백**: 목업 `skillOnePool`/`skillTwoPool`은 목업이다. 실데이터는
  경매 아이템=코드만, 마켓 아이템=없음(고정가 미구현) → **비교표 스킬 행은 경매 아이템도 코드 중립표기**로만.

---

## 3. 통화(코드) 표기 규칙

목업(§3.3): 화폐명 **코드(code)**, 아이콘 `code.png`, 축약(`1만`/`248만`/`99억`). 계약: 금액은 전부 **`long`(정수)**.
목업의 `CodeAmount = string`(decimal integer string) 제안은 **JS 안전정수 범위(현재 최대 99억) 내이므로
프론트는 `number`로 다루되 상한 가드**를 둔다(design-brief m-3, 지수표기·안전정수 초과 방지).

### 3.1 표기 규칙 (확정)

| 맥락 | 표기 | 근거 |
|---|---|---|
| **탐색**(좁은 카드·목록·요약) | **축약** (`10000`→`1만`, `2480000`→`248만`, `9900000000`→`99억`) | 목업 §3.3. 탐색용 |
| **거래 확정**(입찰 시트·판매 입력·지갑·정산·상세 가격) | **정수 원본** (`10001`→`10,001`) | 목업 §3.3. 금전 정확성 |
| **API 요청/응답** | **항상 정수 원본**(`long`) | 계약 §1.4. 축약값을 API에 절대 넣지 않음 |
| 접근성 | `aria-label="2,480,000 코드"`(전체값) | 목업 §24. 축약은 시각만, 보조기술엔 전체값 |

- `G`·`C`·`골드` 텍스트 단위 **금지**(목업 §3.3). 아이콘은 `code.png`(장터 자산).
- 축약은 **표시 변환일 뿐**, 상태·전송은 정수를 유지한다(왕복 변환으로 정밀도 잃지 말 것).

### 3.2 `<CodeAmount>` 컴포넌트 계약

```tsx
<CodeAmount value={number} mode="compact" | "full" />
```

- `value`: 정수(원본 `long`). 문자열 금지(정렬·비교·연산 정확성).
- `mode`:
  - `"compact"` → 축약(`248만`) + 아이콘. 목록·카드·요약.
  - `"full"` → 천단위 구분(`2,480,000`) + 아이콘. 입찰·지갑·정산·상세·판매 입력.
- 접근성: `aria-label`은 **항상 full 전체값 + " 코드"**(mode 무관). 아이콘은 `aria-hidden`(장식).
- 목업의 DOM 후처리(`applyCodeCurrency`·`formatCodeCompact`·`codeAmountElement`)는 **폐기** →
  컴포넌트로 대체(목업 §3.3 명시). null/undefined value는 렌더하지 않거나 "-"(입찰 0건 등).

---

## 4. 입찰 계약 정합 (목업 §10 낙관적락 → 계약 비관적락+CAS)

목업 §10 핸드오프는 **입찰 동시성을 낙관적 버전(`expectedVersion`)으로 잘못 기술**했다. 기존 계약·구현이 정본이다.

### 4.1 동시성 모델 교정

| 목업 §10 서술 | 계약 정본 | 교정 |
|---|---|---|
| `expectedVersion: 17` 요청 | 요청 body = `{ amount }`**만** | **[드롭]** expectedVersion. 계약 §3.1 입찰 요청은 `amount` 단일 |
| 응답 `version: 18` | 응답 = `{ bidPublicId, amount, currentHighestAmount, endAt }` | **[드롭]** version. AuctionDetail에도 version 필드 없음 |
| "auction row/version 낙관적 잠금" | **auction 행 비관적 락 + 금전 조건부 CAS** | CLAUDE.md §1(EPIC-BID 게이트2 승인). 경매 단위 직렬화(D-008) |
| 응답 `serverTime` | 계약에 없음 | **[드롭]**. 카운트다운은 `endAt` + 클라 `useNow()` |
| `BID_004` = "최신 경매 버전 불일치" | `BID_004` = **연속(현재 최고가 보유자) 입찰**(409) | ★ 코드 의미가 뒤바뀜. 계약이 정본 |

> ★ **핸드오프가 실제와 뒤바뀐 지점**: 목업 §10의 낙관적락(expectedVersion/version/serverTime)은
> **채택되지 않은 스켈레톤 기획 잔재**와 동류다. 실제는 비관적 락 + CAS이며, 프론트는 버전을 주고받지
> 않는다. 목업 §22("optimistic 또는 원자적 갱신")의 "optimistic"도 무시하고 서버 계약만 따른다.

### 4.2 입찰 에러코드 교정 (목업 §10 BID_001~005 → 계약 BidErrorCode)

목업 §10은 5개만, 계약은 7개 + AUCTION_004. **의미도 일부 다르다.**

| 목업 §10 | 계약 정본(§5) | HTTP | 교정 |
|---|---|---|---|
| `BID_001` 최소 입찰가 미만 | `BID_001` **최소 증분 미달·첫 입찰 시작가 미달** | 422 | 의미 정합(첫 입찰 하한=`startPrice` 추가) |
| `BID_002` 보유 코드 부족 | `BID_002` **buyNowPrice 이상** | 422 | ★ **뒤바뀜.** 계약 BID_002=buyNowPrice 이상, 잔액부족은 BID_005 |
| `BID_003` 경매 종료 | `BID_003` **자기 경매 입찰** | 403 | ★ **뒤바뀜.** 종료는 BID_006 |
| `BID_004` 최신 경매 버전 불일치 | `BID_004` **연속(최고가 보유자) 입찰** | 409 | ★ **뒤바뀜.** 버전 개념 없음 |
| `BID_005` 본인 상품 입찰 불가 | `BID_005` **게임머니 잔액 부족** | 422 | ★ **뒤바뀜.** 본인상품은 BID_003 |
| — | `BID_006` **마감/종료됨** | 409 | 계약 추가 |
| — | `BID_007` **경매 미개시**(SCHEDULED·startAt 미도래) | 409 | 계약 추가. "아직 시작 안 함"≠"이미 끝남" |
| — | `AUCTION_004` **경매 없음** | 404 | 계약 추가 |

- **정본 인코딩 = 승계 lib `bidErrors.ts`**(design-brief C-6). 목업 §10 코드표를 복제하지 말고 이 lib를 재생성한다.
- 문구는 서버 `code`→UI 메시지 매핑(목업 §23). 서버 원문 예외 노출 금지.

### 4.3 마감 판정 (승계 `auctionPhase.ts`)

- **마감 = 클라 `now >= endAt` 판정**(design-brief B-3). ★ 서버 `status`를 믿지 마라 — 마감 강등 워커가
  없어 endAt 지난 경매도 `status: ACTIVE`로 내려온다(`resultType` 항상 null).
- 목업 §10 상태머신 `SCHEDULED→ACTIVE→ENDED/SOLD/FAILED`, `CANCELLED`는 **계약 enum
  (`SCHEDULED·ACTIVE·SOLD·UNSOLD·CANCELLED`)에 정합**시킨다: `ENDED`는 계약에 없음(=클라 `now>=endAt` 파생),
  `FAILED`→계약 `UNSOLD`. SOLD/UNSOLD 자동 전이는 EPIC-CLOSING 미구현 → 클라가 endAt로 판정.
- `TERMINAL_STATUSES`(SOLD/UNSOLD/CANCELLED)만 조기종료(안전 방향)에 status 신뢰.
- 소프트클로즈: 입찰 응답 `endAt`이 연장 반영값 → 카운트다운 재동기화(`extensionCount`·`maxEndAt` 상한).
- **SSE/WebSocket 실시간 갱신**(목업 §10)은 **[준비 중]** — 백엔드 미구현. 폴링/수동새로고침으로 대체하되
  `refetchOnWindowFocus`로 인한 **금액 입력 덮어쓰기**(design-brief M-1)를 반드시 방어(승계 `bidAmount.ts`).

---

## 5. 드롭/자리보류 목록 (준비 중 UI + 404 방지책)

목업이 그렸으나 백엔드가 없는 UI. **버튼·링크·탭을 만들되 클릭 시 404가 나면 안 된다** →
**자리만(비활성 `disabled`/`aria-disabled`)** 또는 **"준비 중" 안내**로 처리(design-brief FC-048 사고 방지).

| 준비 중 UI | 목업 위치 | 미구현 근거 | 404 방지책 |
|---|---|---|---|
| **고정가 마켓**(목록/상세/구매) | `#market` §9 | ShopController 없음(§3.2 `/shops`) | 라우트 자리 유지 + "준비 중" 빈상태. **홈에서 추천마켓 호출 금지**(FC-048) |
| **즉시구매 버튼** | 경매 상세·마켓 카드 | `POST /auctions/{id}/purchase` 매핑 없음(계약엔 있으나 컨트롤러 부재) | `buyNowPrice`는 **정보 표기만**. 버튼 만들면 404 → **버튼 미생성** 또는 `disabled` |
| **코드 충전**(Toss 결제) | `#payment` §15 | `/charges`·`/charges/confirm` 컨트롤러 없음 | 지갑 "충전" 버튼 `disabled`. 결제창·충전내역 미표시 |
| **커뮤니티 CRUD** | `#board` §11(HANDOVER_ITEM_CARD) | 커뮤니티 도메인 없음. Notice=읽기전용 참조구현 | 글쓰기·검색·상세 비활성. 목록 자리만 |
| **본인 인증**(이메일·휴대폰) | `#verify` §14 | 인증 백엔드 없음 | 상태 표시만("미인증"). 발송/확인 버튼 `disabled` |
| **알림** | 상단 알림 드롭다운 §19 | `/notifications*` 컨트롤러 없음 | 벨 아이콘 자리 + 빈 드롭다운("알림 없음"). 배지 0 고정 |
| **OAuth**(네이버·카카오) | 로그인/가입 §14 | 백엔드 미지원(자리만) | 버튼 자리 확보하되 `disabled` 또는 "준비 중". 구글은 제거 |
| **이메일 인증**(가입) | `#signup` §14 | `email-verifications` 없음 | 필드는 두되 클라 형식검증만. "인증요청" `disabled` 또는 스텁 |
| **아이디 중복 확인** | `#signup` | `ids/availability` 컨트롤러 없음 | 실시간 확인 대신 제출 시 `AUTH_001`(409)로 처리 |
| **슬롯 확장** | `#inventory` §12 | `POST /me/inventory/expansions` 없음 | 96칸 고정 표시. "확장" 버튼 `disabled` |
| **AI 시세** | 홈·마켓 §6 | `/market-prices` 컨트롤러 없음 | 시세 위젯·차트 미표시(자리 제거 또는 "준비 중") |
| **거래 내역** | `#mypage` "최근 거래" §13 | `/me/orders` 컨트롤러 없음 | 최근거래 섹션 "준비 중" 빈상태 |
| **비교 스킬 데이터** | `#compare` §11 | 경매=스킬코드만·마켓=없음 | 스킬 행은 `스킬 #{code}` 중립표기. "효과" 열 공백 처리 |
| **프로필 저장/탈퇴 외 설정** | `#settings` | `/me` PATCH/DELETE만 존재 | 닉네임·탈퇴만 실연동. 그 외 설정 항목 자리보류 |

> **핵심 규칙**(design-brief 상단): "**클릭 시 404가 나는 화면을 그리지 마라.** 필요하면 준비 중 비활성 상태로만
> 자리를 남긴다." 비활성은 **반드시 DOM 속성**(`disabled`/`aria-disabled`)으로 — `opacity-50`만은 보조기술에
> 활성으로 노출된다(WCAG 4.1.2, 승계 교훈).

---

## 6. 아이템 프레임 계약 승계 (item-frame.css ↔ 승계 lib 통합)

목업 `item-frame.css`·`HANDOVER_ITEM_CARD.md`의 프레임 계약을 승계 lib(`itemArt.ts`·`itemCode.ts`·`goldforce.ts`·
크로마키 처리)와 **어긋나지 않게** 통합한다. **두 출처가 충돌하면: 아트 원본·크로마키·정수배는 승계 lib(계약
파생) 정본, 프레임 외형 자산·비율·좌표는 item-frame.css 정본.**

### 6.1 프레임 캔버스·비율 (item-frame.css 정본)

- **공용 카드 캔버스 = 72×134px**(`--item-frame-width/height`). **모든 표시 영역 공통**, 페이지별 변경 금지.
- 원본 투명 프레임 = **50×93px** → CSS에서 캔버스 크기로 확대. 슬롯은 외부 크기(`size`)만 바꾸고
  **내부 프레임 비율·오버레이 좌표는 불변**(목업 §8 `<ItemFrame size>`).
- ★ **승계 lib 정합**: design-brief C-2 원본 도트 `l`(대형) **50×93**, `s`(소형) 26×28 — item-frame.css의
  50×93과 **일치**. 둘 다 세로형. 가로 비율 슬롯 금지.

### 6.2 아트 렌더링 (승계 lib 정본)

- **크로마키**: 원본 PNG는 **알파 없음**(colorType 2), **네 귀퉁이 `#0000FF`**. `predev`/`prebuild`가
  `pngChromaKey`로 **복사본만** RGBA 변환(`public/art`, gitignore). 정본 `docs/game_ui`는 읽기만.
  **스크립트 건너뛰면 모서리 파랑.** 새 프론트도 이 처리 필수.
  → 목업 프레임 자산(`gold-Photoroom.png` 등)은 이미 Photoroom 투명화된 별개 자산 계열이므로,
  **아이템 본체 아트(원게임 도트)와 프레임 오버레이 자산은 크로마키 처리 여부가 다르다**(본체=크로마키 필요,
  프레임 PNG=이미 투명). 재구축 시 두 계열을 분리 관리.
- **확대 = 정수배만**(1·2·3·4) + `image-rendering: pixelated`. 비정수 확대 금지(픽셀아트 뭉갬).
  item-frame.css의 골드 프레임·이벤트·스킬 마크가 전부 `image-rendering: pixelated` 사용 — 정합.
- **아트 경로**: `/art/items/level{1..9}/{l|s}/{water|fire|earth|wind}/{axe|wand|sword|bow|shield|pendant|armor|boots|magic}.png`.
  **레벨 1~9만 존재**(범위 밖 null→플레이스홀더). **마법 kind 1·2는 `magic.png` 공유**.
  ★ `level`은 표시 레벨(1~9) → **0-based 보정 금지**.
- **코드 사전**(§3.3.1): `element` 4값(1물·2불·3흙·4바람) → 경로 `{water|fire|earth|wind}`. `kind`는 `subGroup`
  종속. 사전에 없는 코드는 플레이스홀더 폴백(하드코딩 금지).

### 6.3 프레임 종류 폴백 (계약 데이터 = 골드포스뿐)

목업 프레임 6종(§8 우선순위: 골드포스>실버포스>펫>아바타>이벤트>일반/블랙) 중 **계약 데이터가 존재하는
것은 골드포스뿐**(`goldforceExpireAt`). 나머지는 폴백.

| 목업 프레임 | 자산(item-frame.css) | 계약 데이터 | 처리 |
|---|---|---|---|
| **골드포스** | `gold-Photoroom.png` + `gold-number-transparent.png` | ✅ `goldforceExpireAt`(nullable) | **렌더.** 잔여일=`goldforceExpireAt`−now 클라 파생, 1~999 보정·3자리(`001`~`999`) 표시. 좌상단 일수 슬롯 배경 `#592400` |
| 실버포스 | `silver-frame-transparent.png` | ❌ 없음 | **[폴백 STANDARD]** |
| 펫 | `silver-pet-frame-transparent.png` | ❌ 없음 | **[폴백 STANDARD]** |
| 아바타 | `avatar-frame-transparent.png` | ❌ 없음 | **[폴백 STANDARD]** |
| 이벤트 | `gold-event-text-transparent.png` | ❌ 없음(EVENT element도 없음) | **[폴백 STANDARD]** |
| 일반/블랙 | `black-frame-transparent.png` | (기본) | **STANDARD = 기본 프레임** |

- **스킬 마크**: 우상단 S(`skill-*-transparent.png`). 계약은 `skill1`/`skill2` 코드 존재 여부만 → `hasSkill` 파생으로
  **S 마크만**. **특수 SS(`special-skill-*`)는 계약 데이터 없음 → 렌더 금지**(2.2 specialSkill 드롭).
- **광택 애니메이션**(1.5초 반사선): item-frame.css 계약 유지하되, `prefers-reduced-motion`에서 정지
  (design-brief C-4 접근성). 블랙(STANDARD)에는 광택 미적용(HANDOVER_ITEM_CARD 규칙).
- **골드포스 아웃라인(design-system §5.12) 실측값**: design-brief C-4의 2겹 링·변별 베벨색·`--art-scale` 파생은
  **원본 실측**이라 폐기 대상 아님. 단 목업이 `gold-Photoroom.png` **프레임 PNG 방식**을 채택했으므로,
  §5.12의 CSS 재구성 아웃라인과 **택일**이다 → **목업의 PNG 프레임 방식을 우선**하고, §5.12는 참조 실측값으로만
  보관(선제 폐기 안 함, 사용자 결정 대기).

### 6.4 스프라이트 배경(`item-sprite-stage`)

- 목업: 원본 아이템 이미지를 저채도·저명도·3px 블러로 재사용한 배경(`--item-sprite` CSS 변수 + `applyItemSpriteBackdrops`).
  MutationObserver DOM 후처리 → React에서는 **컴포넌트 prop으로 `--item-sprite` 주입**(DOM 옵저버 폐기, 목업 §21).
- 이미지 DOM 내부 변경 금지 — 비교선택·구매·입찰은 **오버레이/카드 외부 액션**으로(목업 §3.1).
- hover는 **개별 카드에만**(부모 그리드로 전파 금지, 목업 §3.1).

---

## 7. 게이트2 없음 확인

**이 문서 작업은 계약·스키마·성능에 영향을 주지 않는다 → 게이트2 대상 아님(문서만).**

- `api-contract.md`·`erd.md` **무변경**(엔드포인트·필드 집합·에러코드·컬럼 불변).
- 목업이 도입한 추가 개념(grade·확장 element BLACK/EVENT·프레임 5종·스킬 이름/효과·expectedVersion 낙관적락·
  version·serverTime)은 **전부 계약 쪽으로 폴백/드롭**했다 — 계약을 늘리지 않았다.
- 목업 §7~§26의 "권장 API"(BFF `/home`·`/market/*`·`/notifications`·`/payments`·슬롯확장 등)는 **채택하지 않는다**
  (준비 중 자리). 채택하려면 그때 **계약 변경(6절) + 게이트2**가 선행된다.
- 따라서 **architect는 이 문서를 직접 확정**한다(게이트2 상신 불요). 백엔드 동결 해제·신규 계약이 필요한
  결정(스킬 이름 노출, SSE, 고정가 부활 등)만 장차 게이트2 대상이다.

---

## 8. 미결 승계 — 마스킹 불일치 (design-brief E.3)

**결정 대기(문서만, 백엔드 무변경).** 이 문서는 미결을 해소하지 않고 **승계**한다.

- **불일치**: 계약 §3.3 서두 문구는 "소유자·최고입찰자 **마스킹**"이라 하나, **구현은 `sellerNickname`을
  원문 노출**(design-brief DTO 실측 확인). `highestBidderMasked`·`bidderMasked`는 실제 마스킹됨.
- **의존 리스크**: 판매자 본인 판정(`isSeller`)이 이 **원문 노출에 의존**한다. 나중에 문구대로 마스킹이
  들어오면 화면이 **조용히 깨진다**(isSeller 오판 → 입찰 폼/취소 버튼 오노출).
- **미결 내용**: 계약 문구(마스킹) vs 구현(원문) 중 **어느 쪽을 정본으로 확정할지** — 사용자 판단 대기.
  - 원문 정본이면: 계약 §3.3 서두 문구 정정 필요(장차 6절 절차, 이번 범위 밖).
  - 마스킹 정본이면: `sellerNickname` 마스킹 + `isSeller` 판정을 별도 boolean 플래그로 분리 필요(백엔드 변경).
- **이번 에픽 프론트 지침(잠정)**: 현 구현대로 `sellerNickname` **원문 표시**하되, `isSeller` 판정을
  **닉네임 문자열 비교에 의존하지 않도록** 설계(장차 마스킹 전환에 안전). 로그인 사용자 식별은 `/me`의
  `userPublicId`/`nickname` 기준으로, 판매자 여부는 **가능하면 서버 신호**를 쓰고 없으면 닉네임 비교를
  격리된 한 곳(승계 lib류)에 가둔다.

---

## 부록: 프론트 구현이 반드시 지켜야 할 주의 (상위 5)

1. **계약 폴백이 기본값이다.** grade·BLACK/EVENT element·실버포스/펫/아바타/이벤트 프레임·특수스킬(SS)·
   스킬 이름/효과는 **계약에 데이터가 없다** → 렌더하지 말고 STANDARD/중립표기로 폴백. 목업 §7 타입을
   그대로 믿고 필드를 참조하면 undefined 렌더가 난다.
2. **입찰은 `{ amount }`만 보낸다. expectedVersion·version·serverTime은 존재하지 않는다**(비관적락+CAS).
   에러코드는 목업 §10이 아니라 **계약 §5 BidErrorCode**(BID_002=buyNowPrice 이상, BID_003=자기경매,
   BID_005=잔액부족 — 목업과 뒤바뀜). 승계 `bidErrors.ts` 재생성으로 인코딩.
3. **마감은 `now >= endAt` 클라 판정. 서버 status를 믿지 마라**(마감 강등 워커 부재, `resultType` 항상 null).
   승계 `auctionPhase.ts`가 유일 판정처. 카운트다운은 `endAt`+`useNow()` 단일 타이머, 입찰 응답 `endAt`으로
   소프트클로즈 재동기화.
4. **금액은 정수(long)로 다루고 축약은 표시 변환뿐.** `<CodeAmount value(정수) mode>` — API·거래확정엔 원본,
   탐색엔 축약, aria-label엔 항상 전체값. `minNextBidAmount`는 서버 파생(클라 증분표 복제 금지), 변할 때
   사용자 입력을 무조건 치환하지 말 것(미만일 때만 상향, 승계 `bidAmount.ts`).
5. **404 나는 화면을 그리지 마라.** 고정가 마켓·충전·즉시구매·커뮤니티·본인인증·알림·OAuth·슬롯확장·
   AI시세·거래내역은 **준비 중 자리**(비활성 `disabled`/`aria-disabled` — 클래스만 X). 홈에서 미구현
   엔드포인트 호출 금지(FC-048 사고). 아트 캔버스 72×134·정수배·크로마키(모서리 파랑 방지)는 절대 규칙.
