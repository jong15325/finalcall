import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryKey } from '@/lib/api/queryKeys';
import { isAuctionEnded } from '../lib/auctionStatus';
import { getAuction, getAuctions } from './auctionApi';
import type { AuctionListQuery } from './auctionApi';

/** 쿼리 키 — 국소 생성(프론트 CLAUDE.md [4]). 필터·정렬이 키에 들어가 변경 시 커서가 자동 초기화된다. */
export const auctionKeys = {
  list: (query: Omit<AuctionListQuery, 'cursor'>) => queryKey('auction', 'list', query),
  /**
   * 미리보기 키는 목록과 **분리한다.** 같은 키를 쓰면 `useInfiniteQuery`(pages 구조)와
   * `useQuery`(단일 페이지 구조)가 한 캐시 엔트리를 두고 서로의 데이터를 덮어써 화면이 깨진다.
   */
  preview: (query: Omit<AuctionListQuery, 'cursor'>) => queryKey('auction', 'preview', query),
  detail: (auctionPublicId: string) => queryKey('auction', 'detail', { auctionPublicId }),
};

/**
 * 홈 등에서 쓰는 **첫 페이지 미리보기**(FC-048). 무한스크롤이 아니므로 `useQuery` 다.
 *
 * 카운트다운이 도는 데이터라 `staleTime` 을 짧게 둔다. 홈에서 폴링은 하지 않는다 —
 * 남은 시간은 클라이언트가 `endAt` 으로 계산하므로 초당 갱신에 서버 호출이 필요 없다(U-006).
 */
export function useAuctionPreview(query: Omit<AuctionListQuery, 'cursor'>) {
  return useQuery({
    queryKey: auctionKeys.preview(query),
    queryFn: () => getAuctions(query),
    staleTime: 15_000,
  });
}

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
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? (lastPage.nextCursor ?? undefined) : undefined,
    // 마감 카운트다운이 도는 실시간 목록이라 기본(30s)보다 짧게 둔다. 폴링은 하지 않는다(U-006 폴링은 상세 소관).
    staleTime: 15_000,
  });
}

/** 상세 폴링 주기(U-006). 소프트클로즈 연장·최고가 갱신을 잡을 만큼 짧고, 서버를 때리지 않을 만큼 길게. */
const DETAIL_POLL_MS = 10_000;

/**
 * GET /auctions/{id} 경매 상세.
 *
 * **폴링 전제**(U-006 ACCEPTED · ux-flows [상세]): 최고가·endAt·status 를 주기 갱신한다. 소프트클로즈로
 * endAt 이 연장되면 Countdown 이 그대로 따라간다. **종료 감지 시 폴링을 멈춘다** — 끝난 경매는 더 변하지 않는다.
 * EPIC-BID 가 붙으면 `highestBidAmount`·`bidCount`·`minNextBidAmount` 가 이 폴링을 타고 자동으로 살아난다.
 *
 * 404(`AUCTION_004`)는 QueryClient 기본값이 4xx 재시도를 막아 즉시 실패한다 — 페이지가 전용 상태로 분기한다.
 */
export function useAuctionDetail(auctionPublicId: string) {
  return useQuery({
    queryKey: auctionKeys.detail(auctionPublicId),
    queryFn: () => getAuction(auctionPublicId),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const auction = query.state.data;
      if (!auction) return false;
      return isAuctionEnded(auction) ? false : DETAIL_POLL_MS;
    },
  });
}
