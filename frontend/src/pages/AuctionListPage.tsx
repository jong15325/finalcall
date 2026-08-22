import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { TbArrowUpRight, TbGavel } from 'react-icons/tb'
import { paths } from '@/app/paths'
import ListFrame from '@/components/common/ListFrame'
import type { ListFrameState } from '@/components/common/ListFrame'
import CursorPagination from '@/components/common/CursorPagination'
import ItemListSkeleton from '@/features/item/components/ItemListSkeleton'
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
    } = useAuctionBrowse(toListQuery(filters, PAGE_SIZE))

    const templatesQuery = useItemTemplates()
    const templates = templatesQuery.data?.content ?? []


    const auctions = useMemo(
        () => data?.pages.flatMap((page) => page.content) ?? [],
        [data],
    )

    const status = auctionListStatusOf({
        isPending,
        isError,
        itemCount: auctions.length,
    })
    const listState: ListFrameState =
        status === 'loading'
            ? { kind: 'loading', count: 8 }
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
                          : '조건에 맞는 경매가 없어요',
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
        <div data-testid="auction-list-region" className="auction-list-region">
            <ListFrame
                state={listState}
                layout="catalog"
                label="경매 목록"
                heading={
                    <header data-page-intro data-market-page-intro>
                        <div data-market-page-identity>
                            <span data-market-page-icon>
                                <TbGavel aria-hidden className="size-6" />
                            </span>
                            <div className="min-w-0">
                                <span data-market-page-eyebrow>
                                    REALTIME AUCTION
                                </span>
                                <h1>실시간 경매</h1>
                                <p>
                                    핵심 스킬과 현재가를 비교하고 마감 전에
                                    입찰하세요.
                                </p>
                            </div>
                        </div>
                        <Link to={paths.sell} data-market-sell-action>
                            <span>경매 등록</span>
                            <TbArrowUpRight aria-hidden />
                        </Link>
                    </header>
                }
                filters={
                    <AuctionFilters
                        filters={filters}
                        templates={templates}
                        onChange={applyPatch}
                        onReset={resetFilters}
                    />
                }
                resultBar={
                    <>
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                            {/* ★ 검색·필터 결과 수는 aria-live 로 알린다(스크린리더 결과 안내) */}
                            <p
                                aria-live="polite"
                                className="min-w-0 flex-1 text-xs text-content-muted"
                            >
                                {status === 'ready'
                                    ? filters.q
                                        ? `'${filters.q}' 검색 결과 ${auctions.length}건`
                                        : `${auctions.length}건 표시 중`
                                    : '서버가 제공하는 가격·마감 기준'}
                            </p>
                        </div>
                        {status === 'ready' && isError && (
                            <p
                                role="alert"
                                className="mt-3 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger-ink"
                            >
                                최신 목록을 불러오지 못했습니다. 표시된 경매는
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
                renderSkeleton={() => (
                    <ItemListSkeleton
                        extendedFacts
                        layout="catalog"
                        artworkClassName="h-[296px]"
                    />
                )}
            >
                {auctions.map((auction) => (
                    <AuctionCard
                        key={auction.auctionPublicId}
                        auction={auction}
                        now={now}
                    />
                ))}
            </ListFrame>
        </div>
    )
}

