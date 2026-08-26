import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MarketPage from './MarketPage'

const mocks = vi.hoisted(() => ({ browse: vi.fn() }))

vi.mock('@/lib/queries/shop', () => ({
    useShopBrowse: mocks.browse,
}))
vi.mock('@/lib/queries/itemTemplates', () => ({
    useItemTemplates: () => ({ data: { content: [] } }),
}))
vi.mock('@/lib/queries/balance', () => ({
    useMyBalance: () => ({ data: { gameMoneyAvailable: 2_480_000 } }),
}))
vi.mock('@/features/auction/lib/useInfiniteScroll', () => ({
    useInfiniteScroll: () => vi.fn(),
}))
vi.mock('@/features/shop/components/ShopFilters', () => ({
    default: () => <form data-testid="shop-filters" />,
}))
vi.mock('@/features/shop/components/ShopCard', () => ({
    default: () => <article data-testid="shop-card" />,
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

describe('<MarketPage>', () => {
    beforeEach(() => {
        mocks.browse.mockReturnValue(baseQuery)
    })

    it('목록 상단 잔액은 숨기고 공통 마켓 인트로를 표시한다', () => {
        render(
            <MemoryRouter initialEntries={['/market']}>
                <MarketPage />
            </MemoryRouter>,
        )

        expect(screen.queryByText('2,480,000')).not.toBeInTheDocument()
        expect(screen.queryByTestId('list-available-balance')).toBeNull()
        expect(
            screen.getByRole('heading', { name: '아이템 마켓' }),
        ).toBeVisible()
        expect(screen.getByText('FIXED PRICE MARKET')).toBeVisible()
        expect(
            screen.getByRole('link', { name: '아이템 판매 등록' }),
        ).toHaveAttribute('data-registration-action')
    })
})
