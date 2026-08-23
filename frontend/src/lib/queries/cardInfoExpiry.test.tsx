import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { earliestCardInfoValidUntil, useCardInfoExpiry } from './cardInfoExpiry'

const NOW = Date.parse('2026-08-23T00:00:00Z')

afterEach(() => {
    vi.useRealTimers()
})

function cardInfo(validUntil: string | null) {
    return {
        cardInfo: {
            calculatedAt: new Date(NOW).toISOString(),
            frame: { type: 'GOLD' },
            validUntil,
        },
    }
}

describe('cardInfo validUntil query 갱신', () => {
    it('중첩·페이지 데이터에서 가장 이른 유효 경계를 찾는다', () => {
        expect(
            earliestCardInfoValidUntil({
                pages: [
                    { content: [cardInfo('2026-08-23T00:00:20Z')] },
                    { content: [cardInfo('2026-08-23T00:00:10Z')] },
                ],
            }),
        ).toBe(NOW + 10_000)
    })

    it('경계 직전에는 유지하고 now >= validUntil에 해당 query를 무효화한다', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(NOW)
        const queryClient = new QueryClient()
        const invalidate = vi
            .spyOn(queryClient, 'invalidateQueries')
            .mockResolvedValue()
        const wrapper = ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )

        renderHook(
            () =>
                useCardInfoExpiry(
                    ['shops', 'detail', 'SHOP-1'],
                    cardInfo('2026-08-23T00:00:10Z'),
                ),
            { wrapper },
        )

        await act(() => vi.advanceTimersByTimeAsync(9_999))
        expect(invalidate).not.toHaveBeenCalled()
        await act(() => vi.advanceTimersByTimeAsync(1))
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: ['shops', 'detail', 'SHOP-1'],
            exact: true,
            refetchType: 'active',
        })
    })

    it('데이터 변경과 unmount 시 이전 타이머를 정리한다', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(NOW)
        const queryClient = new QueryClient()
        const invalidate = vi
            .spyOn(queryClient, 'invalidateQueries')
            .mockResolvedValue()
        const wrapper = ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
        const { rerender, unmount } = renderHook(
            ({ validUntil }) =>
                useCardInfoExpiry(['inventory', 'me'], cardInfo(validUntil)),
            {
                wrapper,
                initialProps: { validUntil: '2026-08-23T00:00:20Z' },
            },
        )

        rerender({ validUntil: '2026-08-23T00:00:05Z' })
        await act(() => vi.advanceTimersByTimeAsync(5_000))
        expect(invalidate).toHaveBeenCalledTimes(1)
        unmount()
        await act(() => vi.advanceTimersByTimeAsync(20_000))
        expect(invalidate).toHaveBeenCalledTimes(1)
    })
})
