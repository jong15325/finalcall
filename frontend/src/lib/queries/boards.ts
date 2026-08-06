import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import {
    createPost,
    deletePost,
    getBoard,
    getBoards,
    getPost,
    getPosts,
    updatePost,
} from '@/lib/api/boards'
import type {
    BoardResponse,
    CreatePostResponse,
    PostDetailResponse,
    PostSummary,
    PostWriteRequest,
} from '@/lib/api/boards'
import type { CursorPage } from '@/types/api'

/**
 * 게시판 쿼리 (계약 §6) — FC-202.
 *
 * ★ 키를 게시판 레지스트리(`registry`)·게시판 단건(`board`)·글 목록(`posts`)·글 상세(`post`)로
 *   가른다 — 글을 무효화해도 레지스트리·다른 게시판 목록이 딸려가지 않도록 반경을 좁힌다
 *   (auction 키 분리 선례).
 */
export const boardKeys = {
    all: ['boards'] as const,
    /** 게시판 레지스트리(`GET /boards`) */
    registry: () => [...boardKeys.all, 'registry'] as const,
    /** 게시판 단건(`GET /boards/{slug}`) */
    board: (slug: string) => [...boardKeys.all, 'board', slug] as const,
    /** 글 목록(게시판별 커서) */
    postLists: () => [...boardKeys.all, 'posts'] as const,
    postList: (slug: string, size: number) =>
        [...boardKeys.postLists(), slug, { size }] as const,
    /** 글 상세 */
    postDetails: () => [...boardKeys.all, 'post'] as const,
    postDetail: (slug: string, postPublicId: string) =>
        [...boardKeys.postDetails(), slug, postPublicId] as const,
}

/** 게시판 레지스트리 — 허브·목록 진입에서 게시판 메타(유형·쓰기정책·댓글허용)를 얻는다. */
export function useBoards() {
    return useQuery<BoardResponse[]>({
        queryKey: boardKeys.registry(),
        queryFn: ({ signal }) => getBoards(signal),
        // 게시판 목록은 시드 레지스트리라 자주 바뀌지 않는다 — 잦은 재조회 불요.
        staleTime: 5 * 60 * 1000,
    })
}

/** 게시판 단건 — 목록·작성 화면에서 쓰기정책·댓글허용·표시명을 얻는다. */
export function useBoard(slug: string, enabled = true) {
    return useQuery<BoardResponse>({
        queryKey: boardKeys.board(slug),
        queryFn: ({ signal }) => getBoard(slug, signal),
        staleTime: 5 * 60 * 1000,
        enabled,
    })
}

/**
 * 게시글 목록 커서 무한스크롤(계약 §6.2 · §1.3).
 *
 * ★ `size` 만 키에 싣는다 — `cursor` 는 페이지 파라미터라 react-query 가 따로 나른다(auction 선례).
 * ★ `hasNext` 와 `nextCursor` 를 **둘 다** 봐서 커서 null 무한루프를 끊는다(계약 §1.3).
 */
export function usePostList(slug: string, size = 20) {
    return useInfiniteQuery<CursorPage<PostSummary>>({
        queryKey: boardKeys.postList(slug, size),
        queryFn: ({ pageParam, signal }) =>
            getPosts(
                slug,
                { size, cursor: (pageParam as string | null) ?? undefined },
                signal,
            ),
        initialPageParam: null,
        getNextPageParam: (lastPage) =>
            lastPage.hasNext && lastPage.nextCursor
                ? lastPage.nextCursor
                : null,
        refetchOnWindowFocus: false,
    })
}

/**
 * 게시글 상세(계약 §6.2).
 *
 * ★★ **창 포커스 재조회를 끈다.** 상세 조회는 서버에서 `viewCount` 를 매번 원자 증가시키고
 *    디둡이 없다(§6.2). 켜 두면 탭 전환마다 조회수가 부풀어 카운터가 거짓이 된다.
 */
export function usePostDetail(slug: string, postPublicId: string) {
    return useQuery<PostDetailResponse>({
        queryKey: boardKeys.postDetail(slug, postPublicId),
        queryFn: ({ signal }) => getPost(slug, postPublicId, signal),
        refetchOnWindowFocus: false,
    })
}

/**
 * 게시글 작성(계약 §6.2).
 * ★ 성공 시 해당 게시판 글 목록을 무효화해 새 글이 목록에 등장하게 한다. 다른 게시판·레지스트리는
 *   건드리지 않는다(반경 최소). 상세로의 이동은 호출부가 응답 `postPublicId` 로 처리한다.
 */
export function useCreatePost(slug: string) {
    const queryClient = useQueryClient()

    return useMutation<CreatePostResponse, Error, PostWriteRequest>({
        mutationFn: (body) => createPost(slug, body),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: boardKeys.postLists(),
            })
        },
    })
}

/**
 * 게시글 수정(계약 §6.2). 성공 응답 204(본문 없음).
 * ★ 무효화 반경 = 이 글 상세 + 게시판 글 목록(제목·썸네일이 목록에 실린다).
 */
export function useUpdatePost(slug: string, postPublicId: string) {
    const queryClient = useQueryClient()

    return useMutation<void, Error, PostWriteRequest>({
        mutationFn: (body) => updatePost(slug, postPublicId, body),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: boardKeys.postDetail(slug, postPublicId),
            })
            void queryClient.invalidateQueries({
                queryKey: boardKeys.postLists(),
            })
        },
    })
}

/**
 * 게시글 삭제(soft, 계약 §6.2). 성공 응답 204.
 * ★ 삭제 후 상세 캐시는 제거하고 목록을 무효화한다. 이동(목록 복귀)은 호출부가 처리한다.
 */
export function useDeletePost(slug: string, postPublicId: string) {
    const queryClient = useQueryClient()

    return useMutation<void, Error, void>({
        mutationFn: () => deletePost(slug, postPublicId),
        onSuccess: () => {
            queryClient.removeQueries({
                queryKey: boardKeys.postDetail(slug, postPublicId),
            })
            void queryClient.invalidateQueries({
                queryKey: boardKeys.postLists(),
            })
        },
    })
}
