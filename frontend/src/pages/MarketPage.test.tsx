import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import MarketPage from './MarketPage'

vi.mock('@/lib/queries/shop', () => ({
    useShopBrowse: () => ({
        data: undefined,
        isPending: false,
        isError: false,
        refetch: vi.fn(),
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetching: false,
        isFetchingNextPage: false,
    }),
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

describe('<MarketPage>', () => {
    it('상단 가용잔액을 축약 없이 전체 정수로 표시한다', () => {
        render(
            <MemoryRouter initialEntries={['/market']}>
                <MarketPage />
            </MemoryRouter>,
        )

        expect(screen.getByText('2,480,000')).toBeInTheDocument()
        expect(screen.queryByText('248만')).not.toBeInTheDocument()
        expect(screen.getByTestId('list-available-balance')).toHaveClass(
            'min-w-0',
            'max-w-full',
            'flex-wrap',
        )
    })
})
