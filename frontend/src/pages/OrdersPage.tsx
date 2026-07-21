import { useMemo, useState } from 'react'
import { TbAlertTriangle, TbReceipt, TbReceiptOff } from 'react-icons/tb'
import OrderCard from '@/features/order/components/OrderCard'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import { useMyOrders } from '@/lib/queries/orders'
import type { OrderListQuery, OrderRole } from '@/lib/api/orders'

/**
 * 거래내역 `/me/orders` (FC-090 — 계약 §4.3 · rebuild-contract-map §9·§13 준비중 자리 승격).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **역할 필터(전체/구매/판매)만 노출**한다. `sourceType`(AUCTION|SHOP) 필터는 두지 않는다 —
 *   고정가(SHOP)가 미구현이라 현재 출처는 `AUCTION` 하나뿐이고, **선택지가 하나인 필터는 아무것도
 *   거르지 않으면서 자리만 차지**하기 때문이다(경매 목록이 `mainCategory` 를 뺀 것과 같은 판단,
 *   `auctionFilters` 주). SHOP 이 붙으면 그때 출처 필터를 추가한다(API 는 이미 받는다).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **역할이 바뀌면 커서가 초기화**된다 — 쿼리 키가 바뀌어(`useMyOrders`) 코드 없이 리셋된다.
 * ★ 무한스크롤은 공용 `useInfiniteScroll`(카운트다운 리렌더에 흔들리지 않는 관찰자, FC-071).
 * ★ 실 API + 로딩/빈/에러를 우아하게. 데모 데이터 하드코딩 없음.
 */

const ROLE_TABS: { value: OrderRole | 'ALL'; label: string }[] = [
    { value: 'ALL', label: '전체' },
    { value: 'BUYER', label: '구매' },
    { value: 'SELLER', label: '판매' },
]

export default function OrdersPage() {
    const [role, setRole] = useState<OrderRole | 'ALL'>('ALL')

    const query: OrderListQuery = useMemo(
        () => (role === 'ALL' ? {} : { role }),
        [role],
    )

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

    const sentinelRef = useInfiniteScroll({
        hasNext: Boolean(hasNextPage),
        isFetching,
        onLoadMore: () => void fetchNextPage(),
    })

    return (
        <div className="flex flex-col gap-5">
            <header>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                    <TbReceipt aria-hidden className="size-6 text-navy" />
                    거래 내역
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    구매·판매한 거래를 한 곳에서 확인하세요.
                </p>
            </header>

            {/* 역할 필터 — 세그먼트 컨트롤 */}
            <div
                role="tablist"
                aria-label="거래 역할 필터"
                className="inline-flex w-fit gap-1 rounded-lg border border-line bg-surface p-1"
            >
                {ROLE_TABS.map((tab) => {
                    const active = role === tab.value
                    return (
                        <button
                            key={tab.value}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`rounded-md px-4 py-1.5 text-sm font-bold transition-colors ${
                                active
                                    ? 'bg-navy text-white'
                                    : 'text-gray-500 hover:text-navy'
                            }`}
                            onClick={() => setRole(tab.value)}
                        >
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* 부분 실패 — 이미 받은 카드는 두고 배너만 얹는다 */}
            {orders.length > 0 && isError && (
                <p
                    role="alert"
                    className="rounded-lg bg-danger-subtle px-4 py-2.5 text-sm text-danger"
                >
                    최신 내역을 불러오지 못했습니다. 표시된 거래는 이전
                    결과입니다.
                </p>
            )}

            {isPending && <OrderListSkeleton />}

            {!isPending && isError && orders.length === 0 && (
                <StateBlock
                    icon={TbAlertTriangle}
                    title="거래 내역을 불러오지 못했습니다"
                    description="잠시 후 다시 시도해 주세요."
                    action={
                        <button
                            type="button"
                            className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                            onClick={() => void refetch()}
                        >
                            다시 시도
                        </button>
                    }
                />
            )}

            {!isPending && !isError && orders.length === 0 && (
                <StateBlock
                    icon={TbReceiptOff}
                    title="아직 거래 내역이 없어요"
                    description="경매에서 낙찰받거나 즉시구매하면 여기에 쌓입니다."
                />
            )}

            {orders.length > 0 && (
                <>
                    <section
                        aria-label="거래 내역 목록"
                        className="grid grid-cols-1 gap-4 min-[1000px]:grid-cols-2"
                    >
                        {orders.map((order) => (
                            <OrderCard
                                key={order.orderPublicId}
                                order={order}
                            />
                        ))}
                    </section>

                    <div ref={sentinelRef} aria-hidden className="h-px" />

                    {isFetchingNextPage && (
                        <p
                            role="status"
                            className="py-2 text-center text-xs text-gray-400"
                        >
                            더 불러오는 중…
                        </p>
                    )}
                </>
            )}
        </div>
    )
}

/** 목록 영역만 스켈레톤(전체 블러 금지). */
function OrderListSkeleton() {
    return (
        <div
            aria-hidden
            className="grid grid-cols-1 gap-4 min-[1000px]:grid-cols-2"
        >
            {Array.from({ length: 4 }).map((_, index) => (
                <div
                    key={index}
                    className="grid min-h-[150px] grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface"
                >
                    <div className="animate-pulse bg-gray-100" />
                    <div className="flex flex-col gap-2 p-[17px]">
                        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                        <div className="mt-auto h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function StateBlock({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    title: string
    description: string
    action?: React.ReactNode
}) {
    return (
        <section className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <Icon aria-hidden className="size-7" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
            {action && <div className="mt-5">{action}</div>}
        </section>
    )
}
