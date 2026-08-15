import { describe, expect, it } from 'vitest'
import {
    auctionPriceOf,
    bidCountBadgeLabelOf,
    bidCountLabelOf,
    formatGameMoney,
} from './auctionPrice'
import type { AuctionSummary } from '@/lib/api/auctions'

describe('bidCountBadgeLabelOf', () => {
    it('1만 미만은 전체, 이상은 결정적 한국어 축약값을 쓴다', () => {
        expect(bidCountBadgeLabelOf(0)).toEqual({
            visible: '입찰 없음',
            full: '입찰 없음',
        })
        expect(bidCountBadgeLabelOf(9_999)).toEqual({
            visible: '입찰 9,999건',
            full: '입찰 9,999건',
        })
        expect(bidCountBadgeLabelOf(10_000)).toEqual({
            visible: '입찰 1만건',
            full: '입찰 10,000건',
        })
        expect(bidCountBadgeLabelOf(12_500)).toEqual({
            visible: '입찰 1.2만건',
            full: '입찰 12,500건',
        })
        expect(bidCountBadgeLabelOf(Number.MAX_SAFE_INTEGER)).toEqual({
            visible: '입찰 9,007조건',
            full: '입찰 9,007,199,254,740,991건',
        })
    })
})

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
