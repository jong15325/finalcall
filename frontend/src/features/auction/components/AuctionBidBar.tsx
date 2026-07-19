import { Button } from '@/components/ui/Button';
import { CountdownZone } from '@/components/ui/Countdown';
import { bidCtaLabelFor } from '@/lib/countdown';
import type { CountdownPhase } from '@/lib/countdown';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { AuctionDetail } from '@/types/schema';
import { isTerminalStatus } from '../lib/auctionStatus';
import { AUCTION_STATUS_META, RESULT_TYPE_LABEL } from '../types';

/**
 * AuctionBidBar — 경매 상세의 **전폭 스티키 입찰 바**(FC-049, references [4-4]·[8-2]).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 상시 노출은 편의가 아니라 **정확성 요구**다(references [4-1]).
 * 상시 노출이 없으면 사용자는 스크롤 도중 **낡은 가격을 기억한 채** 결정한다. 경매에서 그건
 * 오조작이 아니라 손해다. 그래서 데스크톱은 헤더 아래 sticky, 모바일은 하단 fixed 바로
 * **역할을 다른 컴포넌트에 넘긴다**(같은 바를 좁혀 접는 게 아니다 — `AuctionMobileBar`).
 *
 * 세 구역은 [4-1]의 필수 3요소를 경매용으로 치환한 것이다:
 *   가격 → 현재가 / 변형·옵션 상태 → 잔여시간 / 주요 CTA → 입찰
 *
 * ★ **화면당 하나뿐인 `text-figure-xl`(44)이 구간에 따라 옮겨 간다**([3.1] 원칙 4).
 *   평시·주의에는 **현재가**가 이 화면의 주인공이고, 임박에 들어서면 주인공이 **시간**으로 넘어간다.
 *   두 곳에 동시에 쓰지 않는다 — 그러면 주인공이 둘이 되어 위계가 무너진다.
 *
 * 높이·폭이 고정이고 수치는 전부 `font-num` 이라 숫자가 바뀌어도 바가 흔들리지 않는다.
 * ══════════════════════════════════════════════════════════════════════════════
 */
export function AuctionBidBar({
  auction,
  phase,
  remaining,
  ended,
}: {
  auction: AuctionDetail;
  phase: CountdownPhase;
  remaining: number;
  ended: boolean;
}) {
  const meta = AUCTION_STATUS_META[auction.status];
  const hasBid = auction.highestBidAmount != null;
  const soldByBid = auction.status === 'SOLD' && hasBid;
  const priceLabel = hasBid ? (soldByBid ? '낙찰가' : '현재가') : '입찰 없음 · 시작가';
  const amount = hasBid ? (auction.highestBidAmount as number) : auction.startPrice;
  // 임박 구간에서는 최고 승격 단계를 카운트다운에 양보한다(위 ★).
  const priceClass = phase === 'urgent' ? 'text-figure' : 'text-figure-xl';

  return (
    <section
      className="rounded-lg border border-border bg-surface shadow-md lg:sticky lg:top-4 lg:z-30"
      aria-label="거래 정보"
    >
      <div className="grid gap-5 p-5 md:grid-cols-2 md:gap-6 lg:grid-cols-[minmax(190px,230px)_minmax(190px,1fr)_auto] lg:gap-8 lg:p-6">
        {/* ── 시간 ─────────────────────────────────────────────────────────── */}
        <div className="min-w-0">
          <span className="block text-label text-text-subtle">{ended ? '마감' : '남은 시간'}</span>
          <div className="mt-2 flex min-h-12 items-center">
            <CountdownZone
              endAt={auction.endAt}
              phase={ended ? 'ended' : phase}
              remaining={remaining}
              label={auction.item.nameSnapshot}
            />
          </div>
          <p className="mt-2 text-micro leading-relaxed text-text-subtle">
            마감 <b className="font-num text-text-muted">{formatDateTime(auction.endAt)}</b> · 서버
            수신 시각 기준
          </p>
          {auction.status === 'SCHEDULED' && auction.startAt ? (
            <p className="mt-1 text-micro text-text-subtle">
              시작 <b className="font-num text-text-muted">{formatDateTime(auction.startAt)}</b>
            </p>
          ) : null}
        </div>

        {/* ── 가격 ─────────────────────────────────────────────────────────── */}
        <div className="min-w-0 md:border-l md:border-border-muted md:pl-6">
          <span className="block text-label text-text-subtle">{priceLabel}</span>
          <div className="mt-2 flex min-h-12 items-center">
            {/* 가격에는 긴박 표현을 걸지 않는다 — 가격까지 빨개지면 세일 광고가 된다(references [1-5]③). */}
            <p className={`font-num ${priceClass} text-text`}>
              {formatMoney(amount)}
              <span className="ml-1 text-micro font-semibold text-text-muted">G</span>
            </p>
          </div>
          <p className="mt-2 text-micro leading-relaxed text-text-subtle">
            입찰 <b className="font-num text-text-muted">{auction.bidCount}</b>회 · 시작가{' '}
            <b className="font-num text-text-muted">{formatMoney(auction.startPrice)}G</b> ·{' '}
            {/*
             * ★ 부채 14 — `buyNowPrice` 가 null 이면 **줄이 사라지던** 문제. 값이 없다고 자리를 없애면
             * 경매마다 이 문단의 높이가 달라지고, 사용자는 "즉시구매를 못 본 건지 없는 건지" 알 수 없다.
             * FC-042가 세운 원칙대로 **"설정 없음"으로 자리를 유지**한다.
             */}
            즉시구매{' '}
            {auction.buyNowPrice != null ? (
              <b className="font-num text-text-muted">{formatMoney(auction.buyNowPrice)}G</b>
            ) : (
              <b className="font-medium text-text-subtle">설정 없음</b>
            )}
          </p>
          <p className="mt-1 text-micro text-text-subtle">
            최고 입찰자 <b className="text-text-muted">{auction.highestBidderMasked ?? '없음'}</b>
          </p>
        </div>

        {/* ── 액션 ─────────────────────────────────────────────────────────── */}
        <div className="min-w-0 md:col-span-2 md:border-t md:border-border-muted md:pt-5 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
            {/* resultType 은 상태 칩 옆 보조 라벨이다([5.8]). */}
            {auction.resultType ? (
              <span className="text-label text-text-muted">
                {RESULT_TYPE_LABEL[auction.resultType]}
              </span>
            ) : null}
          </div>
          <div className="mt-3">
            <BidCallToAction auction={auction} ended={ended} phase={phase} />
          </div>
        </div>
      </div>

      <ExtensionNote auction={auction} ended={ended} />
    </section>
  );
}

/**
 * ★ 부채 15 — 소프트클로즈 **규칙 자체를 상시 안내**한다.
 *
 * 종전 구현은 `extensionCount > 0` 일 때만 연장 사실을 적었다. 그러면 **연장이 일어나기 전까지는
 * 규칙의 존재를 알 수 없고**, 0이 되어야 할 카운트다운이 갑자기 늘어나는 순간 사용자는 배신감을
 * 느낀다(references [1-3]: "카운트다운이 연장될 수 있다는 사실 자체가 UI 요소다").
 * 그래서 규칙은 항상 적고, 실제 연장 횟수는 **있을 때만** 덧붙인다.
 *
 * ★ FC-038 이월 minor — 연장 안내는 입찰이 붙는 순간 accessibility [6]의 실효 요건이 된다.
 * 연장으로 `endAt` 이 뒤로 밀리면 `aria-live` 로 한 번 알린다(초당 갱신 스팸과 구분되는 사건성 안내).
 */
function ExtensionNote({ auction, ended }: { auction: AuctionDetail; ended: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-b-lg border-t border-border bg-surface-band px-5 py-3 lg:px-6">
      <p className="text-micro leading-relaxed text-text-muted">
        마감 <b className="font-num text-text">30초</b> 안에 입찰이 들어오면 마감이 미뤄집니다. 최대{' '}
        <b className="font-num text-text">{formatDateTime(auction.maxEndAt)}</b>까지 연장됩니다.
        {auction.extensionCount > 0 ? (
          <>
            {' '}
            지금까지 <b className="font-num text-text">{auction.extensionCount}회</b> 연장됐습니다.
          </>
        ) : null}
      </p>
      {!ended ? (
        <span
          className="ml-auto inline-flex items-center gap-2 text-micro text-text-subtle"
          aria-live="polite"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          연장 {auction.extensionCount}회 반영됨
        </span>
      ) : null}
    </div>
  );
}

/**
 * 입찰 CTA **자리**([5.1] primary=ink 블랙, lg). CTA 문구는 임박 구간에서 "지금 입찰"로 바뀐다
 * (부채 10 — 구간 전환 시 CTA도 함께 움직인다).
 *
 * ★ **입찰 실행은 이 티켓 범위 밖이다.** 백엔드 `POST /auctions/{id}/bids` 는 존재하지만
 * 프론트 입찰 뮤테이션·금액 입력·바텀시트는 별도 티켓 소관이라, 여기서는 자리와 문구만 정확히 잡는다.
 * 비활성 버튼에는 **사유를 반드시 병기**한다 — 이유 없는 disabled 는 금지다([5.1]·[5.2]).
 */
function BidCallToAction({
  auction,
  ended,
  phase,
}: {
  auction: AuctionDetail;
  ended: boolean;
  phase: CountdownPhase;
}) {
  const reasonId = 'bid-cta-reason';
  const terminal = isTerminalStatus(auction.status);

  const label = ended ? '마감된 경매' : bidCtaLabelFor(phase);
  const reason = ended
    ? terminal
      ? `이 경매는 ${AUCTION_STATUS_META[auction.status].label} 상태로 종료되었습니다.`
      : '마감 시각이 지나 더 이상 입찰할 수 없습니다.'
    : auction.status === 'SCHEDULED'
      ? // 계약 §3.1 주(v1.8 F4): "아직 시작 안 함"과 "이미 끝남"은 안내와 재시도 가능성이 정반대다.
        '아직 시작하지 않은 경매입니다. 시작 시각이 지나면 입찰할 수 있습니다.'
      : '입찰 기능은 준비 중입니다. 열리면 이 자리에서 바로 입찰할 수 있습니다.';

  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary" size="lg" disabled aria-describedby={reasonId} className="w-full">
        {label}
      </Button>
      {!ended && auction.minNextBidAmount != null ? (
        <p className="text-micro text-text-subtle">
          다음 최소 입찰가{' '}
          <b className="font-num text-text-muted">{formatMoney(auction.minNextBidAmount)}G</b>
        </p>
      ) : null}
      {/* 비활성 사유는 각주가 아니라 읽혀야 하는 설명문이다([3.2] body). */}
      <p id={reasonId} className="text-body text-text-subtle">
        {reason}
      </p>
    </div>
  );
}

/** 로딩 스켈레톤 — 실제 바와 같은 구역 수·높이를 차지해 도착 시 레이아웃이 튀지 않는다. */
export function AuctionBidBarSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-md lg:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(190px,230px)_minmax(190px,1fr)_auto]">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className="h-3 w-20 animate-pulse rounded-sm bg-surface-sunken" />
            <div className="h-12 w-40 animate-pulse rounded-sm bg-surface-sunken" />
            <div className="h-3 w-full animate-pulse rounded-sm bg-surface-sunken" />
          </div>
        ))}
      </div>
    </div>
  );
}
