import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MePage from './MePage'
import { useAuthStore } from '@/store/authStore'
import { memoKeys } from '@/lib/queries/memos'
import { orderKeys } from '@/lib/queries/orders'
import { inventoryKeys } from '@/lib/queries/inventory'
import { okEnvelope, renderWithProviders } from '@/test/renderWithProviders'
import type { Mock } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'

/**
 * 마이페이지 탈퇴 경로 — 컨텍스트 캐시 축출 (FC-175 M1, spec §4.3-a).
 *
 * ★ 탈퇴 `onSuccess` 가 React 핸들러답게 컨텍스트 클라이언트(`useQueryClient()`)로 캐시를 비우는지
 *   검증한다. renderWithProviders 는 매번 새 QueryClient 를 주입하므로, 모듈 싱글턴이 아니라
 *   **주입된 인스턴스**가 비워져야 이 단언이 통과한다(§4.3-a — 원칙 일치·테스트 가능성).
 */

let fetchMock: Mock

beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
})

function seedSession() {
    useAuthStore.getState().setSession({
        accessToken: 'access-me',
        refreshToken: 'refresh-me',
        accessExpiresAt: '2999-01-01T00:00:00Z',
        user: { userPublicId: 'U-ME', nickname: '나', isAdmin: false },
    })
}

/** MePage 가 렌더 중 부르는 조회는 성공으로, 탈퇴(DELETE /me)는 204 로 응답한다. */
function mockPageFetches() {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        const u = String(url)
        const method = init?.method ?? 'GET'
        if (u.endsWith('/me/balance')) {
            return okEnvelope({
                cashBalance: 0,
                gameMoneyBalance: 1000,
                gameMoneyHeld: 0,
                gameMoneyAvailable: 1000,
            })
        }
        if (u.includes('/me/shops')) {
            return okEnvelope({ content: [], hasNext: false, nextCursor: null })
        }
        if (u.endsWith('/me') && method === 'DELETE') {
            return new Response(null, { status: 204 })
        }
        if (u.endsWith('/me') && method === 'GET') {
            return okEnvelope({
                userPublicId: 'U-ME',
                nickname: '나',
                isAdmin: false,
                createdAt: '2026-01-01T00:00:00Z',
                emailVerified: false,
                emailMasked: null,
            })
        }
        return okEnvelope(null)
    })
}

/** 사용자 전용 전역키 중 MePage 가 직접 조회하지 않는 대표들(축출 후 재조회로 되살아나지 않는다). */
function primeCaches(queryClient: QueryClient) {
    queryClient.setQueryData(memoKeys.received(), { pages: [], pageParams: [] })
    queryClient.setQueryData(memoKeys.unread(), { count: 5 })
    queryClient.setQueryData(orderKeys.lists(), { seeded: true })
    queryClient.setQueryData(inventoryKeys.me(), { seeded: true })
}

describe('MePage 탈퇴 — 컨텍스트 캐시 축출 (FC-175 M1)', () => {
    it('탈퇴 성공 시 주입된 컨텍스트 QueryClient 의 캐시가 비워진다', async () => {
        seedSession()
        mockPageFetches()

        const { queryClient } = renderWithProviders(<MePage />)

        // GET /me 성공 후에야 탈퇴 섹션이 렌더된다(성공 분기).
        const withdrawTrigger = await screen.findByRole('button', {
            name: '탈퇴하기',
        })

        // 축출 대상 캐시를 프라임한다(탈퇴 전에는 살아 있어야 한다).
        act(() => primeCaches(queryClient))
        expect(queryClient.getQueryData(memoKeys.unread())).toEqual({ count: 5 })

        // 다이얼로그 열기 → 동의 체크 → 탈퇴 확정.
        fireEvent.click(withdrawTrigger)
        fireEvent.click(await screen.findByRole('checkbox'))
        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: '탈퇴 확정' }),
            )
        })

        // onSuccess 가 컨텍스트 클라이언트를 clear → 프라임한 캐시가 전량 undefined.
        await waitFor(() => {
            expect(
                queryClient.getQueryData(memoKeys.received()),
            ).toBeUndefined()
        })
        expect(queryClient.getQueryData(memoKeys.unread())).toBeUndefined()
        expect(queryClient.getQueryData(orderKeys.lists())).toBeUndefined()
        expect(queryClient.getQueryData(inventoryKeys.me())).toBeUndefined()
        // 세션도 함께 비워진다(resetSessionState).
        expect(useAuthStore.getState().accessToken).toBeNull()
    })
})
