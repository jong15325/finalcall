import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PostDetailPage from './PostDetailPage'

const mocks = vi.hoisted(() => ({
    board: vi.fn(),
    detail: vi.fn(),
    deletePost: vi.fn(),
}))

vi.mock('@/lib/queries/boards', () => ({
    useBoard: mocks.board,
    usePostDetail: mocks.detail,
    useDeletePost: mocks.deletePost,
}))

vi.mock('@/features/board/components/CommentSection', () => ({
    default: () => (
        <section aria-label="댓글">
            <p className="break-words">{'긴댓글'.repeat(160)}</p>
            <button type="button">댓글 등록</button>
        </section>
    ),
}))

const longText = '공백없이아주긴게시글내용'.repeat(100)
const post = {
    postPublicId: 'P-1',
    boardSlug: 'community',
    title: longText,
    content: longText,
    authorNickname: '작성자',
    isPinned: true,
    viewCount: 12,
    commentCount: 1,
    images: [],
    createdAt: '2026-08-13T00:00:00Z',
    updatedAt: '2026-08-13T00:00:00Z',
    editable: true,
}

function renderPage() {
    return render(
        <MemoryRouter initialEntries={['/boards/community/P-1']}>
            <Routes>
                <Route
                    path="/boards/:slug/:postId"
                    element={<PostDetailPage />}
                />
            </Routes>
        </MemoryRouter>,
    )
}

describe('PostDetailPage 공통 콘텐츠 폭 계약', () => {
    beforeEach(() => {
        mocks.board.mockReturnValue({
            data: {
                slug: 'community',
                name: '커뮤니티',
                allowComments: true,
            },
            isError: false,
        })
        mocks.deletePost.mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
            isError: false,
            error: null,
        })
    })

    it.each([390, 1280])(
        '%dpx에서 상세 표면은 공통 콘텐츠 폭을 쓰고 긴 콘텐츠만 내부에서 줄바꿈한다',
        (viewportWidth) => {
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                value: viewportWidth,
            })
            mocks.detail.mockReturnValue({
                data: post,
                isPending: false,
                isError: false,
            })

            renderPage()

            const article = screen.getByRole('article')
            const layout = article.parentElement
            const prose = screen
                .getAllByText(longText)
                .find((element) => element.tagName === 'DIV')
            expect(layout).toHaveClass('w-full', 'min-w-0')
            expect(layout).not.toHaveClass('mx-auto', 'max-w-3xl')
            expect(article).toHaveClass('w-full', 'min-w-0')
            expect(screen.getByRole('heading', { level: 1 })).toHaveClass(
                'min-w-0',
                'break-words',
            )
            expect(prose).toHaveClass(
                'min-w-0',
                'max-w-[75ch]',
                'break-words',
            )
            expect(article).toContainElement(screen.getByLabelText('댓글'))
            expect(article).toContainElement(
                screen.getByRole('button', { name: '댓글 등록' }),
            )
        },
    )

    it('loading과 error 상태도 별도 최대 폭 없이 공통 콘텐츠 영역을 채운다', () => {
        mocks.detail.mockReturnValueOnce({
            isPending: true,
            isError: false,
        })
        const loadingView = renderPage()
        expect(loadingView.container.firstElementChild).toHaveClass(
            'w-full',
            'min-w-0',
        )
        expect(loadingView.container.firstElementChild).not.toHaveClass(
            'max-w-3xl',
        )
        loadingView.unmount()

        mocks.detail.mockReturnValue({
            isPending: false,
            isError: true,
            error: new Error('일시 오류'),
        })
        renderPage()
        const errorState = screen.getByRole('heading', {
            level: 2,
        }).closest('section')
        expect(errorState).toHaveClass('bg-content-surface')
        expect(errorState).not.toHaveClass('max-w-3xl')
    })
})
