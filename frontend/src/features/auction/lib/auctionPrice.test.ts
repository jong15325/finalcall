import { describe, expect, it } from 'vitest'
import {
    auctionPriceOf,
    bidCountLabelOf,
    formatGameMoney,
} from './auctionPrice'
import type { AuctionSummary } from '@/lib/api/auctions'

const base = {
    startPrice: 10_000,
    highestBidAmount: null,
} as unknown as AuctionSummary

describe('auctionPriceOf — 현재가와 시작가를 구분한다', () => {
    it('★ 입찰이 없으면 "시작가"다 — 거래된 적 없는 값을 현재가라 부르지 않는다', () => {
        expect(auctionPriceOf(base)).toEqual({
            label: '시작가',
            amount: 10_000,
            hasBids: false,
        })
    })

    it('입찰이 있으면 "현재가" + 최고가', () => {
        expect(auctionPriceOf({ ...base, highestBidAmount: 42_000 })).toEqual({
            label: '현재가',
            amount: 42_000,
            hasBids: true,
        })
    })

    it('최고가가 0이어도 입찰로 취급한다 (0 ≠ 없음)', () => {
        expect(auctionPriceOf({ ...base, highestBidAmount: 0 }).hasBids).toBe(
            true,
        )
    })

    it('undefined 도 입찰 없음으로 흐른다 (필드 누락 방어)', () => {
        const missing = { startPrice: 500 } as unknown as AuctionSummary
        expect(auctionPriceOf(missing)).toEqual({
            label: '시작가',
            amount: 500,
            hasBids: false,
        })
    })
})

describe('보조 표기', () => {
    it('금액은 천 단위로 끊는다', () => {
        expect(formatGameMoney(1_234_567)).toBe('1,234,567')
    })

    it('입찰 0건은 "입찰 없음" — 숫자보다 빨리 읽힌다', () => {
        expect(bidCountLabelOf(0)).toBe('입찰 없음')
        expect(bidCountLabelOf(3)).toBe('입찰 3건')
    })
})
