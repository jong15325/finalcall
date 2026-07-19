import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 경매 가격 표시 파생 (FC-058).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **"현재가"와 "시작가"를 같은 이름으로 부르지 않는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 계약 §3.3 의 `highestBidAmount` 는 **입찰이 없으면 null** 이다. 이때 `startPrice` 를 꺼내
 * "현재가"라고 적으면 **입찰이 하나도 없는 경매를 이미 그 값에 거래된 것처럼** 보이게 한다.
 * 서버가 두 값을 정직히 구분해 내리므로 화면도 구분한다 — 라벨이 다르다.
 *
 * (그래서 `AuctionSummary.startPrice` 를 "현재가"로 개명하지 않았다. `lib/api/auctions.ts` 주.)
 */

const gameMoney = new Intl.NumberFormat('ko-KR')

/** 게임머니 표기. 단위는 화면에서 별도로 붙인다(숫자만 낸다). */
export function formatGameMoney(amount: number): string {
    return gameMoney.format(amount)
}

export interface AuctionPriceView {
    /** "현재가" | "시작가" — 입찰 유무에 따라 **다른 라벨** */
    label: string
    amount: number
    /** 입찰이 하나라도 있는가 */
    hasBids: boolean
}

export function auctionPriceOf(auction: AuctionSummary): AuctionPriceView {
    const hasBids =
        auction.highestBidAmount !== null &&
        auction.highestBidAmount !== undefined

    return {
        label: hasBids ? '현재가' : '시작가',
        amount: hasBids
            ? (auction.highestBidAmount as number)
            : auction.startPrice,
        hasBids,
    }
}

/** "입찰 3건" / "입찰 없음" — 0을 "0건"으로 적지 않는다(없음이 더 빨리 읽힌다). */
export function bidCountLabelOf(bidCount: number): string {
    return bidCount > 0 ? `입찰 ${gameMoney.format(bidCount)}건` : '입찰 없음'
}
