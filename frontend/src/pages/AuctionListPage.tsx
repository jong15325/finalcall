import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { TbAlertTriangle, TbGavel, TbSearchOff, TbWallet } from 'react-icons/tb'
import { paths } from '@/app/paths'
import CodeAmount from '@/components/common/CodeAmount'
import AuctionCard from '@/features/auction/components/AuctionCard'
import AuctionFilters from '@/features/auction/components/AuctionFilters'
import {
    normalizeFilters,
    parseAuctionFilters,
    toListQuery,
    toSearchParams,
} from '@/features/auction/lib/auctionFilters'
import { auctionListStatusOf } from '@/features/auction/lib/auctionListState'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import { useNow } from '@/features/auction/lib/useNow'
import { useAuctionBrowse } from '@/lib/queries/auctions'
import { useItemTemplates } from '@/lib/queries/itemTemplates'
import { useMyBalance } from '@/lib/queries/balance'
import type { AuctionFilterState } from '@/features/auction/lib/auctionFilters'

/**
 * 실시간 경매 목록 (FC-071 — design-brief B-2 · 목업 `#auction`).
 *
 * ★ **필터는 URL search params 가 정본**(§20) — 링크가 곧 조회 조건이다. `parseAuctionFilters` 로
 *   읽고 `toSearchParams` 로 되쓴다. 필터가 바뀌면 쿼리 키가 바뀌어 **커서가 코드 한 줄 없이
 *   초기화**된다(`useAuctionBrowse` 주).
 * ★ **카운트다운은 단일 타이머**(`useNow` 1회 구독) 값을 전 카드에 내려보낸다.
 * ★ **마감 판정·상태는 클라 파생**(서버 status 불신). 실 API 호출 + 로딩/빈/에러 상태를 우아하게
 *   낸다 — 데모 데이터를 하드코딩하지 않는다(백엔드 미가동 시에도 상태만 다르게 보인다).
 */

const PAGE_SIZE = 24

export default function AuctionListPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const now = useNow()

    const filters = useMemo(
        () => parseAuctionFilters(searchParams),
        [searchParams],
    )

    const applyPatch = (patch: Partial<AuctionFilterState>) => {
        const next = normalizeFilters({ ...filters, ...patch })
        setSearchParams(toSearchParams(next))
    }

    const resetFilters = () => setSearchParams(new URLSearchParams())

    const {
        data,
        isPending,
        isError,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
    } = useAuctionBrowse(toListQuery(filters, PAGE_SIZE))

    const templatesQuery = useItemTemplates()
    const templates = templatesQuery.data?.content ?? []

    const balanceQuery = useMyBalance()

    const auctions = useMemo(
        () => data?.pages.flatMap((page) => page.content) ?? [],
        [data],
    )

    const status = auctionListStatusOf({
        isPending,
        isError,
        itemCount: auctions.length,
    })

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
                        <TbGavel aria-hidden className="size-6 text-navy" />
                        실시간 경매
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        조건을 비교하고 마감 전에 입찰하세요.
                    </p>
                </div>
                <Link
                    to={paths.sell}
                    className="rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-deep"
                >
                    경매 등록
                </Link>
            </header>

            <AuctionFilters
                filters={filters}
                templates={templates}
                onChange={applyPatch}
                onReset={resetFilters}
            />

            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                    {status === 'ready'
                        ? `${auctions.length}건 표시 중`
                        : '서버가 제공하는 가격·마감 기준'}
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
                    최신 목록을 불러오지 못했습니다. 표시된 경매는 이전
                    결과입니다.
                </p>
            )}

            {status === 'loading' && <AuctionGridSkeleton />}

            {status === 'error' && (
                <StateBlock
                    icon={TbAlertTriangle}
                    title="경매를 불러오지 못했습니다"
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
                    title="조건에 맞는 경매가 없어요"
                    description="필터를 바꾸거나 초기화해 보세요."
                    action={
                        <button
                            type="button"
                            className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100"
                            onClick={resetFilters}
                        >
                            필터 초기화
                        </button>
                    }
                />
            )}

            {status === 'ready' && (
                <>
                    <section
                        aria-label="경매 목록"
                        className="grid grid-cols-1 gap-4 xs:grid-cols-2 min-[1200px]:grid-cols-3"
                    >
                        {auctions.map((auction) => (
                            <AuctionCard
                                key={auction.auctionPublicId}
                                auction={auction}
                                now={now}
                            />
                        ))}
                    </section>

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
        </div>
    )
}

/** 목록 영역만 스켈레톤(전체 블러 금지, §18). */
function AuctionGridSkeleton() {
    return (
        <div
            aria-hidden
            className="grid grid-cols-1 gap-4 xs:grid-cols-2 min-[1200px]:grid-cols-3"
        >
            {Array.from({ length: 8 }).map((_, index) => (
                <div
                    key={index}
                    className="grid min-h-[218px] grid-cols-[102px_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface xs:grid-cols-[112px_minmax(0,1fr)]"
                >
                    <div className="animate-pulse bg-gray-100" />
                    <div className="flex flex-col gap-2 p-[17px]">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                        <div className="mt-3 h-8 w-full animate-pulse rounded bg-gray-100" />
                        <div className="mt-auto h-3 w-2/3 animate-pulse rounded bg-gray-100" />
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
