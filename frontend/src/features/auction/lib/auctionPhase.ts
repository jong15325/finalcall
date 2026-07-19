/**
 * 경매 진행 단계 판정 (FC-064).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **서버 `status` 를 그대로 믿으면 끝난 경매에 입찰 바가 뜬다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 마감 강등 워커가 아직 없다 — `Auction.displayStatus()` 는 `SCHEDULED→ACTIVE` **승격만**
 * 하고 마감으로 내리지 않는다. 그래서 **`endAt` 이 지난 경매도 `status: "ACTIVE"` 로
 * 내려온다.** 그 값을 그대로 렌더하면 화면은 "진행 중"이라 말하고 입찰 버튼을 내주는데
 * 서버는 그 입찰을 `BID_006`(마감/종료됨)으로 거절한다 — **화면이 사용자에게 거짓말을 한다.**
 *
 * 그래서 마감은 **시각으로 판정한다**(`now >= endAt`). 이것이 서버와 정합한 판정이다 —
 * `BidService.isBiddable()` 도 status 가 아니라 **시각**으로 입찰 가능 여부를 가른다.
 *
 * ★ **낙찰을 단정하지 않는다.** `resultType` 은 항상 null 이고(EPIC-CLOSING 소유) 정산 전이라
 *   `highestBidderMasked` 는 "낙찰자" 가 아니라 **"최고 입찰자"** 다. 화면 문구도 거기까지만.
 */

import type { AuctionStatus } from '@/lib/api/auctions'

export type AuctionPhase = 'scheduled' | 'live' | 'ended'

/**
 * 종료 상태 — 여기 속하면 시각과 무관하게 끝이다(취소는 `endAt` 전에도 끝난다).
 *
 * ★ 집합 밖의 값(우리가 모르는 신규 상태)은 **에러가 아니라 시각 판정으로 흐른다** —
 *   계약 §3.3 의 미등록 코드 폴백 태도와 같다.
 */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
    'SOLD',
    'UNSOLD',
    'CANCELLED',
])

export interface AuctionPhaseInput {
    status: AuctionStatus
    /** 예약 경매의 시작 시각. 즉시 시작이면 null */
    startAt: string | null
    endAt: string
}

export function auctionPhaseOf(
    auction: AuctionPhaseInput,
    now: number,
): AuctionPhase {
    if (TERMINAL_STATUSES.has(auction.status)) return 'ended'

    const endAt = Date.parse(auction.endAt)
    /*
     * 파싱 불가는 '마감'으로 흘린다 — 값 하나가 이상하다고 입찰 버튼을 내주면
     * 서버가 거절할 요청을 사용자가 보내게 된다. 안전한 쪽은 잠그는 쪽이다.
     */
    if (!Number.isFinite(endAt) || now >= endAt) return 'ended'

    const startAt = auction.startAt ? Date.parse(auction.startAt) : null
    if (startAt !== null && Number.isFinite(startAt) && now < startAt) {
        return 'scheduled'
    }

    return 'live'
}

/**
 * 입찰 가능 여부. **화면 표시 제어일 뿐 인가가 아니다** — 서버가 `BID_006`·`BID_007` 로
 * 최종 판정하고, 화면은 그 응답도 반드시 처리한다.
 */
export function isBiddablePhase(phase: AuctionPhase): boolean {
    return phase === 'live'
}

/** 상태 한 줄. 마감은 결과를 단정하지 않는다(위 ★). */
export function auctionPhaseLabelOf(phase: AuctionPhase): string {
    switch (phase) {
        case 'scheduled':
            return '시작 전'
        case 'ended':
            return '마감'
        default:
            return '진행 중'
    }
}

/**
 * ★ **판매자 여부는 닉네임 비교로 파생한다** — 계약에 `isSeller` 가 없다.
 *   닉네임은 활성 회원 간 유일하고(`uk_user_nickname_active`), 진행 중 경매를 가진 판매자는
 *   탈퇴가 막혀(`MEMBER_002`) 재사용 오탐 경로도 닫혀 있다.
 *
 * ★★ **그래도 이건 인가가 아니라 표시 제어다.** 입찰 버튼을 숨기는 데까지만 쓰고,
 *    서버 `BID_003`(자기 경매 입찰, 403) 처리는 **반드시 별도로 구현한다.**
 */
export function isOwnAuction(
    sellerNickname: string,
    myNickname: string | null | undefined,
): boolean {
    return Boolean(myNickname) && sellerNickname === myNickname
}
