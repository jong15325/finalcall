import { useCallback, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import {
    TbAlertTriangle,
    TbBuildingStore,
    TbSearchOff,
    TbWallet,
} from 'react-icons/tb'
import { paths } from '@/app/paths'
import CodeAmount from '@/components/common/CodeAmount'
import ItemCardGrid, {
    ItemCardGridSkeleton,
} from '@/features/item/components/ItemCardGrid'
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

    const sentinelRef = useInfiniteScroll({
        hasNext: Boolean(hasNextPage),
        isFetching,
        onLoadMore: () => void fetchNextPage(),
    })

    return (
        <div className="flex flex-col gap-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <TbBuildingStore
                            aria-hidden
                            className="size-6 text-navy"
                        />
                        아이템 마켓
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        검증된 판매자의 아이템을 고정가로 안전하게 구매하세요.
                    </p>
                </div>
                <Link
                    to={paths.sell}
                    className="rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-deep"
                >
                    아이템 판매
                </Link>
            </header>

            <ShopFilters
                filters={filters}
                templates={templates}
                onChange={applyPatch}
                onReset={resetFilters}
            />

            <div className="flex items-center justify-between gap-3">
                {/* ★ 검색·필터 결과 수는 aria-live 로 알린다(스크린리더 결과 안내) */}
                <p aria-live="polite" className="text-xs text-gray-500">
                    {status === 'ready'
                        ? filters.q
                            ? `'${filters.q}' 검색 결과 ${shops.length}건`
                            : `${shops.length}건 표시 중`
                        : '검증된 판매자의 고정가 상품'}
                </p>
                {balanceQuery.data && (
                    <Link
                        to={paths.wallet}
                        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-navy"
                    >
                        <TbWallet aria-hidden className="size-4 text-navy" />
                        사용 가능
                        <CodeAmount
                            value={balanceQuery.data.gameMoneyAvailable}
                            mode="compact"
                            className="font-bold text-gray-900"
                        />
                    </Link>
                )}
            </div>

            {/* 부분 실패 — 이미 받은 카드는 두고 배너만 얹는다 */}
            {status === 'ready' && isError && (
                <p
                    role="alert"
                    className="rounded-lg bg-danger-subtle px-4 py-2.5 text-sm text-danger"
                >
                    최신 목록을 불러오지 못했습니다. 표시된 상품은 이전
                    결과입니다.
                </p>
            )}

            {status === 'loading' && (
                <ItemCardGridSkeleton variant="market" count={12} />
            )}

            {status === 'error' && (
                <StateBlock
                    icon={TbAlertTriangle}
                    title="마켓을 불러오지 못했습니다"
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

            {status === 'empty' && (
                <StateBlock
                    icon={TbSearchOff}
                    title={
                        filters.q
                            ? `'${filters.q}' 검색 결과가 없어요`
                            : '조건에 맞는 상품이 없어요'
                    }
                    description={
                        filters.q
                            ? '다른 검색어를 입력하거나 검색을 지워 보세요.'
                            : '필터를 바꾸거나 초기화해 보세요.'
                    }
                    action={
                        filters.q ? (
                            <button
                                type="button"
                                className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100"
                                onClick={clearSearch}
                            >
                                검색 지우기
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100"
                                onClick={resetFilters}
                            >
                                필터 초기화
                            </button>
                        )
                    }
                />
            )}

            {status === 'ready' && (
                <>
                    {/* 목업 §9 — PC 6열 / 태블릿 3열 / 모바일 2열(ItemCardGrid market) */}
                    <ItemCardGrid variant="market" ariaLabel="마켓 상품 목록">
                        {shops.map((shop) => (
                            <ShopCard
                                key={shop.shopPublicId}
                                shop={shop}
                                now={now}
                                onOpen={openCardInfo}
                            />
                        ))}
                    </ItemCardGrid>

                    {/* 무한스크롤 감시점 — 목록 끝 문구는 두지 않는다(목업 §17) */}
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
