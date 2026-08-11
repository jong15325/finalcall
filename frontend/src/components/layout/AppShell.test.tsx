import { fireEvent, render } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import ElementDetailBackground from '@/features/item/components/ElementDetailBackground'
import AppShell from './AppShell'

vi.mock('./Sidebar', () => ({
    default: () => <aside data-testid="shell-sidebar" className="z-20" />,
}))
vi.mock('./TopNavbar', () => ({
    default: () => <header data-testid="shell-navbar" className="z-30" />,
}))
vi.mock('./MobileBottomNav', () => ({
    default: () => <nav data-testid="shell-mobile-nav" className="z-30" />,
}))
vi.mock('@/features/item/components/CompareBar', () => ({
    default: () => <div data-testid="shell-compare" className="z-40" />,
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
        expect(scene).toHaveClass(
            'element-detail__scene',
            'fixed',
            'inset-0',
            'z-0',
        )
        expect(view.getByTestId('shell-sidebar')).toHaveClass('z-20')
        expect(view.getByTestId('shell-navbar')).toHaveClass('z-30')
        expect(view.getByTestId('shell-compare')).toHaveClass('z-40')
        expect(view.container.querySelector('footer')).toHaveClass('z-10')

        fireEvent.click(view.getByRole('link', { name: '목록으로' }))
        expect(
            view.container.querySelector('.element-detail__scene'),
        ).toBeNull()
        expect(view.getByText('경매 목록')).toBeVisible()
    })

    it('목록 route 직접 진입에는 배경 DOM이 없다', () => {
        const view = renderShell('/auctions')
        expect(
            view.container.querySelector('.element-detail__scene'),
        ).toBeNull()
    })
})
