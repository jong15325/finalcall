import { useQuery } from '@tanstack/react-query';
import { queryKey } from '@/lib/api/queryKeys';
import { useIsAuthenticated } from '@/stores/authStore';
import { getBalance } from './walletApi';

/** 쿼리 키 — 국소 생성(spec §4.3). 마이페이지 잔액 카드·탈퇴 Modal 이 같은 쿼리를 공유. */
export const walletKeys = {
  balance: () => queryKey('wallet', 'balance'),
};

/** GET /me/balance — 표시만(폴링 불요). staleTime 30s면 마운트 시 refetch 로 충분. */
export function useBalance() {
  const isAuthed = useIsAuthenticated();
  return useQuery({
    queryKey: walletKeys.balance(),
    queryFn: () => getBalance(),
    enabled: isAuthed,
    staleTime: 30_000,
  });
}
