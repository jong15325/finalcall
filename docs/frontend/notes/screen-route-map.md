# 화면·라우트 맵 / feature 구조 작업 노트

성격: 미확정 분석/초안 — 타 역할 근거 인용 금지 (D-014 유형 4). 근거는 api-contract v1.1(확정 스펙)만 인용.
관련: api-contract.md v1.1, frontend/CLAUDE.md 3·4절, domain-spec §3·§6, F-001

목적: 계약 v1.1 엔드포인트를 라우트·feature·타입으로 1:1 대응시켜 구현 분해의 기준을 만든다.
이 노트는 초안이며, 확정 결정은 decision-log(F-xxx)로 옮긴다.

---

## 1. 라우트 맵 (계약 엔드포인트 대응)

인증 불요(공개):

| 라우트 | 화면 | 계약 엔드포인트 |
|---|---|---|
| `/login` | 로그인 | POST /auth/login |
| `/signup` | 회원가입 | POST /auth/signup |
| `/` | 홈(경매·고정가 통합 피드, 탭) | GET /auctions, GET /shops |
| `/auctions` | 경매 목록(필터·정렬·cursor) | GET /auctions |
| `/auctions/:auctionPublicId` | 경매 상세(입찰·즉시구매) | GET /auctions/{id}, GET /auctions/{id}/bids |
| `/shops` | 고정가 목록 | GET /shops |
| `/shops/:shopPublicId` | 고정가 상세(구매) | GET /shops/{id} |
| `/items/:itemInstancePublicId` | 아이템 인스턴스 상세 | GET /items/{id} |
| `/market-prices` | 시세 조회 | GET /market-prices |

인증 필요(`me` 주체):

| 라우트 | 화면 | 계약 엔드포인트 |
|---|---|---|
| `/sell` | 판매 등록(경매/고정가 선택, 인벤토리에서 아이템 선택) | POST /auctions, POST /shops |
| `/me/inventory` | 정규 인벤토리(96칸) | GET /me/inventory, POST /me/temp-storage/{id}/relocate |
| `/me/temp-storage` | 임시보관(오버플로우) | GET /me/temp-storage |
| `/me/orders` | 거래 내역(BUYER/SELLER 필터) | GET /me/orders |
| `/me/orders/:orderPublicId` | 주문 상세 | GET /orders/{id} |
| `/me/wallet` | 지갑(잔액·충전·교환·충전내역) | GET /me/balance, POST /charges, POST /exchanges, GET /me/charges |
| `/me/wallet/charge/confirm` | 토스 결제 승인 콜백 처리 | POST /charges/confirm |

인증 필요(관리자):

| 라우트 | 화면 | 계약 엔드포인트 |
|---|---|---|
| `/admin/auctions/:auctionPublicId` | 관리자 경매 조치(강제 취소) | POST /admin/auctions/{id}/force-cancel |

주: 판매자 취소(POST /auctions|shops/{id}/cancel)는 상세 화면 내 액션으로 흡수(별도 라우트 없음).

## 2. feature 구조 (CLAUDE.md 3절 — features/<도메인>)

각 feature = api/(함수+Query 훅) + components/ + hooks/.

- `features/auth` — signup·login·refresh·logout. 세션은 Zustand 전역(CLAUDE.md 4절).
- `features/auction` — 목록·상세·등록·판매자취소·즉시구매(POST /auctions/{id}/purchase는 경매 소속).
- `features/bid` — 입찰(POST /auctions/{id}/bids)·입찰내역. 경매 상세에 중첩 마운트.
- `features/shop` — 고정가 목록·상세·등록·구매·판매자취소.
- `features/item` — 아이템 인스턴스 상세·item-templates 카탈로그·market-prices.
- `features/inventory` — 인벤토리·임시보관·relocate.
- `features/order` — 내 거래·주문 상세.
- `features/wallet` — 잔액·충전(charges·confirm)·교환(exchanges)·충전내역.
- `features/admin` — 강제 취소.

공용 후보(components/·lib/·types/): 필터바(경매·고정가·아이템 검색이 공통 필터 공유 — 계약 §3), item 표시 카드/스냅샷, 페이지네이션(cursor/offset), 금액·시간 포매터. 두 번째 사용처 확인 시 공용 승격(CLAUDE.md 3절).

## 3. 공용 타입 (types/ — 계약 스키마 대응)

envelope·페이지 래퍼(계약 §1.4·§1.3):

- `ApiResponse<T>` = `{ success:true, data:T, timestamp }` | `{ success:false, code, message, errors?, timestamp }`.
- `CursorPage<T>` = `{ content:T[], nextCursor:string|null, hasNext:boolean }`.
- `OffsetPage<T>` = `{ content:T[], page, size, totalElements, totalPages }`.
- `ErrorCode` 상수 = 계약 §5 표(AUTH_001…EXC_002 + COMMON_004)를 코드 enum/상수로 고정, 화면 분기·메시지 매핑의 단일 출처(CLAUDE.md 5절).

도메인 DTO(응답 형태 대응): `AuctionSummary`/`AuctionDetail`, `Bid`, `ShopSummary`/`ShopDetail`, `ItemInstance`, `ItemTemplate`, `MarketPrice`, `InventorySlot`, `TempStorageItem`, `Order`/`OrderDetail`, `Balance`(cashBalance·gameMoneyBalance·gameMoneyHeld·gameMoneyAvailable), `Charge`, `Exchange`.

주의: 외부 식별자는 public_id(ULID), item_template은 typeCode(계약 §1.1·§4.1). 내부 BIGINT id는 계약상 미노출 — 타입에 두지 않는다.

## 4. 페이징·정렬 대응 (계약 §1.3·§3)

- cursor 목록: 경매·고정가·임시보관·주문·충전내역 → 무한 스크롤(useInfiniteQuery).
- offset 목록: item-templates·입찰내역 → 페이지 번호 UI.
- 정렬 화이트리스트: 경매 `price·endAt·createdAt·highestBidAmount`, 고정가 `price·endAt·createdAt`. UI 정렬 옵션을 이 화이트리스트로 제한(임의 필드 금지).
- 공통 필터(경매·고정가·아이템 검색 공유): mainCategory·subGroup·element·kind·grade·minLevel/maxLevel·skill1/skill2·goldforceActive·minPrice/maxPrice·status → 단일 `SearchFilterBar` 공용 컴포넌트로 재사용.

## 5. 상태 관리 배치 (CLAUDE.md 4절)

- 서버 데이터 전부 TanStack Query. 쿼리 키 `[도메인, 리소스, 파라미터]`. 예: `['auction','detail',auctionPublicId]`, `['auction','list',filters]`, `['wallet','balance']`.
- Zustand 전역: 인증 세션(accessToken·만료·user 요약), 테마. 그 외 로컬 state.
- 실시간 최고가·남은시간: F-001(폴링). 상세 화면 한정 refetchInterval, 종료 시 중지.
- 낙관적 갱신 후보: 입찰·구매·relocate 성공 시 관련 쿼리 invalidate(잔액·인벤토리·경매 상세). 실패는 계약 에러코드로 롤백 분기.

## 6. 계약 공백·확인 필요 (구현 전 해소 — 추측 금지, CLAUDE.md 2절)

이 절은 결정 요청/확인 대상이며 임의 가정하지 않는다.

- 실시간 푸시 채널(SSE/WS) 부재 → F-001 폴링으로 진행, 도입 여부는 총괄 결정 요청(outbox/001 안건 2).
- 프론트 저장소 미생성 → 스켈레톤(Vite+React+TS) 생성 시점·방식 총괄·사용자 협의(outbox/001 안건 1). 계약 복사본은 repo 셋업 시 생성(원본 경로·버전·해시 헤더, D-030).
- 목록/상세 응답의 정확한 필드 스키마(요약 vs 상세 필드 목록)는 계약이 "요약/스냅샷" 수준으로만 기술 → 타입 확정 전 백엔드 구현 응답 또는 기획 확인 필요. 착수 시 확인 대상으로 표기, 임의 확정 금지.
- Claude Code 작업 프롬프트 형식: 킥오프가 templates §18을 지목하나 현행 templates는 §17까지. D-069(핸드오프 규약)를 기준으로 삼되 §18 부재는 총괄 확인 대상.
