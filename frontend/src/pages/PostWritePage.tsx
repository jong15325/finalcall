import { Link, useNavigate, useParams } from 'react-router'
import { TbAlertTriangle, TbLock, TbSearchOff } from 'react-icons/tb'
import { boardPath, boardPostPath } from '@/app/paths'
import {
    useBoard,
    useCreatePost,
    usePostDetail,
    useUpdatePost,
} from '@/lib/queries/boards'
import { useIsAdmin } from '@/store/authStore'
import { canWriteBoard } from '@/features/board/lib/boardMeta'
import { boardWriteErrorMessage } from '@/features/board/lib/boardErrors'
import PostForm from '@/features/board/components/PostForm'
import BoardStateBlock from '@/features/board/components/BoardStateBlock'
import { isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'
import type { BoardResponse } from '@/lib/api/boards'

/**
 * 게시글 작성/수정 (FC-202 — 승인 화면 D). `/boards/:slug/write`(작성)·`/boards/:slug/:postId/edit`(수정).
 *
 * ★ 이 라우트는 `ProtectedRoute`(로그인 필수) 아래에 둔다. 게시판별 쓰기정책·본인여부는 추가로
 *   표시 제어한다(관리자 전용 게시판·타인 글). **인가 권위는 서버**(§1.2) — 여기선 미리 가릴 뿐.
 * ★ 작성/수정을 훅 분기 없이 **별도 뷰**로 가른다(usePostDetail 을 작성 시 헛돌리지 않게).
 */
export default function PostWritePage() {
    const { slug = '', postId } = useParams()

    return postId ? (
        <EditPostView slug={slug} postId={postId} />
    ) : (
        <CreatePostView slug={slug} />
    )
}

/** 권한 없음 안내(관리자 전용 게시판 등). */
function DeniedBlock({ slug }: { slug: string }) {
    return (
        <BoardStateBlock
            icon={TbLock}
            title="이 게시판에 글을 쓸 권한이 없어요"
            description="관리자만 작성할 수 있는 게시판일 수 있어요."
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

function WriteHeader({ board }: { board: BoardResponse }) {
    return (
        <header className="mb-4">
            <nav
                aria-label="위치"
                className="mb-1 flex items-center gap-1.5 text-xs text-content-subtle"
            >
                <Link to={boardPath(board.slug)} className="hover:text-brand-structure">
                    {board.name}
                </Link>
                <span aria-hidden>/</span>
                <span>글쓰기</span>
            </nav>
            <h1 className="text-xl font-bold text-content-fg">글쓰기</h1>
        </header>
    )
}

/* ── 작성 ─────────────────────────────────────────────────────────────────── */
function CreatePostView({ slug }: { slug: string }) {
    const navigate = useNavigate()
    const boardQuery = useBoard(slug)
    const isAdmin = useIsAdmin()
    const createMutation = useCreatePost(slug)
    if (boardQuery.isPending) return <FormSkeleton />

    const boardNotFound =
        boardQuery.isError &&
        isApiError(boardQuery.error) &&
        boardQuery.error.code === ERROR_CODES.BOARD_001
    if (boardNotFound) {
        return (
            <BoardStateBlock
                icon={TbSearchOff}
                title="게시판을 찾을 수 없어요"
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

    if (boardQuery.isError || !boardQuery.data) {
        return (
            <BoardStateBlock
                icon={TbAlertTriangle}
                title="게시판을 불러오지 못했어요"
                description="잠시 후 다시 시도해 주세요."
            />
        )
    }

    const board = boardQuery.data
    // 로그인 상태는 ProtectedRoute 가 보장 → isAuthenticated=true.
    if (!canWriteBoard(board, true, isAdmin)) {
        return <DeniedBlock slug={slug} />
    }

    return (
        <div className="mx-auto w-full max-w-3xl">
            <WriteHeader board={board} />
            <PostForm
                board={board}
                submitLabel="등록"
                isSubmitting={createMutation.isPending}
                errorMessage={
                    createMutation.isError
                        ? boardWriteErrorMessage(createMutation.error)
                        : null
                }
                onCancel={() => navigate(boardPath(slug))}
                onSubmit={(body) =>
                    createMutation.mutate(body, {
                        onSuccess: (result) =>
                            navigate(boardPostPath(slug, result.postPublicId)),
                    })
                }
            />
        </div>
    )
}

/* ── 수정 ─────────────────────────────────────────────────────────────────── */
function EditPostView({ slug, postId }: { slug: string; postId: string }) {
    const navigate = useNavigate()
    const boardQuery = useBoard(slug)
    const postQuery = usePostDetail(slug, postId)
    const updateMutation = useUpdatePost(slug, postId)
    if (boardQuery.isPending || postQuery.isPending) return <FormSkeleton />

    const postNotFound =
        postQuery.isError &&
        isApiError(postQuery.error) &&
        postQuery.error.code === ERROR_CODES.POST_001
    if (postNotFound) {
        return (
            <BoardStateBlock
                icon={TbSearchOff}
                title="게시글을 찾을 수 없어요"
                description="이미 삭제됐을 수 있어요."
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

    if (
        boardQuery.isError ||
        !boardQuery.data ||
        postQuery.isError ||
        !postQuery.data
    ) {
        return (
            <BoardStateBlock
                icon={TbAlertTriangle}
                title="게시글을 불러오지 못했어요"
                description="잠시 후 다시 시도해 주세요."
            />
        )
    }

    const board = boardQuery.data
    const post = postQuery.data
    // 본인·관리자만 수정(서버 판정 editable). 아니면 권한 안내.
    if (!post.editable) {
        return <DeniedBlock slug={slug} />
    }

    return (
        <div className="mx-auto w-full max-w-3xl">
            <WriteHeader board={board} />
            <PostForm
                board={board}
                initial={{ title: post.title, content: post.content }}
                initialImages={[...post.images]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((image) => ({
                        imagePublicId: image.imagePublicId,
                        url: image.url,
                    }))}
                submitLabel="수정"
                isSubmitting={updateMutation.isPending}
                errorMessage={
                    updateMutation.isError
                        ? boardWriteErrorMessage(updateMutation.error)
                        : null
                }
                onCancel={() => navigate(boardPostPath(slug, postId))}
                onSubmit={(body) =>
                    updateMutation.mutate(body, {
                        onSuccess: () => navigate(boardPostPath(slug, postId)),
                    })
                }
            />
        </div>
    )
}

function FormSkeleton() {
    return (
        <div className="mx-auto w-full max-w-3xl">
            <div className="mb-4 h-6 w-24 animate-pulse rounded bg-content-soft" />
            <div className="h-96 animate-pulse rounded-2xl border border-content-line bg-content-surface" />
        </div>
    )
}
