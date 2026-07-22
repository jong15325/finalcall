/**
 * 비교표 셀 파생 (FC-079 — rebuild-contract-map §2.5·§5 "비교 스킬 데이터").
 *
 * ★ **비교표의 미묘한 두 곳만** 순수 함수로 가둔다 — 가격 "의미" 라벨과 스킬 중립 표기.
 *   나머지(속성·종류·상태)는 기존 lib(`element`·`itemCode`·`auctionPhase`)를 그대로 쓴다.
 * ★ **스킬 = 코드만이다.** 경매·고정가 item 블록엔 스킬 이름이 없다(§2.5, 링크 끊김). 비교표에서도
 *   `스킬 #{code}` **중립 표기**가 계약 준수다 — 이름을 지어내면 거짓이 된다. 두 출처가 같은 공통
 *   item 블록을 쓰므로 `compareSkillLabel` 은 고정가 비교에도 그대로 쓰인다(FC-094).
 * ★ `comparePriceOf` 는 **경매 전용**이다(입찰 유무로 의미가 갈린다). 고정가는 "고정가" 의미로
 *   `ComparePage` 가 직접 파생한다 — 여기 두면 `AuctionSummary` 를 요구해 결합이 늘어난다.
 */

import type { AuctionSummary } from '@/lib/api/auctions'

export interface ComparePriceView {
    amount: number
    /** ★ 가격 "의미" 를 반드시 표기한다 — 입찰 유무로 갈린다(저렴 오해 방지, 티켓 요구). */
    meaning: string
    hasBids: boolean
}

/**
 * 비교표 가격 셀. 입찰이 있으면 **현재 최고가**, 없으면 **시작가(입찰 없음)** 를 낸다 —
 * 계약 §3.3 `highestBidAmount` 는 입찰 0건이면 null 이라, `startPrice` 를 "현재가" 로 적으면
 * 거래된 적 없는 경매를 그 값에 팔린 것처럼 오도한다(`auctionPrice.ts` 와 같은 태도).
 */
export function comparePriceOf(auction: AuctionSummary): ComparePriceView {
    const hasBids =
        auction.highestBidAmount !== null &&
        auction.highestBidAmount !== undefined

    return {
        amount: hasBids
            ? (auction.highestBidAmount as number)
            : auction.startPrice,
        meaning: hasBids ? '현재 최고가' : '시작가 · 입찰 없음',
        hasBids,
    }
}

/**
 * 비교표 스킬 셀 라벨. **슬롯 고정**(skill1→슬롯1, skill2→슬롯2) 후 코드 중립 표기.
 * 빈 슬롯은 "없음"(마법은 구조적으로 skill1 부재 — 슬롯을 재번호하지 않는다, §2.5).
 */
export function compareSkillLabel(code: number | null | undefined): string {
    if (code === null || code === undefined || !Number.isFinite(code)) {
        return '없음'
    }
    return `스킬 #${code}`
}
