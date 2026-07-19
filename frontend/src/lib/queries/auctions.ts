import { useQuery } from '@tanstack/react-query'
import { getAuctions } from '@/lib/api/auctions'
import type { AuctionListQuery, AuctionSummary } from '@/lib/api/auctions'
import type { CursorPage } from '@/types/api'

/**
 * 경매 목록 쿼리 (계약 §3.1) — FC-058.
 *
 * ★ 키에 쿼리 객체를 통째로 싣는다 — 홈의 두 섹션(`endAt,asc` · `createdAt,desc`)이 같은
 *   엔드포인트를 다른 정렬로 부르므로, 키가 같으면 한 섹션이 다른 섹션의 캐시를 덮어쓴다.
 */
export const auctionKeys = {
    all: ['auctions'] as const,
    lists: () => [...auctionKeys.all, 'list'] as const,
    list: (query: AuctionListQuery) => [...auctionKeys.lists(), query] as const,
}

/**
 * 경매 목록.
 *
 * ★★ **섹션별 에러 격리의 절반이 여기 있다.** 홈의 두 섹션이 **각자 쿼리를 가지므로**
 *    한쪽이 실패해도 다른 쪽은 자기 데이터로 렌더된다. 한 훅에서 둘을 합쳐 받으면
 *    한 요청의 실패가 두 섹션을 함께 죽인다. 나머지 절반은 각 섹션 컴포넌트가 자기
 *    `isError` 를 자기 자리에서 그리는 것이다.
 *
 * ★ **폴링하지 않는다.** 카운트다운은 `endAt` 에서 파생돼 클라이언트에서 흐르고, 목록 자체는
 *   창 포커스 복귀 시에만 다시 가져온다. 화면에 "N초마다 갱신" 류 문구를 쓰지 마라 — 거짓이다.
 */
export function useAuctionList(query: AuctionListQuery) {
    return useQuery<CursorPage<AuctionSummary>>({
        queryKey: auctionKeys.list(query),
        queryFn: ({ signal }) => getAuctions(query, signal),
        refetchOnWindowFocus: true,
    })
}
