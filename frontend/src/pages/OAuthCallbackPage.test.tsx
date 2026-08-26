import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor } from '@testing-library/react'
import OAuthCallbackPage from './OAuthCallbackPage'
import PublicRoute from '@/components/route/PublicRoute'
import { okEnvelope, renderWithProviders } from '@/test/renderWithProviders'
import { OAUTH_SESSION_KEY } from '@/features/auth/lib/oauth'
import { useAuthStore } from '@/store/authStore'
import type { MeResponse } from '@/lib/api/auth'
import type { SessionTokens } from '@/store/authStore'

/**
 * 소셜 로그인 콜백 (FC-156).
 *
 * 고정하는 것:
 *  1. state 대조(CSRF) — 불일치·누락·보관값 부재면 **백엔드를 호출하지 않고** 에러를 낸다.
 *  2. 사용자 취소(provider `?error`) — 취소 문구, 백엔드 미호출.
 *  3. 성공 — `POST /auth/oauth/{provider}` 교환 + `GET /me` 로 세션 확립(기존 토큰 저장 경로 재사용)
 *     → PublicRoute 가 홈으로 되돌린다.
 *  4. 교환 실패(AUTH_007) — code 별 문구, 세션 미확립.
 */

const TOKENS: SessionTokens = {
    accessToken: 'oauth-access',
    refreshToken: 'oauth-refresh',
    accessExpiresAt: '2999-01-01T00:00:00Z',
}

const ME: MeResponse = {
    userPublicId: 'U-KAKAO',
    nickname: '카카오유저',
    isAdmin: false,
    createdAt: '2026-07-01T00:00:00Z',
    emailVerified: false,
    emailMasked: null,
}

function errEnvelope(code: string, status: number) {
    return new Response(
        JSON.stringify({
            success: false,
            code,
            message: 'raw server text',
            timestamp: '2026-07-29T00:00:00Z',
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
    )
}

/** method+path 별 응답을 지정하는 fetch 스텁. */
function stubFetch(handler: (url: string, method: string) => Response) {
    const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(handler(String(input), init?.method ?? 'GET')),
    )
    vi.stubGlobal('fetch', fn)
    return fn
}

/** FC-155 규약대로 sessionStorage 에 보관값을 심는다. */
function seedPending(provider: string, state: string) {
    sessionStorage.setItem(
        OAUTH_SESSION_KEY,
        JSON.stringify({
            provider,
            state,
            issuedAt: Date.now(),
            returnPath: '/',
        }),
    )
}

/** 콜백을 PublicRoute 아래에 두고(성공 시 홈 복귀 검증), 지정 URL 로 진입시킨다. */
function renderCallback(url: string, strict = false) {
    const routes = (
        <Routes>
            <Route element={<PublicRoute />}>
                <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
            </Route>
            <Route path="/" element={<div>HOME</div>} />
            <Route path="/auctions" element={<div>AUCTIONS</div>} />
        </Routes>
    )
    return renderWithProviders(
        strict ? <StrictMode>{routes}</StrictMode> : routes,
        { route: url },
    )
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('OAuthCallbackPage', () => {
    it('state 불일치면 백엔드를 호출하지 않고 에러를 낸다(CSRF)', async () => {
        const fetchSpy = stubFetch(() => okEnvelope(TOKENS))
        seedPending('kakao', 'S1')

        renderCallback('/oauth/callback?code=CODE&state=WRONG')

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                '로그인 요청이 올바르지 않습니다. 다시 시도해 주세요.',
            ),
        )
        expect(fetchSpy).not.toHaveBeenCalled()
        // 보관값은 정리된다.
        expect(sessionStorage.getItem(OAUTH_SESSION_KEY)).toBeNull()
    })

    it('code 가 없으면(보관값만 있어도) 에러를 낸다', async () => {
        const fetchSpy = stubFetch(() => okEnvelope(TOKENS))
        seedPending('kakao', 'S1')

        renderCallback('/oauth/callback?state=S1')

        await waitFor(() =>
            expect(screen.getByRole('alert')).toBeInTheDocument(),
        )
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('provider 가 사용자 거부(?error)를 실어 오면 취소 문구를 낸다', async () => {
        const fetchSpy = stubFetch(() => okEnvelope(TOKENS))
        seedPending('kakao', 'S1')

        renderCallback('/oauth/callback?error=access_denied&state=S1')

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                '소셜 로그인을 취소했습니다.',
            ),
        )
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('보관값이 없으면(직접 진입 등) 에러를 낸다', async () => {
        const fetchSpy = stubFetch(() => okEnvelope(TOKENS))
        // seedPending 없음

        renderCallback('/oauth/callback?code=CODE&state=S1')

        await waitFor(() =>
            expect(screen.getByRole('alert')).toBeInTheDocument(),
        )
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('state 일치 시 code 를 교환하고 세션을 세워 홈으로 되돌린다', async () => {
        const fetchSpy = stubFetch((url, method) => {
            if (method === 'POST' && url.includes('/auth/oauth/kakao')) {
                return okEnvelope(TOKENS)
            }
            if (url.includes('/me')) return okEnvelope(ME)
            throw new Error(`예상치 못한 요청: ${method} ${url}`)
        })
        seedPending('kakao', 'S1')

        renderCallback('/oauth/callback?code=CODE&state=S1')

        // 성공 → PublicRoute 가 홈으로 되돌린다.
        await waitFor(() =>
            expect(screen.getByText('HOME')).toBeInTheDocument(),
        )

        // 기존 토큰 저장 경로 재사용 — 스토어에 토큰·사용자가 확립된다.
        const state = useAuthStore.getState()
        expect(state.accessToken).toBe(TOKENS.accessToken)
        expect(state.user?.nickname).toBe(ME.nickname)

        // 교환 요청 바디에 code·redirectUri 를 싣는다.
        const postCall = fetchSpy.mock.calls.find(
            ([, init]) => (init?.method ?? 'GET') === 'POST',
        )
        expect(postCall).toBeDefined()
        const body = JSON.parse(String(postCall?.[1]?.body))
        expect(body.code).toBe('CODE')
        expect(typeof body.redirectUri).toBe('string')
    })

    it('교환 실패(AUTH_007)면 세션을 세우지 않고 문구를 낸다', async () => {
        stubFetch((url, method) => {
            if (method === 'POST' && url.includes('/auth/oauth/kakao')) {
                return errEnvelope('AUTH_007', 401)
            }
            return okEnvelope(ME)
        })
        seedPending('kakao', 'S1')

        renderCallback('/oauth/callback?code=CODE&state=S1')

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                '소셜 로그인에 실패했습니다. 다시 시도해 주세요.',
            ),
        )
        expect(useAuthStore.getState().accessToken).toBeNull()
    })

    it('만료된 pending은 backend를 호출하지 않는다', async () => {
        const fetchSpy = stubFetch(() => okEnvelope(TOKENS))
        sessionStorage.setItem(
            OAUTH_SESSION_KEY,
            JSON.stringify({
                provider: 'kakao',
                state: 'S1',
                issuedAt: Date.now() - 5 * 60 * 1000 - 1,
                returnPath: '/',
            }),
        )
        renderCallback('/oauth/callback?code=CODE&state=S1')
        await waitFor(() =>
            expect(screen.getByRole('alert')).toBeInTheDocument(),
        )
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('성공하면 저장한 내부 returnPath로 복귀한다', async () => {
        stubFetch((url, method) => {
            if (method === 'POST' && url.includes('/auth/oauth/naver'))
                return okEnvelope(TOKENS)
            if (url.includes('/me')) return okEnvelope(ME)
            throw new Error(`예상하지 못한 요청: ${method} ${url}`)
        })
        sessionStorage.setItem(
            OAUTH_SESSION_KEY,
            JSON.stringify({
                provider: 'naver',
                state: 'S1',
                issuedAt: Date.now(),
                returnPath: '/auctions?sort=closing',
            }),
        )
        renderCallback('/oauth/callback?code=CODE&state=S1')
        await waitFor(() =>
            expect(screen.getByText('AUCTIONS')).toBeInTheDocument(),
        )
    })

    it('StrictMode에서도 backend code 교환을 정확히 한 번만 수행한다', async () => {
        const fetchSpy = stubFetch((url, method) => {
            if (method === 'POST' && url.includes('/auth/oauth/kakao')) {
                return okEnvelope(TOKENS)
            }
            if (url.includes('/me')) return okEnvelope(ME)
            throw new Error(`예상하지 못한 요청: ${method} ${url}`)
        })
        seedPending('kakao', 'S1')

        renderCallback('/oauth/callback?code=CODE&state=S1', true)

        await waitFor(() =>
            expect(screen.getByText('HOME')).toBeInTheDocument(),
        )
        expect(
            fetchSpy.mock.calls.filter(
                ([url, init]) =>
                    (init?.method ?? 'GET') === 'POST' &&
                    String(url).includes('/auth/oauth/kakao'),
            ),
        ).toHaveLength(1)
    })
})
