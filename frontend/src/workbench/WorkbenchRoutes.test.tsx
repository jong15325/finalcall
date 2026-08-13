import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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
