import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import {
    TbPencilPlus,
    TbAlertTriangle,
    TbMessageOff,
    TbSearchOff,
    TbChevronLeft,
} from 'react-icons/tb'
import { boardPath, boardWritePath, paths } from '@/app/paths'
import { useBoard, useBoards, usePostList } from '@/lib/queries/boards'
import { useIsAuthenticated, useIsAdmin } from '@/store/authStore'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import {
    canWriteBoard,
    isEventBoard,
    writeDisabledLabel,
} from '@/features/board/lib/boardMeta'
import PostCard from '@/features/board/components/PostCard'
import EventPostCard from '@/features/board/components/EventPostCard'
import BoardStateBlock from '@/features/board/components/BoardStateBlock'
import { isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 게시판 글 목록 `/boards/:slug` (FC-202 — 승인 화면 B).
 *
 * ★ 게시판 메타(`useBoard`)로 쓰기정책·댓글허용·유형을 얻어 **표시 제어**한다(글쓰기 버튼·댓글수
 *   배지·이벤트 배너 변주). 인가 권위는 서버(§1.2).
 * ★ 커서 무한스크롤(`usePostList` + `useInfiniteScroll`). 정렬(고정 우선·최신순)은 서버가 한다.
 * ★ 상단 게시판 탭으로 게시판을 오간다(진입은 허브지만 목록 간 이동 편의).
 */
const PAGE_SIZE = 20

export default function BoardPostListPage() {
    const { slug = '' } = useParams()

    const boardQuery = useBoard(slug)
    const boardsQuery = useBoards()
    const {
        data,
        isPending,
        isError,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
    } = usePostList(slug, PAGE_SIZE)

    const posts = useMemo(
        () => data?.pages.flatMap((page) => page.content) ?? [],
        [data],
    )

    const isAuthenticated = useIsAuthenticated()
    const isAdmin = useIsAdmin()

    const board = boardQuery.data
    const showWrite =
        board !== undefined && canWriteBoard(board, isAuthenticated, isAdmin)
    const eventLayout = board !== undefined && isEventBoard(board.boardType)

    const sentinelRef = useInfiniteScroll({
        hasNext: Boolean(hasNextPage),
        isFetching,
        onLoadMore: () => void fetchNextPage(),
    })

    // 게시판 자체가 없음(slug 오타·비활성) — 목록 대신 안내.
    const boardNotFound =
        boardQuery.isError &&
        isApiError(boardQuery.error) &&
        boardQuery.error.code === ERROR_CODES.BOARD_001

    if (boardNotFound) {
        return (
            <BoardStateBlock
                icon={TbSearchOff}
                title="게시판을 찾을 수 없어요"
                description="주소가 바뀌었거나 닫힌 게시판일 수 있어요."
                action={
                    <Link
                        to={paths.boards}
                        className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                    >
                        게시판 목록으로
                    </Link>
                }
            />
        )
    }

    return (
        <div className="flex flex-col gap-4">
            {/* 허브 복귀 — 게시판 목록(허브)으로 */}
            <Link
                to={paths.boards}
                className="inline-flex w-max items-center gap-1 text-sm font-semibold text-gray-500 hover:text-navy"
            >
                <TbChevronLeft aria-hidden className="size-4" />
                게시판
            </Link>

            {/* 게시판 탭 — 게시판 간 이동 */}
            {boardsQuery.data && boardsQuery.data.length > 0 && (
                <div className="flex w-max max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
                    {boardsQuery.data.map((tab) => {
                        const active = tab.slug === slug
                        return (
                            <Link
                                key={tab.slug}
                                to={boardPath(tab.slug)}
                                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                                    active
                                        ? 'bg-navy text-white'
                                        : 'text-gray-500 hover:text-navy'
                                }`}
                            >
                                {tab.name}
                            </Link>
                        )
                    })}
                </div>
            )}

            {/* 헤더 + 글쓰기 */}
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {board?.name ?? '게시판'}
                    </h1>
                    {board?.description && (
                        <p className="mt-1 text-sm text-gray-500">
                            {board.description}
                        </p>
                    )}
                </div>
                {showWrite ? (
                    <Link
                        to={boardWritePath(slug)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-deep"
                    >
                        <TbPencilPlus aria-hidden className="size-4" />
                        글쓰기
                    </Link>
                ) : (
                    board &&
                    writeDisabledLabel(board) && (
                        <span className="text-xs font-medium text-gray-400">
                            {writeDisabledLabel(board)}
                        </span>
                    )
                )}
            </header>

            {/* 로딩 */}
            {isPending && (
                <div className="overflow-hidden rounded-xl border border-line bg-surface">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3.5 border-b border-line px-4 py-3.5 last:border-b-0"
                        >
                            <div className="size-14 shrink-0 animate-pulse rounded-lg bg-gray-100" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3.5 w-2/3 animate-pulse rounded bg-gray-100" />
                                <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 에러 */}
            {!isPending && isError && posts.length === 0 && (
                <BoardStateBlock
                    icon={TbAlertTriangle}
                    title="게시글을 불러오지 못했어요"
                    description="잠시 후 다시 시도해 주세요."
                    action={
                        <button
                            type="button"
                            className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                            onClick={() => void refetch()}
                        >
                            다시 시도
                        </button>
                    }
                />
            )}

            {/* 빈 목록 */}
            {!isPending && !isError && posts.length === 0 && (
                <BoardStateBlock
                    icon={TbMessageOff}
                    title="아직 게시글이 없어요"
                    description={
                        showWrite
                            ? '첫 글을 남겨보세요.'
                            : '새 글이 올라오면 여기에서 볼 수 있어요.'
                    }
                    action={
                        showWrite ? (
                            <Link
                                to={boardWritePath(slug)}
                                className="rounded-lg bg-orange px-4 py-2 text-sm font-bold text-white hover:bg-orange-deep"
                            >
                                글쓰기
                            </Link>
                        ) : undefined
                    }
                />
            )}

            {/* 부분 실패(이미 받은 목록 유지 + 배너) */}
            {!isPending && isError && posts.length > 0 && (
                <p
                    role="alert"
                    className="rounded-lg bg-danger-subtle px-4 py-2.5 text-sm text-danger"
                >
                    최신 목록을 불러오지 못했어요. 표시된 글은 이전 결과예요.
                </p>
            )}

            {/* 목록 — 이벤트는 배너 그리드, 그 외는 카드 리스트 */}
            {posts.length > 0 &&
                (eventLayout ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {posts.map((post) => (
                            <EventPostCard
                                key={post.postPublicId}
                                slug={slug}
                                post={post}
                            />
                        ))}
                    </div>
                ) : (
                    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                        {posts.map((post) => (
                            <li key={post.postPublicId}>
                                <PostCard
                                    slug={slug}
                                    post={post}
                                    showComments={board?.allowComments ?? false}
                                />
                            </li>
                        ))}
                    </ul>
                ))}

            {/* 무한스크롤 감시점 */}
            <div ref={sentinelRef} aria-hidden className="h-px" />
            {isFetchingNextPage && (
                <p
                    role="status"
                    className="py-2 text-center text-xs text-gray-400"
                >
                    더 불러오는 중…
                </p>
            )}
        </div>
    )
}
