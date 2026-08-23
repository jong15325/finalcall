import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getMyDeliveries } from '@/lib/api/deliveries'
import { useIsAuthenticated } from '@/store/authStore'
import { useCardInfoExpiry } from './cardInfoExpiry'
import type { DeliveryListQuery, DeliverySummary } from '@/lib/api/deliveries'
import type { CursorPage } from '@/types/api'

/**
 * 배송 상태 쿼리 (계약 §4.6) — FC-190.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **교차 조회 lookup 이 핵심.** 인벤/구매내역 카드는 자기 데이터로 그려지고, 배송 상태는
 *   `itemInstancePublicId` 로 이 lookup 에서 얹힌다(계약 §4.6 형상 보존). 기존
 *   `/me/inventory`·`/me/orders` 응답은 건드리지 않는다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 즉시구매·낙찰이 새 배송을 만들 수 있으므로 주문/인벤 무효화와 함께 이 키도 무효화 대상이다
 *   (`deliveryKeys.all`). 게임 claim/apply 는 웹 무관(DB 프로토콜)이라 폴링은 두지 않고 창 포커스
 *   복귀 시 새로고침으로 상태 진행(배송중→도착)을 반영한다.
 */
export const deliveryKeys = {
    all: ['deliveries'] as const,
    lists: () => [...deliveryKeys.all, 'list'] as const,
    list: (query: DeliveryListQuery) =>
        [...deliveryKeys.lists(), query] as const,
    /** 교차 조회용 lookup(전 상태·페이지 1) */
    lookup: () => [...deliveryKeys.all, 'lookup'] as const,
}

/**
 * `itemInstancePublicId → 배송` 조회 맵(교차 키). 최대 1건/인스턴스가 사실상 보장되나
 * (delivery-spec §6.1 미완료 배송 최대 1건), 혹시 중복이면 최신(created_at desc 선두)이 이긴다.
 */
export type DeliveryLookup = ReadonlyMap<string, DeliverySummary>

/** 페이지 content → itemInstancePublicId 키 맵(선두=최신 우선). */
function toLookup(page: CursorPage<DeliverySummary>): DeliveryLookup {
    const map = new Map<string, DeliverySummary>()
    for (const delivery of page.content) {
        // created_at desc 정렬이라 선두가 최신 — 이미 있으면 최신을 유지한다.
        if (!map.has(delivery.itemInstancePublicId)) {
            map.set(delivery.itemInstancePublicId, delivery)
        }
    }
    return map
}

/**
 * 배송 교차 조회 lookup — 인벤/구매내역 배지가 소비한다.
 *
 * ★ **첫 페이지만 조회한다**(단일 유저의 진행 중 배송은 소수라 실무상 충분). 진행 중 배송이
 *   페이지를 넘길 만큼 많은 극단 케이스는 통합 단계에서 size 상향/무한로딩으로 조정한다
 *   (백엔드 API 착지 후, contract-first).
 * ★ **`enabled: isAuthed`** — 인증 필요 엔드포인트라 비로그인 401 이 refresh 회전을
 *   불필요하게 깨우지 않게 가드한다(`useMyInventory`·`useMyOrders` 와 같은 태도).
 */
export function useDeliveryLookup() {
    const isAuthed = useIsAuthenticated()

    const query = useQuery<CursorPage<DeliverySummary>, Error, DeliveryLookup>({
        queryKey: deliveryKeys.lookup(),
        queryFn: ({ signal }) => getMyDeliveries({}, signal),
        select: toLookup,
        enabled: isAuthed,
        refetchOnWindowFocus: true,
    })
    useCardInfoExpiry(deliveryKeys.lookup(), query.data)
    return query
}

/**
 * 내 배송 목록 — cursor 무한스크롤(계약 §1.3 · §4.6). 향후 독립 배송 목록 화면용(현 FC-190
 * 범위는 인벤/주문 배지라 미사용이나, 계약 소비 완결을 위해 제공). 필터가 바뀌면 커서 초기화
 * (`query` 가 키에 통째로 실림, `useMyOrders` 와 같은 구조).
 */
export function useMyDeliveries(query: DeliveryListQuery = {}) {
    const isAuthed = useIsAuthenticated()

    const result = useInfiniteQuery<CursorPage<DeliverySummary>>({
        queryKey: deliveryKeys.list(query),
        queryFn: ({ pageParam, signal }) =>
            getMyDeliveries(
                { ...query, cursor: (pageParam as string | null) ?? undefined },
                signal,
            ),
        initialPageParam: null,
        getNextPageParam: (lastPage) =>
            lastPage.hasNext && lastPage.nextCursor
                ? lastPage.nextCursor
                : null,
        enabled: isAuthed,
        refetchOnWindowFocus: false,
    })
    useCardInfoExpiry(deliveryKeys.list(query), result.data)
    return result
}
