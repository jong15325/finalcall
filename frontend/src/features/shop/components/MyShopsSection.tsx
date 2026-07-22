import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { TbAlertTriangle, TbBuildingStore } from 'react-icons/tb'
import { paths } from '@/app/paths'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import { useNow } from '@/features/auction/lib/useNow'
import { useCancelShop, useMyShops } from '@/lib/queries/shop'
import MyShopCard from './MyShopCard'
import MyShopCancelDialog from './MyShopCancelDialog'
import type { MyShopSummary } from '@/lib/api/shop'

/**
 * 마이페이지 '내 판매' 섹션 (FC-096 · 계약 §3.2 `GET /me/shops` · shop-spec §10) — 디자인 게이트 충족.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **진행 중(ACTIVE) 리스팅만** 승인된 마켓 카드 그리드(`ItemCard` 재사용)로 표시한다. 각 카드에
 *   등록가·예상 정산액과 '내리기' 버튼을 얹는다. 판매/만료/취소 이력은 '내 주문'(`/me/orders`)에
 *   실현값으로 노출되므로 여기서는 다루지 않는다(최소 ACTIVE 범위).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 구조는 마켓 목록(`MarketPage`)과 동형 — 커서 무한스크롤·로딩/빈/에러 상태 블록. 내리기는 확인
 *   다이얼로그를 거쳐 `POST /shops/{id}/cancel` → 성공 시 목록·인벤·임시보관 무효화(useCancelShop).
 */

const PAGE_SIZE = 12

/** 내 판매 조회 쿼리(ACTIVE 고정) — 상수라 useMyShops 키가 안정적으로 유지된다. */
const ACTIVE_QUERY = { status: 'ACTIVE', size: PAGE_SIZE } as const

export default function MyShopsSection() {
    const now = useNow()

    const {
        data,
        isPending,
        isError,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
    } = useMyShops(ACTIVE_QUERY)

    const cancelMutation = useCancelShop()

    const [target, setTarget] = useState<MyShopSummary | null>(null)

    const shops = useMemo(
        () => data?.pages.flatMap((page) => page.content) ?? [],
        [data],
    )

    const sentinelRef = useInfiniteScroll({
        hasNext: Boolean(hasNextPage),
        isFetching,
        onLoadMore: () => void fetchNextPage(),
    })

    const openCancel = (shop: MyShopSummary) => {
        cancelMutation.reset()
        setTarget(shop)
    }

    const closeCancel = () => setTarget(null)

    const confirmCancel = () => {
        if (!target) return
        cancelMutation.mutate(target.shopPublicId, {
            onSuccess: () => setTarget(null),
        })
    }

    return (
        <section
            aria-labelledby="myShopsTitle"
            className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6"
        >
            <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-navy text-gold-bright">
                        <TbBuildingStore aria-hidden className="size-5" />
                    </span>
                    <div>
                        <h2
                            id="myShopsTitle"
                            className="text-base font-bold text-gray-900"
                        >
                            내 판매
                        </h2>
                        <p className="text-xs text-gray-500">
                            판매 중인 고정가 상품을 확인하고 내릴 수 있어요.
                        </p>
                    </div>
                </div>
                <Link
                    to={paths.sell}
                    className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-gray-700 hover:border-navy"
                >
                    아이템 판매
                </Link>
            </header>

            {isPending ? (
                <MyShopsGridSkeleton />
            ) : isError && shops.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-sunken px-6 py-12 text-center">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                        <TbAlertTriangle aria-hidden className="size-5" />
                    </span>
                    <p className="mt-3 text-sm font-bold text-gray-900">
                        판매 목록을 불러오지 못했습니다
                    </p>
                    <button
                        type="button"
                        className="mt-4 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                        onClick={() => void refetch()}
                    >
                        다시 시도
                    </button>
                </div>
            ) : shops.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-sunken px-6 py-12 text-center">
                    <p className="text-sm font-bold text-gray-900">
                        판매 중인 상품이 없어요
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        보유한 아이템을 고정가로 등록해 보세요.
                    </p>
                    <Link
                        to={paths.sell}
                        className="mt-4 rounded-lg bg-orange px-4 py-2 text-sm font-bold text-white hover:bg-orange-deep"
                    >
                        아이템 판매
                    </Link>
                </div>
            ) : (
                <>
                    {/* 부분 실패 — 이미 받은 카드는 두고 배너만 얹는다 */}
                    {isError && (
                        <p
                            role="alert"
                            className="rounded-lg bg-danger-subtle px-4 py-2.5 text-sm text-danger"
                        >
                            최신 목록을 불러오지 못했습니다. 표시된 상품은 이전
                            결과입니다.
                        </p>
                    )}

                    <div
                        aria-label="판매 중인 상품 목록"
                        className="grid grid-cols-2 gap-3 xs:grid-cols-3 min-[1024px]:grid-cols-4"
                    >
                        {shops.map((shop) => (
                            <MyShopCard
                                key={shop.shopPublicId}
                                shop={shop}
                                now={now}
                                isCancelling={
                                    cancelMutation.isPending &&
                                    cancelMutation.variables ===
                                        shop.shopPublicId
                                }
                                onCancel={openCancel}
                            />
                        ))}
                    </div>

                    {/* 무한스크롤 감시점 */}
                    <div ref={sentinelRef} aria-hidden className="h-px" />

                    {isFetchingNextPage && (
                        <p
                            role="status"
                            className="py-1 text-center text-xs text-gray-400"
                        >
                            더 불러오는 중…
                        </p>
                    )}
                </>
            )}

            <MyShopCancelDialog
                open={target !== null}
                itemName={target?.item.nameSnapshot ?? ''}
                price={target?.price ?? 0}
                isSubmitting={cancelMutation.isPending}
                submitError={cancelMutation.error}
                onClose={closeCancel}
                onConfirm={confirmCancel}
            />
        </section>
    )
}

/** 그리드 영역만 스켈레톤(전체 블러 금지) — 마켓 카드 비율 유지. */
function MyShopsGridSkeleton() {
    return (
        <div
            aria-hidden
            className="grid grid-cols-2 gap-3 xs:grid-cols-3 min-[1024px]:grid-cols-4"
        >
            {Array.from({ length: 4 }).map((_, index) => (
                <div
                    key={index}
                    className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
                >
                    <div className="aspect-[72/134] animate-pulse bg-gray-100" />
                    <div className="flex flex-col gap-1.5 p-3">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                        <div className="mt-2 h-8 w-full animate-pulse rounded bg-gray-100" />
                    </div>
                </div>
            ))}
        </div>
    )
}
