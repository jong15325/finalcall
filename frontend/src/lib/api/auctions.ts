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
 * 목록 쿼리. 공통 목록 필터(계약 §3)의 부분집합만 노출한다 — 홈이 쓰는 것만.
 * 필터 전체는 경매 목록 화면(FC-059) 소관이다.
 */
export interface AuctionListQuery {
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
