import { apiClient } from '@/lib/api/client';
import type { CursorPage } from '@/types/api';
import type { AuctionDetail, AuctionSummary } from '@/types/schema';
import type { AuctionFilters, AuctionSortValue } from '../types';

/** 목록 페이지 크기(계약 §1.3 `size`). 4열 그리드 기준 5행. */
export const AUCTION_PAGE_SIZE = 20;

export interface AuctionListQuery extends AuctionFilters {
  sort: AuctionSortValue;
  /** opaque cursor(계약 §1.3). 첫 페이지는 미지정. */
  cursor?: string;
}

/**
 * GET /auctions — 경매 목록(계약 §3.1). 인증 불요라 토큰을 붙이지 않는다(`auth:false`).
 * undefined 파라미터는 client.buildUrl 이 자동 제외하므로 여기서 분기하지 않는다.
 */
export function getAuctions(query: AuctionListQuery): Promise<CursorPage<AuctionSummary>> {
  return apiClient.get<CursorPage<AuctionSummary>>('/auctions', {
    auth: false,
    query: {
      status: query.status,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      element: query.element,
      sort: query.sort,
      cursor: query.cursor,
      size: AUCTION_PAGE_SIZE,
    },
  });
}

/**
 * GET /auctions/{auctionPublicId} — 경매 상세(계약 §3.1). 인증 불요.
 * 404 는 `AUCTION_004` envelope 로 오며 client 가 ApiError 로 정규화한다 — 여기서 삼키지 않는다.
 *
 * 경로 세그먼트는 **항상 `encodeURIComponent` 로 감싼다.** publicId 는 서버 발급 UUID 라 지금은
 * 이스케이프할 문자가 없지만, 이 값은 URL 파라미터를 통해 사용자 입력으로 유입된다 —
 * 인코딩하지 않으면 `/`·`?`·`#` 가 경로 구조를 바꿔 다른 엔드포인트로 새어 나간다.
 * 코드베이스 최초의 경로 보간이므로 여기서 관례를 세운다(이후 경로 보간은 전부 이 형태).
 */
export function getAuction(auctionPublicId: string): Promise<AuctionDetail> {
  return apiClient.get<AuctionDetail>(`/auctions/${encodeURIComponent(auctionPublicId)}`, {
    auth: false,
  });
}
