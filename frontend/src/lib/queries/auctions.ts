import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getAuctions } from '@/lib/api/auctions'
import type { AuctionListQuery, AuctionSummary } from '@/lib/api/auctions'
import type { CursorPage } from '@/types/api'

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
