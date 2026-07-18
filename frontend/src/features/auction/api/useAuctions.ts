import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKey } from '@/lib/api/queryKeys';
import { getAuctions } from './auctionApi';
import type { AuctionListQuery } from './auctionApi';

/** 쿼리 키 — 국소 생성(프론트 CLAUDE.md [4]). 필터·정렬이 키에 들어가 변경 시 커서가 자동 초기화된다. */
export const auctionKeys = {
  list: (query: Omit<AuctionListQuery, 'cursor'>) => queryKey('auction', 'list', query),
};

/**
 * GET /auctions cursor 무한 목록(계약 §1.3).
 * `nextCursor` 는 정렬·필터에 종속된 keyset 이므로 조건이 바뀌면 처음부터 다시 받아야 한다 —
 * 조건을 queryKey 에 넣어 react-query 가 그 초기화를 담당하게 한다.
 */
export function useAuctionList(query: Omit<AuctionListQuery, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: auctionKeys.list(query),
    queryFn: ({ pageParam }) => getAuctions({ ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? (lastPage.nextCursor ?? undefined) : undefined),
    // 마감 카운트다운이 도는 실시간 목록이라 기본(30s)보다 짧게 둔다. 폴링은 하지 않는다(U-006 폴링은 상세 소관).
    staleTime: 15_000,
  });
}
