import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, signInForTest } from '@/test/renderWithProviders'
import type { RootCommentResponse } from '@/lib/api/comments'
import CommentItem from './CommentItem'

const useReplies = vi.fn()
const toggleReaction = vi.fn()
const createReply = vi.fn()

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
        mutate: createReply,
    }),
    useToggleReaction: () => ({
        isPending: false,
        isError: false,
        error: null,
        mutate: toggleReaction,
    }),
}))

const comment: RootCommentResponse = {
    commentPublicId: 'C-ROOT',
    authorNickname: '루트작성자',
    authorPrimaryCharacterId: 2,
    content: '루트 댓글',
    createdAt: '2026-08-07T01:00:00Z',
    updatedAt: '2026-08-07T02:00:00Z',
    editable: false,
    ownedByMe: false,
    likeCount: 7,
    dislikeCount: 3,
    myReaction: 'DISLIKE',
    deleted: false,
    replyCount: 1,
}

function renderComment(
    replyQuery: Partial<ReturnType<typeof useReplies>> = {},
    commentOverride: Partial<RootCommentResponse> = {},
) {
    const query = {
        data: {
            pages: [
                {
                    content: [
                        {
                            commentPublicId: 'C-REPLY',
                            authorNickname: '답글작성자',
                            authorPrimaryCharacterId: 25,
                            content: '항상 보이는 답글',
                            createdAt: '2026-08-07T01:30:00Z',
                            updatedAt: '2026-08-07T01:30:00Z',
                            editable: false,
                            ownedByMe: false,
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
        ...replyQuery,
    }
    useReplies.mockReturnValue(query)

    return renderWithProviders(
        <ul>
            <CommentItem
                slug="free"
                postPublicId="P-1"
                comment={{ ...comment, ...commentOverride }}
            />
        </ul>,
    )
}

describe('<CommentItem> FC-219·FC-223 댓글 UI', () => {
    it('삭제 tombstone은 캐릭터 avatar 대신 기존 placeholder를 유지한다', () => {
        renderComment({}, { deleted: true, content: null })

        expect(
            screen.queryByAltText('루트작성자 프로필'),
        ).not.toBeInTheDocument()
        expect(screen.getByText('삭제된 댓글입니다.')).toBeInTheDocument()
    })

    it('정상 루트와 답글 작성자는 계약 캐릭터 avatar를 표시한다', async () => {
        renderComment()

        expect(screen.getByAltText('루트작성자 프로필')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_02_shamoo.png',
        )
        expect(await screen.findByAltText('답글작성자 프로필')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_13_avatar.png',
        )
    })

    it('공백 없는 긴 댓글도 콘텐츠 영역 안에서 줄바꿈한다', () => {
        const longComment = '긴댓글'.repeat(160)
        renderComment({}, { content: longComment })

        expect(screen.getByText(longComment)).toHaveClass(
            'break-words',
            'whitespace-pre-wrap',
        )
    })

    it('루트와 답글에서 비공감 UI를 숨기고 공감 카운트만 표시한다', () => {
        renderComment()

        expect(
            screen.queryByRole('button', { name: '비공감' }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole('button', {
                name: '루트작성자의 댓글 공감, 현재 7개',
            }),
        ).toHaveTextContent('7')
        expect(
            screen.getByRole('button', {
                name: '답글작성자의 댓글 공감, 현재 2개',
            }),
        ).toBeInTheDocument()
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

    it('공감 클릭 시 LIKE payload를 전달한다', async () => {
        const user = userEvent.setup()
        signInForTest({ nickname: '다른사용자' })
        renderComment()

        await user.click(
            screen.getByRole('button', {
                name: '루트작성자의 댓글 공감, 현재 7개',
            }),
        )

        expect(toggleReaction).toHaveBeenCalledWith({
            commentPublicId: 'C-ROOT',
            type: 'LIKE',
        })
    })

    it('내가 공감한 댓글은 골드 활성색과 pressed 상태로 구분한다', () => {
        signInForTest({ nickname: '다른사용자' })
        renderComment({}, { myReaction: 'LIKE' })

        const likeButton = screen.getByRole('button', {
            name: '루트작성자의 댓글 공감, 현재 7개',
        })
        expect(likeButton).toHaveAttribute('aria-pressed', 'true')
        expect(likeButton).toHaveClass(
            'border-brand-highlight',
            'bg-brand-highlight-soft',
            'text-brand-highlight-deep',
        )
    })

    it('닉네임이 달라도 ownedByMe가 true면 본인 댓글 공감을 막는다', async () => {
        const user = userEvent.setup()
        signInForTest({ nickname: '변경된닉네임' })
        renderComment({}, { ownedByMe: true })

        const likeButton = screen.getByRole('button', {
            name: /루트작성자의 댓글 공감, 현재 7개.*본인 댓글에는 공감할 수 없어요/,
        })
        await user.click(likeButton)

        expect(likeButton).toBeDisabled()
        expect(toggleReaction).not.toHaveBeenCalled()
    })

    it('닉네임이 같아도 ownedByMe가 false면 타인 댓글에 공감할 수 있다', async () => {
        const user = userEvent.setup()
        signInForTest({ nickname: '루트작성자' })
        renderComment()

        await user.click(
            screen.getByRole('button', {
                name: '루트작성자의 댓글 공감, 현재 7개',
            }),
        )

        expect(toggleReaction).toHaveBeenCalledWith({
            commentPublicId: 'C-ROOT',
            type: 'LIKE',
        })
    })

    it('관리자는 타인 댓글을 편집할 수 있어도 ownedByMe가 false면 공감할 수 있다', async () => {
        const user = userEvent.setup()
        signInForTest({ nickname: '관리자', isAdmin: true })
        renderComment({}, { editable: true, ownedByMe: false })

        await user.click(
            screen.getByRole('button', {
                name: '루트작성자의 댓글 공감, 현재 7개',
            }),
        )

        expect(toggleReaction).toHaveBeenCalledWith({
            commentPublicId: 'C-ROOT',
            type: 'LIKE',
        })
    })

    it('게스트는 ownedByMe가 false여도 공감 요청 대신 로그인으로 유도한다', async () => {
        const user = userEvent.setup()
        renderComment()

        await user.click(
            screen.getByRole('button', {
                name: '루트작성자의 댓글 공감, 현재 7개',
            }),
        )

        expect(toggleReaction).not.toHaveBeenCalled()
    })

    it('답글 오류 재시도와 다음 페이지 로드를 실행한다', async () => {
        const user = userEvent.setup()
        const refetch = vi.fn()
        const fetchNextPage = vi.fn()
        renderComment({
            data: undefined,
            isError: true,
            refetch,
            hasNextPage: true,
            fetchNextPage,
        })

        await user.click(screen.getByRole('button', { name: '다시 시도' }))
        await user.click(screen.getByRole('button', { name: '답글 더 보기' }))

        expect(refetch).toHaveBeenCalledOnce()
        expect(fetchNextPage).toHaveBeenCalledOnce()
    })

    it('답글 작성 시 대상과 내용을 전달한다', async () => {
        const user = userEvent.setup()
        signInForTest({ nickname: '다른사용자' })
        renderComment()

        await user.click(screen.getAllByRole('button', { name: '답글' })[0])
        await user.type(
            screen.getByRole('textbox', { name: '답글 내용' }),
            '  새 답글  ',
        )
        await user.click(screen.getByRole('button', { name: '답글 등록' }))

        expect(createReply).toHaveBeenCalledWith(
            { targetCommentPublicId: 'C-ROOT', content: '새 답글' },
            expect.objectContaining({ onSuccess: expect.any(Function) }),
        )
    })

    it('답글 작성자에게 답글을 열면 멘션과 대상 payload를 유지한다', async () => {
        const user = userEvent.setup()
        signInForTest({ nickname: '다른사용자' })
        renderComment()

        await user.click(screen.getAllByRole('button', { name: '답글' })[1])
        expect(screen.getByText('@답글작성자')).toBeInTheDocument()
        await user.type(
            screen.getByRole('textbox', { name: '답글 내용' }),
            '멘션 답글',
        )
        await user.click(screen.getByRole('button', { name: '답글 등록' }))

        expect(createReply).toHaveBeenCalledWith(
            { targetCommentPublicId: 'C-REPLY', content: '멘션 답글' },
            expect.objectContaining({ onSuccess: expect.any(Function) }),
        )
    })
})
