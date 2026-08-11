import { act, fireEvent, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementDetailBackground from '@/features/item/components/ElementDetailBackground'
import BidDialog from '@/features/auction/components/BidDialog'
import PurchaseDialog from '@/features/auction/components/PurchaseDialog'
import { useCompareStore } from '@/store/compareStore'
import AppShell from './AppShell'
import { useAppFooterVariant } from './AppFooterContext'

function CompactPage() {
    useAppFooterVariant('compact')
    return (
        <main>
            짧은 상태 <Link to="/market">정상 route로</Link>
        </main>
    )
}

vi.mock('@/lib/queries/balance', () => ({
    useMyBalance: () => ({ data: undefined }),
}))
vi.mock('@/lib/queries/memos', () => ({
    useUnreadMemoCount: () => ({ data: { count: 0 } }),
}))

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    useCompareStore.setState({ items: [] })
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
                    <Route path="/short" element={<CompactPage />} />
                    <Route
                        path="/long"
                        element={<main className="h-[1200px]">긴 콘텐츠</main>}
                    />
                    <Route
                        path="/layer-test"
                        element={
                            <>
                                <BidDialog
                                    open
                                    auctionName="test"
                                    currentHighestAmount={100}
                                    minNextBidAmount={110}
                                    buyNowPrice={200}
                                    gameMoneyAvailable={300}
                                    isSubmitting={false}
                                    submitError={null}
                                    onClose={vi.fn()}
                                    onSubmit={vi.fn()}
                                />
                                <PurchaseDialog
                                    open
                                    auctionName="test"
                                    buyNowPrice={200}
                                    gameMoneyAvailable={300}
                                    isSubmitting={false}
                                    submitError={null}
                                    onClose={vi.fn()}
                                    onConfirm={vi.fn()}
                                />
                            </>
                        }
                    />
                </Route>
            </Routes>
        </MemoryRouter>,
    )
}

describe('AppShell route-scoped 상세 배경', () => {
    it('production 입력 CSS에서 100vh fallback 뒤에 100dvh를 선언한다', () => {
        const appCss = readFileSync(`${process.cwd()}/src/index.css`, 'utf8')
        expect(appCss.indexOf('min-height: 100vh')).toBeLessThan(
            appCss.indexOf('@supports (min-height: 100dvh)'),
        )
        expect(appCss).toContain('min-height: 100dvh')
    })

    it('상세 route에서 fixed 배경을 chrome 아래에 둔다', () => {
        const view = renderShell('/auctions/A-1')
        const shell = view.container.firstElementChild
        const scene = view.container.querySelector('.world-map-background')

        expect(shell).toHaveClass('isolate')
        expect(shell).toHaveClass('app-shell-height')
        expect(shell).toHaveAttribute('data-detail-theme', 'fire')
        expect(shell).toHaveStyle({
            '--detail-accent': '#ff5500',
            '--detail-cta-bg': '#f59e0b',
        })
        expect(scene).toHaveClass(
            'world-map-background',
            'absolute',
            'inset-0',
            '-z-10',
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
            'bg-navy-900',
            'text-gray-300',
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
            'py-4',
            'sm:px-5',
            'sm:py-5',
            'xl:px-8',
            'xl:py-7',
        )
        expect(
            view.container.querySelector('#view')?.parentElement,
        ).toHaveClass('pb-[calc(4rem+env(safe-area-inset-bottom))]', 'xl:pb-0')

        const contentPlane = view.getByTestId('app-content-plane')
        expect(contentPlane).toHaveClass('w-full', 'min-w-0', 'px-3')
        expect(contentPlane).not.toHaveClass(
            'border',
            'rounded-xl',
            'shadow-sm',
        )
        expect(scene?.nextElementSibling).not.toHaveClass('relative', 'z-10')

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

    it('마켓 route의 AppShell에 모바일 안전 여백과 유효한 하단 안내를 제공한다', () => {
        const view = renderShell('/market')
        const footer = view.container.querySelector('footer')
        const footerInner = footer?.firstElementChild

        expect(footer).toBeVisible()
        expect(footerInner).toHaveClass('max-w-[1440px]', 'py-10', 'sm:py-12')
        expect(
            view.getByRole('navigation', { name: '하단 서비스 메뉴' }),
        ).toBeVisible()
        expect(view.getByRole('link', { name: '경매' })).toHaveAttribute(
            'href',
            '/auctions',
        )
        expect(view.getByRole('link', { name: '공지사항' })).toHaveAttribute(
            'href',
            '/boards/notice',
        )
        expect(view.getByText('이용약관 준비 중')).not.toHaveAttribute('href')
        expect(view.getByText('공식 문의 채널 준비 중')).toBeVisible()
        expect(
            view.getByText('© 2026 장터. All rights reserved.'),
        ).toBeVisible()
        expect(view.queryByText(/© 2026 FinalCall/)).toBeNull()
    })

    it('짧은 상태는 링크를 유지한 compact footer를 쓰고 긴 route는 기본 footer를 쓴다', () => {
        const shortView = renderShell('/short')
        const shortFooter = shortView.container.querySelector('footer')

        expect(shortFooter).toHaveAttribute('data-variant', 'compact')
        expect(shortFooter?.firstElementChild).toHaveClass('py-5', 'sm:py-6')
        expect(
            shortView.getByRole('navigation', { name: '하단 서비스 메뉴' }),
        ).toBeVisible()
        expect(
            shortView.getByRole('navigation', { name: '정책 안내' }),
        ).toBeVisible()
        expect(shortView.getByTestId('app-content-plane')).not.toHaveClass(
            'min-h-full',
        )
        fireEvent.click(shortView.getByRole('link', { name: '정상 route로' }))
        expect(shortView.container.querySelector('footer')).toHaveAttribute(
            'data-variant',
            'default',
        )
        shortView.unmount()

        const longView = renderShell('/long')
        expect(longView.container.querySelector('footer')).toHaveAttribute(
            'data-variant',
            'default',
        )
        expect(longView.container.querySelector('#view')).not.toHaveClass(
            'overflow-auto',
            'overflow-y-auto',
        )
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

    it('fixed dialogs remain above the mobile nav and compare bar', () => {
        useCompareStore.setState({
            items: [{ source: 'AUCTION', listingId: 'A-1' }],
        })
        const view = renderShell('/layer-test')
        const dialogs = view.getAllByRole('dialog')
        const contentWrapper =
            view.container.querySelector('#view')?.parentElement

        expect(dialogs).toHaveLength(2)
        dialogs.forEach((dialog) => {
            expect(dialog.parentElement).toHaveClass('fixed', 'z-50')
        })
        expect(contentWrapper).not.toHaveClass('relative', 'z-10')
        expect(view.container.querySelector('nav.fixed')).toHaveClass('z-30')
        expect(view.container.querySelector('aside.fixed')).toHaveClass('z-40')
    })
})
