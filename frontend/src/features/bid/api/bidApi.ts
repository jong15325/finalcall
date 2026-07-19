import { apiClient } from '@/lib/api/client';
import type { OffsetPage } from '@/types/api';
import type { BidSummary } from '@/types/schema';

/**
 * 입찰 이력 조회 (계약 §3.1 `GET /auctions/{auctionPublicId}/bids`).
 *
 * **인증 불요**다(응답이 닉네임 마스킹) — `auth:false` 로 토큰을 붙이지 않는다.
 * 페이징은 **offset** 이다(계약 §1.3 "관리·소규모는 offset 예외" — 경매당 입찰 수는 소규모).
 * 정렬은 서버 고정(`amount desc`)이라 클라이언트가 정렬 파라미터를 만들지 않는다.
 *
 * 경로 세그먼트는 `encodeURIComponent` 로 감싼다 — publicId 는 URL 파라미터를 통해 사용자 입력으로
 * 유입되며, 인코딩하지 않으면 `/`·`?`·`#` 가 경로 구조를 바꾼다(auctionApi 가 세운 관례).
 */
export const BID_PAGE_SIZE = 10;

export function getBids(auctionPublicId: string, page: number): Promise<OffsetPage<BidSummary>> {
  return apiClient.get<OffsetPage<BidSummary>>(
    `/auctions/${encodeURIComponent(auctionPublicId)}/bids`,
    { auth: false, query: { page, size: BID_PAGE_SIZE } },
  );
}
