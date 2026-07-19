import { apiClient } from './client'
import type { CursorPage } from '@/types/api'

/**
 * 경매 목록 API (계약 §3.1 `GET /auctions` · §3.3 AuctionSummary) — FC-058.
 *
 * ★ 계약 스키마와 1:1. 클라 편의를 위한 필드 추가·개명 금지(`types/api.ts` 상단 규칙).
 *   특히 `startPrice` 를 "현재가"로 개명하지 마라 — 입찰이 붙으면 현재가는
 *   `highestBidAmount` 이고 둘은 다른 값이다. 화면이 그 구분을 해야 한다.
 */

/**
 * 경매 상태(계약 §3.1 · 백엔드 `AuctionStatus` 5값).
 *
 * ★ 알려진 값을 유니온으로 좁히되 **`(string & {})` 를 열어둔다** — 서버가 우리가 모르는
 *   상태를 먼저 배포할 수 있고, 그때 타입 에러 대신 폴백 경로로 흘러야 한다(계약 §3.3 태도).
 */
export type AuctionStatus =
    | 'SCHEDULED'
    | 'ACTIVE'
    | 'SOLD'
    | 'UNSOLD'
    | 'CANCELLED'
    | (string & Record<never, never>)

/**
 * 목록/상세 공통 item 블록 (계약 §3.3).
 * **5개 코드 축과 `level`·`skillPercent` 는 전부 정수다** — 문자열로 다루면 정렬·비교가
 * 사전순으로 깨진다(계약 §3.3 명시).
 */
export interface AuctionItemBlock {
    typeCode: number
    mainCategory: number
    subGroup: number
    element: number
    kind: number
    level: number
    /** 슬롯이 비면 null. 마법(subGroup 3)은 **구조적으로** skill1 이 없다 */
    skill1: number | null
    skill2: number | null
    skillPercent: number
    /** 골드포스 만료 시각(ISO-8601 UTC). 미적용이면 null. 활성 여부는 클라 파생 */
    goldforceExpireAt: string | null
    /** 등록 시점 스냅샷(D-045) — 표시명은 이 값이 코드 사전보다 우선한다 */
    nameSnapshot: string
    specSnapshot: string
}

/** AuctionSummary (계약 §3.3 — `GET /auctions` content 항목) */
export interface AuctionSummary {
    auctionPublicId: string
    status: AuctionStatus
    item: AuctionItemBlock
    startPrice: number
    buyNowPrice: number | null
    /** 입찰이 없으면 null — `startPrice` 로 대체하지 않는다(서버가 정직히 구분해 내린다) */
    highestBidAmount: number | null
    bidCount: number
    startAt: string | null
    endAt: string
    /** 리스팅 고유 정보라 마스킹 대상이 아니다(최고입찰자만 상세에서 마스킹) */
    sellerNickname: string
}

/**
 * 목록 쿼리 — 계약 §3 공통 목록 필터 (FC-059 에서 전 축으로 확장).
 *
 * ★★ **계약에 있는 축 중 세 가지를 일부러 뺐다.** 타입에 없으면 화면이 만들 수 없다:
 *   - `mainCategory` — 값이 `1` 하나뿐이라(§3.3.1) 축이 되지 않는다. 선택지가 하나인
 *     필터는 아무것도 거르지 않으면서 자리만 차지한다.
 *   - `skill1`/`skill2` — **코드→이름 매핑 API 가 계약에 없다.** 숫자 코드를 그대로
 *     고르게 할 수는 없으므로 선택지를 만들 방법이 없다.
 *   - `q`/keyword — **계약에 자유문 검색이 없다.** 만들면 동작하지 않는 컨트롤이다.
 *
 * ★ `kind` 는 여기서 단독으로 들어올 수 있는 것처럼 보이지만, 화면 쪽 정규화
 *   (`features/auction/lib/auctionFilters.ts`)가 `subGroup` 없는 `kind` 를 지운다.
 *   서버는 400 으로 막지 않으므로(§4.1) 그 방어가 클라이언트에만 있다.
 */
export interface AuctionListQuery {
    /** 대분류 1=무기 · 2=방어구 · 3=마법 (§3.3.1) */
    subGroup?: number
    /** 종류. **의미가 `subGroup` 에 의존한다** — 단독 전송 금지(§4.1) */
    kind?: number
    /** 속성 1=물 · 2=불 · 3=흙 · 4=바람 (§3.3.1) */
    element?: number
    minLevel?: number
    maxLevel?: number
    goldforceActive?: boolean
    minPrice?: number
    maxPrice?: number
    status?: AuctionStatus
    /** `<field>,<asc|desc>` — field 화이트리스트는 `price·endAt·createdAt·highestBidAmount` */
    sort?: string
    size?: number
    cursor?: string
}

/** `GET /auctions` — **인증 불요**. 손님도 봐야 하므로 `auth: false` 로 토큰을 붙이지 않는다. */
export function getAuctions(
    query: AuctionListQuery = {},
    signal?: AbortSignal,
): Promise<CursorPage<AuctionSummary>> {
    return apiClient.get<CursorPage<AuctionSummary>>('/auctions', {
        query: { ...query },
        auth: false,
        signal,
    })
}
