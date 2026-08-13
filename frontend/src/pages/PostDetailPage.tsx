import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
    TbPin,
    TbEye,
    TbMessage,
    TbPencil,
    TbTrash,
    TbAlertTriangle,
    TbSearchOff,
    TbChevronLeft,
} from 'react-icons/tb'
import { boardPath, boardPostEditPath } from '@/app/paths'
import { useBoard, usePostDetail, useDeletePost } from '@/lib/queries/boards'
import {
    avatarInitial,
    formatPostTimeFull,
} from '@/features/board/lib/postView'
import { boardWriteErrorMessage } from '@/features/board/lib/boardErrors'
import CommentSection from '@/features/board/components/CommentSection'
import BoardStateBlock from '@/features/board/components/BoardStateBlock'
import { isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 게시글 상세 `/boards/:slug/:postId` (FC-202 — 승인 화면 C).
 *
 * ★ 상세 조회는 서버가 `viewCount` 를 증가시킨다(디둡 없음) — 상세 쿼리는 창 포커스 재조회를
 *   끈다(queries/boards). 이미지 `images[]`는 presigned url 로 오며, 지금은 빈 배열이라
 *   갤러리가 렌더되지 않는다(FC-204 에서 채워짐 — 슬롯만 대비).
 * ★ 수정/삭제 버튼은 `editable`(작성자 or 관리자, 서버 판정)일 때만 노출한다. 인가 권위는 서버.
 * ★ 댓글 영역은 `CommentSection` 슬롯(뼈대) — 실제 댓글 CRUD 는 FC-203.
 */
export default function PostDetailPage() {
    const { slug = '', postId = '' } = useParams()
    const navigate = useNavigate()

    const {
        data: post,
        isPending,
        isError,
        error,
        refetch,
    } = usePostDetail(slug, postId)
    const boardQuery = useBoard(slug)
    const deleteMutation = useDeletePost(slug, postId)

    const [confirmOpen, setConfirmOpen] = useState(false)
    const dialogRef = useRef<HTMLDivElement>(null)
    const cancelRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)

    const images = useMemo(
        () =>
            [...(post?.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
        [post],
    )

    /**
     * 삭제 확인 모달 — 초점·스크롤잠금·Escape·Tab 가둠(프로젝트 `SellConfirmDialog` 패턴 재사용).
     * 의존은 `[confirmOpen]` 뿐 — 부모 리렌더가 초점을 강탈하지 않는다.
     */
    useEffect(() => {
        if (!confirmOpen) return

        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const focusRaf = requestAnimationFrame(() => cancelRef.current?.focus())

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                setConfirmOpen(false)
                return
            }
            if (event.key !== 'Tab') return
            const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
                'button, [href], input, [tabindex]:not([tabindex="-1"])',
            )
            const list = Array.from(focusables ?? []).filter(
                (el) => !el.hasAttribute('disabled'),
            )
            if (list.length === 0) return
            const first = list[0]
            const last = list[list.length - 1]
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }
        document.addEventListener('keydown', onKeyDown)

        return () => {
            cancelAnimationFrame(focusRaf)
            document.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = previousOverflow
            previousFocusRef.current?.focus()
        }
    }, [confirmOpen])

    // 글 없음(삭제·미존재) — 상세 대신 안내.
    const notFound =
        isError && isApiError(error) && error.code === ERROR_CODES.POST_001
    if (notFound) {
        return (
            <BoardStateBlock
                icon={TbSearchOff}
                title="게시글을 찾을 수 없어요"
                description="이미 삭제됐거나 주소가 바뀌었을 수 있어요."
                action={
                    <Link
                        to={boardPath(slug)}
                        className="rounded-lg bg-brand-structure px-4 py-2 text-sm font-bold text-on-strong hover:bg-chrome-raised"
                    >
                        목록으로
                    </Link>
                }
            />
        )
    }

    if (isPending) {
        return (
            <div className="w-full min-w-0 rounded-2xl border border-content-line bg-content-surface p-7">
                <div className="h-6 w-2/3 animate-pulse rounded bg-content-soft" />
                <div className="mt-4 h-3 w-1/3 animate-pulse rounded bg-content-soft" />
                <div className="mt-8 space-y-3">
                    <div className="h-3 w-full animate-pulse rounded bg-content-soft" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-content-soft" />
                    <div className="h-3 w-4/6 animate-pulse rounded bg-content-soft" />
                </div>
            </div>
        )
    }

    if (isError || !post) {
        return (
            <BoardStateBlock
                icon={TbAlertTriangle}
                title="게시글을 불러오지 못했어요"
                description="잠시 후 다시 시도해 주세요."
                action={
                    <button
                        type="button"
                        className="rounded-lg bg-brand-structure px-4 py-2 text-sm font-bold text-on-strong hover:bg-chrome-raised"
                        onClick={() => void refetch()}
                    >
                        다시 시도
                    </button>
                }
            />
        )
    }

    const handleDelete = () => {
        deleteMutation.mutate(undefined, {
            onSuccess: () => navigate(boardPath(slug)),
        })
    }

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            {/* 뒤로 */}
            <Link
                to={boardPath(slug)}
                className="inline-flex w-max items-center gap-1 text-sm font-semibold text-content-subtle hover:text-brand-structure"
            >
                <TbChevronLeft aria-hidden className="size-4" />
                {boardQuery.data?.name ?? '목록'}
            </Link>

            <article className="w-full min-w-0 rounded-2xl border border-content-line bg-content-surface p-6 sm:p-7">
                {/* 헤더 */}
                <header className="min-w-0 border-b border-content-line pb-5">
                    <h1 className="flex min-w-0 items-start gap-2 break-words text-[22px] font-bold leading-snug text-content-fg">
                        {post.isPinned && (
                            <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-highlight-soft px-2 py-0.5 text-[11px] font-bold text-brand-highlight-deep">
                                <TbPin aria-hidden className="size-3" />
                                고정
                            </span>
                        )}
                        <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                            {post.title}
                        </span>
                    </h1>
                    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-content-subtle">
                        <span className="inline-flex items-center gap-1.5 font-bold text-content-fg">
                            <span className="grid size-6 place-items-center rounded-full bg-chrome-selected text-[11px] font-bold text-on-strong">
                                {avatarInitial(post.authorNickname)}
                            </span>
                            {post.authorNickname}
                        </span>
                        <span aria-hidden className="text-content-line">
                            ·
                        </span>
                        <span>{formatPostTimeFull(post.createdAt)}</span>
                        <span aria-hidden className="text-content-line">
                            ·
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <TbEye aria-hidden className="size-4" />
                            {post.viewCount.toLocaleString()}
                        </span>
                        {boardQuery.data?.allowComments && (
                            <>
                                <span aria-hidden className="text-content-line">
                                    ·
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <TbMessage aria-hidden className="size-4" />
                                    {post.commentCount.toLocaleString()}
                                </span>
                            </>
                        )}

                        {/* editable=true(작성자 or 관리자) 일 때만 */}
                        {post.editable && (
                            <span className="ml-auto flex max-w-full flex-wrap items-center gap-2">
                                <Link
                                    to={boardPostEditPath(slug, postId)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-content-line bg-content-surface px-3 py-1.5 text-xs font-bold text-content-muted hover:border-brand-structure"
                                >
                                    <TbPencil
                                        aria-hidden
                                        className="size-3.5"
                                    />
                                    수정
                                </Link>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-lg border border-danger-soft bg-content-surface px-3 py-1.5 text-xs font-bold text-danger-ink hover:bg-danger-soft"
                                    onClick={() => setConfirmOpen(true)}
                                >
                                    <TbTrash aria-hidden className="size-3.5" />
                                    삭제
                                </button>
                            </span>
                        )}
                    </div>
                </header>

                {/* 본문 */}
                <div className="min-w-0 max-w-[75ch] break-words whitespace-pre-wrap py-6 text-[15px] leading-8 text-content-fg">
                    {post.content}
                </div>

                {/* 이미지 갤러리 — images[] 있을 때만(FC-204 에서 채워짐) */}
                {images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2.5 pb-6 sm:grid-cols-3">
                        {images.map((image) => (
                            <img
                                key={image.imagePublicId}
                                src={image.url}
                                alt=""
                                className="aspect-[4/3] w-full rounded-lg border border-content-line object-cover"
                            />
                        ))}
                    </div>
                )}

                {/* 삭제 실패 안내 */}
                {deleteMutation.isError && (
                    <p
                        role="alert"
                        className="mb-2 flex items-center gap-2 rounded-lg bg-danger-soft px-3.5 py-3 text-sm text-danger-ink"
                    >
                        <TbAlertTriangle
                            aria-hidden
                            className="size-4 shrink-0"
                        />
                        {boardWriteErrorMessage(deleteMutation.error)}
                    </p>
                )}

                {/* 댓글(FC-203) — board 로딩 확정 후 판정(로딩 중 '댓글 미허용' 오표시 방지) */}
                {boardQuery.data ? (
                    <CommentSection
                        slug={slug}
                        postPublicId={postId}
                        allowComments={boardQuery.data.allowComments}
                        commentCount={post.commentCount}
                    />
                ) : boardQuery.isError ? null : (
                    <div
                        aria-hidden
                        className="mt-6 border-t border-content-line pt-6"
                    >
                        <div className="h-5 w-24 animate-pulse rounded bg-content-soft" />
                        <div className="mt-4 h-16 animate-pulse rounded-lg bg-content-soft" />
                    </div>
                )}
            </article>

            {/* 삭제 확인 */}
            {confirmOpen && (
                <div
                    role="presentation"
                    className="fixed inset-0 z-50 grid place-items-center bg-brand-structure/40 p-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget)
                            setConfirmOpen(false)
                    }}
                >
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="deletePostTitle"
                        className="w-full max-w-sm rounded-2xl bg-content-surface p-6 shadow-xl"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <h2
                            id="deletePostTitle"
                            className="text-lg font-bold text-content-fg"
                        >
                            게시글을 삭제할까요?
                        </h2>
                        <p className="mt-1.5 text-sm text-content-subtle">
                            삭제한 글은 되돌릴 수 없어요.
                        </p>
                        <div className="mt-5 flex justify-end gap-2.5">
                            <button
                                ref={cancelRef}
                                type="button"
                                className="rounded-lg border border-content-line bg-content-surface px-4 py-2.5 text-sm font-bold text-content-muted hover:border-brand-structure"
                                onClick={() => setConfirmOpen(false)}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                disabled={deleteMutation.isPending}
                                className="rounded-lg bg-danger px-4 py-2.5 text-sm font-bold text-on-strong hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={handleDelete}
                            >
                                {deleteMutation.isPending ? '삭제 중…' : '삭제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 목록으로(하단) — 비로그인·타인도 목록 복귀 */}
            <div className="text-center">
                <Link
                    to={boardPath(slug)}
                    className="text-sm font-semibold text-content-subtle hover:text-brand-structure"
                >
                    목록으로
                </Link>
            </div>
        </div>
    )
}
