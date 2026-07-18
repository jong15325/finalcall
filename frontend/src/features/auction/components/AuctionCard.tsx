import { Link } from 'react-router-dom';
import { Countdown } from '@/components/ui/Countdown';
import { StatusChip } from '@/components/ui/StatusChip';
import { ElementBadge } from '@/features/item/components/ElementBadge';
import { ItemArtSlot } from '@/features/item/components/ItemArtSlot';
import { formatMoney } from '@/lib/format';
import { buildPath } from '@/routes/paths';
import type { AuctionSummary } from '@/types/schema';
import { AUCTION_STATUS_META } from '../types';

/**
 * AuctionCard — design-system [5.3] ItemCard 의 경매 적용.
 *
 * 구조: [상단] 검정 아트 슬롯(플레이스홀더) + [하단] 웹 상거래 영역(아이템명·가격·카운트다운·상태 칩·판매자).
 * 하단은 전부 커머스 토큰(near-black·의미색)이고, 게임색(element)은 아트 슬롯과 속성 배지 안에만 머문다
 * ([1.2] Game-Color Containment). 등급 배지는 없다(D-073 폐기).
 *
 * 카드 전체가 하나의 링크다 — 탭 정지점을 1개로 유지해 20장 그리드의 키보드 주행을 짧게 만든다.
 */
const TERMINAL_STATUSES = ['SOLD', 'UNSOLD', 'CANCELLED'] as const;

function isTerminal(status: AuctionSummary['status']): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  const { item, status } = auction;
  const meta = AUCTION_STATUS_META[status];
  const ended = isTerminal(status) || new Date(auction.endAt).getTime() <= Date.now();

  return (
    <article className="group h-full">
      <Link
        to={buildPath.auctionDetail(auction.auctionPublicId)}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition duration-fast hover:border-border-strong hover:shadow-lg"
      >
        {/* 아트 슬롯 + 종료 오버레이([5.3] 딤 + "마감") */}
        <div className="relative">
          <ItemArtSlot name={item.nameSnapshot} element={item.element} level={item.level} />
          {ended ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="text-lg font-bold text-white">
                {isTerminal(status) ? meta.label : '마감'}
              </span>
            </div>
          ) : null}
        </div>

        {/* 웹 상거래 영역 */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
            <ElementBadge element={item.element} />
          </div>

          <h3 className="line-clamp-2 text-base font-semibold text-text">{item.nameSnapshot}</h3>

          <AuctionPrice auction={auction} />

          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <Countdown endAt={auction.endAt} label={item.nameSnapshot} />
            <span className="truncate text-sm text-text-muted">{auction.sellerNickname}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

/**
 * ★ 가격 표시 — 정직성이 계약 설계 의도다(auction-domain-spec §9-b).
 *
 * `highestBidAmount` 가 null 이면 입찰이 아직 없다는 뜻이다. 이때 **`startPrice` 를 현재가처럼 보이게 하지 않고**
 * "입찰 없음 · 시작가 N" 으로 표기한다. EPIC-BID 가 붙어 실값이 내려오면 이 null 분기만으로 현재가 표시로
 * 자동 전환된다(계약·스키마 무변경).
 */
function AuctionPrice({ auction }: { auction: AuctionSummary }) {
  const hasBid = auction.highestBidAmount != null;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted">
        {hasBid ? `현재가 · 입찰 ${auction.bidCount}회` : '입찰 없음 · 시작가'}
      </span>
      <span className="font-num text-lg font-bold tabular-nums text-text">
        {formatMoney(hasBid ? (auction.highestBidAmount as number) : auction.startPrice)}
        <span className="ml-1 text-xs font-medium text-text-subtle">게임머니</span>
      </span>
      {auction.buyNowPrice != null ? (
        <span className="font-num text-xs tabular-nums text-text-muted">
          즉시구매 {formatMoney(auction.buyNowPrice)}
        </span>
      ) : null}
    </div>
  );
}

/** 로딩 스켈레톤 — 카드와 같은 비율·높이를 차지해 데이터 도착 시 레이아웃이 튀지 않는다. */
export function AuctionCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="aspect-[4/3] w-full animate-pulse bg-surface-sunken" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-5 w-20 animate-pulse rounded-full bg-surface-sunken" />
        <div className="h-5 w-3/4 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-6 w-1/2 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-full animate-pulse rounded-sm bg-surface-sunken" />
      </div>
    </div>
  );
}
