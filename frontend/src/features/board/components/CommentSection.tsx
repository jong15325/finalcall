import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { TbMessage, TbMessageOff, TbAlertTriangle } from 'react-icons/tb'
import { paths } from '@/app/paths'
import { buildReturnUrlQuery } from '@/lib/returnUrl'
import { useComments, useCreateComment } from '@/lib/queries/comments'
import { useIsAuthenticated, useAuthStore } from '@/store/authStore'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import { avatarInitial } from '@/features/board/lib/postView'
import { commentErrorMessage } from '@/features/board/lib/boardErrors'
import CommentItem from './CommentItem'

/**
 * 댓글 영역 — 목록·작성·수정·삭제 (FC-203, FC-202 뼈대 실기능화).
 *
 * ★ `allowComments=false`(공지)면 미노출·안내(뼈대 로직 유지). 허용이면 개수 헤더 + 작성 폼
 *   (로그인 유저만) + 목록. 수정/삭제는 `CommentItem` 이 `editable`(작성자 or 관리자)로 표시 제어.
 * ★ **가짜 댓글을 렌더하지 않는다**(FC-048) — 빈 상태는 안내 문구. 개수는 상세의 비정규화
 *   `commentCount`(계약 §6.2, 작성/삭제 시 로컬 보정) — 헤더에 그대로 쓴다.
 */
const CONTENT_MAX = 1000

interface CommentSectionProps {
    slug: string
    postPublicId: string
    allowComments: boolean
    commentCount: number
}

export default function CommentSection({
    slug,
    postPublicId,
    allowComments,
    commentCount,
}: CommentSectionProps) {
    if (!allowComments) {
        return (
            <section
                aria-label="댓글"
                className="mt-6 border-t border-line pt-6"
            >
                <div className="flex items-center justify-center gap-2 rounded-lg bg-surface-sunken px-4 py-5 text-sm text-gray-400">
                    <TbMessageOff aria-hidden className="size-4" />이 게시판은
                    댓글을 받지 않습니다.
                </div>
            </section>
        )
    }

    return (
        <section aria-label="댓글" className="mt-6 border-t border-line pt-6">
            <h3 className="flex items-center gap-1.5 text-base font-bold text-gray-900">
                <TbMessage aria-hidden className="size-4 text-navy" />
                댓글
                <span className="text-orange-deep">
                    {commentCount.toLocaleString()}
                </span>
            </h3>

            <CommentComposer slug={slug} postPublicId={postPublicId} />
            <CommentList slug={slug} postPublicId={postPublicId} />
        </section>
    )
}

/* ── 작성 폼 (로그인 유저만) ─────────────────────────────────────────────── */
function CommentComposer({
    slug,
    postPublicId,
}: {
    slug: string
    postPublicId: string
}) {
    const isAuthenticated = useIsAuthenticated()
    const nickname = useAuthStore((state) => state.user?.nickname)
    const location = useLocation()
    const [content, setContent] = useState('')
    const createMutation = useCreateComment(slug, postPublicId)

    if (!isAuthenticated) {
        return (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface px-4 py-5 text-sm text-gray-500">
                댓글을 작성하려면
                <Link
                    to={`${paths.login}${buildReturnUrlQuery(location)}`}
                    className="font-bold text-navy hover:text-orange-deep"
                >
                    로그인
                </Link>
                하세요.
            </div>
        )
    }

    const trimmed = content.trim()
    const canSubmit =
        trimmed.length > 0 &&
        content.length <= CONTENT_MAX &&
        !createMutation.isPending

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (!canSubmit) return
        createMutation.mutate(
            { content: trimmed },
            { onSuccess: () => setContent('') },
        )
    }

    return (
        <form className="mt-4 flex gap-3" onSubmit={handleSubmit}>
            <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-full bg-navy-600 text-sm font-bold text-white"
            >
                {avatarInitial(nickname)}
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface-sunken px-3 py-2.5 focus-within:border-orange focus-within:ring-2 focus-within:ring-orange-subtle">
                <label htmlFor="comment-content" className="sr-only">
                    댓글 내용
                </label>
                <textarea
                    id="comment-content"
                    value={content}
                    maxLength={CONTENT_MAX}
                    rows={2}
                    placeholder="따뜻한 댓글을 남겨보세요."
                    className="w-full resize-none bg-transparent text-sm text-gray-700 outline-none"
                    onChange={(event) => setContent(event.target.value)}
                />
                {createMutation.isError && (
                    <p
                        role="alert"
                        className="mt-1 flex items-center gap-1.5 text-xs text-danger"
                    >
                        <TbAlertTriangle
                            aria-hidden
                            className="size-3.5 shrink-0"
                        />
                        {commentErrorMessage(createMutation.error)}
                    </p>
                )}
                <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-gray-400 tabular-nums">
                        {content.length} / {CONTENT_MAX}
                    </span>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="rounded-lg bg-orange px-4 py-1.5 text-sm font-bold text-white hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {createMutation.isPending ? '등록 중…' : '등록'}
                    </button>
                </div>
            </div>
        </form>
    )
}

/* ── 목록 (offset 무한 누적) ─────────────────────────────────────────────── */
function CommentList({
    slug,
    postPublicId,
}: {
    slug: string
    postPublicId: string
}) {
    const {
        data,
        isPending,
        isError,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useComments(postPublicId)

    const comments = data?.pages.flatMap((page) => page.content) ?? []

    const sentinelRef = useInfiniteScroll({
        hasNext: Boolean(hasNextPage),
        isFetching: isFetchingNextPage,
        onLoadMore: () => void fetchNextPage(),
    })

    if (isPending) {
        return (
            <div aria-hidden className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex gap-3">
                        <div className="size-8 shrink-0 animate-pulse rounded-full bg-gray-100" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
                            <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (isError) {
        return (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-center">
                <p className="text-sm text-gray-500">
                    댓글을 불러오지 못했어요.
                </p>
                <button
                    type="button"
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-navy"
                    onClick={() => void refetch()}
                >
                    다시 시도
                </button>
            </div>
        )
    }

    if (comments.length === 0) {
        return (
            <p className="mt-4 rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-gray-400">
                아직 댓글이 없어요. 첫 댓글을 남겨보세요.
            </p>
        )
    }

    return (
        <>
            <ul className="mt-2 divide-y divide-line">
                {comments.map((comment) => (
                    <CommentItem
                        key={comment.commentPublicId}
                        slug={slug}
                        postPublicId={postPublicId}
                        comment={comment}
                    />
                ))}
            </ul>

            {/* 무한스크롤 감시점 — 목록 끝 문구는 두지 않는다(BidHistory 선례) */}
            <div ref={sentinelRef} aria-hidden className="h-px" />
            {isFetchingNextPage && (
                <p
                    role="status"
                    className="py-2 text-center text-xs text-gray-400"
                >
                    더 불러오는 중…
                </p>
            )}
        </>
    )
}
