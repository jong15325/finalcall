import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/renderWithProviders'
import CommentSection from './CommentSection'

vi.mock('@/lib/queries/comments', () => ({
    useComments: () => ({
        data: undefined,
        isPending: true,
        isError: false,
        refetch: vi.fn(),
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
    }),
    useCreateComment: () => ({
        isPending: false,
        isError: false,
        error: null,
        mutate: vi.fn(),
    }),
}))

function renderSection() {
    return renderWithProviders(
        <CommentSection
            allowComments
            slug="free"
            postPublicId="P-1"
            commentCount={3}
        />,
    )
}

describe('<CommentSection> 정렬 메뉴 접근성', () => {
    it('열릴 때 선택 항목에 초점을 두고 ARIA와 roving tabindex를 동기화한다', async () => {
        const user = userEvent.setup()
        renderSection()

        const trigger = screen.getByRole('button', { name: '최신순' })
        await user.click(trigger)

        const menu = screen.getByRole('menu', { name: '댓글 정렬' })
        const items = screen.getAllByRole('menuitemradio')
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        expect(trigger).toHaveAttribute('aria-controls', menu.id)
        expect(items[0]).toHaveFocus()
        expect(items[0]).toHaveAttribute('aria-checked', 'true')
        expect(items.map((item) => item.tabIndex)).toEqual([0, -1, -1])
    })

    it('화살표를 순환하고 Home과 End로 처음과 마지막 항목에 이동한다', async () => {
        const user = userEvent.setup()
        renderSection()
        await user.click(screen.getByRole('button', { name: '최신순' }))

        const items = screen.getAllByRole('menuitemradio')
        await user.keyboard('{ArrowUp}')
        expect(items[2]).toHaveFocus()
        expect(items.map((item) => item.tabIndex)).toEqual([-1, -1, 0])

        await user.keyboard('{ArrowDown}')
        expect(items[0]).toHaveFocus()
        await user.keyboard('{End}')
        expect(items[2]).toHaveFocus()
        await user.keyboard('{Home}')
        expect(items[0]).toHaveFocus()
    })

    it('Enter와 Space 선택 및 Escape 닫기 후 트리거로 초점을 돌려준다', async () => {
        const user = userEvent.setup()
        renderSection()

        let trigger = screen.getByRole('button', { name: '최신순' })
        await user.click(trigger)
        await user.keyboard('{ArrowDown}{Enter}')
        trigger = screen.getByRole('button', { name: '과거순' })
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(trigger).toHaveFocus()

        await user.click(trigger)
        await user.keyboard('{End} ')
        trigger = screen.getByRole('button', { name: '순공감순' })
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(trigger).toHaveFocus()

        await user.click(trigger)
        await user.keyboard('{Escape}')
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(trigger).toHaveFocus()
    })

    it('기존 마우스 선택과 바깥 클릭 닫기를 유지한다', async () => {
        const user = userEvent.setup()
        renderSection()

        await user.click(screen.getByRole('button', { name: '최신순' }))
        await user.click(screen.getByRole('menuitemradio', { name: '과거순' }))
        expect(screen.getByRole('button', { name: '과거순' })).toHaveFocus()

        await user.click(screen.getByRole('button', { name: '과거순' }))
        fireEvent.mouseDown(document.body)
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
})
