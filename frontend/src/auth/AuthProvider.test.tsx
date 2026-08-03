import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/auth'
import { useAuthStore } from '@/store/authStore'
import { apiClient } from '@/lib/api/client'
import { memoKeys } from '@/lib/queries/memos'
import { balanceKeys } from '@/lib/queries/balance'
import { meKeys } from '@/lib/queries/me'
import { orderKeys } from '@/lib/queries/orders'
import { inventoryKeys } from '@/lib/queries/inventory'
import { okEnvelope, renderWithProviders } from '@/test/renderWithProviders'
import type { AuthContextValue } from '@/auth/AuthContext'
import type { Mock } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'

/**
 * 세션 생명주기 — 원자적 계정 전환 (FC-174, spec §6.2).
 *
 * ★ 근본원인 A(캐시 미초기화)·B(신원 desync)의 회귀 방어. 로그아웃·계정 전환이 (store + 전역키
 *   캐시)를 원자적으로 비우고, 전환 후 발신 요청이 **새 계정 토큰**으로 나가는지 검증한다.
 * ★ renderWithProviders 는 매번 새 QueryClient 를 주입한다 — AuthProvider 는 `useQueryClient()`
 *   (컨텍스트 클라이언트)로 clear 하므로, 이 테스트가 그 인스턴스로 캐시 축출을 단언할 수 있다(§4.3-a).
 */

/** 최신 auth 컨텍스트를 잡아두는 프로브. */
let auth: AuthContextValue
function AuthProbe() {
    auth = useAuth()
    return null
}

/** 204 (로그아웃) 응답. */
function noContent(): Response {
    return new Response(null, { status: 204 })
}

let fetchMock: Mock

beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
})

/** demo1 세션을 store 에 심는다(로그인된 상태로 렌더 시작). */
function seedDemo1Session() {
    useAuthStore.getState().setSession({
        accessToken: 'access-demo1',
        refreshToken: 'refresh-demo1',
        accessExpiresAt: '2999-01-01T00:00:00Z',
        user: { userPublicId: 'U-DEMO1', nickname: 'demo1', isAdmin: false },
    })
}

/** 사용자 전용 전역키 8계열 중 대표들에 demo1 데이터를 프라임한다. */
function primeDemo1Caches(queryClient: QueryClient) {
    queryClient.setQueryData(memoKeys.received(), {
        pages: [
            {
                content: [
                    {
                        memoPublicId: 'M-DEMO1',
                        type: 5,
                        senderNickname: '누군가',
                        bodyPreview: 'demo1 에게 온 쪽지',
                        isRead: false,
                        createdAt: '2026-08-01T00:00:00Z',
                    },
                ],
                hasNext: false,
                nextCursor: null,
            },
        ],
        pageParams: [null],
    })
    queryClient.setQueryData(memoKeys.unread(), { count: 3 })
    queryClient.setQueryData(balanceKeys.me(), { balance: 999_999 })
    queryClient.setQueryData(meKeys.profile(), { nickname: 'demo1' })
    queryClient.setQueryData(orderKeys.lists(), { demo1: true })
    queryClient.setQueryData(inventoryKeys.me(), { demo1: true })
}

describe('T1 — 세션 스토어 원자성 (spec §6.1)', () => {
    it('clearSession 은 토큰·user 를 전부 비운다', () => {
        seedDemo1Session()

        act(() => useAuthStore.getState().clearSession())

        const state = useAuthStore.getState()
        expect(state.accessToken).toBeNull()
        expect(state.refreshToken).toBeNull()
        expect(state.accessExpiresAt).toBeNull()
        expect(state.user).toBeNull()
    })

    it('setSession(demo2) 후 이전 계정(user) 잔재가 없다', () => {
        seedDemo1Session()

        act(() =>
            useAuthStore.getState().setSession({
                accessToken: 'access-demo2',
                refreshToken: 'refresh-demo2',
                accessExpiresAt: '2999-01-01T00:00:00Z',
                user: {
                    userPublicId: 'U-DEMO2',
                    nickname: 'demo2',
                    isAdmin: false,
                },
            }),
        )

        const state = useAuthStore.getState()
        expect(state.user?.nickname).toBe('demo2')
        expect(state.user?.userPublicId).toBe('U-DEMO2')
        expect(state.accessToken).toBe('access-demo2')
    })
})

describe('T4 — 로그아웃 캐시 축출 (defect A, spec §6.2)', () => {
    it('signOut 은 사용자 전용 전역키 캐시를 전량 축출한다', async () => {
        seedDemo1Session()
        const { queryClient } = renderWithProviders(<AuthProbe />)
        primeDemo1Caches(queryClient)

        // apiLogout(POST /auth/logout) → 204.
        fetchMock.mockResolvedValue(noContent())

        await act(async () => {
            await auth.signOut()
        })

        // store 비움.
        expect(useAuthStore.getState().accessToken).toBeNull()
        // 전역키 캐시 전량 축출(메모만이 아니다 — 8계열 전부).
        expect(queryClient.getQueryData(memoKeys.received())).toBeUndefined()
        expect(queryClient.getQueryData(memoKeys.unread())).toBeUndefined()
        expect(queryClient.getQueryData(balanceKeys.me())).toBeUndefined()
        expect(queryClient.getQueryData(meKeys.profile())).toBeUndefined()
        expect(queryClient.getQueryData(orderKeys.lists())).toBeUndefined()
        expect(queryClient.getQueryData(inventoryKeys.me())).toBeUndefined()
    })
})

describe('T5 — 계정 전환 격리 (defect A+B, spec §6.2)', () => {
    it('demo1→demo2 전환: store 가 demo2 로 갈리고 demo1 캐시가 사라지며, 이후 발신이 demo2 토큰으로 나간다', async () => {
        seedDemo1Session()
        const { queryClient } = renderWithProviders(<AuthProbe />)
        primeDemo1Caches(queryClient)

        fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
            const u = String(url)
            if (u.endsWith('/auth/login')) {
                return okEnvelope({
                    accessToken: 'access-demo2',
                    refreshToken: 'refresh-demo2',
                    accessExpiresAt: '2999-01-01T00:00:00Z',
                })
            }
            if (u.endsWith('/me') && (init.method ?? 'GET') === 'GET') {
                return okEnvelope({
                    userPublicId: 'U-DEMO2',
                    nickname: 'demo2',
                    isAdmin: false,
                    createdAt: '2026-08-01T00:00:00Z',
                    emailVerified: false,
                    emailMasked: null,
                })
            }
            if (u.endsWith('/me/memos')) {
                return okEnvelope({
                    memoPublicId: 'M-NEW',
                    createdAt: '2026-08-03T00:00:00Z',
                })
            }
            return okEnvelope(null)
        })

        await act(async () => {
            await auth.signIn({ loginId: 'demo2', password: 'pw' })
        })

        // (a) store = demo2.
        const state = useAuthStore.getState()
        expect(state.user?.nickname).toBe('demo2')
        expect(state.accessToken).toBe('access-demo2')

        // (b) demo1 메모 캐시 부재(전환 진입 시 purge).
        expect(queryClient.getQueryData(memoKeys.received())).toBeUndefined()
        expect(queryClient.getQueryData(memoKeys.unread())).toBeUndefined()

        // (c) T5c — 전환 후 발신의 Authorization 헤더 == 새 계정 토큰(신원 정확성 FE 대리검증).
        await apiClient.post('/me/memos', {
            receiverNickname: '수신자',
            body: '안녕',
        })
        const memoCall = fetchMock.mock.calls.find(
            (call) =>
                String(call[0]).endsWith('/me/memos') &&
                (call[1] as RequestInit).method === 'POST',
        )
        const headers = (memoCall?.[1] as RequestInit).headers as Headers
        expect(headers.get('Authorization')).toBe('Bearer access-demo2')
    })

    it('getMe 가 실패하면 반쪽 세션을 남기지 않고 되돌린다', async () => {
        seedDemo1Session()
        renderWithProviders(<AuthProbe />)

        fetchMock.mockImplementation(async (url: string) => {
            const u = String(url)
            if (u.endsWith('/auth/login')) {
                return okEnvelope({
                    accessToken: 'access-demo2',
                    refreshToken: 'refresh-demo2',
                    accessExpiresAt: '2999-01-01T00:00:00Z',
                })
            }
            // /me 가 500 — 프로필 하이드레이션 실패.
            return new Response(
                JSON.stringify({
                    success: false,
                    code: 'COMMON_001',
                    message: '서버 오류',
                    timestamp: '2026-08-03T00:00:00Z',
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        })

        await act(async () => {
            await expect(
                auth.signIn({ loginId: 'demo2', password: 'pw' }),
            ).rejects.toBeTruthy()
        })

        // 새 토큰이 심겼다가 실패로 되돌아가 세션이 비워진다(반쪽 세션 금지).
        expect(useAuthStore.getState().accessToken).toBeNull()
        expect(useAuthStore.getState().user).toBeNull()
    })
})

describe('T6 — 미열람 뱃지 초기화 (spec §6.2)', () => {
    it('전환 후 미열람 캐시가 비워져 이전 계정 카운트가 잔존하지 않는다', async () => {
        seedDemo1Session()
        const { queryClient } = renderWithProviders(<AuthProbe />)
        // demo1 미열람 뱃지 3 을 프라임.
        queryClient.setQueryData(memoKeys.unread(), { count: 3 })

        fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
            const u = String(url)
            if (u.endsWith('/auth/login')) {
                return okEnvelope({
                    accessToken: 'access-demo2',
                    refreshToken: 'refresh-demo2',
                    accessExpiresAt: '2999-01-01T00:00:00Z',
                })
            }
            if (u.endsWith('/me') && (init.method ?? 'GET') === 'GET') {
                return okEnvelope({
                    userPublicId: 'U-DEMO2',
                    nickname: 'demo2',
                    isAdmin: false,
                    createdAt: '2026-08-01T00:00:00Z',
                    emailVerified: false,
                    emailMasked: null,
                })
            }
            return okEnvelope(null)
        })

        await act(async () => {
            await auth.signIn({ loginId: 'demo2', password: 'pw' })
        })

        // demo1 의 미열람 3 이 캐시에서 축출됐다 — 뱃지는 demo2 로 재조회한다(잔존 렌더 금지).
        expect(queryClient.getQueryData(memoKeys.unread())).toBeUndefined()
    })
})
