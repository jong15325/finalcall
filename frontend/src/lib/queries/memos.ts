import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import {
    deleteMemo,
    getMemo,
    getReceivedMemos,
    getSentMemos,
    getUnreadMemoCount,
    sendMemo,
} from '@/lib/api/memos'
import { useIsAuthenticated } from '@/store/authStore'
import type {
    MemoResponse,
    MemoSummary,
    SendMemoRequest,
    SendMemoResponse,
    UnreadMemoCountResponse,
} from '@/lib/api/memos'
import type { CursorPage } from '@/types/api'

/**
 * 메모/쪽지 쿼리·변이 (계약 §2.6) — FC-172.
 *
 * ★ **키 계층**: 발신은 보낸함을, 삭제는 양쪽 박스+미열람 수를 무효화한다. 읽음 전이는 서버가
 *   상세 GET 에서 1회 수행하므로, 미열람 받은 쪽지를 열 때 클라가 **낙관적으로** 받은함 항목의
 *   `isRead` 와 미열람 카운트를 먼저 갱신한다(리페치 깜빡임 없이 목록·뱃지 즉시 반영).
 * ★ 전 쿼리 `enabled: isAuthed` — 인증 필요 엔드포인트라 비로그인에서 401→refresh 회전을 헛돌게
 *   하지 않는다(`useMyOrders`·`useMe` 와 같은 태도).
 */
export const memoKeys = {
    all: ['memos'] as const,
    received: () => [...memoKeys.all, 'received'] as const,
    sent: () => [...memoKeys.all, 'sent'] as const,
    unread: () => [...memoKeys.all, 'unread'] as const,
    detail: (id: string) => [...memoKeys.all, 'detail', id] as const,
}

/** 받은함 — cursor 무한스크롤(계약 §1.3 · §2.6). */
export function useReceivedMemos() {
    const isAuthed = useIsAuthenticated()

    return useInfiniteQuery<CursorPage<MemoSummary>>({
        queryKey: memoKeys.received(),
        queryFn: ({ pageParam, signal }) =>
            getReceivedMemos(
                { cursor: (pageParam as string | null) ?? undefined },
                signal,
            ),
        initialPageParam: null,
        getNextPageParam: (lastPage) =>
            lastPage.hasNext && lastPage.nextCursor
                ? lastPage.nextCursor
                : null,
        enabled: isAuthed,
        refetchOnWindowFocus: false,
    })
}

/** 보낸함 — cursor 무한스크롤. */
export function useSentMemos() {
    const isAuthed = useIsAuthenticated()

    return useInfiniteQuery<CursorPage<MemoSummary>>({
        queryKey: memoKeys.sent(),
        queryFn: ({ pageParam, signal }) =>
            getSentMemos(
                { cursor: (pageParam as string | null) ?? undefined },
                signal,
            ),
        initialPageParam: null,
        getNextPageParam: (lastPage) =>
            lastPage.hasNext && lastPage.nextCursor
                ? lastPage.nextCursor
                : null,
        enabled: isAuthed,
        refetchOnWindowFocus: false,
    })
}

/**
 * 미열람 개수(뱃지). 헤더·사이드바·하단 내비가 공유(react-query 가 키로 dedupe).
 * `staleTime` 을 짧게 둬 다른 화면 전환 시 과도한 리페치를 줄인다.
 */
export function useUnreadMemoCount() {
    const isAuthed = useIsAuthenticated()

    return useQuery<UnreadMemoCountResponse>({
        queryKey: memoKeys.unread(),
        queryFn: ({ signal }) => getUnreadMemoCount(signal),
        enabled: isAuthed,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
    })
}

/**
 * 메모 상세(+서버 읽음 전이). `memoPublicId` 가 없으면(선택 없음) 비활성.
 * ★ 상세 GET 이 서버에서 미열람 수신 메모를 읽음으로 전이시킨다 — 목록·뱃지 반영은 호출부가
 *   `markMemoReadOptimistic` 로 선반영한다(리페치 없이).
 */
export function useMemoDetail(memoPublicId: string | null) {
    const isAuthed = useIsAuthenticated()

    return useQuery<MemoResponse>({
        queryKey: memoKeys.detail(memoPublicId ?? ''),
        queryFn: ({ signal }) => getMemo(memoPublicId as string, signal),
        enabled: isAuthed && memoPublicId !== null,
        refetchOnWindowFocus: false,
    })
}

/**
 * 미열람 받은 쪽지를 열 때 목록·뱃지를 **낙관적으로** 읽음 처리한다(서버 전이를 선반영).
 * 서버 GET 이 실제 전이하므로 재조회 없이 일치한다. 이미 읽음이면 no-op.
 */
export function markMemoReadOptimistic(
    queryClient: QueryClient,
    memoPublicId: string,
): void {
    queryClient.setQueryData<InfiniteData<CursorPage<MemoSummary>>>(
        memoKeys.received(),
        (old) => {
            if (!old) return old
            let changed = false
            const pages = old.pages.map((page) => ({
                ...page,
                content: page.content.map((memo) => {
                    if (memo.memoPublicId === memoPublicId && !memo.isRead) {
                        changed = true
                        return { ...memo, isRead: true }
                    }
                    return memo
                }),
            }))
            return changed ? { ...old, pages } : old
        },
    )
    queryClient.setQueryData<UnreadMemoCountResponse>(
        memoKeys.unread(),
        (old) => (old ? { count: Math.max(0, old.count - 1) } : old),
    )
}

/**
 * 발신 (`POST /me/memos`). 성공 시 보낸함·미열람 수를 무효화한다(내가 보낸 쪽지가 보낸함에 추가).
 * 실패는 호출부가 `error` 로 받아 code 로 문구를 낸다(`memoErrors.ts`, 원문 미노출).
 */
export function useSendMemo() {
    const queryClient = useQueryClient()

    return useMutation<SendMemoResponse, Error, SendMemoRequest>({
        mutationFn: (body) => sendMemo(body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: memoKeys.sent() })
        },
    })
}

/**
 * 삭제 (`DELETE /me/memos/{id}`, 204). soft delete 가 **양쪽 박스에서 사라지게** 하므로
 * 받은함·보낸함·미열람 수를 모두 무효화한다(§2.6 단일 플래그).
 */
export function useDeleteMemo() {
    const queryClient = useQueryClient()

    return useMutation<void, Error, string>({
        mutationFn: (memoPublicId) => deleteMemo(memoPublicId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: memoKeys.received() })
            queryClient.invalidateQueries({ queryKey: memoKeys.sent() })
            queryClient.invalidateQueries({ queryKey: memoKeys.unread() })
        },
    })
}
