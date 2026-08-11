import { act, fireEvent, render } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import ElementDetailBackground from '@/features/item/components/ElementDetailBackground'
import AppShell from './AppShell'

vi.mock('@/lib/queries/balance', () => ({
    useMyBalance: () => ({ data: undefined }),
}))
vi.mock('@/lib/queries/memos', () => ({
    useUnreadMemoCount: () => ({ data: { count: 0 } }),
}))

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
                    <Route path="/auctions" element={<main>경매 목록</main>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    )
}

describe('AppShell route-scoped 상세 배경', () => {
    it('상세 route에서 fixed 배경을 chrome 아래에 둔다', () => {
        const view = renderShell('/auctions/A-1')
        const shell = view.container.firstElementChild
        const scene = view.container.querySelector('.element-detail__scene')

        expect(shell).toHaveClass('isolate')
        expect(shell).toHaveClass('min-h-screen')
        expect(shell).toHaveAttribute('data-detail-theme', 'fire')
        expect(shell).toHaveStyle({
            '--detail-accent': '#ff5500',
            '--detail-cta-bg': '#f59e0b',
        })
        expect(scene).toHaveClass(
            'element-detail__scene',
            'fixed',
            'inset-0',
            'z-0',
        )
        expect(scene).not.toHaveClass('w-screen')
        expect(view.container.querySelector('aside')).toBeNull()
        expect(
            view.queryByRole('navigation', { name: '주요 메뉴' }),
        ).toBeNull()
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
        )
        expect(view.getByTestId('app-content-plane')).not.toHaveClass(
            'overflow-hidden',
            'transform',
            'filter',
            'z-0',
        )
        expect(view.getByTestId('app-content-plane')).toHaveClass(
            'xl:border',
            'xl:border-line',
            'xl:rounded-xl',
            'xl:shadow-sm',
        )

        const focusFrame = vi
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation((callback) => {
                callback(0)
                return 1
            })
        const hamburger = view.getByRole('button', { name: '메뉴 열기' })
        fireEvent.click(hamburger)
        expect(
            view.container.querySelector('aside nav a[href]'),
        ).toHaveFocus()
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(view.container.querySelector('aside')).toBeNull()
        expect(hamburger).toHaveFocus()
        focusFrame.mockRestore()

        fireEvent.click(view.getByRole('link', { name: '목록으로' }))
        expect(
            view.container.querySelector('.element-detail__scene'),
        ).toBeNull()
        expect(view.container.firstElementChild).not.toHaveAttribute(
            'data-detail-theme',
        )
        expect(view.getByText('경매 목록')).toBeVisible()
    })

    it('목록 route 직접 진입에는 배경 DOM이 없다', () => {
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
            view.container.querySelector('.element-detail__scene'),
        ).toBeNull()
        expect(imageConstructor).not.toHaveBeenCalled()
        expect(requestFrame).not.toHaveBeenCalled()
        expect(addMediaListener).toHaveBeenCalledTimes(1)
        vi.unstubAllGlobals()
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
        expect(view.getByRole('navigation', { name: '주요 메뉴' })).toBeVisible()
        vi.unstubAllGlobals()
    })
})
