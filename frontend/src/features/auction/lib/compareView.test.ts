import { describe, expect, it } from 'vitest'
import { compareSkillLabel, comparePriceOf } from './compareView'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 비교표 셀 파생 (FC-079).
 *
 * 고정하는 것: 스킬은 **코드 중립 표기**(이름 없음, §2.5) / 가격 "의미" 는 입찰 유무로 갈린다.
 */

const baseAuction: AuctionSummary = {
    auctionPublicId: '01J3AUCTION0001',
    status: 'ACTIVE',
    item: {
        typeCode: 1123,
        mainCategory: 1,
        subGroup: 1,
        element: 2,
        kind: 1,
        level: 3,
        skill1: 104,
        skill2: null,
        skillPercent: 12,
        goldforceExpireAt: null,
        nameSnapshot: '불의 전투도끼',
        specSnapshot: '공격력이 높은 한손 도끼',
    },
    startPrice: 1_000_000,
    buyNowPrice: null,
    highestBidAmount: 2_480_000,
    bidCount: 3,
    startAt: null,
    endAt: '2026-07-21T01:00:00Z',
    sellerNickname: '토르',
}

describe('compareSkillLabel', () => {
    it('이름이 있으면 스킬명을 낸다(계약 §3.3 델타)', () => {
        expect(compareSkillLabel(202, '트리플샷')).toBe('트리플샷')
    })

    it('이름이 없으면 `스킬 #{code}` 중립 폴백', () => {
        expect(compareSkillLabel(104)).toBe('스킬 #104')
        expect(compareSkillLabel(104, null)).toBe('스킬 #104')
    })

    it('빈 슬롯(null/undefined/비유한)은 이름 유무와 무관하게 "없음"', () => {
        expect(compareSkillLabel(null)).toBe('없음')
        expect(compareSkillLabel(undefined)).toBe('없음')
        expect(compareSkillLabel(Number.NaN)).toBe('없음')
        expect(compareSkillLabel(null, '트리플샷')).toBe('없음')
    })
})

describe('comparePriceOf', () => {
    it('입찰이 있으면 현재 최고가 + "현재 최고가" 의미', () => {
        const view = comparePriceOf(baseAuction)
        expect(view.amount).toBe(2_480_000)
        expect(view.meaning).toBe('현재 최고가')
        expect(view.hasBids).toBe(true)
    })

    it('입찰이 없으면 시작가 + "시작가 · 입찰 없음" 의미(저렴 오해 방지)', () => {
        const view = comparePriceOf({
            ...baseAuction,
            highestBidAmount: null,
        })
        expect(view.amount).toBe(1_000_000)
        expect(view.meaning).toBe('시작가 · 입찰 없음')
        expect(view.hasBids).toBe(false)
    })
})
