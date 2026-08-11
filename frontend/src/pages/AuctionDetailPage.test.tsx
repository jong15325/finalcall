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
vi.mock('@/features/auction/components/AuctionHeroCard', () => ({
    default: () => (
        <div
            data-testid="auction-hero"
            className="detail-surface bg-surface text-gray-900"
        >
            경매 상품
        </div>
    ),
}))
vi.mock('@/features/auction/components/BidHistory', () => ({
    default: ({ auctionPublicId }: { auctionPublicId: string }) => (
        <div data-testid="bid-history" className="detail-surface bg-surface">
            {auctionPublicId}
        </div>
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
        <aside
            data-testid="bid-panel"
            className="detail-surface sticky z-10 bg-surface"
        >
            <button data-testid="open-bid" type="button" onClick={onBid}>
                입찰 열기
            </button>
            <button
                data-testid="open-purchase"
                type="button"
                onClick={onBuyNow}
            >
                구매 열기
            </button>
        </aside>
    ),
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
            <header data-testid="global-navigation" className="fixed z-30" />
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
        expect(view.container.querySelector('.element-detail')).toBeNull()
        expect(screen.getByTestId('auction-page-region')).toHaveClass(
            'bg-surface',
            'border-line',
            'rounded-xl',
            'shadow-sm',
        )

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
        expect(view.container.querySelector('.element-detail')).toHaveAttribute(
            'data-element',
            'fire',
        )
        expect(screen.getByTestId('bid-history')).toHaveTextContent('A-1')
        const region = screen.getByTestId('auction-page-region')
        expect(region).toContainElement(
            screen.getByRole('link', { name: /경매 목록/ }),
        )
        expect(region).toContainElement(screen.getByTestId('auction-hero'))
        expect(region).toContainElement(screen.getByTestId('bid-panel'))
        expect(region).toContainElement(screen.getByTestId('bid-history'))
        expect(region).not.toHaveClass(
            'overflow-hidden',
            'transform',
            'filter',
            'z-0',
        )
        expect(screen.getByTestId('auction-hero')).toHaveClass(
            'bg-surface',
            'text-gray-900',
        )
        const scene = view.container.querySelector('.element-detail__scene')
        expect(scene).not.toBeNull()
        expect(scene?.contains(region)).toBe(false)
        expect(scene?.compareDocumentPosition(region) ?? 0).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        )
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
        expect(
            first.container.querySelector('.element-detail'),
        ).toHaveAttribute('data-element', 'fire')
        first.unmount()
        const second = renderPage('/auctions/A-2')
        expect(
            second.container.querySelector('.element-detail'),
        ).toHaveAttribute('data-element', 'wind')
    })

    it('404에서는 배경을 격리하고 입찰 모달이 sticky 패널보다 높은 계층으로 열린다', () => {
        mocks.detail.mockReturnValue({
            data: auction,
            isPending: false,
            isError: false,
        })
        const successView = renderPage()
        fireEvent.click(screen.getByRole('button', { name: '입찰 열기' }))
        const dialog = screen.getByRole('dialog')
        expect(dialog.parentElement).toHaveClass('fixed', 'z-50')
        expect(document.body.style.overflow).toBe('hidden')
        expect(screen.getByRole('complementary')).toHaveClass('z-10')
        const backgroundRoot = dialog.closest('.element-detail')
        expect(backgroundRoot).not.toBeNull()
        expect(getComputedStyle(backgroundRoot as Element).isolation).not.toBe(
            'isolate',
        )
        expect(getComputedStyle(backgroundRoot as Element).zIndex).toMatch(
            /^(|auto)$/,
        )
        expect(screen.getByTestId('global-navigation')).toHaveClass('z-30')
        successView.unmount()
        expect(document.body.style.overflow).toBe('')

        const purchaseView = renderPage()
        fireEvent.click(screen.getByTestId('open-purchase'))
        const purchaseDialog = screen.getByRole('dialog')
        expect(purchaseDialog.parentElement).toHaveClass('fixed', 'z-50')
        expect(document.body.style.overflow).toBe('hidden')
        expect(
            getComputedStyle(
                purchaseDialog.closest('.element-detail') as Element,
            ).isolation,
        ).not.toBe('isolate')
        purchaseView.unmount()
        expect(document.body.style.overflow).toBe('')

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
        expect(errorView.container.querySelector('.element-detail')).toBeNull()
        expect(screen.getByTestId('auction-page-region')).toHaveClass(
            'bg-surface',
            'rounded-xl',
        )
    })
})
