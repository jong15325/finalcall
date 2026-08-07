import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import type { RootCommentResponse } from '@/lib/api/comments'
import CommentItem from './CommentItem'

const useReplies = vi.fn()

vi.mock('@/lib/queries/comments', () => ({
    useReplies: (...args: unknown[]) => useReplies(...args),
    useDeleteComment: () => ({
        isPending: false,
        isError: false,
        error: null,
        mutate: vi.fn(),
    }),
    useUpdateComment: () => ({
        isPending: false,
        isError: false,
        error: null,
        mutate: vi.fn(),
        reset: vi.fn(),
    }),
    useCreateReply: () => ({
        isPending: false,
        isError: false,
        error: null,
        mutate: vi.fn(),
    }),
    useToggleReaction: () => ({
        isPending: false,
        isError: false,
        error: null,
        mutate: vi.fn(),
    }),
}))

const comment: RootCommentResponse = {
    commentPublicId: 'C-ROOT',
    authorNickname: '루트작성자',
    content: '루트 댓글',
    createdAt: '2026-08-07T01:00:00Z',
    updatedAt: '2026-08-07T02:00:00Z',
    editable: false,
    likeCount: 7,
    dislikeCount: 3,
    myReaction: 'DISLIKE',
    deleted: false,
    replyCount: 1,
}

function renderComment() {
    useReplies.mockReturnValue({
        data: {
            pages: [
                {
                    content: [
                        {
                            commentPublicId: 'C-REPLY',
                            authorNickname: '답글작성자',
                            content: '항상 보이는 답글',
                            createdAt: '2026-08-07T01:30:00Z',
                            updatedAt: '2026-08-07T01:30:00Z',
                            editable: false,
                            likeCount: 2,
                            dislikeCount: 1,
                            myReaction: null,
                            deleted: false,
                            mentionedNickname: null,
                        },
                    ],
                },
            ],
        },
        isPending: false,
        isError: false,
        refetch: vi.fn(),
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
    })

    return renderWithProviders(
        <ul>
            <CommentItem slug="free" postPublicId="P-1" comment={comment} />
        </ul>,
    )
}

describe('<CommentItem> FC-219 댓글 UI 정리', () => {
    it('루트와 답글에서 비공감 UI를 숨기고 공감 카운트만 표시한다', () => {
        renderComment()

        expect(
            screen.queryByRole('button', { name: '비공감' }),
        ).not.toBeInTheDocument()
        const likeButtons = screen.getAllByRole('button', { name: '공감' })
        expect(likeButtons).toHaveLength(2)
        expect(likeButtons[0]).toHaveTextContent('7')
    })

    it('작성 시간을 작성자와 같은 행에 두고 PC의 수정됨 표시를 유지한다', () => {
        renderComment()

        const author = screen.getByText('루트작성자')
        const editedTime = screen.getByText(/수정됨/)
        expect(author.parentElement).toBe(editedTime.parentElement)
        expect(editedTime).not.toHaveClass('hidden')
        expect(screen.getAllByText(/수정됨/)).toHaveLength(1)
    })

    it('답글 토글 없이 replyCount가 있는 스레드를 즉시 표시한다', () => {
        renderComment()

        expect(
            screen.queryByRole('button', { name: /답글 1|접기/ }),
        ).not.toBeInTheDocument()
        expect(screen.getByText('항상 보이는 답글')).toBeInTheDocument()
        expect(useReplies).toHaveBeenCalledWith('P-1', 'C-ROOT', true)
    })
})
