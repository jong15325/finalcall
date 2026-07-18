import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuctionDetail } from '@/features/auction/api/useAuctions';
import {
  AuctionTradePanel,
  AuctionTradePanelSkeleton,
} from '@/features/auction/components/AuctionTradePanel';
import { isAuctionEnded, isTerminalStatus } from '@/features/auction/lib/auctionStatus';
import { AUCTION_STATUS_META } from '@/features/auction/types';
import { ElementBadge } from '@/features/item/components/ElementBadge';
import { ItemArtSlot } from '@/features/item/components/ItemArtSlot';
import { ItemSpecList } from '@/features/item/components/ItemSpecList';
import { hasErrorCode } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { ROUTES } from '@/routes/paths';
import { ERROR_CODES } from '@/types/errorCodes';
import type { AuctionDetail } from '@/types/schema';

/**
 * 경매 상세 (`/auctions/:auctionPublicId`, PublicLayout) — FC-037.
 *
 * 계약 §3.1 `GET /auctions/{auctionPublicId}` + §3.3 `AuctionDetail`.
 * 좌: 아이템(아트 슬롯 + 스탯) · 우: 거래 패널(남은 시간·가격·입찰 CTA 자리). 모바일은 세로 스택이며
 * **거래 패널이 아이템 스탯보다 위**에 온다 — 가격·마감이 먼저 알고 싶은 정보다.
 */
export function AuctionDetailPage() {
  const { auctionPublicId = '' } = useParams();
  const query = useAuctionDetail(auctionPublicId);

  if (query.isPending) return <DetailSkeleton />;

  if (query.isError) {
    // 404 는 "장애"가 아니라 "없는 매물"이다 — 에러 박스가 아니라 안내 + 목록 복귀 동선으로 받는다.
    if (hasErrorCode(query.error, ERROR_CODES.AUCTION_004)) return <AuctionNotFound />;
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  return <AuctionDetailView auction={query.data} />;
}

function AuctionDetailView({ auction }: { auction: AuctionDetail }) {
  const { item, status } = auction;
  const meta = AUCTION_STATUS_META[status];
  const ended = isAuctionEnded(auction);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /*
   * 상세 진입 시 포커스 관리(accessibility [3]): SPA 는 페이지 전환에도 포커스가 이전 화면(목록 카드 링크)에
   * 남아 스크린리더가 새 화면을 인지하지 못한다. 데이터가 도착해 제목이 확정된 시점에 제목으로 옮긴다.
   * `tabIndex={-1}` 은 프로그램 포커스 전용(탭 순서에는 넣지 않는다).
   */
  useEffect(() => {
    headingRef.current?.focus();
  }, [auction.auctionPublicId]);

  return (
    <div className="flex flex-col gap-6">
      <BackToList />

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
          <ElementBadge element={item.element} />
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold text-text outline-none sm:text-3xl"
        >
          {item.nameSnapshot}
        </h1>
        <p className="text-sm text-text-muted">
          판매자 {auction.sellerNickname} · 등록 {formatDateTime(auction.createdAt)}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
        {/* 거래 패널: 데스크톱은 우측 컬럼, 모바일은 아이템 정보보다 앞(order) */}
        <div className="order-1 lg:order-2 lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <AuctionTradePanel auction={auction} />
          </div>
        </div>

        <div className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-3">
          {/* 아트 슬롯 + 종료 오버레이([5.3] 딤 + "마감/판매완료") */}
          <div className="relative overflow-hidden rounded-lg border border-border">
            <ItemArtSlot name={item.nameSnapshot} element={item.element} level={item.level} />
            {ended ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="text-xl font-bold text-white">
                  {isTerminalStatus(status) ? meta.label : '마감'}
                </span>
              </div>
            ) : null}
          </div>

          <section className="flex flex-col gap-3" aria-labelledby="item-spec-heading">
            <h2 id="item-spec-heading" className="text-lg font-semibold text-text">
              아이템 정보
            </h2>
            <ItemSpecList item={item} />
          </section>
        </div>
      </div>
    </div>
  );
}

function BackToList() {
  return (
    <Link to={ROUTES.auctions} className="w-fit text-sm text-text-muted hover:text-text">
      ← 경매 목록
    </Link>
  );
}

function AuctionNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <BackToList />
      <EmptyState
        title="경매를 찾을 수 없습니다"
        description="이미 삭제되었거나 주소가 잘못되었을 수 있습니다."
        action={
          <Link
            to={ROUTES.auctions}
            className="inline-flex h-11 items-center rounded-md border border-border-strong px-4 text-sm text-text transition-colors duration-fast hover:bg-surface-sunken"
          >
            경매 목록으로
          </Link>
        }
      />
    </div>
  );
}

/** 로딩 스켈레톤 — 실제 화면과 같은 2열 골격을 그대로 그려 데이터 도착 시 이동이 없게 한다. */
function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="h-5 w-24 animate-pulse rounded-sm bg-surface-sunken" />
      <div className="flex flex-col gap-2">
        <div className="h-5 w-32 animate-pulse rounded-full bg-surface-sunken" />
        <div className="h-8 w-2/3 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-48 animate-pulse rounded-sm bg-surface-sunken" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="order-1 lg:order-2 lg:col-span-2">
          <AuctionTradePanelSkeleton />
        </div>
        <div className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-3">
          <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-surface-sunken" />
          <div className="flex flex-col gap-3">
            <div className="h-6 w-28 animate-pulse rounded-sm bg-surface-sunken" />
            <div className="h-24 w-full animate-pulse rounded-sm bg-surface-sunken" />
          </div>
        </div>
      </div>
    </div>
  );
}
