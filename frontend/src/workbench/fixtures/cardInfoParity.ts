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
        cardInfo: {
            level: 7,
            shortName: 'Lv.7 불도',
            formalName: '7레벨 도끼',
            category: { code: 1, label: '무기' },
            kind: { code: 1, label: '도끼', abbreviation: '도' },
            element: { code: 2, label: '불', abbreviation: '불' },
            channelLimit: { code: 'EXPERT', label: '고수채널 이상' },
            frame: { type: 'GOLD', label: '골드', remainingGoldforceDays: 11 },
            skills: [
                { slot: 1, code: 131, name: '방어력 강화 8초', percent: null },
                { slot: 2, code: 202, name: '회피율 8초', percent: 33 },
            ],
            calculatedAt: '2026-08-23T09:00:00Z',
            validUntil: '2026-08-24T09:00:00Z',
        },
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
