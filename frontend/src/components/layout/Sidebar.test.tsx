import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'

vi.mock('@/lib/queries/memos', () => ({
    useUnreadMemoCount: () => ({ data: { count: 2 } }),
}))
vi.mock('@/lib/queries/chat', () => ({
    useUnreadChatCount: () => ({ data: { count: 2 } }),
}))

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
        expect(
            screen.getByRole('link', { name: '채팅 · 안 읽음 2건' }),
        ).toHaveAttribute('href', '/me/chat')
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
