import { useCallback, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PiFunnelDuotone } from 'react-icons/pi'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Sheet from '@/components/shared/Sheet'
import {
    AUCTION_SORT_OPTIONS,
    countActiveFilters,
    normalizeFilters,
    parseAuctionFilters,
    toListQuery,
    toSearchParams,
} from '@/features/auction/lib/auctionFilters'
import { useAuctionBrowse } from '@/lib/queries/auctions'
import ActiveFilterChips from './components/ActiveFilterChips'
import AuctionFilterPanel from './components/AuctionFilterPanel'
import AuctionResults from './components/AuctionResults'
import type { AuctionFilterState } from '@/features/auction/lib/auctionFilters'

/**
 * 경매 목록 (FC-059) — 계약 §3.1 `GET /auctions` · §3.3 · §4.1.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **필터 상태의 정본은 URL 이다. 리액트 state 가 아니다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 컴포넌트 state 로 들고 URL 에 "동기화"하면 두 벌이 생기고, 그 둘이 어긋나는 순간
 * (뒤로가기·링크 붙여넣기·새로고침)이 반드시 온다. `useSearchParams` 하나만 읽으면
 * **어긋날 두 번째 사본이 존재하지 않는다.** 덤으로 필터 걸린 목록이 그대로 공유된다.
 *
 * ★ `replace: true` 로 바꾼다 — 가격 입력은 **한 글자마다** onChange 가 난다. push 면
 *   "10000"을 치는 동안 히스토리에 5개가 쌓여 뒤로가기가 다섯 번 필요해진다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **모바일 우선** — FC-058 이 여기서 파손 3건을 냈다.
 * ══════════════════════════════════════════════════════════════════════════════
 *   · 루트에 `max-w-full overflow-x-hidden`(참고 대시보드 `EcommerceDashboard` 관례)
 *   · 세로 스택이 기본, **`lg:` 에서 처음 가로 2단**이 된다(레일은 그 전엔 존재하지 않는다)
 *   · 격자는 `grid-cols-1` 에서 시작
 *   · 고정 폭은 큰 브레이크포인트에만 — 레일 `lg:w-60`, 최대폭 `xl:max-w-[1280px]`
 *   · **`min-w-0` 가 결정적이다** — flex 자식의 기본 `min-width:auto` 때문에 격자 내용이
 *     넘치면 열 자체가 넓어져 **부모를 밀어낸다**. `overflow-x-hidden` 은 그것을 잘라 감출
 *     뿐이고, 원인을 없애는 건 이 한 줄이다.
 *
 * ★ **캐시 키가 홈과 갈라져 있다**(`auctionKeys.browse` vs `preview`) — 여기서 필터를
 *   아무리 만져도 홈 프리뷰 캐시는 건드려지지 않는다.
 */

/** 한 페이지 24건 — 3열(xl)·2열(sm/lg)·1열 모두 나누어떨어져 마지막 줄이 어색하지 않다. */
const PAGE_SIZE = 24

const AuctionList = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const [sheetOpen, setSheetOpen] = useState(false)
    const sheetTriggerRef = useRef<HTMLButtonElement>(null)

    const filters = useMemo(
        () => parseAuctionFilters(searchParams),
        [searchParams],
    )

    const applyFilters = useCallback(
        (next: AuctionFilterState) => {
            setSearchParams(toSearchParams(normalizeFilters(next)), {
                replace: true,
            })
        },
        [setSearchParams],
    )

    const resetFilters = useCallback(
        // 정렬은 남긴다 — 필터 초기화가 사용자의 정렬 선택까지 뺏을 이유가 없다.
        () => applyFilters(normalizeFilters({ sort: filters.sort })),
        [applyFilters, filters.sort],
    )

    const listQuery = useMemo(() => toListQuery(filters, PAGE_SIZE), [filters])

    const {
        data,
        isPending,
        isError,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        refetch,
    } = useAuctionBrowse(listQuery)

    const auctions = useMemo(
        () => data?.pages.flatMap((page) => page.content) ?? [],
        [data],
    )

    const activeCount = countActiveFilters(filters)
    const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage])

    return (
        <div className="mx-auto flex w-full max-w-full flex-col gap-4 overflow-x-hidden px-4 py-6 sm:px-6 lg:gap-6 lg:py-8 xl:max-w-[1280px]">
            <header className="flex min-w-0 flex-col gap-1">
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-gray-100">
                    경매 목록
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    조건을 좁혀 원하는 아이템을 찾아보세요.
                </p>
            </header>

            <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start">
                {/*
                 * ★ 레일은 `lg` 이상에서만 존재한다. 그 아래에서는 DOM 에 없고
                 *   같은 폼이 시트 안에서 렌더된다(폼 컴포넌트는 하나다).
                 *   `sticky` 로 목록을 길게 내려도 필터가 따라오되, 레일 자체가 길면
                 *   그 안에서만 스크롤한다(`max-h`+`overflow-y-auto`).
                 */}
                <aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100dvh-3rem)] lg:w-60 lg:shrink-0 lg:overflow-y-auto">
                    <Card header={{ content: '필터' }}>
                        <AuctionFilterPanel
                            idPrefix="rail"
                            value={filters}
                            onChange={applyFilters}
                        />
                    </Card>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                        {/*
                         * ★★ **커서 페이지에는 총건수가 없다**(계약 §1.3 `CursorPage` =
                         *    content·nextCursor·hasNext). 그래서 아직 더 있을 때는
                         *    **"N개 이상"** 이라고 적는다 — 지금까지 받은 수를 전체인 양
                         *    적으면 거짓이다. 다 받은 뒤(`hasNext=false`)에만 정확한 수다.
                         */}
                        <p
                            aria-live="polite"
                            className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                            data-testid="auction-list-count"
                            role="status"
                        >
                            {isPending || isError
                                ? ' '
                                : hasNextPage
                                  ? `${auctions.length}개 이상`
                                  : `${auctions.length}개`}
                        </p>

                        <div className="flex min-w-0 items-center gap-2">
                            <Button
                                ref={sheetTriggerRef}
                                className="lg:hidden"
                                data-testid="filter-sheet-trigger"
                                icon={<PiFunnelDuotone />}
                                size="sm"
                                type="button"
                                onClick={() => setSheetOpen(true)}
                            >
                                필터
                                {activeCount > 0 && (
                                    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-gray-900 px-1.5 text-xs font-bold text-white dark:bg-gray-100 dark:text-gray-900">
                                        {activeCount}
                                    </span>
                                )}
                            </Button>

                            <label className="sr-only" htmlFor="auction-sort">
                                정렬
                            </label>
                            <select
                                className="input input-sm h-9 w-auto"
                                data-testid="auction-sort"
                                id="auction-sort"
                                value={filters.sort}
                                onChange={(event) =>
                                    // 정렬이 바뀌면 쿼리 키가 바뀌어 커서가 자동 초기화된다.
                                    applyFilters({
                                        ...filters,
                                        sort: event.target.value,
                                    })
                                }
                            >
                                {AUCTION_SORT_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <ActiveFilterChips
                        value={filters}
                        onChange={applyFilters}
                        onReset={resetFilters}
                    />

                    <AuctionResults
                        auctions={auctions}
                        hasFilters={activeCount > 0}
                        hasNextPage={hasNextPage}
                        isError={isError}
                        isFetchingNextPage={isFetchingNextPage}
                        isPending={isPending}
                        onLoadMore={loadMore}
                        onResetFilters={resetFilters}
                        onRetry={() => void refetch()}
                    />
                </div>
            </div>

            <Sheet
                className="lg:hidden"
                closeLabel="필터 닫기"
                data-testid="filter-sheet"
                footer={
                    <div className="flex items-center gap-2">
                        <Button
                            block
                            size="sm"
                            type="button"
                            onClick={resetFilters}
                        >
                            초기화
                        </Button>
                        <Button
                            block
                            size="sm"
                            type="button"
                            variant="solid"
                            onClick={() => setSheetOpen(false)}
                        >
                            결과 보기
                        </Button>
                    </div>
                }
                open={sheetOpen}
                title="필터"
                triggerRef={sheetTriggerRef}
                onClose={() => setSheetOpen(false)}
            >
                {/*
                 * ★ 시트는 **즉시 반영**이다("적용" 버튼을 눌러야 걸리는 방식이 아니다).
                 *   결과 수가 칩 줄과 함께 실시간으로 바뀌므로 "결과 보기"는 닫기일 뿐이고,
                 *   눌러야만 적용되는 방식이었다면 시트를 닫기 전엔 몇 건인지 알 수 없다.
                 */}
                <AuctionFilterPanel
                    idPrefix="sheet"
                    showReset={false}
                    value={filters}
                    onChange={applyFilters}
                />
            </Sheet>
        </div>
    )
}

export default AuctionList
