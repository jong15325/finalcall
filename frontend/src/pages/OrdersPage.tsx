import { useMemo, useState } from 'react'
import { TbReceipt } from 'react-icons/tb'
import CursorPagination from '@/components/common/CursorPagination'
import ListFrame from '@/components/common/ListFrame'
import type { ListFrameState } from '@/components/common/ListFrame'
import ItemListSkeleton from '@/features/item/components/ItemListSkeleton'
import OrderCard from '@/features/order/components/OrderCard'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import { useMyOrders } from '@/lib/queries/orders'
import { useDeliveryLookup } from '@/lib/queries/deliveries'
import type {
    OrderListQuery,
    OrderRole,
    OrderSourceType,
    OrderSummary,
} from '@/lib/api/orders'
import type { DeliveryStatus } from '@/lib/api/deliveries'
import type { DeliveryLookup } from '@/lib/queries/deliveries'

/**
 * 거래내역 `/me/orders` (FC-090 → FC-094 에서 출처 필터 노출 · 계약 §4.3).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **역할(전체/구매/판매) + 출처(전체/경매/고정가) 두 축을 노출**한다. 종전엔 고정가(SHOP)가
 *   미구현이라 출처가 `AUCTION` 하나뿐이어서 출처 필터를 숨겼으나(선택지 하나짜리 필터 회피),
 *   EPIC-SHOP 실기능화로 `SHOP` 주문이 실재하므로 출처 축이 의미를 갖는다. `orderView` 는 이미
 *   SHOP 케이스를 처리한다(코드 변경 0 — `orderSourceLabelOf('SHOP')='고정가'`).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **필터가 바뀌면 커서가 초기화**된다 — 쿼리 키가 바뀌어(`useMyOrders`) 코드 없이 리셋된다.
 * ★ 무한스크롤은 공용 `useInfiniteScroll`(카운트다운 리렌더에 흔들리지 않는 관찰자, FC-071).
 * ★ 실 API + 로딩/빈/에러를 우아하게. 데모 데이터 하드코딩 없음.
 */

const ROLE_TABS: { value: OrderRole | 'ALL'; label: string }[] = [
    { value: 'ALL', label: '전체' },
    { value: 'BUYER', label: '구매' },
    { value: 'SELLER', label: '판매' },
]

const SOURCE_TABS: { value: OrderSourceType | 'ALL'; label: string }[] = [
    { value: 'ALL', label: '전체' },
    { value: 'AUCTION', label: '경매' },
    { value: 'SHOP', label: '고정가' },
]

/**
 * 주문 → 배송 상태(교차 조회, FC-190).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **배송은 구매자 도메인** — `myRole==='BUYER'` 인 주문에만 상태를 얹는다(판매 카드엔 없음).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 교차 키 = `itemInstancePublicId`(계약 §4.6). FC-193 로 `OrderSummary`(목록)에도 이 필드가
 *   additive 로 실린다(계약 §4.3). 필드가 없으면(배포 시차) 조용히 배지를 생략한다(graceful).
 */
function deliveryStatusFor(
    order: OrderSummary,
    deliveries: DeliveryLookup | undefined,
): DeliveryStatus | undefined {
    if (order.myRole !== 'BUYER' || !deliveries) return undefined
    const instanceId = order.itemInstancePublicId
    if (!instanceId) return undefined
    return deliveries.get(instanceId)?.status
}

export default function OrdersPage() {
    const [role, setRole] = useState<OrderRole | 'ALL'>('ALL')
    const [source, setSource] = useState<OrderSourceType | 'ALL'>('ALL')

    const query: OrderListQuery = useMemo(() => {
        const next: OrderListQuery = {}
        if (role !== 'ALL') next.role = role
        if (source !== 'ALL') next.sourceType = source
        return next
    }, [role, source])

    const {
        data,
        isPending,
        isError,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
    } = useMyOrders(query)

    const orders = useMemo(
        () => data?.pages.flatMap((page) => page.content) ?? [],
        [data],
    )
    // 배송 상태 교차 조회(계약 §4.6). 실패해도 주문은 그대로 뜬다(배지만 빠짐, best-effort).
    const deliveries = useDeliveryLookup().data

    const sentinelRef = useInfiniteScroll({
        hasNext: Boolean(hasNextPage),
        isFetching,
        onLoadMore: () => void fetchNextPage(),
    })
    const listState: ListFrameState = isPending
        ? { kind: 'loading', count: 4 }
        : isError && orders.length === 0
          ? {
                kind: 'error',
                message: '잠시 후 다시 시도해 주세요.',
                onRetry: () => void refetch(),
            }
          : orders.length === 0
            ? {
                  kind: 'empty',
                  title: '아직 거래 내역이 없어요',
                  description:
                      '경매에서 낙찰받거나 즉시구매하면 여기에 쌓입니다.',
              }
            : { kind: 'ready' }

    return (
        <ListFrame
            heading={
                <header>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-content-fg">
                        <TbReceipt
                            aria-hidden
                            className="size-6 text-brand-structure"
                        />
                        거래 내역
                    </h1>
                    <p className="mt-1 text-sm text-content-subtle">
                        구매·판매한 거래를 한 곳에서 확인하세요.
                    </p>
                </header>
            }
            filters={
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <OrderFilterTabs
                        label="거래 역할 필터"
                        title="역할"
                        tabs={ROLE_TABS}
                        value={role}
                        onChange={setRole}
                    />
                    <OrderFilterTabs
                        label="거래 출처 필터"
                        title="출처"
                        tabs={SOURCE_TABS}
                        value={source}
                        onChange={setSource}
                    />
                </div>
            }
                state={listState}
                layout="two-column"
                label="거래 내역 목록"
                resultBar={
                    orders.length > 0 && isError ? (
                        <p
                            role="alert"
                            className="rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger-ink"
                        >
                            최신 내역을 불러오지 못했습니다. 표시된 거래는 이전
                            결과입니다.
                        </p>
                    ) : undefined
                }
                pagination={
                    <CursorPagination
                        sentinelRef={sentinelRef}
                        hasNext={Boolean(hasNextPage)}
                        isFetchingNextPage={isFetchingNextPage}
                        onLoadMore={() => void fetchNextPage()}
                    />
                }
                renderSkeleton={() => <ItemListSkeleton layout="two-column" />}
            >
                {orders.map((order) => (
                    <OrderCard
                        key={order.orderPublicId}
                        order={order}
                        deliveryStatus={deliveryStatusFor(order, deliveries)}
                    />
                ))}
        </ListFrame>
    )
}

function OrderFilterTabs<T extends string>({
    label,
    title,
    tabs,
    value,
    onChange,
}: {
    label: string
    title: string
    tabs: { value: T; label: string }[]
    value: T
    onChange: (value: T) => void
}) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-content-subtle">{title}</span>
            <div
                role="tablist"
                aria-label={label}
                className="inline-flex w-fit gap-1 rounded-lg border border-content-line bg-content-surface p-1"
            >
                {tabs.map((tab) => {
                    const active = value === tab.value
                    return (
                        <button
                            key={tab.value}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`rounded-md px-4 py-1.5 text-sm font-bold transition-colors ${
                                active
                                    ? 'bg-brand-structure text-on-strong'
                                    : 'text-content-subtle hover:text-brand-structure'
                            }`}
                            onClick={() => onChange(tab.value)}
                        >
                            {tab.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
