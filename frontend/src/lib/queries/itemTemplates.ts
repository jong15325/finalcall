import { useQuery } from '@tanstack/react-query'
import { getItemTemplates } from '@/lib/api/itemTemplates'
import type { ItemTemplate, ItemTemplateQuery } from '@/lib/api/itemTemplates'
import type { OffsetPage } from '@/types/api'

/**
 * 아이템 카탈로그 쿼리 (계약 §4.1) — FC-071.
 *
 * ★ **경매 목록/필터가 무효화하지 않는 별도 네임스페이스다.** 카탈로그는 원게임 시드라
 *   사실상 불변이므로(§4.1), 경매 입찰·필터 변경이 이 캐시를 건드릴 이유가 없다. 키를 갈라
 *   두면 입찰 성공의 무효화 반경(`auctionKeys.browses()`)이 이 카탈로그를 스치지 않는다.
 *
 * ★ **필터가 백엔드 부재에도 죽지 않아야 한다.** 이 쿼리가 실패/로딩이어도 필터 선택지는
 *   로컬 코드 사전(`itemCode.ts`·`element.ts`)으로 완전히 구성된다(`filterOptions.ts` 폴백).
 *   카탈로그는 "없는 조합을 숨기는" 향상일 뿐 필터 동작의 전제가 아니다.
 */
export const itemTemplateKeys = {
    all: ['itemTemplates'] as const,
    list: (query: ItemTemplateQuery) =>
        [...itemTemplateKeys.all, 'list', query] as const,
}

/** 카탈로그가 소규모라(§4.1) 한 번에 전량을 받는다 — 페이지네이션 UI 를 만들지 않는다. */
const CATALOG_PAGE_SIZE = 200

/**
 * 필터 선택지용 카탈로그. `mainCategory=1` 스코프는 서버가 강제하므로 쿼리를 비워 전량을 받는다.
 *
 * ★ **staleTime 을 길게** 둔다 — 시드 카탈로그는 세션 중 바뀌지 않는다. 창 포커스마다 다시
 *   받을 이유가 없어 `refetchOnWindowFocus` 를 끈다(잔액·목록과 다른 수명).
 */
export function useItemTemplates() {
    return useQuery<OffsetPage<ItemTemplate>>({
        queryKey: itemTemplateKeys.list({ size: CATALOG_PAGE_SIZE }),
        queryFn: ({ signal }) =>
            getItemTemplates({ size: CATALOG_PAGE_SIZE }, signal),
        staleTime: 60 * 60_000,
        refetchOnWindowFocus: false,
    })
}
