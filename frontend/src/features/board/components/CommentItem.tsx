import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
    TbPencil,
    TbTrash,
    TbAlertTriangle,
    TbThumbUp,
    TbChevronDown,
    TbArrowBackUp,
    TbMessageOff,
    TbDotsVertical,
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
import type { CommentResponse, RootCommentResponse } from '@/lib/api/comments'

/**
 * 댓글 1건 — 네이버식 대댓글 (계약 v1.24 §6.3, §13) — FC-210·FC-211.
 *
 * ★ 이 파일의 default export `CommentItem` 은 **루트 댓글**을 그린다 — "답글 N개" 펼치기,
 *   답글 지연 로딩(`useReplies`), 답글 폼(@멘션 프리필), tombstone 마스킹을 관장한다.
 * ★ 답글(대댓글)은 `ReplyItem` 이 그리며 루트·답글 공통 몸통은 `CommentBody` 로 공유한다
 *   (수정/삭제 인라인·공감 토글·본문/tombstone 분기).
 * ★ **공감(FC-211·FC-219)** — 계약의 비공감 처리는 유지하되 UI에는 공감만 노출한다.
 *   비로그인 클릭은 로그인 유도, 본인 댓글은 비활성(COMMENT_003 서버 방어). 인가 권위는 서버(§1.2).
 * ★ **인라인 답글(FC-216)** — "답글" 클릭 시 폼이 그 댓글/답글 **바로 아래**에 뜬다. 동시에
 *   하나만 열리며(`replyingTo.targetPublicId`가 열린 노드), 다른 대상 클릭 시 이전이 닫히고 이동한다.
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
}

export default function CommentItem({
    slug,
    postPublicId,
    comment,
}: CommentItemProps) {
    const hasReplies = comment.replyCount > 0
    const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null)

    const openReplyForm = (target: ReplyTarget) => {
        setReplyingTo(target)
    }

    const actions = (
        <>
            {/* tombstone(삭제 루트)에는 신규 답글 불가(§13.4) → 답글 버튼 미노출 */}
            {!comment.deleted && (
                <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    onClick={() =>
                        openReplyForm({
                            targetPublicId: comment.commentPublicId,
                            mentionLabel: null,
                        })
                    }
                >
                    <TbArrowBackUp aria-hidden className="size-3.5" />
                    답글
                </button>
            )}
        </>
    )

    const closeReplyForm = () => setReplyingTo(null)

    return (
        <li className="border-t border-line first:border-t-0">
            <CommentBody
                slug={slug}
                postPublicId={postPublicId}
                comment={comment}
                variant="root"
                mention={null}
                actions={actions}
            />

            {/* 루트에 단 답글 폼 — 루트 바로 아래(스레드 들여쓰기 정렬)에 인라인(FC-216) */}
            {replyingTo?.targetPublicId === comment.commentPublicId && (
                <div className="ml-4 pl-2 sm:ml-11 sm:pl-4">
                    <ReplyComposer
                        slug={slug}
                        postPublicId={postPublicId}
                        rootCommentPublicId={comment.commentPublicId}
                        target={replyingTo}
                        onDone={closeReplyForm}
                    />
                </div>
            )}

            {hasReplies && (
                <ReplyThread
                    slug={slug}
                    postPublicId={postPublicId}
                    rootCommentPublicId={comment.commentPublicId}
                    replyingTo={replyingTo}
                    onReply={openReplyForm}
                    onCloseForm={closeReplyForm}
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
        <div className="ml-4 pl-2 sm:ml-11 sm:pl-4">
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
                            rootCommentPublicId={rootCommentPublicId}
                            reply={reply}
                            replyingTo={replyingTo}
                            onReply={onReply}
                            onCloseForm={onCloseForm}
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
        </div>
    )
}

/* ── 답글 1건 ────────────────────────────────────────────────────────────── */
function ReplyItem({
    slug,
    postPublicId,
    rootCommentPublicId,
    reply,
    replyingTo,
    onReply,
    onCloseForm,
}: {
    slug: string
    postPublicId: string
    rootCommentPublicId: string
    reply: CommentResponse & { mentionedNickname: string | null }
    replyingTo: ReplyTarget | null
    onReply: (target: ReplyTarget) => void
    onCloseForm: () => void
}) {
    // 이 답글에 "답글" → 서버가 같은 루트로 평탄화하고 이 답글 작성자에게 @멘션(§13.1).
    const actions = (
        <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            onClick={() =>
                onReply({
                    targetPublicId: reply.commentPublicId,
                    mentionLabel: reply.authorNickname ?? '',
                })
            }
        >
            <TbArrowBackUp aria-hidden className="size-3.5" />
            답글
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

            {/* 이 답글에 단 답글 폼 — 답글 바로 아래에 인라인(FC-216) */}
            {replyingTo?.targetPublicId === reply.commentPublicId && (
                <ReplyComposer
                    slug={slug}
                    postPublicId={postPublicId}
                    rootCommentPublicId={rootCommentPublicId}
                    target={replyingTo}
                    onDone={onCloseForm}
                />
            )}
        </li>
    )
}

/* ── 공용 몸통 (루트·답글 공통: 표시 + 인라인 수정/삭제 + 공감) ───────── */
function CommentBody({
    slug,
    postPublicId,
    comment,
    variant,
    mention,
    actions,
}: {
    slug: string
    postPublicId: string
    comment: CommentResponse
    variant: 'root' | 'reply'
    /** 답글의 답글이면 @멘션 대상 닉(직접 답글·루트는 null) */
    mention: string | null
    /** 액션 바 슬롯 — 답글·답글 토글 등 변주별 버튼 */
    actions: React.ReactNode
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

    const handleReact = () => {
        // 비로그인 → 로그인 유도(returnUrl 보존). 본인 댓글은 버튼이 이미 비활성(서버도 방어).
        if (!isAuthenticated) {
            void navigate(`${paths.login}${buildReturnUrlQuery(location)}`)
            return
        }
        if (isOwnComment) return
        reactionMutation.mutate({
            commentPublicId: comment.commentPublicId,
            type: 'LIKE',
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
                        {/* 상단 행 — 모바일·웹 모두 닉네임 우측에 작성 시간 표시 */}
                        <div className="flex items-center gap-2">
                            <b className="min-w-0 truncate text-sm font-bold text-gray-900">
                                {comment.authorNickname}
                            </b>
                            <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">
                                {formatPostTime(comment.createdAt)}
                                {edited && ' · 수정됨'}
                            </span>

                            {comment.editable && !editing && !confirmDelete && (
                                <CommentEditMenu
                                    onEdit={startEdit}
                                    onDelete={() => setConfirmDelete(true)}
                                />
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

                {/* 액션 바 — 공감(맨 앞) · 구분선 · 답글. tombstone은 슬롯만. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {!comment.deleted && (
                        <>
                            <ReactionButton
                                count={comment.likeCount}
                                active={comment.myReaction === 'LIKE'}
                                disabled={isOwnComment}
                                pending={reactionMutation.isPending}
                                onToggle={handleReact}
                            />
                            <span
                                aria-hidden
                                className="mx-0.5 h-4 w-px bg-line"
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

/* ── 공감 버튼 (낙관적 토글, FC-211) ───────────────────────────────────── */
/**
 * 승인 디자인: 공감 활성 = 오렌지 필("따뜻한 댓글" 톤).
 * ★ 클릭 → `handleReact`가 낙관적 토글을 낸다(등록·전환·취소). 본인 댓글은 `disabled`
 *   (COMMENT_003 UI 힌트, 서버가 최종 방어). 비로그인 클릭은 상위에서 로그인 유도.
 * ★ `active`(myReaction 강조)는 낙관 반영 + 서버 권위로 갱신되고, 토글 진행 중엔 연타를 막는다.
 */
function ReactionButton({
    count,
    active,
    disabled,
    pending,
    onToggle,
}: {
    count: number
    active: boolean
    disabled: boolean
    pending: boolean
    onToggle: () => void
}) {
    // 비활성 사유를 hover title뿐 아니라 접근성 이름에도 실어 SR 사용자에게 전달(MINOR-4).
    const reason = disabled ? '본인 댓글에는 공감할 수 없어요' : undefined

    return (
        <button
            type="button"
            disabled={disabled || pending}
            title={reason}
            aria-pressed={active}
            aria-label={reason ? `공감 — ${reason}` : '공감'}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                    ? 'border-orange bg-orange-subtle text-orange-deep'
                    : 'border-line bg-surface text-gray-500 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={onToggle}
        >
            <TbThumbUp aria-hidden className="size-[15px]" />
            <span className="tabular-nums">{count}</span>
        </button>
    )
}

/* ── 수정/삭제 오버플로 메뉴 (본인·관리자만, FC-215) ─────────────────────── */
/**
 * 승인 배치(A안): 헤더 우측 ⋮ 버튼. 웹=앵커 드롭다운, 모바일=하단 시트(엄지 도달·큰 타깃).
 * `CommentSortControl` 반응형 패턴을 미러링 — 같은 열림 상태를 반응형 유틸리티로 두 표현.
 * ★ 바깥 클릭·Esc 로 닫힘. 삭제는 기존 확인 흐름(`onDelete`가 confirmDelete 인라인을 연다).
 */
function CommentEditMenu({
    onEdit,
    onDelete,
}: {
    onEdit: () => void
    onDelete: () => void
}) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onPointer = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onPointer)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const choose = (fn: () => void) => {
        setOpen(false)
        fn()
    }

    return (
        <div ref={rootRef} className="relative ml-auto shrink-0">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="댓글 관리 메뉴"
                className="-mr-1 grid size-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                onClick={() => setOpen((v) => !v)}
            >
                <TbDotsVertical aria-hidden className="size-[18px]" />
            </button>

            {open && (
                <>
                    {/* 모바일 스크림 — 시트 뒤 어둡게 + 바깥 탭 닫기 */}
                    <div
                        aria-hidden
                        className="fixed inset-0 z-40 bg-navy-900/35 sm:hidden"
                        onClick={() => setOpen(false)}
                    />
                    <div
                        role="menu"
                        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-line bg-surface p-2 pb-4 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-1 sm:w-32 sm:rounded-xl sm:border sm:p-1.5"
                    >
                        <button
                            type="button"
                            role="menuitem"
                            className="flex h-12 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-gray-600 hover:bg-gray-100 sm:h-9 sm:text-xs"
                            onClick={() => choose(onEdit)}
                        >
                            <TbPencil aria-hidden className="size-4 sm:size-3.5" />
                            수정
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="flex h-12 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-danger hover:bg-danger-subtle sm:h-9 sm:text-xs"
                            onClick={() => choose(onDelete)}
                        >
                            <TbTrash aria-hidden className="size-4 sm:size-3.5" />
                            삭제
                        </button>
                        <button
                            type="button"
                            className="mt-1 flex h-12 w-full items-center justify-center rounded-lg bg-surface-sunken text-sm font-bold text-gray-600 sm:hidden"
                            onClick={() => setOpen(false)}
                        >
                            닫기
                        </button>
                    </div>
                </>
            )}
        </div>
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
        <form className="my-2" onSubmit={handleSubmit}>
            <div className="rounded-lg border border-line bg-surface-sunken px-3 py-2.5 focus-within:border-orange focus-within:ring-2 focus-within:ring-orange-subtle">
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
