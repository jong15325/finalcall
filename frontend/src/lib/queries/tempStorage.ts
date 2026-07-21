import {
    useInfiniteQuery,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query'
import {
    getMyTempStorage,
    relocateTempStorageItem,
} from '@/lib/api/tempStorage'
import { useIsAuthenticated } from '@/store/authStore'
import { inventoryKeys } from './inventory'
import type { RelocateResponse, TempStorageItem } from '@/lib/api/tempStorage'
import type { CursorPage } from '@/types/api'

/**
 * 임시 보관함 쿼리 (계약 §4.2) — FC-076.
 *
 * ★ 이동(relocate)이 성공하면 아이템이 **임시보관→정규 인벤토리로 옮겨간다** → 두 목록이 모두
 *   바뀐다. 그래서 `useRelocateItem` 은 성공 후 **임시보관 + 인벤토리**(`inventoryKeys.me()`)를
 *   함께 무효화한다. 인벤토리를 빼먹으면 방금 옮긴 칸이 인벤토리에 즉시 나타나지 않는다.
 */
export const tempStorageKeys = {
    all: ['temp-storage'] as const,
    me: () => [...tempStorageKeys.all, 'me'] as const,
}

/** 이동 변이 변수 — `slotNo` 미지정이면 서버 자동 배정(§4.2). */
export interface RelocateVariables {
    itemInstancePublicId: string
    slotNo?: number
}

/**
 * 내 임시 보관함 — cursor 무한스크롤(계약 §1.3 실시간 목록 기본).
 *
 * ★ **`enabled: isAuthed`** — 보호 라우트지만 세션 만료 직후 401 이 refresh 회전을 불필요하게
 *   깨우지 않도록 가드한다(`useMyInventory` 와 같은 태도).
 * ★ 이동으로 곧 바뀌는 목록이라 창 포커스 복귀 시 다시 가져온다.
 */
export function useMyTempStorage() {
    const isAuthed = useIsAuthenticated()

    return useInfiniteQuery<CursorPage<TempStorageItem>>({
        queryKey: tempStorageKeys.me(),
        queryFn: ({ pageParam, signal }) =>
            getMyTempStorage((pageParam as string | null) ?? undefined, signal),
        initialPageParam: null,
        /*
         * ★ `hasNext` 와 `nextCursor` 를 **둘 다** 본다(auctions.ts 와 같은 이유) —
         *   `hasNext=true` 인데 커서가 null 로 오면 첫 페이지를 무한히 다시 받는 루프가 된다.
         */
        getNextPageParam: (lastPage) =>
            lastPage.hasNext && lastPage.nextCursor
                ? lastPage.nextCursor
                : null,
        enabled: isAuthed,
        refetchOnWindowFocus: true,
    })
}

/**
 * 임시보관→정규 슬롯 이동 (계약 §4.2 `POST …/relocate`).
 *
 * ★ 성공 시 **임시보관 + 인벤토리를 함께 무효화**한다(위 keys 주석). 잔액은 건드리지 않는다 —
 *   이동은 금전 이동이 아니다.
 * ★ 실패(`INV_001`·`INV_002`·`ITEM_002`·`ITEM_003`)는 호출부가 `error` 로 받아 code 로 문구를
 *   낸다(`relocateErrors.ts`).
 */
export function useRelocateItem() {
    const queryClient = useQueryClient()

    return useMutation<RelocateResponse, Error, RelocateVariables>({
        mutationFn: ({ itemInstancePublicId, slotNo }) =>
            relocateTempStorageItem(itemInstancePublicId, slotNo),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: tempStorageKeys.me(),
            })
            void queryClient.invalidateQueries({
                queryKey: inventoryKeys.me(),
            })
        },
    })
}
