import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
    TbPencil,
    TbTrash,
    TbAlertTriangle,
    TbThumbUp,
    TbThumbDown,
    TbChevronDown,
    TbArrowBackUp,
    TbMessageOff,
    TbStarFilled,
} from 'react-icons/tb'
import { paths } from '@/app/paths'
import { buildReturnUrlQuery } from '@/lib/returnUrl'
import {
    useDeleteComment,
    useReplies,
    useUpdateComment,
    useCreateReply,
    useToggleReaction,
} from '@/lib/queries/comments'
import { useIsAuthenticated, useAuthStore } from '@/store/authStore'
import { avatarInitial, formatPostTime } from '@/features/board/lib/postView'
import { commentErrorMessage } from '@/features/board/lib/boardErrors'
import type {
    CommentResponse,
    ReactionType,
    RootCommentResponse,
} from '@/lib/api/comments'

/**
 * 댓글 1건 — 네이버식 대댓글 (계약 v1.24 §6.3, §13) — FC-210·FC-211.
 *
 * ★ 이 파일의 default export `CommentItem` 은 **루트 댓글**을 그린다 — "답글 N개" 펼치기,
 *   답글 지연 로딩(`useReplies`), 답글 폼(@멘션 프리필), tombstone 마스킹을 관장한다.
 * ★ 답글(대댓글)은 `ReplyItem` 이 그리며 루트·답글 공통 몸통은 `CommentBody` 로 공유한다
 *   (수정/삭제 인라인·공감/비공감 토글·본문/tombstone 분기).
 * ★ **공감/비공감(FC-211)** — 낙관적 토글. 비로그인 클릭은 로그인 유도, 본인 댓글은 비활성
 *   (COMMENT_003 서버 방어). **BEST 는 FC-212**. 인가 권위는 서버(§1.2).
 */
const CONTENT_MAX = 1000

/** 답글 폼의 대상 — 경로 POST 대상 `commentPublicId` + 표시용 @멘션 라벨(루트 직답은 null). */
interface ReplyTarget {
    targetPublicId: string
    mentionLabel: string | null
}

interface CommentItemProps {
    slug: string
    postPublicId: string
    comment: RootCommentResponse
    /** BEST 섹션에서 렌더할 때 골드 배지 표시(FC-212). 본 목록에서는 false. */
    isBest?: boolean
}

export default function CommentItem({
    slug,
    postPublicId,
    comment,
    isBest = false,
}: CommentItemProps) {
    const [expanded, setExpanded] = useState(false)
    const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null)
    const hasReplies = comment.replyCount > 0

    // 답글 폼을 열면 스레드도 함께 펼친다(폼이 스레드 하단에 붙으므로).
    const openReplyForm = (target: ReplyTarget) => {
        setExpanded(true)
        setReplyingTo(target)
    }

    const actions = (
        <>
            {hasReplies && (
                <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-navy-500 hover:bg-gray-100 hover:text-navy"
                    onClick={() => setExpanded((v) => !v)}
                >
                    <TbChevronDown
                        aria-hidden
                        className={`size-3.5 transition-transform ${
                            expanded ? 'rotate-180' : ''
                        }`}
                    />
                    답글 {comment.replyCount}
                    {expanded ? ' 접기' : ''}
                </button>
            )}
            {/* tombstone(삭제 루트)에는 신규 답글 불가(§13.4) → 답글쓰기 미노출 */}
            {!comment.deleted && (
                <button
                    type="button"
                    className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    onClick={() =>
                        openReplyForm({
                            targetPublicId: comment.commentPublicId,
                            mentionLabel: null,
                        })
                    }
                >
                    <TbArrowBackUp aria-hidden className="size-3.5" />
                    답글쓰기
                </button>
            )}
        </>
    )

    return (
        <li className="border-t border-line first:border-t-0">
            <CommentBody
                slug={slug}
                postPublicId={postPublicId}
                comment={comment}
                variant="root"
                mention={null}
                isBest={isBest}
                actions={actions}
            />

            {expanded && (
                <ReplyThread
                    slug={slug}
                    postPublicId={postPublicId}
                    rootCommentPublicId={comment.commentPublicId}
                    replyingTo={replyingTo}
                    onReply={openReplyForm}
                    onCloseForm={() => setReplyingTo(null)}
                />
            )}
        </li>
    )
}

/* ── 답글 스레드 (지연 로딩·펼침 시 마운트) ─────────────────────────────── */
function ReplyThread({
    slug,
    postPublicId,
    rootCommentPublicId,
    replyingTo,
    onReply,
    onCloseForm,
}: {
    slug: string
    postPublicId: string
    rootCommentPublicId: string
    replyingTo: ReplyTarget | null
    onReply: (target: ReplyTarget) => void
    onCloseForm: () => void
}) {
    const {
        data,
        isPending,
        isError,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useReplies(postPublicId, rootCommentPublicId, true)

    const replies = data?.pages.flatMap((page) => page.content) ?? []

    return (
        <div className="ml-11 border-l-2 border-line pl-4">
            {isPending ? (
                <div aria-hidden className="flex gap-3 py-3.5">
                    <div className="size-8 shrink-0 animate-pulse rounded-full bg-gray-100" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
                        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                    </div>
                </div>
            ) : isError ? (
                <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
                    답글을 불러오지 못했어요.
                    <button
                        type="button"
                        className="rounded-lg border border-line px-2 py-1 font-bold text-gray-600 hover:border-navy"
                        onClick={() => void refetch()}
                    >
                        다시 시도
                    </button>
                </div>
            ) : (
                <ul>
                    {replies.map((reply) => (
                        <ReplyItem
                            key={reply.commentPublicId}
                            slug={slug}
                            postPublicId={postPublicId}
                            reply={reply}
                            onReply={onReply}
                        />
                    ))}
                </ul>
            )}

            {hasNextPage && (
                <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 py-1.5 text-xs font-bold text-navy-500 hover:text-navy disabled:opacity-50"
                    disabled={isFetchingNextPage}
                    onClick={() => void fetchNextPage()}
                >
                    <TbChevronDown aria-hidden className="size-3.5" />
                    {isFetchingNextPage ? '불러오는 중…' : '답글 더 보기'}
                </button>
            )}

            {replyingTo && (
                <ReplyComposer
                    slug={slug}
                    postPublicId={postPublicId}
                    rootCommentPublicId={rootCommentPublicId}
                    target={replyingTo}
                    onDone={onCloseForm}
                />
            )}
        </div>
    )
}

/* ── 답글 1건 ────────────────────────────────────────────────────────────── */
function ReplyItem({
    slug,
    postPublicId,
    reply,
    onReply,
}: {
    slug: string
    postPublicId: string
    reply: CommentResponse & { mentionedNickname: string | null }
    onReply: (target: ReplyTarget) => void
}) {
    // 이 답글에 "답글쓰기" → 서버가 같은 루트로 평탄화하고 이 답글 작성자에게 @멘션(§13.1).
    const actions = (
        <button
            type="button"
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            onClick={() =>
                onReply({
                    targetPublicId: reply.commentPublicId,
                    mentionLabel: reply.authorNickname ?? '',
                })
            }
        >
            <TbArrowBackUp aria-hidden className="size-3.5" />
            답글쓰기
        </button>
    )

    return (
        <li className="border-t border-gray-100 first:border-t-0">
            <CommentBody
                slug={slug}
                postPublicId={postPublicId}
                comment={reply}
                variant="reply"
                mention={reply.mentionedNickname}
                actions={actions}
            />
        </li>
    )
}

/* ── 공용 몸통 (루트·답글 공통: 표시 + 인라인 수정/삭제 + 공감/비공감) ──── */
function CommentBody({
    slug,
    postPublicId,
    comment,
    variant,
    mention,
    actions,
    isBest = false,
}: {
    slug: string
    postPublicId: string
    comment: CommentResponse
    variant: 'root' | 'reply'
    /** 답글의 답글이면 @멘션 대상 닉(직접 답글·루트는 null) */
    mention: string | null
    /** 액션 바 슬롯 — 답글 토글·답글쓰기 등 변주별 버튼 */
    actions: React.ReactNode
    /** BEST 섹션 렌더 시 작성자 옆 골드 배지(FC-212) */
    isBest?: boolean
}) {
    const [editing, setEditing] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [draft, setDraft] = useState(comment.content ?? '')

    const isAuthenticated = useIsAuthenticated()
    const myNickname = useAuthStore((state) => state.user?.nickname)
    const location = useLocation()
    const navigate = useNavigate()

    const updateMutation = useUpdateComment(
        postPublicId,
        comment.commentPublicId,
    )
    const deleteMutation = useDeleteComment(
        slug,
        postPublicId,
        comment.commentPublicId,
    )
    const reactionMutation = useToggleReaction(postPublicId)

    // 본인 댓글 판정 = 작성자 닉 스냅샷 == 로그인 닉(유니크). 자기 반응 금지(COMMENT_003)의 UI 힌트일
    // 뿐 권위는 서버다 — admin은 editable=true지만 남의 댓글이라 반응 가능(닉 비교라 오판하지 않음).
    const isOwnComment =
        isAuthenticated &&
        myNickname !== undefined &&
        comment.authorNickname === myNickname

    const handleReact = (type: ReactionType) => {
        // 비로그인 → 로그인 유도(returnUrl 보존). 본인 댓글은 버튼이 이미 비활성(서버도 방어).
        if (!isAuthenticated) {
            void navigate(`${paths.login}${buildReturnUrlQuery(location)}`)
            return
        }
        if (isOwnComment) return
        reactionMutation.mutate({
            commentPublicId: comment.commentPublicId,
            type,
        })
    }

    const isReply = variant === 'reply'
    const edited = comment.updatedAt !== comment.createdAt
    const trimmed = draft.trim()
    const canSave =
        trimmed.length > 0 &&
        draft.length <= CONTENT_MAX &&
        !updateMutation.isPending

    const handleSave = () => {
        if (!canSave) return
        updateMutation.mutate(
            { content: trimmed },
            { onSuccess: () => setEditing(false) },
        )
    }

    const startEdit = () => {
        setDraft(comment.content ?? '')
        updateMutation.reset()
        setEditing(true)
    }

    const avatarSize = isReply ? 'size-8 text-xs' : 'size-9 text-sm'

    return (
        <div className={`flex gap-3 ${isReply ? 'py-3.5' : 'py-4'}`}>
            {comment.deleted ? (
                <span
                    aria-hidden
                    className={`grid ${avatarSize} shrink-0 place-items-center rounded-full bg-gray-100 text-gray-300`}
                >
                    <TbTrash className="size-4" />
                </span>
            ) : (
                <span
                    aria-hidden
                    className={`grid ${avatarSize} shrink-0 place-items-center rounded-full bg-gray-200 font-bold text-gray-600`}
                >
                    {avatarInitial(comment.authorNickname ?? undefined)}
                </span>
            )}

            <div className="min-w-0 flex-1">
                {comment.deleted ? (
                    /* tombstone — 본문·작성자 마스킹(§13.4), 답글 접근은 actions(토글)로 보존 */
                    <div className="flex items-center gap-1.5 text-sm text-gray-400">
                        <TbMessageOff aria-hidden className="size-4" />
                        삭제된 댓글입니다.
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <b className="text-sm font-bold text-gray-900">
                                {comment.authorNickname}
                            </b>
                            {isBest && (
                                <span className="inline-flex h-[18px] items-center gap-0.5 rounded bg-gold px-1.5 text-[10px] font-extrabold tracking-wide text-navy-900">
                                    <TbStarFilled aria-hidden className="size-2.5" />
                                    BEST
                                </span>
                            )}
                            <span className="text-xs text-gray-400">
                                {formatPostTime(comment.createdAt)}
                                {edited && ' · 수정됨'}
                            </span>

                            {comment.editable &&
                                !editing &&
                                !confirmDelete && (
                                    <span className="ml-auto flex gap-1.5">
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-400 hover:text-gray-700"
                                            onClick={startEdit}
                                        >
                                            <TbPencil
                                                aria-hidden
                                                className="size-3.5"
                                            />
                                            수정
                                        </button>
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-400 hover:text-danger"
                                            onClick={() =>
                                                setConfirmDelete(true)
                                            }
                                        >
                                            <TbTrash
                                                aria-hidden
                                                className="size-3.5"
                                            />
                                            삭제
                                        </button>
                                    </span>
                                )}
                        </div>

                        {editing ? (
                            <div className="mt-2">
                                <textarea
                                    value={draft}
                                    maxLength={CONTENT_MAX}
                                    rows={3}
                                    className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange focus:ring-2 focus:ring-orange-subtle"
                                    onChange={(event) =>
                                        setDraft(event.target.value)
                                    }
                                />
                                {updateMutation.isError && (
                                    <p
                                        role="alert"
                                        className="mt-1.5 flex items-center gap-1.5 text-xs text-danger"
                                    >
                                        <TbAlertTriangle
                                            aria-hidden
                                            className="size-3.5 shrink-0"
                                        />
                                        {commentErrorMessage(
                                            updateMutation.error,
                                        )}
                                    </p>
                                )}
                                <div className="mt-2 flex items-center justify-end gap-2">
                                    <span className="mr-auto text-xs text-gray-400 tabular-nums">
                                        {draft.length} / {CONTENT_MAX}
                                    </span>
                                    <button
                                        type="button"
                                        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-navy"
                                        onClick={() => setEditing(false)}
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!canSave}
                                        className="rounded-lg bg-orange px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={handleSave}
                                    >
                                        {updateMutation.isPending
                                            ? '저장 중…'
                                            : '저장'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                {mention && (
                                    <span className="mr-1 inline-flex h-5 items-center rounded-full bg-navy px-2 align-[1px] text-xs font-bold text-white">
                                        @{mention}
                                    </span>
                                )}
                                {comment.content}
                            </p>
                        )}

                        {confirmDelete && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg bg-danger-subtle px-3 py-2">
                                <span className="text-xs font-semibold text-danger">
                                    이 댓글을 삭제할까요?
                                </span>
                                {deleteMutation.isError && (
                                    <span className="text-xs text-danger">
                                        {commentErrorMessage(
                                            deleteMutation.error,
                                        )}
                                    </span>
                                )}
                                <span className="ml-auto flex gap-1.5">
                                    <button
                                        type="button"
                                        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-navy"
                                        onClick={() => setConfirmDelete(false)}
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="button"
                                        disabled={deleteMutation.isPending}
                                        className="rounded-lg bg-danger px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={() => deleteMutation.mutate()}
                                    >
                                        {deleteMutation.isPending
                                            ? '삭제 중…'
                                            : '삭제'}
                                    </button>
                                </span>
                            </div>
                        )}
                    </>
                )}

                {/* 액션 바 — 공감/비공감 토글 + 변주 슬롯(답글 토글·답글쓰기). tombstone은 슬롯만. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {!comment.deleted && (
                        <>
                            <ReactionButton
                                kind="like"
                                count={comment.likeCount}
                                active={comment.myReaction === 'LIKE'}
                                disabled={isOwnComment}
                                pending={reactionMutation.isPending}
                                onToggle={() => handleReact('LIKE')}
                            />
                            <ReactionButton
                                kind="dislike"
                                count={comment.dislikeCount}
                                active={comment.myReaction === 'DISLIKE'}
                                disabled={isOwnComment}
                                pending={reactionMutation.isPending}
                                onToggle={() => handleReact('DISLIKE')}
                            />
                        </>
                    )}
                    {actions}
                </div>

                {!comment.deleted && reactionMutation.isError && (
                    <p
                        role="alert"
                        className="mt-1.5 flex items-center gap-1.5 text-xs text-danger"
                    >
                        <TbAlertTriangle aria-hidden className="size-3.5 shrink-0" />
                        {commentErrorMessage(reactionMutation.error)}
                    </p>
                )}
            </div>
        </div>
    )
}

/* ── 공감/비공감 버튼 (낙관적 토글, FC-211) ─────────────────────────────── */
/**
 * 승인 디자인: 공감 활성 = 오렌지 필("따뜻한 댓글" 톤), 비공감 활성 = 중립 회색 필.
 * ★ 클릭 → `handleReact`가 낙관적 토글을 낸다(등록·전환·취소). 본인 댓글은 `disabled`
 *   (COMMENT_003 UI 힌트, 서버가 최종 방어). 비로그인 클릭은 상위에서 로그인 유도.
 * ★ `active`(myReaction 강조)는 낙관 반영 + 서버 권위로 갱신되고, 토글 진행 중엔 연타를 막는다.
 */
function ReactionButton({
    kind,
    count,
    active,
    disabled,
    pending,
    onToggle,
}: {
    kind: 'like' | 'dislike'
    count: number
    active: boolean
    disabled: boolean
    pending: boolean
    onToggle: () => void
}) {
    const Icon = kind === 'like' ? TbThumbUp : TbThumbDown
    const activeClass =
        kind === 'like'
            ? 'border-orange bg-orange-subtle text-orange-deep'
            : 'border-gray-400 bg-gray-100 text-gray-700'
    const baseLabel = kind === 'like' ? '공감' : '비공감'
    // 비활성 사유를 hover title뿐 아니라 접근성 이름에도 실어 SR 사용자에게 전달(MINOR-4).
    const reason = disabled ? '본인 댓글에는 공감·비공감할 수 없어요' : undefined

    return (
        <button
            type="button"
            disabled={disabled || pending}
            title={reason}
            aria-pressed={active}
            aria-label={reason ? `${baseLabel} — ${reason}` : baseLabel}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                    ? activeClass
                    : 'border-line bg-surface text-gray-500 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={onToggle}
        >
            <Icon aria-hidden className="size-[15px]" />
            <span className="tabular-nums">{count}</span>
        </button>
    )
}

/* ── 답글 작성 폼 (@멘션 프리필·로그인 유저만) ──────────────────────────── */
function ReplyComposer({
    slug,
    postPublicId,
    rootCommentPublicId,
    target,
    onDone,
}: {
    slug: string
    postPublicId: string
    rootCommentPublicId: string
    target: ReplyTarget
    onDone: () => void
}) {
    const isAuthenticated = useIsAuthenticated()
    const nickname = useAuthStore((state) => state.user?.nickname)
    const location = useLocation()
    const [content, setContent] = useState('')
    const createReplyMutation = useCreateReply(
        slug,
        postPublicId,
        rootCommentPublicId,
    )

    if (!isAuthenticated) {
        return (
            <div className="my-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-line bg-surface px-3 py-3 text-xs text-gray-500">
                <span>
                    답글을 작성하려면{' '}
                    <Link
                        to={`${paths.login}${buildReturnUrlQuery(location)}`}
                        className="font-bold text-navy hover:text-orange-deep"
                    >
                        로그인
                    </Link>
                    하세요.
                </span>
                <button
                    type="button"
                    className="font-bold text-gray-400 hover:text-gray-700"
                    onClick={onDone}
                >
                    닫기
                </button>
            </div>
        )
    }

    const trimmed = content.trim()
    const canSubmit =
        trimmed.length > 0 &&
        content.length <= CONTENT_MAX &&
        !createReplyMutation.isPending

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (!canSubmit) return
        createReplyMutation.mutate(
            { targetCommentPublicId: target.targetPublicId, content: trimmed },
            {
                onSuccess: () => {
                    setContent('')
                    onDone()
                },
            },
        )
    }

    return (
        <form className="my-2 flex gap-2.5" onSubmit={handleSubmit}>
            <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-600 text-xs font-bold text-white"
            >
                {avatarInitial(nickname)}
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface-sunken px-3 py-2.5 focus-within:border-orange focus-within:ring-2 focus-within:ring-orange-subtle">
                {target.mentionLabel && (
                    <div className="mb-1.5 text-xs text-gray-500">
                        <span className="mr-1 inline-flex h-5 items-center rounded-full bg-navy px-2 text-xs font-bold text-white">
                            @{target.mentionLabel}
                        </span>
                        님에게 답글
                    </div>
                )}
                <label htmlFor="reply-content" className="sr-only">
                    답글 내용
                </label>
                <textarea
                    autoFocus
                    id="reply-content"
                    value={content}
                    maxLength={CONTENT_MAX}
                    rows={2}
                    placeholder="답글을 남겨보세요."
                    className="w-full resize-none bg-transparent text-sm text-gray-700 outline-none"
                    onChange={(event) => setContent(event.target.value)}
                />
                {createReplyMutation.isError && (
                    <p
                        role="alert"
                        className="mt-1 flex items-center gap-1.5 text-xs text-danger"
                    >
                        <TbAlertTriangle
                            aria-hidden
                            className="size-3.5 shrink-0"
                        />
                        {commentErrorMessage(createReplyMutation.error)}
                    </p>
                )}
                <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-gray-400 tabular-nums">
                        {content.length} / {CONTENT_MAX}
                    </span>
                    <span className="flex gap-2">
                        <button
                            type="button"
                            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-navy"
                            onClick={onDone}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="rounded-lg bg-orange px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {createReplyMutation.isPending
                                ? '등록 중…'
                                : '답글 등록'}
                        </button>
                    </span>
                </div>
            </div>
        </form>
    )
}
