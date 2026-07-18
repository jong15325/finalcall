import { Button } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/Countdown';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { AuctionDetail } from '@/types/schema';
import { isAuctionEnded, isTerminalStatus } from '../lib/auctionStatus';
import { AUCTION_STATUS_META, RESULT_TYPE_LABEL } from '../types';

/**
 * AuctionTradePanel — 경매 상세의 거래 패널(design-system [5.9]·[5.10]·[5.1]).
 *
 * ★ **이 패널은 EPIC-BID 가 얹힐 자리를 미리 잡아 둔 골격이다.** 지금은 입찰 API 가 없어
 * 최고가·입찰수·최고입찰자가 전건 비어 있지만(auction-domain-spec §9-b), **영역을 지우지 않는다** —
 * 값이 없다고 블록을 없애면 EPIC-BID 완료 시 레이아웃이 통째로 흔들린다. 대신 "입찰 없음 · 시작가 N"으로
 * 정직하게 적고, 실값이 오면 **같은 자리에 숫자만 바뀐다**(계약·스키마 무변경 전환).
 *
 * 색 계층([1.2]): CTA 는 **블랙(`ink`)** 이고 퍼플은 쓰지 않는다(액센트 전용). 상태는 의미색 칩,
 * element 색은 이 패널에 들어오지 않는다(Game-Color Containment — 아트·배지 담당).
 *
 * DOM 순서 = 시각 순서 = 조작 순서(accessibility [3]): 남은 시간 → 가격 → 최소 입찰가 → CTA.
 */
export function AuctionTradePanel({ auction }: { auction: AuctionDetail }) {
  const meta = AUCTION_STATUS_META[auction.status];
  const ended = isAuctionEnded(auction);
  const hasBid = auction.highestBidAmount != null;

  return (
    <section
      className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 shadow-sm"
      aria-label="거래 정보"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
        {auction.resultType ? (
          <span className="text-xs font-medium text-text-muted">
            {RESULT_TYPE_LABEL[auction.resultType]}
          </span>
        ) : null}
      </div>

      <TimeBlock auction={auction} ended={ended} />

      <hr className="border-border" />

      <PriceBlock auction={auction} hasBid={hasBid} ended={ended} />

      <BidCallToAction auction={auction} ended={ended} />
    </section>
  );
}

/** 남은 시간 — 폴링(U-006)으로 endAt 이 갱신되면 소프트클로즈 연장이 그대로 반영된다. */
function TimeBlock({ auction, ended }: { auction: AuctionDetail; ended: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-text-muted">{ended ? '마감' : '남은 시간'}</span>
      <Countdown endAt={auction.endAt} size="lg" />
      <span className="text-xs text-text-subtle">마감 {formatDateTime(auction.endAt)}</span>
      {auction.status === 'SCHEDULED' && auction.startAt ? (
        <span className="text-xs text-text-subtle">시작 {formatDateTime(auction.startAt)}</span>
      ) : null}
      {auction.extensionCount > 0 ? (
        // 소프트클로즈 연장은 사용자가 "왜 아직 안 끝났지?"를 묻게 되는 지점이라 횟수·상한을 밝힌다.
        <span className="text-xs text-text-subtle">
          소프트클로즈 {auction.extensionCount}회 연장 · 최대 {formatDateTime(auction.maxEndAt)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * ★ 최고가·최고입찰자 영역 — **자리 확보가 목적이다.**
 *
 * `highestBidAmount` 가 null 이면 입찰이 없다는 뜻이지 "시작가가 현재가"라는 뜻이 아니다.
 * `startPrice` 를 현재가처럼 위장하지 않고 라벨로 구분한다(auction-domain-spec §9-b).
 * 입찰수·최고입찰자 줄은 **값이 없어도 항상 렌더**한다 — EPIC-BID 이후 높이가 변하지 않게.
 */
function PriceBlock({
  auction,
  hasBid,
  ended,
}: {
  auction: AuctionDetail;
  hasBid: boolean;
  ended: boolean;
}) {
  const soldByBid = auction.status === 'SOLD' && hasBid;
  const priceLabel = hasBid ? (soldByBid ? '낙찰가' : '현재가') : '입찰 없음 · 시작가';

  return (
    <div className="flex flex-col gap-3">
      <MoneyAmount
        label={priceLabel}
        amount={hasBid ? (auction.highestBidAmount as number) : auction.startPrice}
        unit="게임머니"
        size="lg"
      />

      <dl className="flex flex-col gap-1.5">
        <InfoRow label="입찰" value={`${auction.bidCount}회`} />
        <InfoRow label="최고 입찰자" value={auction.highestBidderMasked ?? '없음'} />
        {/*
         * 시작가는 **항상 렌더**한다. 입찰 유무로 줄을 껐다 켜면 첫 입찰이 붙는 순간 패널 높이가
         * 한 줄 늘어 레이아웃이 튄다 — 이 패널의 "자리 유지" 원칙(위 ★)과 어긋난다.
         * 입찰 전에는 위 MoneyAmount 와 같은 값이지만, 라벨이 다르므로 중복 정보가 아니다.
         */}
        <InfoRow label="시작가" value={`${formatMoney(auction.startPrice)} 게임머니`} />
        {/*
         * `minNextBidAmount`(계약 v1.8 F3)는 **서버가 계산해 주는 값**이다 — 계단식 증분표는 서버 설정이라
         * 클라이언트가 복제하면 드리프트가 난다. 그래서 값이 없어도 **직접 계산하지 않고** 자리만 비워 둔다.
         * 종료 경매는 계약상 null 이라 줄 자체를 내린다(다음 입찰이 없으므로).
         */}
        {!ended ? (
          <InfoRow
            label="다음 최소 입찰가"
            value={
              auction.minNextBidAmount != null
                ? `${formatMoney(auction.minNextBidAmount)} 게임머니`
                : '—'
            }
            emphasis
          />
        ) : null}
        {auction.buyNowPrice != null ? (
          <InfoRow label="즉시구매가" value={`${formatMoney(auction.buyNowPrice)} 게임머니`} />
        ) : null}
      </dl>
    </div>
  );
}

function InfoRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className={`font-num text-sm tabular-nums text-text ${emphasis ? 'font-semibold' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

/**
 * ★ 입찰 CTA **자리**([5.1] primary=ink 블랙, lg).
 *
 * 입찰 실행은 EPIC-BID 소관이라 **동작을 붙이지 않는다.** 다만 자리를 지금 정확히 잡아 두면 그때 화면을
 * 다시 설계할 필요가 없다(SocialLoginButton [5.11]의 "자리 확보 원칙"과 같은 태도).
 * 비활성 버튼은 **사유를 반드시 병기**한다 — 이유 없는 disabled 는 금지다([5.2] Checkbox 조항의 일반 원칙).
 */
function BidCallToAction({ auction, ended }: { auction: AuctionDetail; ended: boolean }) {
  const reasonId = 'bid-cta-reason';
  const terminal = isTerminalStatus(auction.status);
  const label = ended ? '마감된 경매' : '입찰 준비 중';
  const reason = ended
    ? terminal
      ? `이 경매는 ${AUCTION_STATUS_META[auction.status].label} 상태로 종료되었습니다.`
      : '마감 시각이 지나 더 이상 입찰할 수 없습니다.'
    : '입찰 기능은 준비 중입니다. 열리면 이 자리에서 바로 입찰할 수 있습니다.';

  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary" size="lg" disabled aria-describedby={reasonId} className="w-full">
        {label}
      </Button>
      <p id={reasonId} className="text-xs text-text-subtle">
        {reason}
      </p>
    </div>
  );
}

/** 로딩 스켈레톤 — 실제 패널과 같은 블록 수·높이를 차지해 도착 시 레이아웃이 튀지 않는다. */
export function AuctionTradePanelSkeleton() {
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="h-5 w-16 animate-pulse rounded-full bg-surface-sunken" />
      <div className="flex flex-col gap-2">
        <div className="h-4 w-20 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-8 w-40 animate-pulse rounded-sm bg-surface-sunken" />
      </div>
      <hr className="border-border" />
      <div className="flex flex-col gap-2">
        <div className="h-4 w-24 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-9 w-48 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-full animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-2/3 animate-pulse rounded-sm bg-surface-sunken" />
      </div>
      <div className="h-12 w-full animate-pulse rounded-md bg-surface-sunken" />
    </div>
  );
}
