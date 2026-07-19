import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKey } from '@/lib/api/queryKeys';
import { useIsAuthenticated } from '@/stores/authStore';
import { getInventory, getTempStorage, relocateFromTempStorage } from './inventoryApi';

/** 쿼리 키 — 국소 생성(중앙 레지스트리 안 만듦, 프론트 CLAUDE.md [4]). */
export const inventoryKeys = {
  inventory: () => queryKey('inventory', 'me'),
  /**
   * 임시보관 목록(무한)과 배너 미리보기는 **키를 분리한다.** 같은 키를 쓰면 `useInfiniteQuery`(pages
   * 구조)와 `useQuery`(단일 페이지 구조)가 한 캐시 엔트리를 두고 서로를 덮어써 화면이 깨진다
   * (auctionKeys가 같은 이유로 나눠 둔 전례).
   */
  tempStorage: () => queryKey('inventory', 'temp-storage'),
  tempStoragePreview: () => queryKey('inventory', 'temp-storage-preview'),
};

/**
 * GET /me/inventory.
 *
 * `enabled: isAuthed` — 보호 리소스라 세션 없이 호출하면 401이 나가고 client가 refresh 회전을 시도한다.
 * ProtectedLayout이 이미 미인증을 로그인으로 돌려보내므로 실제로는 도달하지 않지만, 로그아웃 직후
 * 언마운트 사이의 짧은 창에서 헛요청이 나가는 것을 막는다(useMe와 같은 규율).
 *
 * 폴링하지 않는다 — 인벤토리는 내 조작으로만 변한다(relocate·판매 등록). 그 조작이 캐시를 무효화한다.
 */
export function useInventory() {
  const isAuthed = useIsAuthenticated();
  return useQuery({
    queryKey: inventoryKeys.inventory(),
    queryFn: () => getInventory(),
    enabled: isAuthed,
  });
}

/** GET /me/temp-storage — cursor 무한 목록(계약 §1.3). 임시보관 화면 본문. */
export function useTempStorageList() {
  const isAuthed = useIsAuthenticated();
  return useInfiniteQuery({
    queryKey: inventoryKeys.tempStorage(),
    queryFn: ({ pageParam }) => getTempStorage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? (lastPage.nextCursor ?? undefined) : undefined,
    enabled: isAuthed,
  });
}

/**
 * 임시보관 **첫 페이지만** — 인벤토리 화면의 배너 판정용.
 *
 * ★ cursor 페이지에는 총건수가 없다. 그래서 배너는 "N개"를 단정하지 않고 `hasNext`일 때
 *   "N개 이상"으로 적는다(화면 쪽 책임). 총계를 알 수 없다는 사실을 숫자로 덮지 않는다.
 */
export function useTempStoragePreview() {
  const isAuthed = useIsAuthenticated();
  return useQuery({
    queryKey: inventoryKeys.tempStoragePreview(),
    queryFn: () => getTempStorage(),
    enabled: isAuthed,
  });
}

/**
 * POST /me/temp-storage/{id}/relocate.
 *
 * 성공하면 **두 목록이 동시에 틀려진다**(임시보관에서 빠지고 정규에 들어온다) — 셋 다 무효화한다.
 * 실패(INV_001 만실 등)는 삼키지 않고 그대로 올린다. 화면이 코드별 문구로 분기한다.
 */
export function useRelocate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemInstancePublicId: string) => relocateFromTempStorage(itemInstancePublicId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inventoryKeys.inventory() });
      void qc.invalidateQueries({ queryKey: inventoryKeys.tempStorage() });
      void qc.invalidateQueries({ queryKey: inventoryKeys.tempStoragePreview() });
    },
  });
}
