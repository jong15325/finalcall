import { useInfiniteQuery } from '@tanstack/react-query'
import { getMyOrders } from '@/lib/api/orders'
import { useIsAuthenticated } from '@/store/authStore'
import type { OrderListQuery, OrderSummary } from '@/lib/api/orders'
import type { CursorPage } from '@/types/api'

/**
 * 거래내역 쿼리 (계약 §4.3) — FC-090.
 *
 * ★ **키 계층을 여기서 시작한다.** 즉시구매·낙찰이 새 주문을 만들면(`usePurchaseAuction`)
 *   성공 후 `queryClient.invalidateQueries({ queryKey: orderKeys.lists() })` 로 목록을 갱신한다.
 *   `lists()` 접두로 무효화하면 어느 필터 조합이 열려 있든 함께 새로 가져온다.
 */
export const orderKeys = {
    all: ['orders'] as const,
    /** 목록(필터별 무한스크롤)의 공통 접두 — 무효화 반경 */
    lists: () => [...orderKeys.all, 'list'] as const,
    list: (query: OrderListQuery) => [...orderKeys.lists(), query] as const,
}

/**
 * 내 거래내역 — cursor 무한스크롤(계약 §1.3 · §4.3).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **필터가 바뀌면 커서가 초기화된다 — 코드 한 줄 없이.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `query`(role·sourceType) 가 키에 통째로 실리므로 필터를 바꾸면 **다른 쿼리**가 된다. 이전
 * 커서는 그 키에 딸린 채 남고 새 키는 `initialPageParam`(= 커서 없음)부터 시작한다(경매 목록과
 * 같은 구조 — `useAuctionBrowse` 주). `cursor` 는 `query` 에 넣지 않는다(넣으면 페이지마다 키가
 * 달라져 무한스크롤이 성립하지 않는다).
 *
 * ★ **`enabled: isAuthed`** — 인증 필요 엔드포인트다. 비로그인 상태(세션 만료 직후 등)에서 401 이
 *   refresh 회전을 불필요하게 깨우지 않도록 가드한다(`useMyBalance` 와 같은 태도).
 */
export function useMyOrders(query: OrderListQuery) {
    const isAuthed = useIsAuthenticated()

    return useInfiniteQuery<CursorPage<OrderSummary>>({
        queryKey: orderKeys.list(query),
        queryFn: ({ pageParam, signal }) =>
            getMyOrders(
                { ...query, cursor: (pageParam as string | null) ?? undefined },
                signal,
            ),
        initialPageParam: null,
        /*
         * ★ `hasNext` 와 `nextCursor` 를 **둘 다** 본다(경매 목록과 같은 이유) —
         *   `hasNext=true` 인데 커서가 null 로 오면 첫 페이지를 무한히 다시 받는 루프가 된다.
         */
        getNextPageParam: (lastPage) =>
            lastPage.hasNext && lastPage.nextCursor
                ? lastPage.nextCursor
                : null,
        enabled: isAuthed,
        refetchOnWindowFocus: false,
    })
}
