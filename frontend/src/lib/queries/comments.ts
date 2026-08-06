import {
    useInfiniteQuery,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query'
import {
    createComment,
    deleteComment,
    getComments,
    updateComment,
} from '@/lib/api/comments'
import { boardKeys } from './boards'
import type { CommentResponse, CreateCommentResponse } from '@/lib/api/comments'
import type { PostDetailResponse } from '@/lib/api/boards'
import type { OffsetPage } from '@/types/api'

/**
 * 댓글 쿼리 (계약 §6.3) — FC-203.
 *
 * ★ 키는 게시글 `postPublicId` 로 건다(API 가 slug 아래 중첩이 아니므로). 상세 화면이
 *   보유한 slug 는 비정규화 `commentCount` 를 상세 캐시에 반영할 때만 쓴다.
 */
export const commentKeys = {
    all: ['comments'] as const,
    lists: () => [...commentKeys.all, 'list'] as const,
    list: (postPublicId: string) =>
        [...commentKeys.lists(), postPublicId] as const,
}

const COMMENT_PAGE_SIZE = 20

/**
 * 댓글 목록(계약 §6.3 — **offset** 페이징).
 *
 * ★ 입찰 이력(`useAuctionBids`) 선례를 따른다 — "더 있는가"를 `page`/`totalPages` 산술이 아니라
 *   **받은 건수 vs `totalElements`** 로 판정한다(offset 기준 흔들림 방지). `id asc`(작성순).
 */
export function useComments(postPublicId: string) {
    return useInfiniteQuery<OffsetPage<CommentResponse>>({
        queryKey: commentKeys.list(postPublicId),
        queryFn: ({ pageParam, signal }) =>
            getComments(
                postPublicId,
                { page: pageParam as number, size: COMMENT_PAGE_SIZE },
                signal,
            ),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            const loaded = allPages.reduce(
                (sum, page) => sum + page.content.length,
                0,
            )
            return loaded < lastPage.totalElements ? allPages.length : null
        },
        refetchOnWindowFocus: false,
    })
}

/**
 * 상세 캐시의 비정규화 `commentCount` 를 증감한다(재조회 없이).
 *
 * ★★ **상세를 무효화하지 않는다** — 상세 GET 은 서버에서 `viewCount` 를 매번 올리므로(디둡 없음,
 *    §6.2) 댓글 하나 달 때마다 재조회하면 조회수가 부풀어 거짓이 된다. 그래서 count 만 로컬 보정한다.
 */
function bumpCommentCount(
    queryClient: ReturnType<typeof useQueryClient>,
    slug: string,
    postPublicId: string,
    delta: number,
) {
    queryClient.setQueryData<PostDetailResponse>(
        boardKeys.postDetail(slug, postPublicId),
        (previous) =>
            previous
                ? {
                      ...previous,
                      commentCount: Math.max(0, previous.commentCount + delta),
                  }
                : previous,
    )
}

/**
 * 댓글 작성(계약 §6.3).
 * ★ 무효화·보정 반경 = 이 글 댓글 목록(재조회로 새 댓글 반영) + 상세 `commentCount` +1(로컬) +
 *   목록 카드 `commentCount`(글 목록 무효화). 상세는 무효화하지 않는다(조회수 부풀림 방지).
 */
export function useCreateComment(slug: string, postPublicId: string) {
    const queryClient = useQueryClient()

    return useMutation<CreateCommentResponse, Error, { content: string }>({
        mutationFn: (body) => createComment(postPublicId, body),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: commentKeys.list(postPublicId),
            })
            bumpCommentCount(queryClient, slug, postPublicId, +1)
            void queryClient.invalidateQueries({
                queryKey: boardKeys.postLists(),
            })
        },
    })
}

/**
 * 댓글 수정(계약 §6.3). 내용만 바뀌므로 개수 보정 없이 목록만 무효화한다.
 */
export function useUpdateComment(
    postPublicId: string,
    commentPublicId: string,
) {
    const queryClient = useQueryClient()

    return useMutation<void, Error, { content: string }>({
        mutationFn: (body) =>
            updateComment(postPublicId, commentPublicId, body),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: commentKeys.list(postPublicId),
            })
        },
    })
}

/**
 * 댓글 삭제(soft, 계약 §6.3).
 * ★ 목록 무효화 + 상세 `commentCount` −1(로컬) + 글 목록 무효화(카드 카운트).
 */
export function useDeleteComment(
    slug: string,
    postPublicId: string,
    commentPublicId: string,
) {
    const queryClient = useQueryClient()

    return useMutation<void, Error, void>({
        mutationFn: () => deleteComment(postPublicId, commentPublicId),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: commentKeys.list(postPublicId),
            })
            bumpCommentCount(queryClient, slug, postPublicId, -1)
            void queryClient.invalidateQueries({
                queryKey: boardKeys.postLists(),
            })
        },
    })
}
