import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import {
    getAuction,
    getAuctionBids,
    getAuctions,
    placeBid,
} from '@/lib/api/auctions'
import { balanceKeys } from './balance'
import type {
    AuctionDetail,
    AuctionListQuery,
    AuctionSummary,
    BidSummary,
    PlaceBidResponse,
} from '@/lib/api/auctions'
import type { CursorPage, OffsetPage } from '@/types/api'

/**
 * 경매 목록 쿼리 (계약 §3.1) — FC-058 → FC-059 에서 네임스페이스 분리.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **홈 프리뷰(`preview`)와 목록 화면(`browse`)의 키를 갈랐다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 종전엔 둘 다 `['auctions','list',query]` 였다. 쿼리 객체가 달라 값이 섞이지는 않았지만
 * **접두 무효화가 둘을 함께 친다** — `invalidateQueries({queryKey:['auctions','list']})`
 * 한 줄이면 목록 필터를 만질 때마다 홈 캐시까지 날아간다. 홈은 다른 화면이고 다른
 * 수명을 갖는다(FC-055 가 react-query 를 유지한 이유가 이 화면별 캐시 수명이다).
 *
 * 갈라 두면 **어느 쪽도 상대의 무효화 반경 안에 없다** — 규칙이 아니라 키 구조로 보장된다.
 */
export const auctionKeys = {
    all: ['auctions'] as const,
    /** 홈 섹션 프리뷰(고정 쿼리 · 소량 · 무한스크롤 없음) */
    previews: () => [...auctionKeys.all, 'preview'] as const,
    preview: (query: AuctionListQuery) =>
        [...auctionKeys.previews(), query] as const,
    /** 경매 목록 화면(사용자 필터 · 커서 페이징) */
    browses: () => [...auctionKeys.all, 'browse'] as const,
    browse: (query: AuctionListQuery) =>
        [...auctionKeys.browses(), query] as const,
    /**
     * 경매 상세 (FC-064).
     *
     * ★ `preview`/`browse` 와 **형제**다 — 상세를 무효화해도 홈 프리뷰가 딸려가지 않는다.
     *   입찰 성공 후 무효화 반경이 어디까지인지는 `usePlaceBid` 주석 참고.
     */
    details: () => [...auctionKeys.all, 'detail'] as const,
    detail: (auctionPublicId: string) =>
        [...auctionKeys.details(), auctionPublicId] as const,
    /** 입찰 이력(경매별 · offset 무한스크롤) */
    bids: (auctionPublicId: string) =>
        [...auctionKeys.detail(auctionPublicId), 'bids'] as const,
}

/**
 * 홈 섹션용 단발 목록.
 *
 * ★★ **섹션별 에러 격리의 절반이 여기 있다.** 홈의 두 섹션이 **각자 쿼리를 가지므로**
 *    한쪽이 실패해도 다른 쪽은 자기 데이터로 렌더된다. 한 훅에서 둘을 합쳐 받으면
 *    한 요청의 실패가 두 섹션을 함께 죽인다.
 *
 * ★ **폴링하지 않는다.** 카운트다운은 `endAt` 에서 파생돼 클라이언트에서 흐르고, 목록 자체는
 *   창 포커스 복귀 시에만 다시 가져온다. 화면에 "N초마다 갱신" 류 문구를 쓰지 마라 — 거짓이다.
 */
export function useAuctionList(query: AuctionListQuery) {
    return useQuery<CursorPage<AuctionSummary>>({
        queryKey: auctionKeys.preview(query),
        queryFn: ({ signal }) => getAuctions(query, signal),
        refetchOnWindowFocus: true,
    })
}

/**
 * 경매 목록 화면용 커서 무한스크롤 (계약 §1.3 — 실시간 목록은 cursor 기본).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **정렬·필터가 바뀌면 커서가 초기화된다 — 코드 한 줄 없이.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `query` 가 키에 통째로 실리므로 정렬을 바꾸면 **다른 쿼리**가 된다. 이전 커서는 그 키에
 * 딸린 채 남고 새 키는 `initialPageParam`(= 커서 없음)부터 시작한다.
 * 커서를 별도 상태로 들고 `useEffect` 로 리셋하는 방식이었다면 **리셋이 한 박자 늦어
 * 옛 정렬의 커서로 새 정렬을 요청**하는 창이 생긴다(서버 커서는 정렬에 종속된 위치라
 * 그 요청의 결과는 조용히 어긋난 페이지다).
 *
 * ★ `cursor` 는 `query` 에 넣지 않는다 — 넣으면 페이지마다 키가 달라져 무한스크롤이
 *   성립하지 않는다. 페이지 파라미터는 react-query 가 따로 나른다.
 */
export function useAuctionBrowse(query: AuctionListQuery) {
    return useInfiniteQuery<CursorPage<AuctionSummary>>({
        queryKey: auctionKeys.browse(query),
        queryFn: ({ pageParam, signal }) =>
            getAuctions(
                { ...query, cursor: (pageParam as string | null) ?? undefined },
                signal,
            ),
        initialPageParam: null,
        /*
         * ★ `hasNext` 와 `nextCursor` 를 **둘 다** 본다(계약 §1.3 CursorPage).
         *   `hasNext=true` 인데 커서가 null 로 오면 같은 첫 페이지를 무한히 다시 받는
         *   루프가 된다 — 서버 버그 하나가 브라우저를 멈추게 하지 않도록 여기서 끊는다.
         */
        getNextPageParam: (lastPage) =>
            lastPage.hasNext && lastPage.nextCursor
                ? lastPage.nextCursor
                : null,
        refetchOnWindowFocus: false,
    })
}

/**
 * 경매 상세 (계약 §3.3) — FC-064.
 *
 * ★ **폴링하지 않는다.** 카운트다운은 `endAt` 에서 파생돼 로컬 시계로 흐르고(`useNow`),
 *   최고가는 창 포커스 복귀·입찰 성공 시에만 다시 가져온다. 화면에 "실시간" 이라 쓰지 마라.
 */
export function useAuctionDetail(auctionPublicId: string) {
    return useQuery<AuctionDetail>({
        queryKey: auctionKeys.detail(auctionPublicId),
        queryFn: ({ signal }) => getAuction(auctionPublicId, signal),
        refetchOnWindowFocus: true,
    })
}

/**
 * 입찰 이력 (계약 §3.1 — **offset** 페이징).
 *
 * ★ 페이지 크기 20. 서버가 `size` 를 100 으로 조용히 자르므로 그 아래에 둔다.
 * ★ **"더 있는가"를 `page`/`totalPages` 산술로 판정하지 않는다** — offset 이 0-기준인지
 *   1-기준인지에 결과가 뒤집힌다. 받은 건수와 `totalElements` 를 비교하면 기준과 무관하다.
 */
const BID_PAGE_SIZE = 20

export function useAuctionBids(auctionPublicId: string, enabled = true) {
    return useInfiniteQuery<OffsetPage<BidSummary>>({
        queryKey: auctionKeys.bids(auctionPublicId),
        queryFn: ({ pageParam, signal }) =>
            getAuctionBids(
                auctionPublicId,
                { page: pageParam as number, size: BID_PAGE_SIZE },
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
        enabled,
        refetchOnWindowFocus: false,
    })
}

/**
 * 입찰 (계약 §3.1 `POST /auctions/{id}/bids`) — FC-064.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **응답의 `endAt` 을 상세 캐시에 즉시 반영한다 — 소프트클로즈 연장 때문이다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 마감 직전 입찰은 서버에서 마감을 미룬다. 그 연장이 반영된 값이 **응답에 실려 온다.**
 * 무효화만 걸고 재조회를 기다리면 그 왕복 동안 카운트다운이 **연장 전 시각으로 0 을 향해
 * 달리고**, 사용자는 자기 입찰이 마감을 밀어냈다는 걸 못 본 채 "마감" 을 본다.
 * `setQueryData` 로 먼저 맞춰두고, 재조회는 뒤에서 서버 값으로 확정한다.
 *
 * ★ **무효화 반경**: 상세(+이력 — 키가 상세 아래라 접두로 함께 걸린다) · 목록(`browses`) ·
 *   잔액(입찰은 게임머니를 홀드한다). **`previews` 는 건드리지 않는다** —
 *   홈은 다른 화면이고 다른 수명이다(FC-059 가 키를 가른 이유).
 */
export function usePlaceBid(auctionPublicId: string) {
    const queryClient = useQueryClient()

    return useMutation<PlaceBidResponse, Error, number>({
        mutationFn: (amount) => placeBid(auctionPublicId, amount),
        onSuccess: (result) => {
            queryClient.setQueryData<AuctionDetail>(
                auctionKeys.detail(auctionPublicId),
                (previous) =>
                    previous
                        ? {
                              ...previous,
                              endAt: result.endAt,
                              highestBidAmount: result.currentHighestAmount,
                          }
                        : previous,
            )

            void queryClient.invalidateQueries({
                queryKey: auctionKeys.detail(auctionPublicId),
            })
            void queryClient.invalidateQueries({
                queryKey: auctionKeys.browses(),
            })
            void queryClient.invalidateQueries({ queryKey: balanceKeys.me() })
        },
    })
}
