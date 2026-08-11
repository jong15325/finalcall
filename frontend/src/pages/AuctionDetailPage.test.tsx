import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'
import AuctionDetailPage from './AuctionDetailPage'

const mocks = vi.hoisted(() => ({
    detail: vi.fn(),
    mutation: vi.fn(),
}))

vi.mock('@/lib/queries/auctions', () => ({
    useAuctionDetail: mocks.detail,
    useCancelAuction: mocks.mutation,
    usePlaceBid: mocks.mutation,
    usePurchaseAuction: mocks.mutation,
}))
vi.mock('@/lib/queries/balance', () => ({
    useMyBalance: () => ({ data: { gameMoneyAvailable: 1_000_000 } }),
}))
vi.mock('@/features/auction/lib/useNow', () => ({
    useNow: () => new Date('2026-08-11T00:00:00Z'),
}))
vi.mock('@/features/item/components/ElementDetailBackground', () => ({
    default: ({
        element,
        children,
    }: {
        element: number
        children: React.ReactNode
    }) => (
        <section data-testid="element-background" data-element={element}>
            {children}
        </section>
    ),
}))
vi.mock('@/features/auction/components/AuctionHeroCard', () => ({
    default: () => <div>경매 상품</div>,
}))
vi.mock('@/features/auction/components/BidHistory', () => ({
    default: ({ auctionPublicId }: { auctionPublicId: string }) => (
        <div data-testid="bid-history">{auctionPublicId}</div>
    ),
}))
vi.mock('@/features/auction/components/BidPanel', () => ({
    default: ({
        onBid,
        onBuyNow,
    }: {
        onBid: () => void
        onBuyNow: () => void
    }) => (
        <aside className="sticky z-10">
            <button type="button" onClick={onBid}>
                입찰 열기
            </button>
            <button type="button" onClick={onBuyNow}>
                구매 열기
            </button>
        </aside>
    ),
}))
vi.mock('@/features/auction/components/BidDialog', () => ({
    default: ({ open }: { open: boolean }) =>
        open ? (
            <div role="dialog" className="z-50">
                입찰 모달
            </div>
        ) : null,
}))
vi.mock('@/features/auction/components/PurchaseDialog', () => ({
    default: ({ open }: { open: boolean }) =>
        open ? (
            <div role="dialog" className="z-50">
                구매 모달
            </div>
        ) : null,
}))

const auction = {
    auctionPublicId: 'A-1',
    status: 'ACTIVE',
    item: { element: 2, nameSnapshot: '불의 검' },
    startAt: null,
    endAt: '2026-08-12T00:00:00Z',
    sellerNickname: 'seller',
    highestBidAmount: 500,
    minNextBidAmount: 510,
    buyNowPrice: 1000,
}

function renderPage(route = '/auctions/A-1') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path="/auctions/:id" element={<AuctionDetailPage />} />
            </Routes>
        </MemoryRouter>,
    )
}

describe('AuctionDetailPage 속성 배경 계약', () => {
    beforeEach(() => {
        mocks.mutation.mockReturnValue({
            error: null,
            isPending: false,
            mutate: vi.fn(),
            reset: vi.fn(),
        })
    })

    it('로딩에는 배경이 없고 성공 응답 item.element만 배경에 전달한다', () => {
        mocks.detail.mockReturnValueOnce({ isPending: true })
        const view = renderPage()
        expect(screen.queryByTestId('element-background')).toBeNull()

        mocks.detail.mockReturnValue({
            data: auction,
            isPending: false,
            isError: false,
        })
        view.rerender(
            <MemoryRouter initialEntries={['/auctions/A-1']}>
                <Routes>
                    <Route
                        path="/auctions/:id"
                        element={<AuctionDetailPage />}
                    />
                </Routes>
            </MemoryRouter>,
        )
        expect(screen.getByTestId('element-background')).toHaveAttribute(
            'data-element',
            '2',
        )
        expect(screen.getByTestId('bid-history')).toHaveTextContent('A-1')
    })

    it('id 전환 시 새 응답 속성으로 교체하고 이전 배경을 남기지 않는다', () => {
        mocks.detail.mockImplementation((id: string) => ({
            data: {
                ...auction,
                auctionPublicId: id,
                item: { ...auction.item, element: id === 'A-2' ? 4 : 2 },
            },
            isPending: false,
            isError: false,
        }))
        const first = renderPage('/auctions/A-1')
        expect(screen.getByTestId('element-background')).toHaveAttribute(
            'data-element',
            '2',
        )
        first.unmount()
        renderPage('/auctions/A-2')
        expect(screen.getByTestId('element-background')).toHaveAttribute(
            'data-element',
            '4',
        )
    })

    it('404에서는 배경을 격리하고 입찰 모달이 sticky 패널보다 높은 계층으로 열린다', () => {
        mocks.detail.mockReturnValue({
            data: auction,
            isPending: false,
            isError: false,
        })
        const successView = renderPage()
        fireEvent.click(screen.getByRole('button', { name: '입찰 열기' }))
        expect(screen.getByRole('dialog')).toHaveClass('z-50')
        expect(screen.getByRole('complementary')).toHaveClass('z-10')
        successView.unmount()

        mocks.detail.mockReturnValue({
            error: new ApiError({
                code: ERROR_CODES.AUCTION_004,
                message: '없음',
                status: 404,
            }),
            isPending: false,
            isError: true,
        })
        const errorView = renderPage('/auctions/NOPE')
        expect(
            errorView.container.querySelector(
                '[data-testid="element-background"]',
            ),
        ).toBeNull()
    })
})
