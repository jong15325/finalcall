import { act, fireEvent, render } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementDetailBackground from '@/features/item/components/ElementDetailBackground'
import AppShell from './AppShell'

vi.mock('@/lib/queries/balance', () => ({
    useMyBalance: () => ({ data: undefined }),
}))
vi.mock('@/lib/queries/memos', () => ({
    useUnreadMemoCount: () => ({ data: { count: 0 } }),
}))

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

function renderShell(route: string) {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route element={<AppShell />}>
                    <Route
                        path="/auctions/:id"
                        element={
                            <ElementDetailBackground element={2}>
                                <main>상세 콘텐츠</main>
                                <Link to="/auctions">목록으로</Link>
                            </ElementDetailBackground>
                        }
                    />
                    <Route
                        path="/items/:id"
                        element={
                            <ElementDetailBackground element={1}>
                                <main>아이템 상세 콘텐츠</main>
                            </ElementDetailBackground>
                        }
                    />
                    <Route
                        path="/auctions"
                        element={
                            <main>
                                경매 목록
                                <Link to="/auctions/A-1">상세로</Link>
                                <Link to="/market">마켓으로</Link>
                            </main>
                        }
                    />
                    <Route path="/market" element={<main>아이템 목록</main>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    )
}

describe('AppShell route-scoped 상세 배경', () => {
    it('상세 route에서 fixed 배경을 chrome 아래에 둔다', () => {
        const view = renderShell('/auctions/A-1')
        const shell = view.container.firstElementChild
        const scene = view.container.querySelector('.world-map-background')

        expect(shell).toHaveClass('isolate')
        expect(shell).toHaveClass('min-h-screen')
        expect(shell).toHaveAttribute('data-detail-theme', 'fire')
        expect(shell).toHaveStyle({
            '--detail-accent': '#ff5500',
            '--detail-cta-bg': '#f59e0b',
        })
        expect(scene).toHaveClass(
            'world-map-background',
            'absolute',
            'inset-0',
            'z-0',
            'sm:fixed',
        )
        expect(scene).not.toHaveClass('w-screen')
        expect(view.container.querySelector('aside')).toBeNull()
        expect(view.queryByRole('navigation', { name: '주요 메뉴' })).toBeNull()
        expect(view.container.querySelector('header')).toHaveClass(
            'sticky',
            'z-30',
            'bg-surface/95',
        )
        expect(
            view.getByRole('navigation', { name: '모바일 주요 메뉴' }),
        ).toHaveClass('fixed', 'z-30')
        expect(
            view.queryByRole('complementary', { name: '아이템 비교 선택' }),
        ).toBeNull()
        expect(view.container.querySelector('footer')).toHaveClass(
            'z-10',
            'bg-surface',
            'text-gray-600',
        )
        expect(view.container.querySelector('#view')).not.toHaveClass(
            'overflow-auto',
            'overflow-hidden',
        )
        expect(view.getByTestId('app-content-plane')).toHaveClass(
            'max-w-[1440px]',
            'bg-surface',
            'sm:border',
            'sm:border-line',
            'sm:rounded-xl',
            'sm:shadow-sm',
            'xl:rounded-2xl',
        )
        expect(view.getByTestId('app-content-plane')).not.toHaveClass(
            'overflow-hidden',
            'transform',
            'filter',
            'z-0',
        )
        expect(view.container.querySelector('#view')).toHaveClass(
            'px-3',
            'py-2',
            'pb-20',
            'sm:px-5',
            'sm:py-5',
            'sm:pb-20',
            'xl:px-8',
            'xl:py-7',
            'xl:pb-7',
        )
        const classes = view.container.querySelector('#view')?.className ?? ''
        const resolvedBottomPadding = (width: number) => {
            if (width >= 1280 && classes.includes('xl:pb-7')) return 28
            if (width >= 640 && classes.includes('sm:pb-20')) return 80
            return classes.includes('pb-20') ? 80 : 0
        }
        expect([320, 390, 1280, 1440].map(resolvedBottomPadding)).toEqual([
            80, 80, 28, 28,
        ])

        const contentPlane = view.getByTestId('app-content-plane')
        expect(contentPlane).toHaveClass('w-full', 'min-w-0', 'px-3')
        expect(contentPlane).not.toHaveClass(
            'border',
            'rounded-xl',
            'shadow-sm',
        )
        expect(scene?.nextElementSibling).toHaveClass('relative', 'z-10')

        const mobileContentWidth = (viewportWidth: number) =>
            viewportWidth - 24 - 24
        expect([320, 390].map(mobileContentWidth)).toEqual([272, 342])
        expect([320, 390].every((width) => mobileContentWidth(width) > 0)).toBe(
            true,
        )

        const focusFrame = vi
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation((callback) => {
                callback(0)
                return 1
            })
        const hamburger = view.getByRole('button', { name: '메뉴 열기' })
        fireEvent.click(hamburger)
        expect(view.container.querySelector('aside nav a[href]')).toHaveFocus()
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(view.container.querySelector('aside')).toBeNull()
        expect(hamburger).toHaveFocus()
        focusFrame.mockRestore()

        fireEvent.click(view.getByRole('link', { name: '목록으로' }))
        expect(
            view.container.querySelectorAll('.world-map-background'),
        ).toHaveLength(1)
        expect(view.container.firstElementChild).toHaveAttribute(
            'data-detail-theme',
            'water',
        )
        expect(view.getByText('경매 목록')).toBeVisible()
    })

    it('경매 목록 exact route는 ambient-only water scene 하나만 사용한다', () => {
        const imageConstructor = vi.fn()
        const requestFrame = vi.fn()
        const addMediaListener = vi.fn()
        vi.stubGlobal('Image', imageConstructor)
        vi.stubGlobal('requestAnimationFrame', requestFrame)
        vi.stubGlobal('matchMedia', () => ({
            matches: false,
            media: '',
            onchange: null,
            addEventListener: addMediaListener,
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        const view = renderShell('/auctions')
        expect(
            view.container.querySelectorAll('.world-map-background'),
        ).toHaveLength(1)
        expect(
            view.container.querySelector('.world-map-background'),
        ).toHaveAttribute('data-accent', 'water')
        expect(view.container.firstElementChild).toHaveAttribute(
            'data-detail-theme',
            'water',
        )
        expect(imageConstructor).not.toHaveBeenCalled()
        expect(requestFrame).not.toHaveBeenCalled()
        expect(addMediaListener).toHaveBeenCalledTimes(1)
        vi.unstubAllGlobals()
    })

    it('다른 AppShell route도 공통 scene 하나를 유지한다', () => {
        const imageConstructor = vi.fn()
        const requestFrame = vi.fn()
        vi.stubGlobal('Image', imageConstructor)
        vi.stubGlobal('requestAnimationFrame', requestFrame)
        const view = renderShell('/market')
        expect(
            view.container.querySelectorAll('.world-map-background'),
        ).toHaveLength(1)
        expect(imageConstructor).not.toHaveBeenCalled()
        expect(requestFrame).not.toHaveBeenCalled()
        vi.unstubAllGlobals()
    })

    it('목록→상세는 water를 응답 element로 교체하고 목록→다른 route는 정리한다', () => {
        const detailView = renderShell('/auctions')
        expect(detailView.container.firstElementChild).toHaveAttribute(
            'data-detail-theme',
            'water',
        )
        fireEvent.click(detailView.getByRole('link', { name: '상세로' }))
        expect(
            detailView.container.querySelectorAll('.world-map-background'),
        ).toHaveLength(1)
        expect(detailView.container.firstElementChild).toHaveAttribute(
            'data-detail-theme',
            'fire',
        )
        detailView.unmount()

        const leaveView = renderShell('/auctions')
        fireEvent.click(leaveView.getByRole('link', { name: '마켓으로' }))
        expect(
            leaveView.container.querySelectorAll('.world-map-background'),
        ).toHaveLength(1)
        expect(leaveView.container.firstElementChild).not.toHaveAttribute(
            'data-detail-theme',
        )
    })

    it('아이템 상세도 응답 속성으로 theme을 등록한다', () => {
        const view = renderShell('/items/I-1')

        expect(view.container.firstElementChild).toHaveAttribute(
            'data-detail-theme',
            'water',
        )
        expect(view.container.firstElementChild).toHaveStyle({
            '--detail-accent': '#19b2ff',
        })
    })

    it('xl PC는 Sidebar DOM 없이 수평 메뉴와 content plane을 렌더한다', () => {
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query === '(min-width: 1280px)',
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        const view = renderShell('/auctions')
        expect(view.container.querySelector('aside')).toBeNull()
        expect(view.getByRole('navigation', { name: '주요 메뉴' })).toHaveClass(
            'h-12',
            'sticky',
        )
        expect(view.getByTestId('app-content-plane')).toHaveClass(
            'max-w-[1440px]',
            'bg-surface',
        )
        vi.unstubAllGlobals()
    })

    it('runtime breakpoint가 desktop으로 바뀌면 열린 drawer를 제거한다', () => {
        let desktop = false
        let change: (() => void) | undefined
        vi.stubGlobal('matchMedia', (query: string) => ({
            get matches() {
                return query === '(min-width: 1280px)' && desktop
            },
            media: query,
            onchange: null,
            addEventListener: (_type: string, listener: () => void) => {
                if (query === '(min-width: 1280px)') change = listener
            },
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        const view = renderShell('/auctions')
        fireEvent.click(view.getByRole('button', { name: '메뉴 열기' }))
        expect(view.container.querySelector('aside')).not.toBeNull()
        act(() => {
            desktop = true
            change?.()
        })
        expect(view.container.querySelector('aside')).toBeNull()
        expect(
            view.getByRole('navigation', { name: '주요 메뉴' }),
        ).toBeVisible()
        vi.unstubAllGlobals()
    })
})
