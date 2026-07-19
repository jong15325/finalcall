import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth'
import ProtectedRoute from './ProtectedRoute'
import PublicRoute from './PublicRoute'
import {
    createTestQueryClient,
    signInForTest,
} from '@/test/renderWithProviders'
import type { ReactNode } from 'react'

/**
 * 로그인 복귀(`returnUrl`) 왕복 고정 (FC-057).
 *
 * ★ 종전 `PublicRoute` 는 `redirectUrl` 을 **무시하고** 늘 홈으로 보냈다 — `ProtectedRoute` 가
 *   붙여둔 복귀 대상이 버려졌다. 두 가드는 **짝으로만 의미가 있어** 한 파일에서 왕복을 검증한다.
 */

/** 현재 주소를 화면에 노출해 리다이렉트 결과를 단언 가능하게 만든다. */
const LocationProbe = () => {
    const { pathname, search } = useLocation()
    return <div data-testid="location">{`${pathname}${search}`}</div>
}

function renderAt(route: string, ui: ReactNode) {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <QueryClientProvider client={createTestQueryClient()}>
                <AuthProvider>
                    {ui}
                    <LocationProbe />
                </AuthProvider>
            </QueryClientProvider>
        </MemoryRouter>,
    )
}

/** `/sell`(보호) 과 `/login`(비로그인 전용) 만 있는 최소 트리 */
const guardedTree = (
    <Routes>
        <Route element={<ProtectedRoute />}>
            <Route path="/sell" element={<div>판매 등록 화면</div>} />
        </Route>
        <Route element={<PublicRoute />}>
            <Route path="/login" element={<div>로그인 화면</div>} />
        </Route>
        <Route path="/" element={<div>홈 화면</div>} />
    </Routes>
)

const at = () => screen.getByTestId('location').textContent

describe('ProtectedRoute — 복귀 대상을 만든다', () => {
    it('비로그인은 로그인으로 보내고 원래 경로를 실어 보낸다', () => {
        renderAt('/sell', guardedTree)

        expect(screen.getByText('로그인 화면')).toBeInTheDocument()
        expect(at()).toBe(`/login?redirectUrl=${encodeURIComponent('/sell')}`)
    })

    it('★ query 까지 싣는다 — 경로만 실으면 보던 필터가 사라진다', () => {
        renderAt('/sell?category=weapon', guardedTree)

        expect(at()).toBe(
            `/login?redirectUrl=${encodeURIComponent('/sell?category=weapon')}`,
        )
    })

    it('로그인 상태면 그대로 통과시킨다', () => {
        signInForTest()
        renderAt('/sell', guardedTree)

        expect(screen.getByText('판매 등록 화면')).toBeInTheDocument()
    })
})

describe('PublicRoute — 복귀 대상을 소비한다', () => {
    it('★ redirectUrl 로 되돌린다 (종전에는 무시하고 홈으로 갔다)', () => {
        signInForTest()
        renderAt(
            `/login?redirectUrl=${encodeURIComponent('/sell')}`,
            guardedTree,
        )

        expect(screen.getByText('판매 등록 화면')).toBeInTheDocument()
        expect(at()).toBe('/sell')
    })

    it('redirectUrl 이 없으면 홈으로 간다(기존 동작 유지)', () => {
        signInForTest()
        renderAt('/login', guardedTree)

        expect(screen.getByText('홈 화면')).toBeInTheDocument()
        expect(at()).toBe('/')
    })

    it('★★ 외부 URL 은 따라가지 않는다 — 오픈 리다이렉트(피싱 발판) 차단', () => {
        signInForTest()
        renderAt(
            `/login?redirectUrl=${encodeURIComponent('https://evil.example')}`,
            guardedTree,
        )

        expect(at()).toBe('/')
    })

    it('프로토콜 상대 URL(`//host`) 도 따라가지 않는다', () => {
        signInForTest()
        renderAt(
            `/login?redirectUrl=${encodeURIComponent('//evil.example')}`,
            guardedTree,
        )

        expect(at()).toBe('/')
    })

    it('비로그인이면 로그인 화면을 그대로 보여준다', () => {
        renderAt('/login', guardedTree)

        expect(screen.getByText('로그인 화면')).toBeInTheDocument()
    })
})

describe('왕복 — 튕겨나갔다가 제자리로 돌아온다', () => {
    it('비로그인 /sell → 로그인 → 다시 /sell', () => {
        // 1) 비로그인으로 보호 화면에 접근하면 복귀 대상이 붙은 로그인으로 간다.
        const first = renderAt('/sell', guardedTree)
        const bounced = at()
        expect(bounced).toContain('redirectUrl')
        first.unmount()

        // 2) 그 주소에서 로그인이 성립하면 원래 화면으로 돌아온다.
        signInForTest()
        renderAt(bounced!, guardedTree)
        expect(screen.getByText('판매 등록 화면')).toBeInTheDocument()
        expect(at()).toBe('/sell')
    })
})

describe('전용 404 — 주소를 갈아끼우지 않는다', () => {
    it('없는 경로에서 주소가 유지된다(홈으로 조용히 리다이렉트하지 않는다)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('네트워크 호출 없음')
            }),
        )
        const { default: NotFound } = await import('@/views/others/NotFound')

        renderAt(
            '/typo-page',
            <Routes>
                <Route path="/" element={<div>홈 화면</div>} />
                <Route path="*" element={<NotFound />} />
            </Routes>,
        )

        expect(at()).toBe('/typo-page')
        expect(screen.getByText('404')).toBeInTheDocument()
        // 친 주소를 되비춰 오타를 눈으로 찾게 한다.
        expect(screen.getByTestId('requested-path')).toHaveTextContent(
            '/typo-page',
        )
    })

    it('출구를 제공한다 — 막다른 골목이 아니다', async () => {
        const { default: NotFound } = await import('@/views/others/NotFound')

        renderAt(
            '/typo-page',
            <Routes>
                <Route path="*" element={<NotFound />} />
            </Routes>,
        )

        expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute(
            'href',
            '/',
        )
        expect(
            screen.getByRole('link', { name: '경매 둘러보기' }),
        ).toHaveAttribute('href', '/auctions')
    })
})
