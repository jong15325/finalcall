import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'

describe('Sidebar 모바일 drawer', () => {
    it('열린 상태에서 실제 메뉴를 제공하고 이동 시 닫는다', async () => {
        const close = vi.fn()
        render(
            <MemoryRouter>
                <Sidebar mobileOpen onCloseMobile={close} />
            </MemoryRouter>,
        )

        const aside = screen.getByRole('complementary', { name: '모바일 메뉴' })
        expect(aside).toHaveAttribute('aria-hidden', 'false')
        expect(aside.className).toContain('translate-x-0')
        expect(screen.getByRole('link', { name: '홈' })).toHaveFocus()
        expect(screen.queryByRole('link', { name: /채팅/ })).toBeNull()
        expect(screen.queryByRole('link', { name: '안전거래센터' })).toBeNull()
        await userEvent.click(screen.getByRole('link', { name: '홈' }))
        expect(close).toHaveBeenCalled()
    })

    it('닫힌 상태는 화면 밖에 있고 핀 UI를 노출하지 않는다', () => {
        render(
            <MemoryRouter>
                <Sidebar mobileOpen={false} onCloseMobile={vi.fn()} />
            </MemoryRouter>,
        )
        expect(
            screen.getByRole('complementary', { hidden: true }).className,
        ).toContain('-translate-x-full')
        expect(
            screen.queryByRole('button', { name: /고정/ }),
        ).not.toBeInTheDocument()
    })
})
