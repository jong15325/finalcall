import { useQuery } from '@tanstack/react-query';
import { queryKey } from '@/lib/api/queryKeys';
import { getShops } from './shopApi';
import type { ShopListQuery } from './shopApi';

/** 쿼리 키 — 국소 생성(프론트 CLAUDE.md [4]). */
export const shopKeys = {
  preview: (query: Omit<ShopListQuery, 'cursor'>) => queryKey('shop', 'preview', query),
};

/**
 * 고정가 첫 페이지 미리보기(FC-048 홈). 무한스크롤은 `/shops` 목록 화면 소관이다.
 * 고정가는 카운트다운이 없어 경매보다 덜 휘발적이므로 `staleTime` 을 조금 길게 둔다.
 */
export function useShopPreview(query: Omit<ShopListQuery, 'cursor'>) {
  return useQuery({
    queryKey: shopKeys.preview(query),
    queryFn: () => getShops(query),
    staleTime: 30_000,
  });
}
