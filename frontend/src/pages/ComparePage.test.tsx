import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { cardInfoFixture } from '@/test/cardInfoFixture'
import ComparePage from './ComparePage'
import type { AuctionDetail } from '@/lib/api/auctions'

const auction: AuctionDetail = {
    auctionPublicId: 'AUCTION-1',
    status: 'ACTIVE',
    item: {
        typeCode: 1143,
        mainCategory: 1,
        subGroup: 1,
        element: 4,
        kind: 3,
        level: 9,
        skill1: null,
        skill2: null,
        skill1Name: null,
        skill2Name: null,
        skillPercent: 0,
        goldforceExpireAt: null,
        nameSnapshot: '호환 이름',
        specSnapshot: '호환 설명',
        cardInfo: cardInfoFixture({
            level: 9,
            shortName: 'Lv.9 바검',
            formalName: '9레벨 칼',
            kind: { code: 3, label: '칼', abbreviation: '검' },
            element: { code: 4, label: '바람', abbreviation: '바' },
            skills: [
                { slot: 1, code: null, name: null, percent: null },
                { slot: 2, code: null, name: null, percent: null },
            ],
        }),
    },
    startPrice: 1_000,
    buyNowPrice: null,
    highestBidAmount: null,
    bidCount: 0,
    startAt: null,
    endAt: '2026-08-24T00:00:00Z',
    sellerNickname: '판매자',
    resultType: null,
    highestBidderMasked: null,
    extensionCount: 0,
    maxEndAt: '2026-08-24T01:00:00Z',
    createdAt: '2026-08-23T00:00:00Z',
    minNextBidAmount: 1_000,
}

vi.mock('@/features/auction/lib/useNow', () => ({
    useNow: () => Date.parse('2026-08-23T00:00:00Z'),
}))
vi.mock('@/lib/queries/auctions', () => ({
    useCompareAuctions: () => [
        { data: auction, isPending: false, isError: false },
    ],
}))
vi.mock('@/lib/queries/shop', () => ({ useCompareShops: () => [] }))
vi.mock('@/store/compareStore', () => ({
    useCompareStore: (selector: (state: unknown) => unknown) =>
        selector({
            items: [{ source: 'AUCTION', listingId: 'AUCTION-1' }],
            remove: vi.fn(),
            clear: vi.fn(),
        }),
}))

describe('<ComparePage>', () => {
    it('compact 비교 카드 제목은 서버 shortName을 표시한다', () => {
        renderWithProviders(<ComparePage />)

        expect(
            screen.getByRole('heading', { name: 'Lv.9 바검' }),
        ).toBeInTheDocument()
        expect(screen.queryByText('호환 이름')).not.toBeInTheDocument()
    })
})
