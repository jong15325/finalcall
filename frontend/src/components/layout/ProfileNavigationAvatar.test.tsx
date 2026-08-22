import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import MobileBottomNav from './MobileBottomNav'
import TopNavbar from './TopNavbar'

vi.mock('@/auth/useAuth', () => ({
    default: () => ({
        authenticated: true,
        user: {
            userPublicId: 'U-1',
            nickname: '레온',
            primaryCharacterId: 2,
            isAdmin: false,
        },
        signOut: vi.fn(),
    }),
}))
vi.mock('@/lib/queries/balance', () => ({
    useMyBalance: () => ({ data: undefined }),
}))
vi.mock('@/lib/queries/memos', () => ({
    useUnreadMemoCount: () => ({ data: { count: 0 } }),
}))
vi.mock('@/lib/queries/chat', () => ({
    useUnreadChatCount: () => ({ data: { count: 0 } }),
}))

describe('프로필 navigation avatar', () => {
    it('상단 account trigger와 dropdown header에 로그인 캐릭터를 표시한다', () => {
        render(
            <MemoryRouter>
                <TopNavbar onOpenMobile={vi.fn()} />
            </MemoryRouter>,
        )

        const trigger = screen.getByRole('button', {
            name: '사용자 메뉴 열기',
        })
        expect(trigger.querySelector('img')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_02_shamoo.png',
        )
        fireEvent.click(trigger)
        expect(screen.getAllByAltText('레온 프로필')).toHaveLength(2)
    })

    it('모바일 마이페이지 NavLink의 active semantics를 유지하며 캐릭터를 표시한다', () => {
        render(
            <MemoryRouter initialEntries={['/me']}>
                <MobileBottomNav />
            </MemoryRouter>,
        )

        const link = screen.getByRole('link', { name: /마이페이지/ })
        expect(link).toHaveClass('text-control-action')
        expect(link.querySelector('img')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_02_shamoo.png',
        )
    })
})
