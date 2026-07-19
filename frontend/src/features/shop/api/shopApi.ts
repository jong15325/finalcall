import { apiClient } from '@/lib/api/client';
import type { CursorPage } from '@/types/api';
import type { ShopSummary } from '@/types/schema';

/**
 * 고정가(shop) 목록 API — 계약 §3.2 `GET /shops`.
 *
 * 홈의 "지금 바로 살 수 있는 것" 섹션이 첫 소비처다(FC-048). 인증 불요라 토큰을 붙이지 않는다.
 * 정렬 화이트리스트는 경매와 다르다 — 고정가는 `price · endAt · createdAt` 3종뿐이고
 * `highestBidAmount` 가 없다(입찰이 없는 판매 유형). 화이트리스트 밖 값은 만들지 않는다.
 *
 * 목록 화면(`/shops`)이 붙을 때 필터·커서를 얹을 자리이며, 지금은 홈이 쓰는 첫 페이지만 정의한다.
 */
export type ShopSortValue = 'price,asc' | 'price,desc' | 'endAt,asc' | 'createdAt,desc';

export interface ShopListQuery {
  sort: ShopSortValue;
  size?: number;
  /** opaque cursor(계약 §1.3). 첫 페이지는 미지정. */
  cursor?: string;
}

export const SHOP_PAGE_SIZE = 20;

export function getShops(query: ShopListQuery): Promise<CursorPage<ShopSummary>> {
  return apiClient.get<CursorPage<ShopSummary>>('/shops', {
    auth: false,
    query: {
      sort: query.sort,
      cursor: query.cursor,
      size: query.size ?? SHOP_PAGE_SIZE,
    },
  });
}
