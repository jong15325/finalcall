import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
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
import { WIND_PARTICLE_OPTIONS } from './fixtures/windParticles'
import { WALLET_BALANCE_OPTIONS } from './fixtures/walletBalance'
import { NAVIGATION_LAYOUT_VARIANTS } from './scenarioMetadata'
import { auditAuctionCountdownLayout } from './scenarios/auctionCountdownLayout'
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
    it.each([390, 1280])(
        '%ipx 홈 추천 마켓은 추천 근거와 실제 카드 affordance를 함께 보존한다',
        async (width) => {
            useViewport(width)
            const view = renderWorkbench(
                '/__design/home-market-recommendations?state=ready',
            )

            expect(
                await screen.findByRole('heading', {
                    name: '홈 추천 마켓 디자인 게이트',
                }),
            ).toBeVisible()
            expect(
                screen.getByRole('list', {
                    name: '오늘의 추천 마켓 목록',
                }),
            ).toHaveClass(
                'grid',
                'grid-cols-2',
                'xs:grid-cols-3',
                'min-[1200px]:grid-cols-6',
            )
            expect(
                view.container.querySelectorAll('[data-recommendation-reason]'),
            ).toHaveLength(6)
            expect(
                view.container.querySelectorAll(
                    '[data-card-hit-area="compare"]',
                ),
            ).toHaveLength(6)
            expect(view.container.querySelectorAll('.shop-card')).toHaveLength(
                6,
            )
            expect(screen.getAllByText('24시간 내 판매 종료')).toHaveLength(2)
            expect(screen.getByText('완료 판매 5회 이상')).toBeVisible()
        },
    )

    it.each([
        ['partial', 3],
        ['empty', 0],
    ] as const)('홈 추천 마켓 %s 상태를 전환한다', async (state, count) => {
        const view = renderWorkbench(
            `/__design/home-market-recommendations?state=${state}`,
        )
        await screen.findByRole('heading', {
            name: '홈 추천 마켓 디자인 게이트',
        })

        expect(view.container.querySelectorAll('.shop-card')).toHaveLength(
            count,
        )
    })

    it('홈 추천 마켓 loading 상태는 6개 골격을 노출한다', async () => {
        const view = renderWorkbench(
            '/__design/home-market-recommendations?state=loading',
        )
        await screen.findByRole('heading', {
            name: '홈 추천 마켓 디자인 게이트',
        })

        expect(view.container.querySelector('[aria-busy="true"]')).toBeVisible()
        expect(
            view.container.querySelectorAll('[aria-busy="true"] li'),
        ).toHaveLength(6)
    })

    it('홈 추천 마켓 error 상태는 재시도 affordance를 노출한다', async () => {
        renderWorkbench('/__design/home-market-recommendations?state=error')
        await screen.findByRole('heading', {
            name: '홈 추천 마켓 디자인 게이트',
        })

        expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible()
    })

    it('판매 등록 신규 디자인 3안을 실제 AppShell에서 연다', async () => {
        const view = renderWorkbench(
            '/__design/sell-page-directions?variant=document',
        )

        expect(
            await screen.findByRole('heading', {
                name: '판매 등록 신규 디자인 3안',
            }),
        ).toBeVisible()
        expect(
            view.container.querySelector('[data-sell-direction="document"]'),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', { name: 'B 문서 편집형' }),
        ).toHaveAttribute('aria-current', 'page')
    })

    it('판매 등록 디자인 7안을 실제 AppShell의 판매 경로에서 연다', async () => {
        const view = renderWorkbench(
            '/__design/sell-page-studies?variant=time-first',
        )

        expect(
            await screen.findByRole('heading', {
                name: '판매 등록 페이지 디자인 7안',
            }),
        ).toBeVisible()
        expect(view.getByTestId('app-content-plane')).toHaveAttribute(
            'data-content-plane',
            'default',
        )
        expect(
            view.container.querySelector('[data-sell-study="time-first"]'),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', { name: '시간 중심형' }),
        ).toHaveAttribute('aria-current', 'page')
    })

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

            expect(frame).toHaveClass('sticky', 'z-30')
            expect(frame).toHaveClass('top-2', 'xl:top-3')
            expect(frame).toHaveAttribute('data-dock-state', 'flow')
            expect(
                screen.getByRole('link', { name: /접점 고정형/ }),
            ).toHaveAttribute('aria-current', 'true')
            expect(frame.previousElementSibling).toHaveAttribute(
                'data-workbench-dock-sentinel',
                NAVIGATION_LAYOUT_VARIANTS.contactDock,
            )
            expect(
                view.getByTestId('app-content-plane').parentElement,
            ).toHaveClass('pb-4')
            expect(
                view.getByTestId('app-content-plane').parentElement,
            ).not.toHaveClass('py-4', 'sm:py-5', 'xl:py-7')
            expect(navigation).toHaveClass(
                'w-full',
                'max-w-[1440px]',
                'rounded-xl',
                'shadow-sm',
                'xl:rounded-2xl',
            )
            expect(navigation).not.toHaveClass('overflow-hidden')
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
        const loginForm = heading.closest('.auth-form')
        expect(loginForm).toHaveClass('mx-auto', 'w-full', 'max-w-md')
        expect(document.querySelector('.auth-form-panel')).toContainElement(
            loginForm as HTMLElement,
        )

        const loginId = screen.getByRole('textbox', { name: '아이디' })
        const password = screen.getByLabelText('비밀번호')
        const submit = screen.getByRole('button', { name: '로그인' })
        expect(submit).toBeDisabled()

        const homeLinks = screen.getAllByRole('link', { name: '장터 홈' })
        await user.tab()
        expect(homeLinks[0]).toHaveFocus()
        await user.tab()
        expect(homeLinks[1]).toHaveFocus()
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

    it('DEV route에서 서로 다른 바람 렌더링 10안을 동시에 비교한다', async () => {
        const selected = WIND_PARTICLE_OPTIONS[1]
        const view = renderWorkbench(
            `/__design/wind-particle-studies?variant=${selected.id}`,
        )

        expect(
            await screen.findByRole('heading', {
                name: '바람 파티클 렌더링 10안',
            }),
        ).toBeVisible()
        expect(
            view.container.querySelectorAll('[data-wind-variant]'),
        ).toHaveLength(10)
        expect(
            view.container.querySelectorAll('[data-wind-canvas]'),
        ).toHaveLength(10)
        expect(screen.getByRole('link', { name: '선택됨' })).toHaveAttribute(
            'aria-current',
            'true',
        )
        expect(screen.getAllByText('렌더링 원리')).toHaveLength(10)
        expect(screen.getAllByText('추천 이유')).toHaveLength(10)
        expect(screen.getAllByText('트레이드오프')).toHaveLength(10)
    })

    it.each([
        ['fire', '불 파티클 렌더링 10안'],
        ['water', '물 파티클 렌더링 10안'],
    ] as const)(
        'DEV route에서 %s 렌더링 10안을 실제 AppShell 안에 동시에 표시한다',
        async (element, heading) => {
            const view = renderWorkbench(
                `/__design/${element}-particle-studies`,
            )

            expect(
                await screen.findByRole('heading', { name: heading }),
            ).toBeVisible()
            expect(
                view.container.querySelectorAll(
                    `[data-element-particle="${element}"]`,
                ),
            ).toHaveLength(10)
            expect(
                view.container.querySelectorAll(`[data-${element}-canvas]`),
            ).toHaveLength(10)
            expect(screen.getAllByText('렌더링 원리')).toHaveLength(10)
            expect(screen.getAllByText('추천 이유')).toHaveLength(10)
            expect(
                screen.getByRole('link', { name: '선택됨' }),
            ).toHaveAttribute('aria-current', 'true')
        },
    )

    it('DEV wallet route에서 5개 정보 구조와 상태·긴 정수를 실제 AppShell에 재현한다', async () => {
        const selected = WALLET_BALANCE_OPTIONS[4]
        const view = renderWorkbench(
            `/__design/wallet-balance-studies?variant=${selected.id}&state=ready&sample=long`,
        )

        expect(
            await screen.findByRole('heading', {
                name: '마이페이지 지갑 잔액 5안',
            }),
        ).toBeVisible()
        expect(view.getByTestId('app-content-plane')).toHaveAttribute(
            'data-content-plane',
            'default',
        )
        expect(view.getByTestId('wallet-balance-scenario')).toHaveClass(
            'w-full',
            'min-w-0',
            'max-w-full',
        )

        const optionNav = screen.getByRole('navigation', {
            name: '지갑 디자인 안',
        })
        expect(within(optionNav).getAllByRole('link')).toHaveLength(5)
        expect(
            within(optionNav).getByRole('link', {
                name: new RegExp(selected.shortName),
            }),
        ).toHaveAttribute('aria-current', 'true')
        expect(
            screen.getByRole('link', { name: '긴 안전정수' }),
        ).toHaveAttribute('aria-current', 'true')
        expect(
            screen.getByLabelText('8,607,199,254,740,000 코드'),
        ).toBeVisible()
        expect(
            screen.getAllByRole('button', { name: '충전 준비 중' })[0],
        ).toBeDisabled()
    })

    it.each([390, 1280])(
        '%ipx 경매 카드 게이트는 catalog 열 계약과 상세 hit area를 노출한다',
        async (width) => {
            useViewport(width)
            const view = renderWorkbench('/__design/auction-card')
            await screen.findByRole('heading', {
                name: '경매 목록 세로 카드 디자인 게이트',
            })

            expect(view.getByTestId('app-content-plane')).toBeInTheDocument()
            expect(
                screen.getByRole('region', { name: '경매 카드 후보' }),
            ).toHaveClass(
                'grid',
                'grid-cols-2',
                'gap-3',
                'xs:grid-cols-3',
                'min-[1200px]:grid-cols-6',
            )
            expect(
                view.container.querySelectorAll(
                    '[data-auction-card-candidate]',
                ),
            ).toHaveLength(6)
            expect(
                view.container.querySelectorAll(
                    '[data-card-hit-area="artwork"]',
                ),
            ).toHaveLength(6)
            expect(
                view.container.querySelectorAll('[data-auction-bid-badge]'),
            ).toHaveLength(6)
            expect(
                within(view.getByTestId('auction-card-scenario')).queryByRole(
                    'button',
                ),
            ).not.toBeInTheDocument()
            expect(
                screen.getAllByRole('link', { name: /경매 상세 보기/ }),
            ).toHaveLength(6)
        },
    )

    it.each([390, 1280])(
        '%ipx 경매 시간 표시 게이트는 12개 후보를 실제 artwork에 표시한다',
        async (width) => {
            useViewport(width)
            const view = renderWorkbench('/__design/auction-countdown-tags')
            await screen.findByRole('heading', {
                name: '경매 시간 표시 12안',
            })

            expect(view.getByTestId('app-content-plane')).toBeInTheDocument()
            expect(
                screen.getByRole('region', {
                    name: '경매 시간 표시 후보',
                }),
            ).toHaveClass('auction-time-catalog')
            expect(
                view.container.querySelectorAll('[data-countdown-candidate]'),
            ).toHaveLength(12)
            expect(
                screen.getAllByLabelText('진행중, 경매 마감까지 12분 48초'),
            ).toHaveLength(12)
            expect(
                view.container.querySelectorAll('details[open]'),
            ).toHaveLength(0)
            const layout = auditAuctionCountdownLayout()
            expect(layout.documentFits).toBe(true)
            expect(layout.cardsFit).toBe(true)
            expect(layout.badgesFit).toBe(true)
            expect(layout.timeDisplaysFit).toBe(true)
            expect(layout.cardCount).toBe(12)
            expect(layout.badgeCount).toBe(12)
            expect(layout.timeDisplayCount).toBe(13)
        },
    )
})
