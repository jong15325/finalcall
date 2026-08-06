import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import {
    createComment,
    createReply,
    deleteComment,
    getBestComments,
    getComments,
    getReplies,
    toggleReaction,
    updateComment,
} from '@/lib/api/comments'
import { boardKeys } from './boards'
import type {
    CommentResponse,
    CommentSort,
    CreateCommentResponse,
    ReactionResult,
    ReactionType,
    ReplyResponse,
    RootCommentResponse,
} from '@/lib/api/comments'
import type { PostDetailResponse } from '@/lib/api/boards'
import type { OffsetPage } from '@/types/api'
import type { InfiniteData } from '@tanstack/react-query'

/**
 * 댓글 쿼리 (계약 v1.24 §6.3 — EPIC-COMMENT-V2) — FC-210.
 *
 * ★ 키는 게시글 `postPublicId`로 건다(API가 slug 아래 중첩이 아니므로). 상세 화면이 보유한
 *   slug는 비정규화 `commentCount`를 상세 캐시에 반영할 때만 쓴다.
 * ★ v1.24: 루트 목록 키에 `sort`를 포함한다(정렬마다 별개 캐시) · 답글 목록 키는 루트별로 건다.
 *   무효화는 접두 매칭으로 정렬·루트를 가로질러 한 번에 한다.
 */
export const commentKeys = {
    all: ['comments'] as const,
    lists: () => [...commentKeys.all, 'list'] as const,
    /** 루트 목록(정렬별). 접두 `[...lists(), postPublicId]`로 전 정렬 일괄 무효화. */
    list: (postPublicId: string, sort: CommentSort) =>
        [...commentKeys.lists(), postPublicId, sort] as const,
    replyLists: () => [...commentKeys.all, 'replies'] as const,
    /** 답글 목록(루트별). 접두 `[...replyLists(), postPublicId]`로 글의 전 스레드 무효화. */
    replies: (postPublicId: string, rootCommentPublicId: string) =>
        [...commentKeys.replyLists(), postPublicId, rootCommentPublicId] as const,
    /** BEST 댓글(글별). `commentKeys.all` 접두 아래라 반응 낙관 패치가 함께 훑는다(정합). */
    best: (postPublicId: string) =>
        [...commentKeys.all, 'best', postPublicId] as const,
}

const COMMENT_PAGE_SIZE = 20

/**
 * "더 있는가" 판정 — offset 흔들림 방지로 **받은 건수 vs `totalElements`**로 센다
 * (`useAuctionBids`·구 `useComments` 선례). `page`/`totalPages` 산술을 쓰지 않는다.
 */
function nextOffsetPageParam<T>(
    lastPage: OffsetPage<T>,
    allPages: OffsetPage<T>[],
): number | null {
    const loaded = allPages.reduce((sum, page) => sum + page.content.length, 0)
    return loaded < lastPage.totalElements ? allPages.length : null
}

/**
 * 루트 댓글 목록(계약 §6.3 — offset·정렬). `sort` 기본 `LATEST`(최신순)는 호출부가 준다.
 * tombstone 루트도 포함돼 오며(§13.4) 렌더에서 `deleted`로 분기한다.
 */
export function useComments(postPublicId: string, sort: CommentSort) {
    return useInfiniteQuery<OffsetPage<RootCommentResponse>>({
        queryKey: commentKeys.list(postPublicId, sort),
        queryFn: ({ pageParam, signal }) =>
            getComments(
                postPublicId,
                { page: pageParam as number, size: COMMENT_PAGE_SIZE, sort },
                signal,
            ),
        initialPageParam: 0,
        getNextPageParam: nextOffsetPageParam,
        refetchOnWindowFocus: false,
    })
}

/**
 * BEST 댓글(계약 §6.3, §13.3 — 공감 상위 고정 랭킹·param 없음). 임계 미달이면 빈 배열.
 *
 * ★ 캐시 데이터 = `RootCommentResponse[]`(응답의 `comments`만 보관) — 반응 낙관 패치가 훑는
 *   형상(배열)을 단순하게 유지한다. 페이지 진입 시 fresh, 반응은 카운트만 낙관 반영한다
 *   (BEST 멤버십/순서 변화는 다음 자연 refetch에 반영 — 즉시 재조회 시 항목 튐 방지).
 */
export function useBestComments(postPublicId: string) {
    return useQuery<RootCommentResponse[]>({
        queryKey: commentKeys.best(postPublicId),
        queryFn: async ({ signal }) => {
            const result = await getBestComments(postPublicId, signal)
            return result.comments
        },
        refetchOnWindowFocus: false,
    })
}

/**
 * 답글 목록(계약 §6.3 — offset·`id asc` 고정). **지연 로딩** — 펼쳤을 때만 `enabled`.
 * 삭제 답글은 서버가 배제하고(§13.4), 활성 답글만 시간순으로 온다.
 */
export function useReplies(
    postPublicId: string,
    rootCommentPublicId: string,
    enabled: boolean,
) {
    return useInfiniteQuery<OffsetPage<ReplyResponse>>({
        queryKey: commentKeys.replies(postPublicId, rootCommentPublicId),
        queryFn: ({ pageParam, signal }) =>
            getReplies(
                postPublicId,
                rootCommentPublicId,
                { page: pageParam as number, size: COMMENT_PAGE_SIZE },
                signal,
            ),
        initialPageParam: 0,
        getNextPageParam: nextOffsetPageParam,
        enabled,
        refetchOnWindowFocus: false,
    })
}

/**
 * 상세 캐시의 비정규화 `commentCount`를 증감한다(재조회 없이).
 *
 * ★★ **상세를 무효화하지 않는다** — 상세 GET은 서버에서 `viewCount`를 매번 올리므로(디둡 없음,
 *    §6.2) 댓글 하나 달 때마다 재조회하면 조회수가 부풀어 거짓이 된다. count만 로컬 보정한다.
 *    계약상 `comment_count`는 루트+답글 **총계**라 답글 작성/삭제도 ±1 대상이다(§13.1·§13.4).
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

/** 글의 루트 목록(전 정렬) 무효화 — 접두 매칭. */
function invalidateRootLists(
    queryClient: ReturnType<typeof useQueryClient>,
    postPublicId: string,
) {
    void queryClient.invalidateQueries({
        queryKey: [...commentKeys.lists(), postPublicId],
    })
}

/** 글의 답글 스레드(전 루트) 무효화 — 접두 매칭. */
function invalidateReplyThreads(
    queryClient: ReturnType<typeof useQueryClient>,
    postPublicId: string,
) {
    void queryClient.invalidateQueries({
        queryKey: [...commentKeys.replyLists(), postPublicId],
    })
}

/**
 * 글의 BEST 랭킹 무효화 — **내용·존재가 바뀌는 수정/삭제에서만** 부른다.
 * BEST 쿼리는 `refetchOnWindowFocus:false`라 자연 refetch가 없어, 수정하면 옛 본문이,
 * 삭제하면 계약상 제외돼야 할 댓글이 골드 섹션에 잔류한다(§6.3 "삭제·tombstone 제외"). 반응
 * 토글은 재정렬 튐 방지로 무효화하지 않는다(카운트만 낙관 반영) — 여기서 부르지 않는다.
 */
function invalidateBest(
    queryClient: ReturnType<typeof useQueryClient>,
    postPublicId: string,
) {
    void queryClient.invalidateQueries({
        queryKey: commentKeys.best(postPublicId),
    })
}

/**
 * 루트 댓글 작성(계약 §6.3).
 * ★ 무효화·보정 = 이 글 루트 목록(새 댓글 반영) + 상세 `commentCount` +1(로컬) +
 *   글 목록 카드 카운트. 상세는 무효화하지 않는다(조회수 부풀림 방지).
 */
export function useCreateComment(slug: string, postPublicId: string) {
    const queryClient = useQueryClient()

    return useMutation<CreateCommentResponse, Error, { content: string }>({
        mutationFn: (body) => createComment(postPublicId, body),
        onSuccess: () => {
            invalidateRootLists(queryClient, postPublicId)
            bumpCommentCount(queryClient, slug, postPublicId, +1)
            void queryClient.invalidateQueries({
                queryKey: boardKeys.postLists(),
            })
        },
    })
}

/**
 * 답글 작성(계약 §6.3, §13.1).
 * ★ 대상 `targetCommentPublicId`(루트 or 답글)로 POST — 평탄화·멘션은 서버가 결정한다.
 * ★ 무효화·보정 = 루트 스레드(새 답글) + 루트 목록(루트 `replyCount` +1 반영) +
 *   상세 `commentCount` +1(답글도 총계 포함) + 글 목록 카드 카운트.
 */
export function useCreateReply(
    slug: string,
    postPublicId: string,
    rootCommentPublicId: string,
) {
    const queryClient = useQueryClient()

    return useMutation<
        CreateCommentResponse,
        Error,
        { targetCommentPublicId: string; content: string }
    >({
        mutationFn: ({ targetCommentPublicId, content }) =>
            createReply(postPublicId, targetCommentPublicId, { content }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: commentKeys.replies(postPublicId, rootCommentPublicId),
            })
            invalidateRootLists(queryClient, postPublicId)
            bumpCommentCount(queryClient, slug, postPublicId, +1)
            void queryClient.invalidateQueries({
                queryKey: boardKeys.postLists(),
            })
        },
    })
}

/**
 * 댓글·답글 수정(계약 §6.3). 내용만 바뀌므로 개수 보정 없이 목록·스레드만 무효화한다.
 * ★ 대상이 루트인지 답글인지 호출부가 구분하지 않아도 되도록 둘 다 무효화한다(접두 매칭).
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
            invalidateRootLists(queryClient, postPublicId)
            invalidateReplyThreads(queryClient, postPublicId)
            // 루트가 BEST에 올라 있으면 수정 본문이 골드 카드에도 반영돼야 한다(중복 노출 정합).
            // 대상이 답글이면 BEST 무관하나, 훅은 루트/답글을 구분하지 않고 best refetch는 무해하다.
            invalidateBest(queryClient, postPublicId)
        },
    })
}

/**
 * 댓글·답글 삭제(soft, 계약 §6.3, §13.4).
 * ★ 루트 삭제(활성 답글 有→tombstone/無→배제)·답글 삭제(배제) 모두 `commentCount` −1이라
 *   호출부 구분 없이 −1 보정한다. 루트 목록·답글 스레드 무효화 + 글 목록 카드 카운트.
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
            invalidateRootLists(queryClient, postPublicId)
            invalidateReplyThreads(queryClient, postPublicId)
            bumpCommentCount(queryClient, slug, postPublicId, -1)
            // 삭제된 루트는 BEST에서 제외돼야 한다(§6.3) — best 쿼리는 자연 refetch가 없어 명시 무효화.
            // 답글 삭제는 BEST 무관하나 훅이 대상을 구분하지 않고 best refetch는 무해하다.
            invalidateBest(queryClient, postPublicId)
            void queryClient.invalidateQueries({
                queryKey: boardKeys.postLists(),
            })
        },
    })
}

/* ── 공감/비공감 토글 (낙관적 업데이트, 계약 §6.3·§13.2) — FC-211 ────────── */

/** 반응 관련 필드만 담은 부분 형상 — 낙관적 패치·서버 권위 반영 공통. */
type ReactionState = Pick<
    CommentResponse,
    'likeCount' | 'dislikeCount' | 'myReaction'
>

/**
 * 토글 규칙(계약 §13.2 표)을 현재 상태에 적용한 다음 반응 상태를 계산한다(순수).
 * 등록(무→해당)·전환(LIKE↔DISLIKE)·취소(같은 타입 재요청→null)를 카운트 델타와 함께 반영한다.
 */
function nextReactionState(
    current: ReactionState,
    type: ReactionType,
): ReactionState {
    let { likeCount, dislikeCount } = current
    // 기존 반응 철회(있으면 해당 카운트 −1)
    if (current.myReaction === 'LIKE') likeCount -= 1
    else if (current.myReaction === 'DISLIKE') dislikeCount -= 1

    // 같은 타입 재요청이면 취소(철회만), 아니면 새 타입 등록(+1)
    const canceled = current.myReaction === type
    const myReaction = canceled ? null : type
    if (!canceled) {
        if (type === 'LIKE') likeCount += 1
        else dislikeCount += 1
    }

    return {
        likeCount: Math.max(0, likeCount),
        dislikeCount: Math.max(0, dislikeCount),
        myReaction,
    }
}

/** comments 하위 캐시가 갖는 두 형상 — infinite 목록/스레드, BEST 배열. */
type CommentCache =
    | InfiniteData<OffsetPage<CommentResponse>>
    | CommentResponse[]

/**
 * comments 캐시 전체(루트 목록 전 정렬 + 답글 스레드 전 루트 + **BEST**)를 가로질러 대상 댓글
 * 1건의 반응 필드를 patcher로 교체한다. 대상이 루트·답글·BEST 어디에 있든 접두 `commentKeys.all`을
 * 스캔한다 — BEST(배열)와 목록(infinite pages) 두 형상을 모두 처리하고, 같은 `commentPublicId`가
 * 여러 캐시에 중복(BEST↔목록 중복 노출)돼도 모두 같은 값으로 갱신해 정합을 유지한다.
 * `replyCount`·`mentionedNickname` 등 항목 고유 필드는 스프레드로 보존한다.
 */
function patchReactionInCaches(
    queryClient: ReturnType<typeof useQueryClient>,
    commentPublicId: string,
    patcher: (current: ReactionState) => ReactionState,
) {
    const patchItem = <T extends CommentResponse>(item: T): T =>
        item.commentPublicId === commentPublicId
            ? { ...item, ...patcher(item) }
            : item

    queryClient.setQueriesData<CommentCache>(
        { queryKey: commentKeys.all },
        (data) => {
            if (!data) return data
            // BEST — 배열
            if (Array.isArray(data)) return data.map(patchItem)
            // 목록·답글 — infinite pages
            return {
                ...data,
                pages: data.pages.map((page) => ({
                    ...page,
                    content: page.content.map(patchItem),
                })),
            }
        },
    )
}

/**
 * 공감/비공감 토글(계약 §6.3, §13.2).
 *
 * ★★ **낙관적 업데이트** — 클릭 즉시 규칙(§13.2)대로 카운트·myReaction을 캐시에 반영하고,
 *    실패 시 스냅샷으로 롤백한다. 성공 시 서버 권위 응답(`{ likeCount, dislikeCount, myReaction }`)
 *    으로 확정 동기화한다(동시 반응으로 카운트가 어긋났을 때 교정).
 * ★ **재정렬을 유발하지 않는다** — `LIKES` 정렬 목록에서 반응이 순서에 영향을 주지만 즉시 재조회하면
 *    항목이 튄다. 낙관 반영 + 권위 확정만 하고 무효화는 하지 않는다(다음 자연 refetch에 순서 반영).
 * ★ 대상이 루트·답글 어느 쪽이든 `commentPublicId`로 캐시를 스캔해 패치한다(scope 주입 불필요).
 */
export function useToggleReaction(postPublicId: string) {
    const queryClient = useQueryClient()

    return useMutation<
        ReactionResult,
        Error,
        { commentPublicId: string; type: ReactionType },
        { previous: ReturnType<typeof queryClient.getQueriesData> }
    >({
        mutationFn: ({ commentPublicId, type }) =>
            toggleReaction(postPublicId, commentPublicId, type),
        onMutate: async ({ commentPublicId, type }) => {
            await queryClient.cancelQueries({ queryKey: commentKeys.all })
            const previous = queryClient.getQueriesData({
                queryKey: commentKeys.all,
            })
            patchReactionInCaches(queryClient, commentPublicId, (current) =>
                nextReactionState(current, type),
            )
            return { previous }
        },
        onError: (_error, _variables, context) => {
            // 낙관 반영을 스냅샷으로 되돌린다(권위는 서버 — 실패 시 원상복구).
            context?.previous.forEach(([key, data]) => {
                queryClient.setQueryData(key, data)
            })
        },
        onSuccess: (result, { commentPublicId }) => {
            // 서버 권위값으로 확정(낙관 추정과 실측 카운트 동기화).
            patchReactionInCaches(queryClient, commentPublicId, () => result)
        },
    })
}
