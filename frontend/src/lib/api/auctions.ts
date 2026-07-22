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
    /**
     * ★ 슬롯 스킬명(계약 §3.3 델타·skill-exposure-spec — EPIC-MARKET-DATA). 출처
     *   `skill_definition.name`(§5 효과 서술 그대로). skill1/skill2(코드)가 null 이면 각각 null
     *   (마법 카드는 skill1 부재 → skill1Name=null). 이름은 코드에 **부가**될 뿐 코드를 대체하지
     *   않는다(필터·아트 매핑은 코드 유지). 서버·클라 배포 시차로 부재할 수 있어 optional 이다. */
    skill1Name?: string | null
    skill2Name?: string | null
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
 * ★★ **계약에 있는 축 중 두 가지를 일부러 뺐다.** 타입에 없으면 화면이 만들 수 없다:
 *   - `mainCategory` — 값이 `1` 하나뿐이라(§3.3.1) 축이 되지 않는다. 선택지가 하나인
 *     필터는 아무것도 거르지 않으면서 자리만 차지한다.
 *   - `skill1`/`skill2` — **코드→이름 매핑 API 가 계약에 없다.** 숫자 코드를 그대로
 *     고르게 할 수는 없으므로 선택지를 만들 방법이 없다.
 *
 * ★ `q`(자유문 검색)는 계약 §3 C1(EPIC-SEARCH)로 신설됐다 — `nameSnapshot` 매칭. 최소 2·최대
 *   64자·`relevance` 정렬은 화면 정규화(`auctionFilters.ts`)가 강제한다(계약 C2·C3).
 * ★ `kind` 는 여기서 단독으로 들어올 수 있는 것처럼 보이지만, 화면 쪽 정규화
 *   (`features/auction/lib/auctionFilters.ts`)가 `subGroup` 없는 `kind` 를 지운다.
 *   서버는 400 으로 막지 않으므로(§4.1) 그 방어가 클라이언트에만 있다.
 */
export interface AuctionListQuery {
    /** 자유문 검색(계약 §3 C1). 없으면 생략. 2~64자·`relevance` 정렬과 짝(§C2·C3) */
    q?: string
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
    /**
     * `<field>,<asc|desc>` — field 화이트리스트는 `price·endAt·createdAt·highestBidAmount`.
     * `relevance`(관련도순, 방향 없음)는 **`q` 있을 때만** 유효하다(계약 C2).
     */
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

/**
 * `POST /auctions` 요청 (계약 §3.1) — FC-073.
 *
 * ★ **금액은 정수(long)**, 시각은 **ISO-8601 UTC(Instant)** 문자열이다. 화면의
 *   `datetime-local` 로컬 문자열을 그대로 보내지 마라 — `features/auction/lib/sellForm.ts`
 *   가 UTC ISO 로 변환한 값을 넣는다(계약 §1 시간 타입).
 * ★ `startAt`·`buyNowPrice`·소프트클로즈 두 값은 **선택**이다. 미설정이면 키 자체를 빼서
 *   보낸다(빈 문자열·0 을 보내면 서버 검증이 오작동할 수 있다).
 */
export interface CreateAuctionRequest {
    itemInstancePublicId: string
    startPrice: number
    /** 즉시구매 참고가. 있으면 `> startPrice`(아니면 `AUCTION_003`) */
    buyNowPrice?: number
    /** 예약 시작 시각(ISO). 있으면 `≤ endAt` */
    startAt?: string
    /** 마감 시각(ISO). 필수, `> now` */
    endAt: string
    /** 마감 임박 연장 판단 창(초). 양수·상한 이내 */
    softCloseWindowSec?: number
    /** 1회 연장 시간(초). 양수·상한 이내 */
    softCloseExtendSec?: number
    /** 연장 상한 시각(ISO). 필수, `≥ endAt` */
    maxEndAt: string
}

/** `POST /auctions` 201 (계약 §3.1). */
export interface CreateAuctionResponse {
    auctionPublicId: string
    status: AuctionStatus
    /** 생성된 마감 시각(요청 `endAt` 을 서버가 확정·반향) */
    endAt: string
}

/**
 * `POST /auctions` — **인증 필요**(등록자 = 판매자).
 *
 * ★ 실패는 `AUCTION_001`(미소유·미보유·미존재 403 단일) · `AUCTION_002`(이미 출품중 409) ·
 *   `AUCTION_003`(buyNowPrice ≤ startPrice 422) · `AUCTION_008`(시간 파라미터 위반 422).
 *   문구 매핑은 `features/auction/lib/sellErrors.ts`.
 */
export function createAuction(
    body: CreateAuctionRequest,
): Promise<CreateAuctionResponse> {
    return apiClient.post<CreateAuctionResponse>('/auctions', body)
}

/** `POST /auctions/{id}/purchase` 201 (계약 §3.1). */
export interface PurchaseAuctionResponse {
    orderPublicId: string
    /** 확정 낙찰가 = 서버가 정한 `buyNowPrice`(클라 금액 신뢰 없음) */
    finalPrice: number
}

/**
 * `POST /auctions/{id}/purchase`(즉시구매) — **인증 필요**. FC-090(EPIC-PURCHASE v1.13 승격).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **요청 본문이 없다.** 금액은 서버가 `buy_now_price` 로 확정한다(purchase-spec §2 — 클라
 *    금액 신뢰 없음). `apiClient.post` 에 body 를 넘기지 않으면 Content-Type 도 붙지 않는다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ★ 성립하면 경매가 `SOLD`(resultType=BUYNOW)로 종료되고 구매자 게임머니가 **직접 차감**되며
 *   아이템이 구매자 인벤토리(만실 시 임시보관)로 이전된다(purchase-spec §3·§8). 무효화 반경은
 *   `usePurchaseAuction` 참고.
 * ★ 실패는 `AUCTION_005`(미설정 422)·`AUCTION_006`(구매 불가·미개시/종료 409)·`AUCTION_009`
 *   (자기구매 403)·`BID_005`(잔액 부족 422)·`AUCTION_004`(없음 404). 문구는 `purchaseErrors.ts`.
 */
export function purchaseAuction(
    auctionPublicId: string,
): Promise<PurchaseAuctionResponse> {
    return apiClient.post<PurchaseAuctionResponse>(
        `/auctions/${auctionPublicId}/purchase`,
    )
}
