import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import OrderCard from './OrderCard'
import type { AuctionItemBlock } from '@/lib/api/auctions'
import type { OrderSummary } from '@/lib/api/orders'

/**
 * 거래내역 카드 역할별 노출 (FC-090).
 *
 * 고정하는 것: **구매자 카드는 수수료/정산 숨김, 판매자 카드는 노출**. 상대 직함 반전.
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
    myRole: 'SELLER',
    counterpartyMasked: 'le***',
    feeAmount: 195_000,
    settleAmount: 3_705_000,
}

describe('<OrderCard>', () => {
    it('구매자 카드 — 결제 금액만, 수수료/정산 숨김', () => {
        renderWithProviders(<OrderCard order={buyerOrder} />)
        expect(screen.getByText('구매')).toBeInTheDocument()
        expect(screen.getByText('결제 금액')).toBeInTheDocument()
        expect(screen.getByText('판매자 토르***')).toBeInTheDocument()
        expect(screen.queryByText('수수료')).not.toBeInTheDocument()
        expect(screen.queryByText('정산액')).not.toBeInTheDocument()
    })

    it('판매자 카드 — 판매가 + 수수료 + 정산액', () => {
        renderWithProviders(<OrderCard order={sellerOrder} />)
        expect(screen.getByText('판매')).toBeInTheDocument()
        expect(screen.getByText('판매가')).toBeInTheDocument()
        expect(screen.getByText('수수료')).toBeInTheDocument()
        expect(screen.getByText('정산액')).toBeInTheDocument()
        expect(screen.getByText('구매자 le***')).toBeInTheDocument()
    })

    it('★ 판매자여도 값이 빠졌으면 회계 행을 그리지 않는다', () => {
        renderWithProviders(
            <OrderCard order={{ ...sellerOrder, settleAmount: undefined }} />,
        )
        expect(screen.queryByText('정산액')).not.toBeInTheDocument()
    })
})
