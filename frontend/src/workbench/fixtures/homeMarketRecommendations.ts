import { cardInfoFixture } from '@/test/cardInfoFixture'
import type { ShopRecommendationItem, ShopSummary } from '@/lib/api/shop'
import type { WorkbenchFixture } from '../types'

export const HOME_MARKET_RECOMMENDATIONS_NOW = Date.parse(
    '2026-08-31T03:00:00Z',
)

function shop(
    id: string,
    overrides: Omit<Partial<ShopSummary>, 'item'> & {
        item?: Partial<ShopSummary['item']>
    } = {},
): ShopSummary {
    return {
        shopPublicId: id,
        status: 'ACTIVE',
        price: 2_750_000,
        endAt: '2026-09-04T03:00:00Z',
        sellerNickname: '서리빛상점',
        sellerCompletedSales: 12,
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
            skill1Name: '공격시간 감소',
            skill2Name: '체력 회복',
            skillPercent: 33,
            goldforceExpireAt: null,
            nameSnapshot: '불의 전투 아르카나',
            specSnapshot: '공격 성능이 높은 희귀 아이템',
            cardInfo: cardInfoFixture(),
            ...overrides.item,
        },
    }
}

const complete: readonly ShopRecommendationItem[] = [
    { reason: 'NEW', shop: shop('recommend-1') },
    {
        reason: 'NEW',
        shop: shop('recommend-2', {
            price: 980_000,
            item: { element: 1, nameSnapshot: '바람의 수호 아르카나' },
        }),
    },
    {
        reason: 'NEW',
        shop: shop('recommend-3', {
            price: 12_400_000,
            item: { element: 3, nameSnapshot: '대지의 결속 아르카나' },
        }),
    },
    {
        reason: 'ENDING_SOON',
        shop: shop('recommend-4', { endAt: '2026-08-31T08:00:00Z' }),
    },
    {
        reason: 'ENDING_SOON',
        shop: shop('recommend-5', {
            endAt: '2026-09-01T02:00:00Z',
            price: 8_607_199_254_740_000,
            sellerNickname: '아주아주긴판매자이름레이아웃검증상점',
            item: {
                nameSnapshot:
                    '전설적인 이름을 가진 아주 긴 황금빛 수호 아르카나',
            },
        }),
    },
    {
        reason: 'TRUSTED_SELLER',
        shop: shop('recommend-6', {
            sellerNickname: '믿음직한상점',
            sellerCompletedSales: 128,
        }),
    },
]

export interface HomeMarketRecommendationsFixture extends WorkbenchFixture {
    now: number
    complete: readonly ShopRecommendationItem[]
    partial: readonly ShopRecommendationItem[]
}

export const homeMarketRecommendationsFixture: HomeMarketRecommendationsFixture =
    {
        now: HOME_MARKET_RECOMMENDATIONS_NOW,
        complete,
        partial: [
            complete[0],
            complete[3],
            { ...complete[5], reason: 'GENERAL' },
        ],
    }
