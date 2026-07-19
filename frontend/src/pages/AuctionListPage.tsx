import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { CursorLoadMore } from '@/components/ui/CursorLoadMore';
import { useAuctionList } from '@/features/auction/api/useAuctions';
import { AuctionAppliedFilters } from '@/features/auction/components/AuctionAppliedFilters';
import { AuctionCard, AuctionCardSkeleton } from '@/features/auction/components/AuctionCard';
import { AuctionFilterRail } from '@/features/auction/components/AuctionFilterRail';
import {
  AUCTION_SORTS,
  DEFAULT_SORT,
  applyFilters,
  hasActiveFilters,
  isAuctionSort,
  isAuctionStatus,
} from '@/features/auction/types';
import type { AuctionFilters, AuctionSortValue } from '@/features/auction/types';

/**
 * 경매 목록 (`/auctions`, PublicLayout) — FC-049에서 FC-042 목업(3차 확정안)으로 재구성.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 데스크톱(≥lg)                          모바일(<lg)
 * ┌──────────┬────────────────────┐      ┌──────────────────────┐
 * │ 필터     │ 결과 헤더(건수·정렬)│      │ 페이지 헤더           │
 * │ 레일     ├────────────────────┤      ├──────────────────────┤
 * │ 264px    │ 적용된 필터 칩      │      │ [필터 N개] 토글 버튼  │ ← 레일이 아니라 접힌 패널
 * │ sticky   ├────────────────────┤      ├──────────────────────┤
 * │          │ 카드 그리드 3~4열   │      │ 정렬 select · 건수    │
 * │ 대분류   │  ┌────┐┌────┐┌────┐│      ├──────────────────────┤
 * │  └종류   │  │세로││세로││세로││      │ 적용된 필터 칩(가로스크롤 없음, 줄바꿈)│
 * │ 속성     │  │아트││아트││아트││      ├──────────────────────┤
 * │ 레벨     │  └────┘└────┘└────┘│      │ 카드 그리드 2열       │
 * │ 골드포스 │                    │      │  ┌────┐┌────┐        │
 * │ 가격     │ [더 보기] + 센티넬  │      │  └────┘└────┘        │
 * │ 상태     │                    │      │ [더 보기] + 센티넬    │
 * └──────────┴────────────────────┘      └──────────────────────┘
 *
 * ★ **모바일은 레일을 좁힌 게 아니다.** 좁은 폭에서 264px 레일을 유지하면 카드가 1열로 눌린다.
 *   필터를 **기본 접힘 + 적용 개수 배지**로 바꿔, 첫 화면이 매물로 시작하게 한다. 필터는
 *   "지금 조건이 무엇인가"만 칩 줄로 남긴다 — 조건 확인과 조건 변경을 분리한 것이다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 필터·정렬은 **URL 쿼리에 산다** — 공유·뒤로가기가 그대로 동작하고, 컴포넌트가 파생 상태를
 * 이중 보관하지 않는다. 조건이 바뀌면 queryKey 가 바뀌어 커서가 자동 초기화된다.
 */
export function AuctionListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [railOpen, setRailOpen] = useState(false);

  const sort = useMemo<AuctionSortValue>(() => {
    const raw = searchParams.get('sort');
    return raw && isAuctionSort(raw) ? raw : DEFAULT_SORT;
  }, [searchParams]);

  const filters = useMemo<AuctionFilters>(() => {
    const status = searchParams.get('status');
    // URL 은 사용자가 손댈 수 있는 표면이다 — 읽을 때도 `applyFilters` 로 종속 불변식을 통과시킨다
    // (`?kind=1` 만 붙은 링크가 다의적 요청으로 나가지 않게).
    return applyFilters({
      status: status && isAuctionStatus(status) ? status : undefined,
      minPrice: toNumber(searchParams.get('minPrice')),
      maxPrice: toNumber(searchParams.get('maxPrice')),
      element: toNumber(searchParams.get('element')),
      subGroup: toNumber(searchParams.get('subGroup')),
      kind: toNumber(searchParams.get('kind')),
      minLevel: toNumber(searchParams.get('minLevel')),
      maxLevel: toNumber(searchParams.get('maxLevel')),
      goldforceActive: searchParams.get('goldforceActive') === 'true' ? true : undefined,
    });
  }, [searchParams]);

  const applyParams = useCallback(
    (next: AuctionFilters, nextSort: AuctionSortValue) => {
      const params = new URLSearchParams();
      if (nextSort !== DEFAULT_SORT) params.set('sort', nextSort);
      for (const [key, value] of Object.entries(next)) {
        if (value !== undefined) params.set(key, String(value));
      }
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const query = useAuctionList({ ...filters, sort });
  const auctions = useMemo(
    () => query.data?.pages.flatMap((page) => page.content) ?? [],
    [query.data],
  );
  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const filtered = hasActiveFilters(filters);
  const activeCount = Object.values(filters).filter((value) => value !== undefined).length;

  return (
    <div className="pb-12">
      <header className="border-b border-border pb-5 pt-8">
        <h1 className="text-title text-text">경매</h1>
        <p className="mt-2 max-w-[60ch] text-body text-text-muted">
          남은 시간과 최고가는 서버 시각 기준입니다. 마감 직전에 입찰이 들어오면 마감이 자동으로
          연장됩니다.
        </p>
      </header>

      <div className="grid items-start gap-6 pt-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-8">
        <div>
          {/* 모바일 전용 토글 — 데스크톱에서는 레일이 항상 펼쳐져 있으므로 버튼 자체가 없다. */}
          <Button
            type="button"
            variant="outline"
            size="md"
            aria-expanded={railOpen}
            aria-controls="auction-filter-rail"
            onClick={() => setRailOpen((open) => !open)}
            className="mb-3 w-full lg:hidden"
          >
            {railOpen ? '필터 접기' : `필터${activeCount > 0 ? ` (${activeCount})` : ''}`}
          </Button>

          <div
            id="auction-filter-rail"
            className={`${railOpen ? 'block' : 'hidden'} lg:sticky lg:top-6 lg:block`}
          >
            <AuctionFilterRail filters={filters} onChange={(next) => applyParams(next, sort)} />
          </div>
        </div>

        <section aria-label="경매 목록">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-text-muted">
              {query.isSuccess ? (
                <>
                  <b className="font-num text-text">{auctions.length}</b>건 표시 중
                </>
              ) : (
                ' '
              )}
            </p>
            <label className="ml-auto">
              <span className="sr-only">정렬</span>
              <select
                className="h-10 min-w-[160px] rounded-md border border-border-strong bg-surface px-3 text-body text-text focus:border-primary"
                value={sort}
                onChange={(event) => applyParams(filters, event.target.value as AuctionSortValue)}
              >
                {AUCTION_SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <AuctionAppliedFilters filters={filters} onChange={(next) => applyParams(next, sort)} />

          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : query.isPending ? (
            <AuctionGrid busy>
              {Array.from({ length: 8 }, (_, index) => (
                <li key={index}>
                  <AuctionCardSkeleton />
                </li>
              ))}
            </AuctionGrid>
          ) : auctions.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState
                title={filtered ? '조건에 맞는 매물이 없습니다' : '진행 중인 경매가 없습니다'}
                description={
                  filtered
                    ? '조건을 넓히면 더 많은 매물을 볼 수 있습니다. 대분류·속성부터 풀어 보세요.'
                    : '새 매물이 등록되면 이 자리에서 카운트다운이 시작됩니다.'
                }
                action={
                  filtered ? (
                    <Button variant="outline" onClick={() => applyParams({}, sort)}>
                      필터 초기화
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <AuctionGrid>
                {auctions.map((auction) => (
                  <li key={auction.auctionPublicId}>
                    <AuctionCard auction={auction} />
                  </li>
                ))}
              </AuctionGrid>
              <CursorLoadMore
                hasNext={query.hasNextPage}
                isLoading={query.isFetchingNextPage}
                onLoadMore={loadMore}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** ListGrid([5.4]) — 세로 카드라 모바일도 2열이 성립한다(가로 카드였다면 1열이어야 했다). */
function AuctionGrid({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <ul
      className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-6 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy={busy}
    >
      {children}
    </ul>
  );
}

function toNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
