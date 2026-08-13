import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/auth'
import { balanceKeys } from '@/lib/queries/balance'
import { memoKeys } from '@/lib/queries/memos'
import { useAuthStore } from '@/store/authStore'
import { COLOR_PALETTES } from './fixtures/colorSystem'
import { NAVIGATION_LAYOUT_VARIANTS } from './scenarioMetadata'
import WorkbenchRoutes from './WorkbenchRoutes'

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

function renderWorkbench(route: string, queryClient = createQueryClient()) {
    const view = render(
        <MemoryRouter initialEntries={[route]}>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <WorkbenchRoutes />
                </AuthProvider>
            </QueryClientProvider>
        </MemoryRouter>,
    )
    return Object.assign(view, { queryClient })
}

function createQueryClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
}

function useViewport(width: number) {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: width,
    })
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(min-width: 1280px)' && width >= 1280,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    }))
}

describe('WorkbenchRoutes', () => {
    it('renders a known scenario inside the real AppShell route context', async () => {
        const teal = COLOR_PALETTES.find(({ id }) => id === 'fc-palette-teal')!
        const view = renderWorkbench(
            '/__design/main-color-palettes?variant=fc-palette-teal',
        )

        expect(
            await screen.findByRole('heading', {
                name: '밝고 선명한 메인 컬러 10안',
            }),
        ).toBeVisible()
        expect(view.getByTestId('app-content-plane')).toHaveAttribute(
            'data-content-plane',
            'auction-detail',
        )
        await waitFor(() => {
            expect(view.container.firstElementChild).toHaveStyle({
                '--chrome-bg': teal.overrides['--chrome-bg'],
                '--control-action': teal.overrides['--control-action'],
            })
        })
        expect(view.getByRole('link', { name: /클린 틸/ })).toHaveAttribute(
            'aria-current',
            'true',
        )
    })

    it('10개 후보에서 금지 색을 제외하고 후보 행동색과 고정 의미색을 분리한다', async () => {
        const view = renderWorkbench(
            '/__design/main-color-palettes?variant=fc-palette-cobalt',
        )
        await screen.findByRole('heading', {
            name: '밝고 선명한 메인 컬러 10안',
        })

        expect(COLOR_PALETTES).toHaveLength(10)
        expect(COLOR_PALETTES.map(({ name }) => name).join(' ')).not.toMatch(
            /퍼플|플럼|인디고/u,
        )
        expect(
            new Set(
                COLOR_PALETTES.map(
                    ({ overrides }) => overrides['--control-action-ink'],
                ),
            ),
        ).toEqual(
            new Set([COLOR_PALETTES[0].overrides['--control-action-ink']]),
        )

        expect(screen.getByRole('button', { name: '입찰하기' })).toHaveClass(
            'bg-control-action',
            'text-control-action-ink',
        )
        expect(screen.getByRole('button', { name: '선택됨' })).toHaveAttribute(
            'aria-pressed',
            'true',
        )
        expect(view.getByTestId('fixed-semantic-scope')).toHaveTextContent(
            '취소 / 승인·성공 / 위험',
        )
        expect(screen.getByText('승인 완료')).toHaveClass(
            'bg-success-soft',
            'text-success-ink',
        )
        expect(
            screen.getByRole('button', { name: '경매 강제 종료' }),
        ).toHaveClass('bg-danger', 'text-on-strong')
    })

    it('브라이트 스틸 fixture가 production semantic token과 일치한다', () => {
        const steel = COLOR_PALETTES.find(
            ({ id }) => id === 'fc-palette-steel-blue',
        )!
        const source = readFileSync(
            resolve(process.cwd(), 'src/styles/tokens.css'),
            'utf8',
        )
        const declarations = new Map(
            [...source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/gu)].map(
                ([, name, value]) => [name, value.trim()],
            ),
        )
        const resolveToken = (name: string): string => {
            const value = declarations.get(name) ?? ''
            const reference = value.match(/^var\((--[\w-]+)\)$/u)?.[1]
            return reference ? resolveToken(reference) : value
        }

        for (const [token, value] of Object.entries(steel.overrides)) {
            expect(value.toLowerCase()).toBe(resolveToken(token).toLowerCase())
        }
    })

    it.each([390, 1280])(
        '%ipx 접점 고정형은 responsive 상단 여백에서 동일 폭 sticky 구조를 제공한다',
        async (width) => {
            useViewport(width)
            const view = renderWorkbench(
                `/__design/top-navigation-layouts?variant=${NAVIGATION_LAYOUT_VARIANTS.contactDock}`,
            )
            await screen.findByRole('heading', {
                name: '상단 네비게이션 레이아웃 4안',
            })

            await waitFor(() => {
                expect(
                    view.container.querySelector(
                        '[data-workbench-navigation-frame]',
                    ),
                ).toBeInTheDocument()
            })
            const frame = view.container.querySelector<HTMLElement>(
                '[data-workbench-navigation-frame]',
            )!
            const navigation = view.container.querySelector<HTMLElement>(
                '[data-workbench-nav-measure]',
            )!
            const content = view.container.querySelector<HTMLElement>(
                '[data-workbench-content-measure]',
            )!
            const footer = view.container.querySelector<HTMLElement>(
                '[data-workbench-footer-measure]',
            )!

            expect(frame).toHaveClass('sticky', 'top-0', 'z-30')
            expect(frame.style.top).toBe(width === 1280 ? '12px' : '8px')
            expect(frame).toHaveAttribute('data-workbench-dock-state', 'stuck')
            expect(
                screen.getByRole('link', { name: /접점 고정형/ }),
            ).toHaveAttribute('aria-current', 'true')
            expect(frame.previousElementSibling).toHaveAttribute(
                'data-workbench-dock-sentinel',
                NAVIGATION_LAYOUT_VARIANTS.contactDock,
            )
            expect(view.getByTestId('app-content-plane').parentElement).toHaveClass(
                'pb-4',
            )
            expect(view.getByTestId('app-content-plane').parentElement).not.toHaveClass(
                'py-4',
                'sm:py-5',
                'xl:py-7',
            )
            expect(navigation).toHaveClass(
                'w-full',
                'max-w-[1440px]',
                'rounded-xl',
                'shadow-sm',
                'transition-all',
            )
            expect(navigation).not.toHaveClass('overflow-hidden')
            const contentStyle = getComputedStyle(content)
            const expectedRadius =
                width === 1280
                    ? contentStyle.borderTopLeftRadius
                    : '12px'
            expect(navigation.style.borderTopLeftRadius).toBe(
                expectedRadius,
            )
            expect(navigation.style.borderTopRightRadius).toBe(
                expectedRadius,
            )
            expect(navigation.style.borderBottomLeftRadius).toBe(
                expectedRadius,
            )
            expect(navigation.style.borderBottomRightRadius).toBe(
                expectedRadius,
            )
            expect(navigation.parentElement).toBe(frame)
            expect(
                view.container.querySelector('[data-workbench-nav-backing]'),
            ).not.toBeInTheDocument()
            const navigationBounds = navigation.getBoundingClientRect()
            for (const target of [content, footer]) {
                const bounds = target.getBoundingClientRect()
                expect([
                    navigationBounds.left,
                    navigationBounds.right,
                    navigationBounds.width,
                ]).toEqual([bounds.left, bounds.right, bounds.width])
            }
        },
    )

    it('4안은 실제 공용 navigation을 유지하며 도킹 상태 변화만 구분한다', async () => {
        useViewport(1280)
        const view = renderWorkbench(
            `/__design/top-navigation-layouts?variant=${NAVIGATION_LAYOUT_VARIANTS.transitionDock}`,
        )
        await screen.findByRole('heading', {
            name: '상단 네비게이션 레이아웃 4안',
        })

        expect(
            screen.getAllByRole('link', {
                name: /접점 고정형|도킹 전환형|컴팩트 도킹형|방향 반응형/,
            }),
        ).toHaveLength(4)
        expect(screen.getByText('선택안')).toBeVisible()
        await waitFor(() => {
            expect(
                view.container.querySelector('[data-horizontal-root]'),
            ).toBeInTheDocument()
        })
        expect(
            view.container.querySelector('[data-workbench-nav-measure]'),
        ).toHaveClass('transition-all', 'motion-reduce:transition-none')
    })

    it('390px에서도 실제 mobile menu와 safe-area 접근성을 유지한다', async () => {
        useViewport(390)
        const view = renderWorkbench(
            `/__design/top-navigation-layouts?variant=${NAVIGATION_LAYOUT_VARIANTS.compactDock}`,
        )
        await screen.findByRole('heading', {
            name: '상단 네비게이션 레이아웃 4안',
        })

        await waitFor(() => {
            expect(
                view.container.querySelector(
                    '[data-workbench-navigation-frame]',
                ),
            ).toBeInTheDocument()
        })
        const mobileNav = view.container.querySelector<HTMLElement>(
            'nav.fixed.inset-x-0',
        )!
        expect(mobileNav).toHaveClass(
            'pb-[env(safe-area-inset-bottom)]',
            'xl:hidden',
        )
        for (const item of mobileNav.children) {
            expect(item).toHaveClass('flex-1')
        }
        for (const option of screen.getAllByRole('link', {
            name: /접점 고정형|도킹 전환형|컴팩트 도킹형|방향 반응형/,
        })) {
            expect(option).toHaveClass('min-h-11', 'min-w-0')
        }
    })

    it.each([390, 1280])(
        '%ipx에서 팔레트 scroller 밖의 page-level intrinsic overflow를 만들지 않는다',
        async (width) => {
            useViewport(width)
            const view = renderWorkbench(
                '/__design/main-color-palettes?variant=fc-palette-cobalt',
            )
            await screen.findByRole('heading', {
                name: '밝고 선명한 메인 컬러 10안',
            })

            const scenario = view.getByTestId('color-system-scenario')
            expect(scenario).toHaveClass('w-full', 'min-w-0', 'max-w-full')
            expect(view.getByTestId('palette-preview-grid')).toHaveClass(
                'min-w-0',
            )
            expect(view.getByTestId('palette-selector')).toHaveClass(
                'max-w-full',
                'overflow-x-auto',
            )
            expect(scenario.querySelectorAll('.overflow-x-auto')).toHaveLength(
                1,
            )
            for (const row of view.getAllByTestId('semantic-token-row')) {
                expect(row).toHaveClass('min-w-0', 'flex-wrap')
                expect(row.querySelector('dt')).toHaveClass(
                    'min-w-0',
                    'break-all',
                )
                expect(row.querySelector('dd')).toHaveClass(
                    'min-w-0',
                    'max-w-full',
                    'break-all',
                )
            }
        },
    )

    it('실제 auth/query 상태를 결정적 fixture로 격리하고 이탈 시 복원한다', async () => {
        const originalSession = {
            accessToken: 'original-access',
            refreshToken: 'original-refresh',
            accessExpiresAt: '2030-01-01T00:00:00Z',
            user: {
                userPublicId: 'original-user',
                nickname: '원래 사용자',
                isAdmin: true,
            },
        }
        useAuthStore.getState().setSession(originalSession)
        const queryClient = createQueryClient()
        queryClient.setQueryData(balanceKeys.me(), {
            cashBalance: 1,
            gameMoneyBalance: 2,
            gameMoneyHeld: 0,
            gameMoneyAvailable: 2,
        })
        queryClient.setQueryData(memoKeys.unread(), { count: 77 })

        const view = renderWorkbench(
            '/__design/main-color-palettes?variant=fc-palette-cobalt',
            queryClient,
        )
        await screen.findByRole('heading', {
            name: '밝고 선명한 메인 컬러 10안',
        })

        expect(useAuthStore.getState().user?.nickname).toBe('프리뷰 사용자')
        expect(queryClient.getQueryData(balanceKeys.me())).toMatchObject({
            gameMoneyBalance: 1_520_000,
        })
        expect(queryClient.getQueryData(memoKeys.unread())).toEqual({
            count: 3,
        })
        expect(
            screen.getAllByRole('link', { name: '쪽지 · 안 읽음 3건' }),
        ).not.toHaveLength(0)

        view.unmount()
        expect(useAuthStore.getState().user).toEqual(originalSession.user)
        expect(queryClient.getQueryData(balanceKeys.me())).toMatchObject({
            gameMoneyBalance: 2,
        })
        expect(queryClient.getQueryData(memoKeys.unread())).toEqual({
            count: 77,
        })
    })

    it.each([
        ['loading', '[aria-busy="true"]'],
        ['empty', '표시할 항목이 없습니다.'],
        ['error', '다시 시도'],
        ['success', '지갑 자세히'],
    ] as const)('공용 컴포넌트의 %s 상태를 재현한다', async (state, target) => {
        const view = renderWorkbench(
            `/__design/main-color-palettes?variant=fc-palette-cobalt&state=${state}`,
        )
        await screen.findByRole('heading', {
            name: '밝고 선명한 메인 컬러 10안',
        })

        if (target.startsWith('[')) {
            expect(view.container.querySelector(target)).toBeInTheDocument()
        } else {
            expect(screen.getByText(target)).toBeVisible()
        }
        expect(
            screen.getByRole('link', {
                name:
                    state === 'loading'
                        ? '로딩'
                        : state === 'empty'
                          ? '빈 결과'
                          : state === 'error'
                            ? '오류'
                            : '성공',
            }),
        ).toHaveAttribute('aria-current', 'true')
    })

    it('hover·active·disabled 상태와 키보드 focus 순서를 노출한다', async () => {
        const user = userEvent.setup()
        renderWorkbench(
            '/__design/main-color-palettes?variant=fc-palette-cobalt&state=success',
        )
        await screen.findByRole('heading', {
            name: '밝고 선명한 메인 컬러 10안',
        })

        const loading = screen.getByRole('link', { name: '로딩' })
        const empty = screen.getByRole('link', { name: '빈 결과' })
        const success = screen.getByRole('link', { name: '성공' })
        expect(loading).toHaveClass('hover:border-control-action')
        expect(success).toHaveAttribute('aria-current', 'true')
        expect(screen.getByRole('button', { name: '처리 중' })).toBeDisabled()

        loading.focus()
        expect(loading).toHaveFocus()
        await user.tab()
        expect(empty).toHaveFocus()
    })

    it('실제 AuthLayout과 LoginForm의 키보드·focus·disabled 계약을 유지한다', async () => {
        const user = userEvent.setup()
        renderWorkbench('/__design/auth-layout')

        const heading = await screen.findByRole('heading', { name: '로그인' })
        const authCard = heading.parentElement?.parentElement
        expect(authCard).toHaveClass('w-full', 'max-w-md')

        const loginId = screen.getByRole('textbox', { name: '아이디' })
        const password = screen.getByLabelText('비밀번호')
        const submit = screen.getByRole('button', { name: '로그인' })
        expect(submit).toBeDisabled()

        await user.tab()
        expect(screen.getByRole('link', { name: '장터 홈' })).toHaveFocus()
        await user.tab()
        expect(loginId).toHaveFocus()
        await user.tab()
        expect(password).toHaveFocus()
        await user.type(password, 'fixture-password')
        expect(submit).toBeEnabled()
        await user.tab()
        expect(submit).toHaveFocus()
    })

    it('shows explicit index and unknown-scenario views', () => {
        const index = renderWorkbench('/__design')
        expect(
            screen.getByRole('heading', { name: '디자인 워크벤치' }),
        ).toBeVisible()
        index.unmount()

        renderWorkbench('/__design/not-registered')
        expect(
            screen.getByRole('heading', {
                name: '등록되지 않은 시나리오입니다.',
            }),
        ).toBeVisible()
    })
})
