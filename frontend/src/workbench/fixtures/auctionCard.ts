import type { AuctionSummary } from '@/lib/api/auctions'
import type { WorkbenchFixture } from '../types'

export const AUCTION_CARD_NOW = Date.parse('2026-08-16T03:00:00Z')

function auction(
    id: string,
    overrides: Omit<Partial<AuctionSummary>, 'item'> & {
        item?: Partial<AuctionSummary['item']>
    },
): AuctionSummary {
    return {
        auctionPublicId: id,
        status: 'ACTIVE',
        startPrice: 2_480_000,
        buyNowPrice: null,
        highestBidAmount: 2_750_000,
        bidCount: 7,
        startAt: null,
        endAt: '2026-08-16T05:00:00Z',
        sellerNickname: '신뢰상점',
        ...overrides,
        item: {
            typeCode: 1123,
            mainCategory: 1,
            subGroup: 1,
            element: 2,
            kind: 1,
            level: 3,
            skill1: 11,
            skill2: 202,
            skill1Name: '화염 강타',
            skill2Name: '트리플샷',
            skillPercent: 33,
            goldforceExpireAt: null,
            nameSnapshot: '불의 전투도끼',
            specSnapshot: '공격력이 높은 한손 도끼',
            ...overrides.item,
        },
    }
}

export interface AuctionCardFixture extends WorkbenchFixture {
    now: number
    auctions: readonly AuctionSummary[]
}

export const auctionCardFixture: AuctionCardFixture = {
    now: AUCTION_CARD_NOW,
    auctions: [
        auction('design-auction-empty', {
            highestBidAmount: null,
            bidCount: 0,
            item: {
                skill1: null,
                skill2: null,
                skill1Name: null,
                skill2Name: null,
            },
        }),
        auction('design-auction-one', {
            startAt: '2026-08-16T04:00:00Z',
            highestBidAmount: null,
            bidCount: 0,
            item: { skill2: null, skill2Name: null, element: 1 },
        }),
        auction('design-auction-selected', {
            item: { element: 3, nameSnapshot: '대지의 비교 선택 도끼' },
        }),
        auction('design-auction-ended', {
            status: 'SOLD',
            endAt: '2026-08-16T02:00:00Z',
            sellerNickname: '아주아주긴판매자닉네임말줄임검증상점',
            item: {
                skill1Name:
                    '공격 성공 시 상대의 방어력을 오랫동안 감소시키는 매우 긴 스킬',
                skill2Name: '연속 폭발 피해량이 크게 증가하는 매우 긴 스킬',
                nameSnapshot: '아주 긴 이름의 불타는 전설적인 황금 전투도끼',
            },
        }),
        auction('design-auction-long-price', {
            startPrice: Number.MAX_SAFE_INTEGER,
            highestBidAmount: null,
            bidCount: 0,
            item: { skill1: null, skill1Name: null, element: 4 },
        }),
        auction('design-auction-full', {
            bidCount: Number.MAX_SAFE_INTEGER,
            item: { skill1: null, skill1Name: null, element: 1 },
        }),
    ],
    shellState: {
        authSession: null,
        unreadMemoCount: 0,
    },
}
