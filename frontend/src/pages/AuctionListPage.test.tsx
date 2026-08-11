import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementDetailBackground from '@/features/item/components/ElementDetailBackground'
import AuctionListPage from './AuctionListPage'

const mocks = vi.hoisted(() => ({ browse: vi.fn() }))

vi.mock('@/lib/queries/auctions', () => ({ useAuctionBrowse: mocks.browse }))
vi.mock('@/lib/queries/itemTemplates', () => ({
    useItemTemplates: () => ({ data: { content: [] } }),
}))
vi.mock('@/lib/queries/balance', () => ({
    useMyBalance: () => ({ data: undefined }),
}))
vi.mock('@/features/auction/lib/useNow', () => ({ useNow: () => new Date() }))
vi.mock('@/features/auction/lib/useInfiniteScroll', () => ({
    useInfiniteScroll: () => vi.fn(),
}))
vi.mock('@/features/auction/components/AuctionFilters', () => ({
    default: () => <form data-testid="auction-filters" />,
}))
vi.mock('@/features/auction/components/AuctionCard', () => ({
    default: () => <article data-testid="auction-card" />,
}))
vi.mock('@/features/item/components/ItemCardGrid', () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <section data-testid="auction-grid">{children}</section>
    ),
    ItemCardGridSkeleton: () => <div data-testid="auction-loading" />,
}))

const baseQuery = {
    data: undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
}

function renderPage(withScene = false) {
    return render(
        <MemoryRouter initialEntries={['/auctions']}>
            {withScene ? (
                <ElementDetailBackground ambientOnly element={1}>
                    <AuctionListPage />
                </ElementDetailBackground>
            ) : (
                <AuctionListPage />
            )}
        </MemoryRouter>,
    )
}

describe('AuctionListPage 밝은 region', () => {
    beforeEach(() => mocks.browse.mockReturnValue(baseQuery))

    it.each([
        ['loading', { ...baseQuery, isPending: true }, 'auction-loading'],
        ['error', { ...baseQuery, isError: true }, 'heading'],
    ])('%s 상태를 같은 region 안에 둔다', (_name, query, target) => {
        mocks.browse.mockReturnValue(query)
        renderPage()
        const region = screen.getByTestId('auction-list-region')
        const state =
            target === 'heading'
                ? screen.getByRole('heading', { level: 2 })
                : screen.getByTestId(target)
        expect(region).toContainElement(state)
        expect(region).toContainElement(screen.getByTestId('auction-filters'))
    })

    it('empty와 ready grid/추가 loading도 같은 region 안에 둔다', () => {
        const empty = renderPage()
        const emptyRegion = screen.getByTestId('auction-list-region')
        expect(emptyRegion).toContainElement(
            screen.getByRole('heading', { level: 2 }),
        )
        empty.unmount()

        mocks.browse.mockReturnValue({
            ...baseQuery,
            data: { pages: [{ content: [{ auctionPublicId: 'A-1' }] }] },
            isFetchingNextPage: true,
        })
        renderPage()
        const readyRegion = screen.getByTestId('auction-list-region')
        expect(readyRegion).toContainElement(screen.getByTestId('auction-grid'))
        expect(readyRegion).toContainElement(screen.getByTestId('auction-card'))
        expect(readyRegion).toContainElement(screen.getByRole('status'))
    })

    it('scene 바깥 뒤에 불투명 region을 두고 stacking/overflow context를 만들지 않는다', () => {
        const view = renderPage(true)
        const scene = view.container.querySelector('.element-detail__scene')
        const region = screen.getByTestId('auction-list-region')
        expect(region).toHaveClass('min-w-0', 'flex', 'gap-5')
        expect(region).not.toHaveClass(
            'bg-surface',
            'border',
            'rounded-xl',
            'shadow-sm',
            'p-3',
            'overflow-hidden',
            'transform',
            'filter',
            'z-0',
        )
        expect(scene).toBeNull()
        expect(region.closest('.element-detail')).toHaveClass('element-detail')
    })
})
