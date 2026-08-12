import { useCallback, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { TbBuildingStore, TbWallet } from 'react-icons/tb'
import { paths } from '@/app/paths'
import CodeAmount from '@/components/common/CodeAmount'
import ListFrame from '@/components/common/ListFrame'
import type { ListFrameState } from '@/components/common/ListFrame'
import CursorPagination from '@/components/common/CursorPagination'
import ItemListSkeleton from '@/features/item/components/ItemListSkeleton'
import ShopCard from '@/features/shop/components/ShopCard'
import ShopCardInfoDialog from '@/features/shop/components/ShopCardInfoDialog'
import ShopFilters from '@/features/shop/components/ShopFilters'
import {
    normalizeShopFilters,
    parseShopFilters,
    toShopListQuery,
    toShopSearchParams,
} from '@/features/shop/lib/shopFilters'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import { useShopBrowse } from '@/lib/queries/shop'
import { useItemTemplates } from '@/lib/queries/itemTemplates'
import { useMyBalance } from '@/lib/queries/balance'
import { useIsAuthenticated, useAuthStore } from '@/store/authStore'
import { buildReturnUrlQuery } from '@/lib/returnUrl'
import type { ShopFilterState } from '@/features/shop/lib/shopFilters'
import type { ShopSummary } from '@/lib/api/shop'

/**
 * 고정가 아이템 마켓 `/market` (FC-094 — 목업 `market()` · 계약 §3.2 `/shops`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **`ComingSoonScaffold` 를 걷어내고 실 API 로 켠다**(shop-spec v0.2 · FC-093 backend 병렬).
 * ══════════════════════════════════════════════════════════════════════════════
 *  - **구조는 경매 목록(`AuctionListPage`)과 동형** — 필터는 URL search params 정본, 커서
 *    무한스크롤, 로딩/빈/에러 상태 블록. 데모 데이터를 렌더하지 않는다(정직성·FC-048).
 *  - **카드는 세로형 공통 카드(`ShopCard`)** — 목업 §9 2/3/6 그리드. 카드→상세 링크 + 비교 토글.
 *  - **구매는 상세에서**(게이트 결정 2026-07-22 — 카드→상세→구매, 경매와 동일 UX).
 *  - **골드포스 잔여일은 일 단위**라 매초 시계가 불필요 — 마운트 시각 1회로 고정해 전 카드에
 *    내려보낸다(FC-101: `useNow` 매초 구독을 걷어내 목록 전체 매초 리렌더 제거).
 * ★ 색은 브랜드 토큰(navy/gold/gray) — 목업 Vuexy 팔레트는 재구축에서 폐기(경매 화면 대칭).
 */

const PAGE_SIZE = 24

export default function MarketPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const location = useLocation()
    // 골드포스 잔여일은 일 단위라 매초 시계가 불필요 — 마운트 시각 1회로 고정한다.
    // (useNow 매초 구독을 걷어내 5천 대량 목록의 매초 전체 리렌더/잰더를 없앤다, FC-101.)
    const now = useMemo(() => Date.now(), [])

    // 카드 클릭 → 카드정보 구매 모달(FC-146). 선택된 리스팅만 모달로 띄운다(상세 네비 대체).
    const [selectedShop, setSelectedShop] = useState<ShopSummary | null>(null)
    const isAuthed = useIsAuthenticated()
    const myNickname = useAuthStore((state) => state.user?.nickname ?? null)
    // 대량 목록 memo 유지를 위해 열기 콜백을 안정 참조로 고정한다(매 카드 공유).
    const openCardInfo = useCallback(
        (shop: ShopSummary) => setSelectedShop(shop),
        [],
    )

    const filters = useMemo(
        () => parseShopFilters(searchParams),
        [searchParams],
    )

    const applyPatch = (patch: Partial<ShopFilterState>) => {
        const next = normalizeShopFilters({ ...filters, ...patch })
        setSearchParams(toShopSearchParams(next))
    }

    const resetFilters = () => setSearchParams(new URLSearchParams())
    // 검색만 지운다(필터·정렬은 유지) — 빈 결과 화면의 "검색 지우기" 동선.
    const clearSearch = () => applyPatch({ q: null })

    const {
        data,
        isPending,
        isError,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
    } = useShopBrowse(toShopListQuery(filters, PAGE_SIZE))

    const templatesQuery = useItemTemplates()
    const templates = templatesQuery.data?.content ?? []

    const balanceQuery = useMyBalance()

    const shops = useMemo(
        () => data?.pages.flatMap((page) => page.content) ?? [],
        [data],
    )

    const status: 'loading' | 'error' | 'empty' | 'ready' = isPending
        ? 'loading'
        : isError && shops.length === 0
          ? 'error'
          : shops.length === 0
            ? 'empty'
            : 'ready'
    const listState: ListFrameState =
        status === 'loading'
            ? { kind: 'loading', count: 12 }
            : status === 'error'
              ? {
                    kind: 'error',
                    message: '잠시 후 다시 시도해 주세요.',
                    onRetry: () => void refetch(),
                }
              : status === 'empty'
                ? {
                      kind: 'empty',
                      title: filters.q
                          ? `'${filters.q}' 검색 결과가 없어요`
                          : '조건에 맞는 상품이 없어요',
                      description: filters.q
                          ? '다른 검색어를 입력하거나 검색을 지워 보세요.'
                          : '필터를 바꾸거나 초기화해 보세요.',
                      action: (
                          <button
                              type="button"
                              className="rounded-md border border-content-line px-4 py-2 text-body font-bold text-content-muted hover:bg-content-soft"
                              onClick={filters.q ? clearSearch : resetFilters}
                          >
                              {filters.q ? '검색 지우기' : '필터 초기화'}
                          </button>
                      ),
                  }
                : { kind: 'ready' }
    const sentinelRef = useInfiniteScroll({
        hasNext: Boolean(hasNextPage),
        isFetching,
        onLoadMore: () => void fetchNextPage(),
    })

    return (
        <div>
            <ListFrame
                state={listState}
                layout="catalog"
                label="마켓 상품 목록"
                heading={
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-bold text-content-fg">
                                <TbBuildingStore
                                    aria-hidden
                                    className="size-6 text-brand-structure"
                                />
                                아이템 마켓
                            </h1>
                            <p className="mt-1 text-sm text-content-muted">
                                검증된 판매자의 아이템을 고정가로 안전하게
                                구매하세요.
                            </p>
                        </div>
                        <Link
                            to={paths.sell}
                            className="rounded-md bg-control-action px-4 py-2.5 text-sm font-bold text-content-fg hover:bg-control-action-hover"
                        >
                            아이템 판매
                        </Link>
                    </header>
                }
                filters={
                    <ShopFilters
                        filters={filters}
                        templates={templates}
                        onChange={applyPatch}
                        onReset={resetFilters}
                    />
                }
                resultBar={
                    <>
                        <div className="flex items-center justify-between gap-3">
                            {/* ★ 검색·필터 결과 수는 aria-live 로 알린다(스크린리더 결과 안내) */}
                            <p
                                aria-live="polite"
                                className="text-xs text-content-muted"
                            >
                                {status === 'ready'
                                    ? filters.q
                                        ? `'${filters.q}' 검색 결과 ${shops.length}건`
                                        : `${shops.length}건 표시 중`
                                    : '검증된 판매자의 고정가 상품'}
                            </p>
                            {balanceQuery.data && (
                                <Link
                                    to={paths.wallet}
                                    className="flex items-center gap-1.5 rounded-lg border border-content-line bg-content-surface px-3 py-1.5 text-xs font-medium text-content-muted hover:border-brand-structure"
                                >
                                    <TbWallet
                                        aria-hidden
                                        className="size-4 text-brand-structure"
                                    />
                                    사용 가능
                                    <CodeAmount
                                        value={
                                            balanceQuery.data.gameMoneyAvailable
                                        }
                                        mode="compact"
                                        className="font-bold text-content-fg"
                                    />
                                </Link>
                            )}
                        </div>
                        {status === 'ready' && isError && (
                            <p
                                role="alert"
                                className="mt-3 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger-ink"
                            >
                                최신 목록을 불러오지 못했습니다. 표시된 상품은
                                이전 결과입니다.
                            </p>
                        )}
                    </>
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
                    <ShopCard
                        key={shop.shopPublicId}
                        shop={shop}
                        now={now}
                        onOpen={openCardInfo}
                    />
                ))}
            </ListFrame>

            {selectedShop && (
                <ShopCardInfoDialog
                    shop={selectedShop}
                    now={now}
                    balance={balanceQuery.data}
                    isAuthed={isAuthed}
                    isOwn={
                        myNickname !== null &&
                        myNickname === selectedShop.sellerNickname
                    }
                    loginHref={`${paths.login}${buildReturnUrlQuery(location)}`}
                    onClose={() => setSelectedShop(null)}
                />
            )}
        </div>
    )
}
