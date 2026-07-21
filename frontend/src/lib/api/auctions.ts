import { apiClient } from './client'
import type { CursorPage, OffsetPage } from '@/types/api'

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

/**
 * AuctionDetail (계약 §3.3) — `AuctionSummary` + 6필드. FC-064.
 *
 * ★★ **`resultType` 은 지금 항상 null 이다**(마감 처리는 EPIC-CLOSING 소유). 그래서 이 값으로
 *    "낙찰/유찰"을 판정하면 **아무 경매도 낙찰로 보이지 않는다.** 화면은 `endAt` 으로 마감을
 *    판정하고(`features/auction/lib/auctionPhase.ts`), 낙찰 여부는 **단정하지 않는다.**
 *
 * ★ `minNextBidAmount` 는 **서버 파생값이다. 증분표를 클라에 복제하지 마라.**
 *   서버의 `AuctionService`·`BidService` 가 같은 증분 설정을 쓰므로 "안내받은 금액으로
 *   입찰했는데 거부" 가 구조적으로 불가능하다. 클라가 계산을 흉내내는 순간 그 보장이 깨진다.
 */
export interface AuctionDetail extends AuctionSummary {
    /** 마감 결과. **현재 서버가 채우지 않는다**(항상 null) */
    resultType: string | null
    /** 최고 입찰자 닉네임 마스킹(앞 2자 + `***`). 입찰이 없으면 null */
    highestBidderMasked: string | null
    /** 소프트클로즈 연장 횟수 */
    extensionCount: number
    /** 연장 상한 시각 — 이보다 늦게 마감되지 않는다 */
    maxEndAt: string
    createdAt: string
    /** 다음 입찰의 최소 금액(서버 파생). **종료 상태에서는 null** */
    minNextBidAmount: number | null
}

/** BidSummary `status` (계약 §3.3). 경매당 `ACTIVE` 는 최대 1건이다. */
export type BidStatus =
    'ACTIVE' | 'OUTBID' | 'WON' | (string & Record<never, never>)

/**
 * BidSummary (계약 §3.3 — `GET /auctions/{id}/bids` content 항목).
 *
 * ★ 자금 정보(홀드액·잔액)는 **계약이 싣지 않는다** — 타인 자금 상태 노출 금지.
 *   입찰자는 `bidderMasked` 뿐이고 `userPublicId` 는 오지 않는다(회원 열거 방지, SEC-007).
 *   즉 **"내 입찰"을 이력에서 표시할 방법이 없다** — 만들려 하지 마라.
 */
export interface BidSummary {
    bidPublicId: string
    bidderMasked: string
    amount: number
    status: BidStatus
    createdAt: string
}

/** `POST /auctions/{id}/bids` 201 (계약 §3.1). */
export interface PlaceBidResponse {
    bidPublicId: string
    amount: number
    currentHighestAmount: number
    /** ★ **소프트클로즈 연장이 반영된** 마감 시각 — 카운트다운을 이 값으로 재동기화한다 */
    endAt: string
}

/** `GET /auctions/{id}` — 인증 불요(공개 상세). 없으면 `AUCTION_004`(404). */
export function getAuction(
    auctionPublicId: string,
    signal?: AbortSignal,
): Promise<AuctionDetail> {
    return apiClient.get<AuctionDetail>(`/auctions/${auctionPublicId}`, {
        auth: false,
        signal,
    })
}

/**
 * `GET /auctions/{id}/bids` — 인증 불요. **offset 페이징**(계약 §1.3 소규모 예외).
 *
 * ★ 서버가 `size` 를 **조용히 100 으로 정규화**한다(계약에 미기재). 100 초과를 보내면
 *   요청한 수와 받은 수가 달라지므로 호출부가 100 이하를 쓴다.
 */
export function getAuctionBids(
    auctionPublicId: string,
    query: { page: number; size: number },
    signal?: AbortSignal,
): Promise<OffsetPage<BidSummary>> {
    return apiClient.get<OffsetPage<BidSummary>>(
        `/auctions/${auctionPublicId}/bids`,
        { query: { ...query }, auth: false, signal },
    )
}

/** `POST /auctions/{id}/bids` — **인증 필요**. 실패는 `BID_001~007`·`AUCTION_004`(§5). */
export function placeBid(
    auctionPublicId: string,
    amount: number,
): Promise<PlaceBidResponse> {
    return apiClient.post<PlaceBidResponse>(
        `/auctions/${auctionPublicId}/bids`,
        { amount },
    )
}

/** `POST /auctions/{id}/cancel` 200 (계약 §3.1). `status` 는 취소 결과("CANCELLED"). */
export interface AuctionCancelResponse {
    status: string
}

/**
 * `POST /auctions/{id}/cancel` — **판매자 본인 인증 필요**(계약 §3.1).
 *
 * ★ 서버가 **입찰 0건 & (SCHEDULED|ACTIVE)** 일 때만 취소한다(v1.7 정밀화). 그 밖은 거절이다 —
 *   `AUCTION_007`(입찰 존재, 409) · `AUCTION_006`(이미 종료, 409) · `AUCTION_001`(미소유, 403).
 *   화면은 표시 제어로 버튼을 가리되(판매자·입찰0), **최종 판정은 이 응답으로** 처리한다.
 */
export function cancelAuction(
    auctionPublicId: string,
): Promise<AuctionCancelResponse> {
    return apiClient.post<AuctionCancelResponse>(
        `/auctions/${auctionPublicId}/cancel`,
    )
}

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **`POST /auctions/{id}/purchase`(즉시구매)를 여기에 만들지 마라.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 계약 §3.1 에 **완전히 명세돼 있으나 백엔드에 매핑이 없다** — 호출하면 404 다
 * (`AUCTION_005`/`AUCTION_009` 도 서버 enum 에 없다. EPIC-CLOSING 소유).
 * FC-048 이 계약만 보고 `/shops` 를 호출했다가 홈에 에러 배너를 띄운 것과 같은 함정이다.
 * `buyNowPrice` 는 **정보 표기로만** 쓴다.
 */
