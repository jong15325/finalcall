import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { CursorLoadMore } from '@/components/ui/CursorLoadMore';
import { useAuctionList } from '@/features/auction/api/useAuctions';
import { AuctionCard, AuctionCardSkeleton } from '@/features/auction/components/AuctionCard';
import { AuctionFilterBar } from '@/features/auction/components/AuctionFilterBar';
import {
  DEFAULT_SORT,
  hasActiveFilters,
  isAuctionSort,
  isAuctionStatus,
} from '@/features/auction/types';
import type { AuctionFilters, AuctionSortValue } from '@/features/auction/types';

/**
 * 경매 목록 (`/auctions`, PublicLayout) — FC-036.
 *
 * 계약 §3.1 `GET /auctions` cursor 목록 + 정렬 화이트리스트 + 핵심 필터 4종.
 * 필터·정렬은 **URL 쿼리에 산다** — 공유·뒤로가기가 그대로 동작하고, 컴포넌트가 파생 상태를 이중 보관하지 않는다.
 * 조건이 바뀌면 queryKey 가 바뀌어 커서가 자동 초기화된다(keyset 은 정렬·필터 종속).
 */
export function AuctionListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const sort = useMemo<AuctionSortValue>(() => {
    const raw = searchParams.get('sort');
    return raw && isAuctionSort(raw) ? raw : DEFAULT_SORT;
  }, [searchParams]);

  const filters = useMemo<AuctionFilters>(() => {
    const status = searchParams.get('status');
    return {
      status: status && isAuctionStatus(status) ? status : undefined,
      minPrice: toNumber(searchParams.get('minPrice')),
      maxPrice: toNumber(searchParams.get('maxPrice')),
      element: toNumber(searchParams.get('element')),
    };
  }, [searchParams]);

  const applyParams = useCallback(
    (next: AuctionFilters, nextSort: AuctionSortValue) => {
      const params = new URLSearchParams();
      if (nextSort !== DEFAULT_SORT) params.set('sort', nextSort);
      if (next.status) params.set('status', next.status);
      if (next.minPrice !== undefined) params.set('minPrice', String(next.minPrice));
      if (next.maxPrice !== undefined) params.set('maxPrice', String(next.maxPrice));
      if (next.element !== undefined) params.set('element', String(next.element));
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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        {/* 페이지 제목은 화면당 1개다([3.2] `text-title`). ≤719px 축소는 index.css 가 중앙에서 처리한다. */}
        <h1 className="text-title text-text">경매</h1>
        <p className="text-body text-text-muted">마감이 가까운 매물부터 보여줍니다.</p>
      </header>

      <AuctionFilterBar
        filters={filters}
        sort={sort}
        onChange={(next) => applyParams(next, sort)}
        onSortChange={(nextSort) => applyParams(filters, nextSort)}
      />

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
        <EmptyState
          title={filtered ? '조건에 맞는 매물이 없습니다' : '진행 중인 경매가 없습니다'}
          description={
            filtered
              ? '필터를 넓히면 더 많은 매물을 볼 수 있습니다.'
              : '새 매물이 등록되면 이곳에 표시됩니다.'
          }
          action={
            filtered ? (
              <Button variant="outline" onClick={() => applyParams({}, sort)}>
                필터 초기화
              </Button>
            ) : undefined
          }
        />
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
    </div>
  );
}

/** ListGrid([5.4]) — 1열(모바일)→2(sm)→3(lg)→4(xl). 목록 시맨틱은 ul/li 로 준다(accessibility [5]). */
function AuctionGrid({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <ul
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
