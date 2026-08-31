import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shopKeys, usePurchaseShop, useShopRecommendations } from './shop'
import { getShopRecommendations, purchaseShop } from '@/lib/api/shop'

vi.mock('@/lib/api/shop', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/api/shop')>()),
    getShopRecommendations: vi.fn(),
    purchaseShop: vi.fn(),
}))

function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: PropsWithChildren) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    }
}

describe('홈 마켓 추천 쿼리', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('공개 추천 API 응답을 전용 키에 저장한다', async () => {
        const response = { items: [], calculatedAt: '2026-08-31T00:00:00Z' }
        vi.mocked(getShopRecommendations).mockResolvedValue(response)
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        const { result } = renderHook(() => useShopRecommendations(), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toEqual(response)
        expect(getShopRecommendations).toHaveBeenCalledOnce()
        expect(queryClient.getQueryData(shopKeys.recommendations())).toEqual(
            response,
        )
    })

    it('구매 성공 후 홈 추천 캐시를 무효화한다', async () => {
        vi.mocked(purchaseShop).mockResolvedValue({
            orderPublicId: 'ORDER-1',
            finalPrice: 1000,
        })
        const queryClient = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        queryClient.setQueryData(shopKeys.recommendations(), {
            items: [],
            calculatedAt: '2026-08-31T00:00:00Z',
        })

        const { result } = renderHook(() => usePurchaseShop('SHOP-1'), {
            wrapper: createWrapper(queryClient),
        })
        result.current.mutate()

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(
            queryClient.getQueryState(shopKeys.recommendations())
                ?.isInvalidated,
        ).toBe(true)
    })
})
