import type { AuctionDetail } from '@/lib/api/auctions'
import type { BalanceResponse } from '@/lib/api/balance'
import type { WorkbenchFixture } from '../types'

export const CARD_INFO_NOW = Date.parse('2026-08-23T09:00:00Z')
export const cardInfoAuction: AuctionDetail = {
    auctionPublicId: 'design-card-info-parity',
    status: 'ACTIVE',
    item: {
        typeCode: 1123,
        mainCategory: 1,
        subGroup: 1,
        element: 2,
        kind: 1,
        level: 7,
        skill1: 131,
        skill2: 202,
        skillPercent: 33,
        skill1Name: '방어력 강화 8초',
        skill2Name: '이빌아이 8초',
        goldforceExpireAt: '2026-09-03T09:00:00Z',
        nameSnapshot: '7레벨 - 갑옷',
        specSnapshot: '방어형 갑옷',
    },
    startPrice: 2_000_000,
    buyNowPrice: 3_900_000,
    highestBidAmount: 2_750_000,
    bidCount: 7,
    startAt: null,
    endAt: '2026-08-23T11:00:00Z',
    sellerNickname: '신뢰상점',
    resultType: null,
    highestBidderMasked: 'ga***',
    extensionCount: 1,
    maxEndAt: '2026-08-23T12:00:00Z',
    createdAt: '2026-08-22T09:00:00Z',
    minNextBidAmount: 2_850_000,
}
export const cardInfoBalance: BalanceResponse = {
    cashBalance: 0,
    gameMoneyBalance: 5_000_000,
    gameMoneyHeld: 500_000,
    gameMoneyAvailable: 4_500_000,
}
export const cardInfoParityFixture: WorkbenchFixture = {
    shellState: { authSession: null, unreadMemoCount: 0 },
}
