import { apiClient } from './client'
import type { AuctionItemBlock } from './auctions'
import type { CursorPage } from '@/types/api'

/**
 * 고정가 마켓 API (계약 §3.2 `/shops` · §3.3 ShopSummary/ShopDetail) — FC-094 / shop-spec v0.2.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **API 정본은 우리 계약이다 — 목업의 권장 `/market/listings` 는 폐기했다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 목업 HANDOVER §9 는 `/market/listings`·`expectedPrice`·`idempotencyKey` 를 권장했으나
 * (rebuild-contract-map §327) 채택하지 않는다. 실제 계약은 `GET /shops`(커서)·`GET /shops/{id}`·
 * `POST /shops`(등록)·`POST /shops/{id}/purchase`(구매)다.
 *
 * ★ 계약 스키마와 1:1. 클라 편의를 위한 필드 추가·개명 금지(`types/api.ts` 상단 규칙).
 * ★ **아이템 블록은 경매와 동일**(`AuctionItemBlock`, 계약 §3.3 공통 item 블록) — 재사용한다.
 */

/**
 * 고정가 상태(shop-spec §2.1 상태 머신 · 계약 §3.2).
 *
 * ★ 알려진 값을 유니온으로 좁히되 **`(string & {})` 를 열어둔다** — 서버가 우리가 모르는
 *   상태를 먼저 배포할 수 있고, 그때 타입 에러 대신 폴백 경로로 흘러야 한다(계약 §3.3 태도).
 */
export type ShopStatus =
    | 'ACTIVE'
    | 'SOLD'
    | 'EXPIRED'
    | 'CANCELLED'
    | (string & Record<never, never>)

/**
 * ShopSummary (계약 §3.3 — `GET /shops` content 항목).
 *
 * ★ `endAt` 은 **서버가 등록 시점에 자동 계산**한다(판매자 미지정, shop-spec §3.1 — `now + 설정
 *   일수`). nullable 은 향후 무기한 캐시아이템용 seam 이며, 이 에픽 등록 경로는 항상 유한값을 만든다.
 */
export interface ShopSummary {
    shopPublicId: string
    status: ShopStatus
    /** 계약 §3.3 공통 item 블록(경매와 동일 스키마) */
    item: AuctionItemBlock
    /** 고정 판매가(원본 정수) */
    price: number
    /** 판매 기한(ISO-8601 UTC). 무기한이면 null(현재 등록 경로는 항상 유한) */
    endAt: string | null
    /** 리스팅 고유 정보라 마스킹 대상이 아니다 */
    sellerNickname: string
}

/** ShopDetail (계약 §3.3 — `GET /shops/{id}`). ShopSummary + `createdAt`. */
export interface ShopDetail extends ShopSummary {
    createdAt: string
}

/**
 * 목록 쿼리 — 계약 §3 공통 목록 필터(경매·고정가 공유).
 *
 * ★★ **경매 목록과 같은 축을 뺐다**(`auctionFilters` 주와 동일 판단): `mainCategory`(값 1뿐) ·
 *   `skill1`/`skill2`(코드→이름 매핑 API 없음) · `q`/keyword(자유문 검색 없음)는 타입에 두지 않는다.
 * ★ `kind` 는 **`subGroup` 종속**이라 단독 전송 금지(§4.1) — 화면 정규화(`shopFilters`)가 막는다.
 * ★ 정렬 화이트리스트는 경매와 다르다 — `price·endAt·createdAt`(고정가엔 `highestBidAmount` 없음, §3).
 */
export interface ShopListQuery {
    subGroup?: number
    kind?: number
    element?: number
    minLevel?: number
    maxLevel?: number
    goldforceActive?: boolean
    minPrice?: number
    maxPrice?: number
    status?: ShopStatus
    /** `<field>,<asc|desc>` — field 화이트리스트는 `price·endAt·createdAt` */
    sort?: string
    size?: number
    cursor?: string
}

/** `GET /shops` — **인증 불요**. 손님도 봐야 하므로 `auth: false` 로 토큰을 붙이지 않는다. */
export function getShops(
    query: ShopListQuery = {},
    signal?: AbortSignal,
): Promise<CursorPage<ShopSummary>> {
    return apiClient.get<CursorPage<ShopSummary>>('/shops', {
        query: { ...query },
        auth: false,
        signal,
    })
}

/** `GET /shops/{id}` — 인증 불요(공개 상세). 없으면 `SHOP_003`(404). */
export function getShop(
    shopPublicId: string,
    signal?: AbortSignal,
): Promise<ShopDetail> {
    return apiClient.get<ShopDetail>(`/shops/${shopPublicId}`, {
        auth: false,
        signal,
    })
}

/**
 * `POST /shops` 요청 (계약 §3.2 · shop-spec §3) — FC-094.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **기한 입력 필드가 없다.** 판매자는 기한을 고르지 않는다(shop-spec §3.1 게이트2 정정) —
 *    서버가 `end_at = now + 설정 일수`(기본 7일)로 자동 계산한다. `endAt` 을 보내지 마라.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ★ **금액은 정수(long), `> 0`.** 즉시구매가·시작가·시간 파라미터가 전부 없다(경매보다 짧다).
 */
export interface CreateShopRequest {
    itemInstancePublicId: string
    price: number
}

/** `POST /shops` 201 (계약 §3.2). */
export interface CreateShopResponse {
    shopPublicId: string
    status: ShopStatus
}

/**
 * `POST /shops` — **인증 필요**(등록자 = 판매자).
 *
 * ★ 실패는 `SHOP_001`(미소유·미보유·미존재 403 단일) · `SHOP_002`(이미 출품중 409).
 *   문구 매핑은 `features/shop/lib/shopErrors.ts`.
 */
export function createShop(
    body: CreateShopRequest,
): Promise<CreateShopResponse> {
    return apiClient.post<CreateShopResponse>('/shops', body)
}

/** `POST /shops/{id}/purchase` 201 (계약 §3.2). */
export interface PurchaseShopResponse {
    orderPublicId: string
    /** 확정 결제가 = 서버가 정한 `shop.price`(클라 금액 신뢰 없음) */
    finalPrice: number
}

/**
 * `POST /shops/{id}/purchase`(고정가 구매) — **인증 필요**. FC-094.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **요청 본문이 없다.** 금액은 서버가 `shop.price` 로 확정한다(shop-spec §4.1 — 클라 금액
 *    신뢰 없음). `apiClient.post` 에 body 를 넘기지 않으면 Content-Type 도 붙지 않는다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ★ 성립하면 리스팅이 `SOLD` 로 종료되고 구매자 게임머니가 **직접 차감**(홀드 미경유)되며 아이템이
 *   구매자 인벤토리(만실 시 임시보관)로 이전된다(shop-spec §4.1·§4.2). 무효화 반경은 `usePurchaseShop`.
 * ★ 실패는 `SHOP_004`(이미 판매/종료 409)·`SHOP_005`(잔액 부족 422)·`SHOP_006`(자기구매 403)·
 *   `SHOP_003`(없음 404). 문구는 `shopErrors.ts`.
 */
export function purchaseShop(
    shopPublicId: string,
): Promise<PurchaseShopResponse> {
    return apiClient.post<PurchaseShopResponse>(`/shops/${shopPublicId}/purchase`)
}
