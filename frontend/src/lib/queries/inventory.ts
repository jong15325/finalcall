import { useQuery } from '@tanstack/react-query'
import { getMyInventory } from '@/lib/api/inventory'
import { useIsAuthenticated } from '@/store/authStore'
import type { InventoryResponse } from '@/lib/api/inventory'

/**
 * 인벤토리 쿼리 (계약 §4.2) — FC-073.
 *
 * ★ **키 계층을 여기서 시작한다.** 판매(경매 등록)가 성공하면 아이템이 인벤토리→출품
 *   에스크로(LISTED)로 빠져나가므로, `useCreateAuction` 이 성공 후
 *   `queryClient.invalidateQueries({ queryKey: inventoryKeys.me() })` 로 이 값을 갱신한다.
 *   갱신하지 않으면 방금 출품한 아이템이 인벤토리 목록에 남아 재선택 가능한 것처럼 보인다.
 */
export const inventoryKeys = {
    all: ['inventory'] as const,
    me: () => [...inventoryKeys.all, 'me'] as const,
}

/**
 * 내 인벤토리.
 *
 * ★ **`enabled: isAuthed`** — 셸이 전 화면에 붙지만 판매는 보호 라우트라 로그인 사용자만
 *   도달한다. 그래도 가드를 둬 비로그인 상태(세션 만료 직후 등)에서 401 이 refresh 회전을
 *   불필요하게 깨우지 않게 한다(`balance` 훅과 같은 태도).
 * ★ 출품·이동으로 곧 바뀌는 목록이라 창 포커스 복귀 시 다시 가져온다.
 */
export function useMyInventory() {
    const isAuthed = useIsAuthenticated()

    return useQuery<InventoryResponse>({
        queryKey: inventoryKeys.me(),
        queryFn: ({ signal }) => getMyInventory(signal),
        enabled: isAuthed,
        refetchOnWindowFocus: true,
    })
}
