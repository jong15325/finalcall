import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/auth'
import { COLOR_PALETTES } from './fixtures/colorSystem'
import WorkbenchRoutes from './WorkbenchRoutes'

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

function renderWorkbench(route: string) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <MemoryRouter initialEntries={[route]}>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <WorkbenchRoutes />
                </AuthProvider>
            </QueryClientProvider>
        </MemoryRouter>,
    )
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
        const view = renderWorkbench(
            '/__design/main-color-palettes?variant=fc-palette-teal',
        )

        expect(
            await screen.findByRole('heading', {
                name: '내비게이션 · 푸터 · 버튼 메인 컬러 10안',
            }),
        ).toBeVisible()
        expect(view.getByTestId('app-content-plane')).toHaveAttribute(
            'data-content-plane',
            'auction-detail',
        )
        await waitFor(() => {
            expect(view.container.firstElementChild).toHaveStyle({
                '--chrome-bg': COLOR_PALETTES[2].overrides['--chrome-bg'],
                '--control-action':
                    COLOR_PALETTES[2].overrides['--control-action'],
            })
        })
        expect(view.getByRole('link', { name: /클린 틸/ })).toHaveAttribute(
            'aria-current',
            'true',
        )
    })

    it.each([390, 1280])(
        '%ipx에서 팔레트 scroller 밖의 page-level intrinsic overflow를 만들지 않는다',
        async (width) => {
            useViewport(width)
            const view = renderWorkbench(
                '/__design/main-color-palettes?variant=fc-palette-cobalt',
            )
            await screen.findByRole('heading', {
                name: '내비게이션 · 푸터 · 버튼 메인 컬러 10안',
            })

            const scenario = view.getByTestId('color-system-scenario')
            expect(scenario).toHaveClass('min-w-0', 'max-w-full')
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
                    'break-words',
                )
            }
        },
    )

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
            name: '내비게이션 · 푸터 · 버튼 메인 컬러 10안',
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
            name: '내비게이션 · 푸터 · 버튼 메인 컬러 10안',
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
