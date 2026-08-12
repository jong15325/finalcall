import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
    TbMessage,
    TbMessageOff,
    TbAlertTriangle,
    TbArrowsSort,
    TbChevronDown,
    TbCheck,
} from 'react-icons/tb'
import { paths } from '@/app/paths'
import { buildReturnUrlQuery } from '@/lib/returnUrl'
import { useComments, useCreateComment } from '@/lib/queries/comments'
import { useIsAuthenticated } from '@/store/authStore'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import { commentErrorMessage } from '@/features/board/lib/boardErrors'
import CommentItem from './CommentItem'
import type { CommentSort } from '@/lib/api/comments'

/**
 * 댓글 영역 — 네이버식 대댓글 (계약 v1.24 §6.3, EPIC-COMMENT-V2) — FC-210.
 *
 * ★ `allowComments=false`(공지)면 미노출·안내. 허용이면 개수 헤더 + 정렬 컨트롤 + 작성 폼
 *   (로그인 유저만) + 루트 목록(정렬·지연 답글).
 * ★ **가짜 댓글을 렌더하지 않는다**(FC-048). 개수는 상세의 비정규화 `commentCount`(계약 §6.2).
 * ★ 목록은 **루트 댓글만** — 답글은 각 루트가 펼칠 때 지연 로딩한다(§13.1, `CommentItem`).
 */
const CONTENT_MAX = 1000

const SORT_OPTIONS: { value: CommentSort; label: string }[] = [
    { value: 'LATEST', label: '최신순' },
    { value: 'OLDEST', label: '과거순' },
    { value: 'LIKES', label: '순공감순' },
]

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
    // 정렬은 섹션 상태 — 기본 `LATEST`(최신순, 계약 §13.3 게이트2 확정). 답글은 항상 시간순이라 무관.
    const [sort, setSort] = useState<CommentSort>('LATEST')

    if (!allowComments) {
        return (
            <section
                aria-label="댓글"
                className="mt-6 border-t border-content-line pt-6"
            >
                <div className="flex items-center justify-center gap-2 rounded-lg bg-content-soft px-4 py-5 text-sm text-content-subtle">
                    <TbMessageOff aria-hidden className="size-4" />이 게시판은
                    댓글을 받지 않습니다.
                </div>
            </section>
        )
    }

    return (
        <section aria-label="댓글" className="mt-6 border-t border-content-line pt-6">
            <div className="flex items-center gap-2">
                <h3 className="flex items-center gap-1.5 text-base font-bold text-content-fg">
                    <TbMessage aria-hidden className="size-4 text-brand-structure" />
                    댓글
                    <span className="text-control-action-hover">
                        {commentCount.toLocaleString()}
                    </span>
                </h3>
                <div className="ml-auto">
                    <CommentSortControl sort={sort} onChange={setSort} />
                </div>
            </div>

            <CommentComposer slug={slug} postPublicId={postPublicId} />

            <CommentList slug={slug} postPublicId={postPublicId} sort={sort} />
        </section>
    )
}

/* ── 정렬 컨트롤 (웹=인라인 드롭다운 · 모바일=하단 시트) ─────────────────── */
/**
 * 승인된 디자인: 데스크톱은 버튼 앵커 드롭다운, 모바일은 하단 시트(엄지 도달·큰 터치 타깃).
 * 같은 열림 상태를 반응형 유틸리티로 두 표현으로 바꾼다 — 미디어쿼리 훅 없이 단일 DOM.
 */
function CommentSortControl({
    sort,
    onChange,
}: {
    sort: CommentSort
    onChange: (next: CommentSort) => void
}) {
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)
    const rootRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
    const current =
        SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0]
    const currentIndex = SORT_OPTIONS.findIndex(
        (o) => o.value === current.value,
    )

    useEffect(() => {
        if (open) itemRefs.current[activeIndex]?.focus()
    }, [activeIndex, open])

    useEffect(() => {
        if (!open) return
        const onPointer = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
                triggerRef.current?.focus()
            }
        }
        document.addEventListener('mousedown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onPointer)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const select = (next: CommentSort) => {
        onChange(next)
        setOpen(false)
        triggerRef.current?.focus()
    }

    const moveFocus = (index: number) => {
        setActiveIndex((index + SORT_OPTIONS.length) % SORT_OPTIONS.length)
    }

    const handleMenuKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            moveFocus(activeIndex + 1)
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            moveFocus(activeIndex - 1)
        } else if (event.key === 'Home') {
            event.preventDefault()
            moveFocus(0)
        } else if (event.key === 'End') {
            event.preventDefault()
            moveFocus(SORT_OPTIONS.length - 1)
        }
    }

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? 'comment-sort-menu' : undefined}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-content-line bg-content-surface px-3 text-xs font-bold text-content-muted hover:border-brand-structure"
                onClick={() => {
                    setActiveIndex(currentIndex)
                    setOpen((v) => !v)
                }}
            >
                <TbArrowsSort aria-hidden className="size-3.5 text-content-subtle" />
                {current.label}
                <TbChevronDown aria-hidden className="size-3.5 text-content-subtle" />
            </button>

            {open && (
                <>
                    {/* 모바일 전용 스크림 — 시트 뒤 어둡게 + 바깥 탭으로 닫기 */}
                    <div
                        aria-hidden
                        className="fixed inset-0 z-40 bg-chrome-strong/35 sm:hidden"
                        onClick={() => setOpen(false)}
                    />
                    <div
                        id="comment-sort-menu"
                        role="menu"
                        aria-label="댓글 정렬"
                        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-content-line bg-content-surface p-2 pb-4 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-40 sm:rounded-xl sm:border sm:p-1.5 sm:shadow-lg"
                        onKeyDown={handleMenuKeyDown}
                    >
                        <p className="px-3 pb-1.5 pt-1 text-xs font-bold text-content-subtle sm:hidden">
                            정렬
                        </p>
                        {SORT_OPTIONS.map((option, index) => {
                            const selected = option.value === sort
                            return (
                                <button
                                    key={option.value}
                                    ref={(node) => {
                                        itemRefs.current[index] = node
                                    }}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={selected}
                                    tabIndex={activeIndex === index ? 0 : -1}
                                    className={`flex h-12 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-content-soft sm:h-9 ${
                                        selected
                                            ? 'font-bold text-brand-structure'
                                            : 'font-semibold text-content-muted'
                                    }`}
                                    onClick={() => select(option.value)}
                                >
                                    {option.label}
                                    {selected && (
                                        <TbCheck
                                            aria-hidden
                                            className="ml-auto size-4 text-control-action-hover"
                                        />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
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
    const location = useLocation()
    const [content, setContent] = useState('')
    const createMutation = useCreateComment(slug, postPublicId)

    if (!isAuthenticated) {
        return (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-content-line bg-content-surface px-4 py-5 text-sm text-content-subtle">
                댓글을 작성하려면
                <Link
                    to={`${paths.login}${buildReturnUrlQuery(location)}`}
                    className="font-bold text-brand-structure hover:text-control-action-hover"
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
        <form className="mt-4" onSubmit={handleSubmit}>
            <div className="rounded-lg border border-content-line bg-content-soft px-3 py-2.5 focus-within:border-control-action focus-within:ring-2 focus-within:ring-control-action-soft">
                <label htmlFor="comment-content" className="sr-only">
                    댓글 내용
                </label>
                <textarea
                    id="comment-content"
                    value={content}
                    maxLength={CONTENT_MAX}
                    rows={2}
                    placeholder="따뜻한 댓글을 남겨보세요."
                    className="w-full resize-none bg-transparent text-sm text-content-fg outline-none"
                    onChange={(event) => setContent(event.target.value)}
                />
                {createMutation.isError && (
                    <p
                        role="alert"
                        className="mt-1 flex items-center gap-1.5 text-xs text-danger-ink"
                    >
                        <TbAlertTriangle
                            aria-hidden
                            className="size-3.5 shrink-0"
                        />
                        {commentErrorMessage(createMutation.error)}
                    </p>
                )}
                <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-content-subtle tabular-nums">
                        {content.length} / {CONTENT_MAX}
                    </span>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="rounded-lg bg-control-action px-4 py-1.5 text-sm font-bold text-on-strong hover:bg-control-action-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {createMutation.isPending ? '등록 중…' : '등록'}
                    </button>
                </div>
            </div>
        </form>
    )
}

/* ── 루트 목록 (offset 무한 누적, 정렬별) ───────────────────────────────── */
function CommentList({
    slug,
    postPublicId,
    sort,
}: {
    slug: string
    postPublicId: string
    sort: CommentSort
}) {
    const {
        data,
        isPending,
        isError,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useComments(postPublicId, sort)

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
                        <div className="size-9 shrink-0 animate-pulse rounded-full bg-content-soft" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-1/4 animate-pulse rounded bg-content-soft" />
                            <div className="h-3 w-3/4 animate-pulse rounded bg-content-soft" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (isError) {
        return (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-content-line bg-content-surface px-4 py-8 text-center">
                <p className="text-sm text-content-subtle">
                    댓글을 불러오지 못했어요.
                </p>
                <button
                    type="button"
                    className="rounded-lg border border-content-line px-3 py-1.5 text-xs font-bold text-content-muted hover:border-brand-structure"
                    onClick={() => void refetch()}
                >
                    다시 시도
                </button>
            </div>
        )
    }

    if (comments.length === 0) {
        return (
            <p className="mt-4 rounded-lg border border-dashed border-content-line bg-content-surface px-4 py-8 text-center text-sm text-content-subtle">
                아직 댓글이 없어요. 첫 댓글을 남겨보세요.
            </p>
        )
    }

    return (
        <>
            <ul className="mt-2">
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
                    className="py-2 text-center text-xs text-content-subtle"
                >
                    더 불러오는 중…
                </p>
            )}
        </>
    )
}
