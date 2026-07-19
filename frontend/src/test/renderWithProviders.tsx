import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { act, render } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthProvider } from '@/auth'
import { useAuthStore } from '@/store/authStore'
import type { ReactNode } from 'react'

/**
 * 화면 테스트용 프로바이더 조립 (FC-057).
 *
 * ★ 앱과 **같은 순서**로 감싼다(`App.tsx`) — Router → QueryClient → Auth. 순서가 다르면
 *   테스트에선 통과하는데 앱에선 훅이 컨텍스트를 못 찾는 상황이 생긴다.
 *
 * ★ `QueryClient` 는 **테스트마다 새로** 만든다. 전역 `queryClient` 를 재사용하면 앞 테스트의
 *   잔액 캐시가 다음 테스트로 새어 "혼자 통과, 전체 실패"가 된다(`test/setup.ts` 와 같은 취지).
 *   재시도는 끈다 — 실패 경로 테스트가 백오프만큼 느려질 이유가 없다.
 */
export function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
            mutations: { retry: false },
        },
    })
}

interface RenderOptions {
    /** 초기 URL. 활성 내비·404 검증에 쓴다. */
    route?: string
}

export function renderWithProviders(
    ui: ReactNode,
    { route = '/' }: RenderOptions = {},
) {
    const queryClient = createTestQueryClient()

    return {
        queryClient,
        ...render(
            <MemoryRouter initialEntries={[route]}>
                <QueryClientProvider client={queryClient}>
                    <AuthProvider>{ui}</AuthProvider>
                </QueryClientProvider>
            </MemoryRouter>,
        ),
    }
}

/** 로그인 세션을 심는다. `test/setup.ts` 의 `afterEach` 가 매번 비운다. */
export function signInForTest(
    overrides: Partial<{ nickname: string; isAdmin: boolean }> = {},
) {
    useAuthStore.getState().setSession({
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        accessExpiresAt: '2999-01-01T00:00:00Z',
        user: {
            userPublicId: 'U-TEST',
            nickname: overrides.nickname ?? '테스터',
            isAdmin: overrides.isAdmin ?? false,
        },
    })
}

/**
 * 조작 가능한 `matchMedia` 스텁 (FC-064).
 *
 * ★ `test/setup.ts` 의 기본 스텁은 **항상 `matches: false` 이고 리스너가 no-op** 이라
 *   "폭이 바뀌었다" 를 표현할 수 없다. 뷰포트 전이에 반응하는 동작(모바일 전용 시트의
 *   자동 닫힘 등)을 검증하려면 리스너를 실제로 부를 수 있어야 한다.
 *
 * ★ `afterEach` 의 `unstubGlobals`(vitest 설정)가 원래 구현을 되돌린다.
 */
export function stubMatchMedia(initial: Record<string, boolean> = {}) {
    const matches = { ...initial }
    const listeners = new Map<
        string,
        Set<(event: MediaQueryListEvent) => void>
    >()

    vi.stubGlobal('matchMedia', (query: string) => ({
        media: query,
        get matches() {
            return matches[query] ?? false
        },
        onchange: null,
        addEventListener: (
            _type: string,
            listener: (event: MediaQueryListEvent) => void,
        ) => {
            if (!listeners.has(query)) listeners.set(query, new Set())
            listeners.get(query)?.add(listener)
        },
        removeEventListener: (
            _type: string,
            listener: (event: MediaQueryListEvent) => void,
        ) => listeners.get(query)?.delete(listener),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    }))

    return {
        /** 질의 결과를 바꾸고 구독자에게 알린다(브라우저의 폭 변경에 해당). */
        setMatches(query: string, value: boolean) {
            matches[query] = value
            act(() => {
                for (const listener of listeners.get(query) ?? []) {
                    listener({
                        matches: value,
                        media: query,
                    } as MediaQueryListEvent)
                }
            })
        },
    }
}

/** 성공 envelope 응답 (계약 §1.4) */
export function okEnvelope(data: unknown): Response {
    return new Response(
        JSON.stringify({
            success: true,
            data,
            timestamp: '2026-07-19T00:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
}
