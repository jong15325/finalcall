import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { TbBuildingStore } from 'react-icons/tb'
import { paths } from '@/app/paths'
import CursorPagination from '@/components/common/CursorPagination'
import ListFrame from '@/components/common/ListFrame'
import type { ListFrameState } from '@/components/common/ListFrame'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import { useNow } from '@/features/auction/lib/useNow'
import ItemListSkeleton from '@/features/item/components/ItemListSkeleton'
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
    const listState: ListFrameState = isPending
        ? { kind: 'loading', count: 4 }
        : isError && shops.length === 0
          ? {
                kind: 'error',
                message: '판매 목록을 불러오지 못했습니다.',
                onRetry: () => void refetch(),
            }
          : shops.length === 0
            ? {
                  kind: 'empty',
                  title: '판매 중인 상품이 없어요',
                  description: '보유한 아이템을 고정가로 등록해 보세요.',
                  action: (
                      <Link
                          to={paths.sell}
                          className="rounded-lg bg-control-action px-4 py-2 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                      >
                          아이템 판매
                      </Link>
                  ),
              }
            : { kind: 'ready' }

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
            className="rounded-2xl border border-content-line bg-content-surface p-5 sm:p-6"
        >
            <ListFrame
                heading={
                    <header className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-structure text-brand-highlight-bright">
                                <TbBuildingStore
                                    aria-hidden
                                    className="size-5"
                                />
                            </span>
                            <div>
                                <h2
                                    id="myShopsTitle"
                                    className="text-base font-bold text-content-fg"
                                >
                                    내 판매
                                </h2>
                                <p className="text-xs text-content-subtle">
                                    판매 중인 고정가 상품을 확인하고 내릴 수 있어요.
                                </p>
                            </div>
                        </div>
                        <Link
                            to={paths.sell}
                            className="shrink-0 rounded-lg border border-content-line bg-content-surface px-3 py-2 text-xs font-bold text-content-fg hover:border-brand-structure"
                        >
                            아이템 판매
                        </Link>
                    </header>
                }
                state={listState}
                layout="catalog"
                label="판매 중인 상품 목록"
                resultBar={
                    shops.length > 0 && isError ? (
                        <p
                            role="alert"
                            className="rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger-ink"
                        >
                            최신 목록을 불러오지 못했습니다. 표시된 상품은 이전
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
                renderSkeleton={() => <ItemListSkeleton layout="catalog" />}
            >
                {shops.map((shop) => (
                    <MyShopCard
                        key={shop.shopPublicId}
                        shop={shop}
                        now={now}
                        isCancelling={
                            cancelMutation.isPending &&
                            cancelMutation.variables === shop.shopPublicId
                        }
                        onCancel={openCancel}
                    />
                ))}
            </ListFrame>

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
