import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKey } from '@/lib/api/queryKeys';
import { getBids } from './bidApi';

export const bidKeys = {
  list: (auctionPublicId: string, page: number) =>
    queryKey('bid', 'list', { auctionPublicId, page }),
};

/**
 * 입찰 이력 offset 페이지.
 *
 * `placeholderData: keepPreviousData` 로 페이지 이동 시 표가 **비었다가 다시 차지 않게** 한다 —
 * 표가 사라지면 페이저 버튼이 위로 점프해 다음 클릭이 빗나간다(FC-038 이월 "마지막 페이지 포커스 소실"과
 * 같은 부류의 문제다).
 *
 * 폴링하지 않는다. 상세 폴링이 최고가·상태를 이미 10초마다 당겨 오고, 이력 표는 그 아래 부수 정보라
 * 두 개의 폴링을 겹치면 인증 불요 엔드포인트에 불필요한 부하가 쌓인다(사용자가 페이지를 옮기면 갱신된다).
 */
export function useBidHistory(auctionPublicId: string, page: number, enabled = true) {
  return useQuery({
    queryKey: bidKeys.list(auctionPublicId, page),
    queryFn: () => getBids(auctionPublicId, page),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    enabled: enabled && auctionPublicId !== '',
  });
}
