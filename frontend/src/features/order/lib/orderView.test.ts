import { cardInfoFixture } from '@/test/cardInfoFixture'
import { describe, expect, it } from 'vitest'
import {
    counterpartyLabelOf,
    isSellerOrder,
    orderRoleLabelOf,
    orderSourceLabelOf,
    showsSellerAccounting,
} from './orderView'
import type { AuctionItemBlock } from '@/lib/api/auctions'
import type { OrderSummary } from '@/lib/api/orders'

/**
 * 거래내역 역할별 노출 규칙 (계약 §4.3 · purchase-spec §5.2) — FC-090.
 *
 * 고정하는 것: **수수료/정산액은 판매자에게만, 값 유무가 아니라 역할로 판정**. 상대 직함 반전.
 */

const item: AuctionItemBlock = {
    typeCode: 1123,
    mainCategory: 1,
    subGroup: 1,
    element: 2,
    kind: 3,
    level: 5,
    skill1: 104,
    skill2: null,
    skillPercent: 12,
    goldforceExpireAt: null,
    nameSnapshot: '불의 전투도끼',
    specSnapshot: '한손 도끼',
            cardInfo: cardInfoFixture(),
}

const buyerOrder: OrderSummary = {
    orderPublicId: '01J3ORDER0001',
    myRole: 'BUYER',
    sourceType: 'AUCTION',
    counterpartyMasked: '토르***',
    item,
    finalPrice: 3_900_000,
    status: 'SETTLED',
    createdAt: '2026-07-21T00:00:00Z',
}

const sellerOrder: OrderSummary = {
    ...buyerOrder,
    orderPublicId: '01J3ORDER0002',
    myRole: 'SELLER',
    counterpartyMasked: 'le***',
    feeAmount: 195_000,
    settleAmount: 3_705_000,
}

describe('orderView — 역할별 노출', () => {
    it('구매자 주문은 판매자 회계(수수료/정산)를 숨긴다', () => {
        expect(isSellerOrder(buyerOrder)).toBe(false)
        expect(showsSellerAccounting(buyerOrder)).toBe(false)
    })

    it('판매자 주문은 두 값이 왔을 때 회계를 노출한다', () => {
        expect(isSellerOrder(sellerOrder)).toBe(true)
        expect(showsSellerAccounting(sellerOrder)).toBe(true)
    })

    it('★ 구매자에게 fee/settle 가 새어 와도 역할로 막는다', () => {
        const leaked: OrderSummary = {
            ...buyerOrder,
            feeAmount: 195_000,
            settleAmount: 3_705_000,
        }
        // 값이 있어도 myRole=BUYER 이면 회계 영역은 열리지 않는다.
        expect(showsSellerAccounting(leaked)).toBe(false)
    })

    it('판매자여도 값이 빠졌으면 회계 영역을 그리지 않는다', () => {
        const partial: OrderSummary = {
            ...sellerOrder,
            settleAmount: undefined,
        }
        expect(showsSellerAccounting(partial)).toBe(false)
    })

    it('상대 직함은 내 역할에 따라 뒤집힌다', () => {
        expect(counterpartyLabelOf(buyerOrder)).toBe('판매자 토르***')
        expect(counterpartyLabelOf(sellerOrder)).toBe('구매자 le***')
    })

    it('역할·출처 라벨', () => {
        expect(orderRoleLabelOf('BUYER')).toBe('구매')
        expect(orderRoleLabelOf('SELLER')).toBe('판매')
        expect(orderSourceLabelOf('AUCTION')).toBe('경매')
        // 미등록 출처는 코드를 그대로 노출(무음 실패 방지).
        expect(orderSourceLabelOf('MYSTERY')).toBe('MYSTERY')
    })
})
