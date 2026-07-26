# EPIC-CONVENTION-V2 / FC-123 — 계약영향 평가 노트 (축1=C, DTO 어휘 축약)

- **작성**: architect (계약영향 평가 패스, 2026-07-26)
- **범위**: 코드 무수정(Read/Grep 조사). V2 축1=C가 DTO 접미사(`View`·`Detail`·`Slice`·auction/shop/search의 `Command`/`Result`)를 축약할 때 **응답 JSON 형상이 바뀌는지** 판정.
- **근거 계약**: `docs/spec/api-contract.md` §1.3(53행) — cursor 응답 봉투 `data: { content:[...], nextCursor: "<opaque>|null", hasNext: <bool> }`.

---

## 결론 요약 (게이트2 상신용, 3~5줄)

1. **평가 대상 21개 DTO는 전부 컨트롤러가 직접 반환하지 않는 서비스 내부 전용 타입이다.** 모든 컨트롤러는 `ApiResponse<*Response>`/`ApiResponse<*CursorResponse>`만 반환한다(별도 `*Response` 봉투가 JSON 정본). 따라서 `Slice`/`Detail`/`Result`/`Command` 축약은 **순수 내부 개명**이며 JSON 무변경.
2. **6개 커서 응답의 봉투 필드는 이미 `content`/`nextCursor`/`hasNext`로 통일돼 있어 공용 `CursorResponse<T>`로 옮겨도 형상이 보존된다** — 계약 §1.3과 일치.
3. **유일한 주의점 = `NoticeCursorResponse.nextCursor` 타입이 `Long`(숫자)** 이다. 나머지 5개는 `String`(opaque). 공용 `CursorResponse<T>`가 `nextCursor`를 `String`으로 고정하면 notice 목록의 커서가 JSON 숫자→문자열로 바뀌어 **형상 파급**이 된다(단, notice는 Stage D 참조구현이고 계약 §1.3은 애초 "opaque string"을 규정 → 오히려 계약 정합 방향). 커서 타입을 제네릭/유지하도록 설계하면 무해.
4. **중첩 item-view 3종(`AuctionItemView`·`OrderItemView`·`ShopItemView`)은 응답의 `item` 키로 직렬화된다.** `Response` 내부 static record로 접을 때 필드명·깊이만 보존하면 JSON 동일. 요약/상세가 같은 블록을 공유하므로 접을 때 **필드 정의를 두 응답에서 동일하게 유지**해야 한다.

**프론트 조정이 필요한 실질 형상 파급: notice 커서 타입 1건(설계로 회피 가능).** 나머지 20건은 무해한 내부 개명.

---

## 대상별 판정표

범례 — 응답노출: **직접**=컨트롤러 반환 봉투, **중첩**=응답 내부 키로 직렬화, **내부**=서비스 전용(직렬화 안 됨).

### Slice(6) — 전부 서비스 내부 반환 타입, 직렬화 안 됨

| DTO | 위치 | 응답노출 | 현 형상 | 목표 | 형상보존 | 영향 엔드포인트 |
|---|---|---|---|---|---|---|
| `AuctionSlice` | auction.dto | 내부 | `content(엔티티)/nextCursor:String/hasNext` → 컨트롤러가 `AuctionCursorResponse`로 변환 | `CursorResponse<AuctionSummaryResponse>` | 보존 | `GET /auctions`(봉투 필드 동일) |
| `TempStorageSlice` | item.dto | 내부 | 위와 동형(nextCursor:String) → `TempStorageResponse` | `CursorResponse<...Item>` | 보존 | `GET /me/temp-storage` |
| `NoticeCursorSlice` | notice.dto | 내부 | `notices/nextCursor:**Long**/hasNext` → `NoticeCursorResponse`(content/nextCursor:**Long**/hasNext) | `CursorResponse<NoticeListResponse>` | **주의** | `GET /notices?cursor`(아래 주의 참조) |
| `OrderSlice` | settlement.dto | 내부 | `content/nextCursor:String/hasNext/viewerId` → `OrderCursorResponse` | `CursorResponse<OrderSummaryResponse>` | 보존 | `GET /me/orders`(viewerId는 내부 파생 인자, 직렬화 안 됨) |
| `MyShopSlice` | shop.dto | 내부 | `content/nextCursor:String/hasNext` → `MyShopCursorResponse` | `CursorResponse<MyShopSummaryResponse>` | 보존 | `GET /me/shops` |
| `ShopSlice` | shop.dto | 내부 | `content/nextCursor:String/hasNext` → `ShopCursorResponse` | `CursorResponse<ShopSummaryResponse>` | 보존 | `GET /shops` |

**주의(Notice)**: `OrderSlice.viewerId`처럼 Slice가 실어나르는 파생 인자(viewerId)는 `CursorResponse<T>`가 담을 자리가 없다. 공용 봉투로 옮기려면 viewerId 적용(역할 파생)을 **서비스가 content 매핑 시점에 끝내고** 봉투에는 이미 파생된 `OrderSummaryResponse` 리스트만 담아야 한다(현재 `OrderCursorResponse.from`이 하는 일). 봉투 자체는 무해.

### View(5)

| DTO | 위치 | 응답노출 | 현 형상 | 목표 | 형상보존 | 영향 엔드포인트 |
|---|---|---|---|---|---|---|
| `AuctionItemView` | auction.dto | **중첩**(`item` 키) | 14필드 item 블록(typeCode…specSnapshot) | 응답 내부 static record | 보존(필드 동일 유지 조건) | `GET /auctions`, `GET /auctions/{id}` |
| `OrderItemView` | settlement.dto | **중첩**(`item` 키) | 11필드 item 블록 | 응답 내부 static record | 보존 | `GET /me/orders`, `GET /orders/{id}` |
| `ShopItemView` | shop.dto | **중첩**(`item` 키) | 14필드 item 블록 | 응답 내부 static record | 보존 | `GET /shops`, `GET /shops/{id}` |
| `ItemInstanceView` | item.dto | 내부 | `instance(엔티티)+viewerIsOwner:boolean` → `ItemInstanceDetailResponse.from` | Result성 개명/제거 | 보존 | `GET /item-instances/{id}`(직렬화 안 됨) |
| `OrderView` | settlement.dto | 내부 | `order(엔티티)+viewerId` → `OrderDetailResponse.from` | Result성 개명/제거 | 보존 | `GET /orders/{id}`(직렬화 안 됨) |

**중첩 item-view 3종 권고**: `Response` 내부 record로 접을 때 요약/상세가 동일 블록을 공유한다(예: `AuctionItemView`는 `AuctionSummaryResponse.item`·`AuctionDetailResponse.item` 양쪽). 한 응답의 내부 record로 옮기면 다른 응답이 이를 교차참조하게 되므로, **필드 순서·이름·null 규약을 두 응답에서 동일하게** 유지해야 JSON이 보존된다. 별도 공용 record로 두거나(권장) 한쪽 inner를 공유.

### Detail(1)

| DTO | 위치 | 응답노출 | 현 형상 | 목표 | 형상보존 | 영향 엔드포인트 |
|---|---|---|---|---|---|---|
| `AuctionDetail` | auction.dto | 내부 | `auction(엔티티)+bidCount+minNextBidAmount` → `AuctionDetailResponse.from` | Result성 개명/제거 | 보존 | `GET /auctions/{id}`(직렬화 안 됨) |

### Result(6) — 전부 서비스 내부, `*Response`가 JSON 정본

| DTO | 위치 | 응답노출 | 현 형상 | 목표 | 형상보존 | 영향 엔드포인트 |
|---|---|---|---|---|---|---|
| `AuctionRegisterResult` | auction.dto | 내부 | `{publicId,status,endAt}` → `AuctionRegisterResponse` | Response로 흡수/축약 | 보존 | `POST /auctions` |
| `BidPlaceResult` | bid.dto | 내부 | `{bidPublicId,amount,currentHighestAmount,endAt}` → `BidPlaceResponse` | **유지**(bid는 Command/Result 존치) | 보존 | `POST /auctions/{id}/bids` |
| `PurchaseResult` | settlement.dto | 내부 | `{orderPublicId,finalPrice}` → `PurchaseResponse` | **유지**(settlement 존치) | 보존 | `POST /auctions/{id}/purchase` |
| `ShopPurchaseResult` | shop.dto | 내부 | `{orderPublicId,finalPrice}` → `ShopPurchaseResponse` | Response로 흡수/축약 | 보존 | `POST /shops/{id}/purchase` |
| `ShopRegisterResult` | shop.dto | 내부 | `{shopPublicId,status,endAt}` → `ShopRegisterResponse` | Response로 흡수/축약 | 보존 | `POST /shops` |
| `ListingSearchResult` | search.dto | 내부 | `{publicIds:List<String>,nextCursor,hasNext}` → auction 서비스가 MySQL 하이드레이션 후 `AuctionCursorResponse` 생성 | 축약 | 보존 | `GET /auctions?q`(검색결과는 절대 직렬화 안 됨 — publicId만 담고 DB 재조회) |

`ListingSearchResult`는 ES 매칭 결과(publicId 목록)일 뿐 응답에 실리지 않는다 — 표시 데이터는 MySQL 정본에서 재조회(search-spec §12.8). 축약·개명 완전 무해.

### Command(3) — 요청 측, 응답 무관

| DTO | 위치 | 방향 | 현 형상 | 목표 | 요청바디 영향 |
|---|---|---|---|---|---|
| `AuctionRegisterCommand` | auction.dto | 요청→서비스 | `AuctionRegisterRequest.toCommand()`가 채움 | 축약(Request→서비스 직접 전달 등) | **없음** — 요청 JSON은 `AuctionRegisterRequest`가 정본, Command는 record→VO 내부 변환일 뿐 |
| `BidPlaceCommand` | bid.dto | 요청→서비스 | `BidPlaceRequest`가 채움 | **유지**(bid 존치) | 없음 |
| `ShopRegisterCommand` | shop.dto | 요청→서비스 | `ShopRegisterRequest`가 채움 | 축약 | **없음** — 요청 JSON은 `ShopRegisterRequest`가 정본 |

**Command 결론**: 요청 바디 계약은 `*Request` record가 소유한다. Command는 그 뒤 서비스 입력 VO일 뿐이라 축약해도 **요청 JSON 형상에 영향 없음**.

---

## CursorResponse<T> 설계 권고 (형상 보존 조건)

1. **봉투 필드명 고정**: `content` / `nextCursor` / `hasNext`. 계약 §1.3과 기존 6개 응답 전부와 일치 — 이 3개 이름을 절대 바꾸지 말 것.
2. **`nextCursor` 타입**: 5개 도메인은 `String`(opaque). **notice만 `Long`.** 공용 `CursorResponse<T>`가 `nextCursor:String`으로 고정하면 notice 커서가 숫자→문자열로 바뀐다.
   - 권고: `CursorResponse<T>`를 `content`만 제네릭으로 두고 `nextCursor`는 **`String`(opaque)로 표준화** → 계약 §1.3("opaque")과 정합. 단 notice 목록을 실제 소비하는 프론트가 커서를 숫자로 파싱하면 파급이므로 **notice 프론트 소비 형태 확인 후 진행**(게이트2 판단 지점).
   - 대안: 커서 타입도 제네릭(`CursorResponse<T, C>`)으로 두어 notice는 `Long` 유지 → 완전 무변경(단 봉투가 복잡).
3. **중첩 item 블록**: 요약/상세 공유 record는 공용 nested record로 분리하거나 동일 필드로 복제 — 필드명·순서·null 규약 보존.

## 참조 계약 조항

- `docs/spec/api-contract.md` §1.3(53행): cursor 봉투 `{ content, nextCursor:"<opaque>|null", hasNext }` — **모든 커서 응답의 정본 규정**.
- §3.3(402·411·426행): `AuctionSummary`/`BidSummary`/`ShopSummary` content 항목 스키마 + 공통 item 블록.
- §4.3(497행): `OrderSummary` content(역할 인지). §4.2(470행): temp-storage(계약은 `items:` 표기이나 현 구현은 `content` — 기존 드리프트, V2 무관).
