import { useQuery } from '@tanstack/react-query'
import { getItemInstance } from '@/lib/api/items'
import { useCardInfoExpiry } from './cardInfoExpiry'
import type { ItemInstanceDetail } from '@/lib/api/items'

/**
 * 아이템 인스턴스 상세 쿼리 (계약 §4.1) — FC-077.
 *
 * ★ **키는 `auction` 계열과 형제**로 둔다 — 아이템 상세를 무효화해도 경매/인벤토리 캐시가
 *   딸려가지 않는다. 인벤토리·임시보관에서 링크로 진입하는 목적지다(마이 축 스토리지).
 * ★ 대체로 정적인 리소스(레벨·스킬은 불변)라 폴링·창포커스 재요청을 두지 않는다. 위치 변화
 *   (출품·이동)는 진입 시 재요청(기본 staleTime)으로 충분하다.
 */
export const itemKeys = {
    all: ['items'] as const,
    details: () => [...itemKeys.all, 'detail'] as const,
    detail: (itemInstancePublicId: string) =>
        [...itemKeys.details(), itemInstancePublicId] as const,
}

/**
 * 아이템 인스턴스 상세.
 *
 * ★ `enabled: id.length > 0` — 라우트 파라미터가 비면 요청하지 않는다(잘못된 주소 방어).
 */
export function useItemInstance(itemInstancePublicId: string) {
    const query = useQuery<ItemInstanceDetail>({
        queryKey: itemKeys.detail(itemInstancePublicId),
        queryFn: ({ signal }) => getItemInstance(itemInstancePublicId, signal),
        enabled: itemInstancePublicId.length > 0,
    })
    useCardInfoExpiry(itemKeys.detail(itemInstancePublicId), query.data)
    return query
}
