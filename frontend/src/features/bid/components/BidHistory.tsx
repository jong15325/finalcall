import { useState } from 'react';
import { ErrorState } from '@/components/feedback/ErrorState';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatMoney } from '@/lib/format';
import type { BidStatus, BidSummary } from '@/types/schema';
import { useBidHistory } from '../api/useBids';

/**
 * 입찰 이력 — FC-049 부채 16(화면 자체가 없었다). 계약 §3.1 `GET /auctions/{id}/bids` + §3.3 `BidSummary`.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 반응형이 **배치 변경이 아니라 IA 재설계**인 대표 사례다(references [4-3]·[8-3]).
 *
 *  데스크톱(≥sm) — 표                     모바일(<sm) — 카드 리스트
 *  ┌────────┬───────┬──────┬────┬─────┐   ┌──────────────────────────┐
 *  │ 입찰자 │ 입찰가 │ 증분 │상태│ 시각│   │ 1,280,000G      [현재최고]│
 *  ├────────┼───────┼──────┼────┼─────┤   │ 서리*** · 19:41 · +40,000 │
 *  │ 서리***│1,280k │+40k  │최고│19:41│   ├──────────────────────────┤
 *  │ 달빛***│1,240k │+60k  │밀림│19:41│   │ 1,240,000G                │
 *  └────────┴───────┴──────┴────┴─────┘   │ 달빛*** · 19:41 · +60,000 │
 *                                          └──────────────────────────┘
 *
 * **표를 좁은 폭에서 그대로 접으면 가로 스크롤 지옥이 된다.** 5열을 360px에 밀어 넣는 대신 형식
 * 자체를 바꾼다 — 금액을 첫 줄 주인공으로 올리고 나머지를 메타 한 줄로 접는다.
 * 두 마크업이 DOM에 함께 있지만 `hidden` 이 걸린 쪽은 스크린리더에도 노출되지 않는다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ★ **자금 정보를 그리지 않는다.** 계약이 홀드·잔액을 응답에서 뺀 것은 설계 결정이고(§3.3),
 * 화면도 그 경계를 넘겨 추론하지 않는다. 입찰자는 마스킹된 닉네임뿐이다(SEC-007).
 *
 * 페이징은 **offset**(계약 §1.3 소규모 예외)이라 무한스크롤이 아니라 페이저다.
 */

const BID_STATUS_META: Record<BidStatus, { label: string; tone: 'info' | 'neutral' | 'success' }> =
  {
    ACTIVE: { label: '현재 최고', tone: 'info' },
    OUTBID: { label: '밀림', tone: 'neutral' },
    WON: { label: '낙찰', tone: 'success' },
  };

export function BidHistory({
  auctionPublicId,
  startPrice,
}: {
  auctionPublicId: string;
  startPrice: number;
}) {
  const [page, setPage] = useState(0);
  const query = useBidHistory(auctionPublicId, page);

  const bids = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const totalElements = query.data?.totalElements ?? 0;

  return (
    <section className="pt-12" aria-labelledby="bid-history-heading">
      <div className="mb-5">
        <h2 id="bid-history-heading" className="text-value text-text">
          입찰 이력
        </h2>
        <p className="mt-1 text-body text-text-muted">
          입찰자 이름은 마스킹됩니다. 홀드 금액·잔액 등 자금 정보는 공개하지 않습니다.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isPending ? (
          <BidHistorySkeleton />
        ) : bids.length === 0 ? (
          /* 빈 상태는 이 구조의 알려진 약점이다(references [7]) — 하단이 휑해지므로 반드시 설계한다. */
          <div className="px-5 py-16 text-center">
            <p className="text-value text-text">아직 입찰이 없습니다</p>
            <p className="mt-2 text-body text-text-subtle">
              첫 입찰자가 될 수 있습니다. 시작가{' '}
              <b className="font-num text-text-muted">{formatMoney(startPrice)}G</b>부터 입찰할 수
              있습니다.
            </p>
          </div>
        ) : (
          <>
            <BidTable bids={bids} />
            <BidCardList bids={bids} />
            {totalPages > 1 ? (
              <BidPager
                page={page}
                totalPages={totalPages}
                totalElements={totalElements}
                onChange={setPage}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/** 직전 입찰과의 증분. 페이지 경계에서는 이전 행이 없으므로 계산하지 않는다(추정 금지). */
function deltaOf(bids: BidSummary[], index: number): number | null {
  const current = bids[index];
  const next = bids[index + 1];
  return current && next ? current.amount - next.amount : null;
}

function BidTable({ bids }: { bids: BidSummary[] }) {
  return (
    <table className="hidden w-full border-collapse sm:table">
      <caption className="sr-only">입찰 이력, 금액 높은 순</caption>
      <thead>
        <tr>
          <Th>입찰자</Th>
          <Th align="right">입찰가</Th>
          <Th align="right">증분</Th>
          <Th>상태</Th>
          <Th align="right">시각</Th>
        </tr>
      </thead>
      <tbody>
        {bids.map((bid, index) => {
          const delta = deltaOf(bids, index);
          const top = bid.status === 'ACTIVE';
          return (
            <tr
              key={bid.bidPublicId}
              className={`border-b border-border-muted last:border-b-0 ${top ? 'bg-surface-band' : ''}`}
            >
              <td
                className={`px-5 py-4 text-body font-semibold text-text ${top ? 'shadow-[inset_3px_0_0_0_theme(colors.text)]' : ''}`}
              >
                {bid.bidderMasked}
              </td>
              <td className="px-5 py-4 text-right font-num text-value text-text">
                {formatMoney(bid.amount)}
              </td>
              <td className="px-5 py-4 text-right font-num text-body text-text-subtle">
                {delta === null ? '—' : `+${formatMoney(delta)}`}
              </td>
              <td className="px-5 py-4">
                <StatusChip tone={BID_STATUS_META[bid.status].tone}>
                  {BID_STATUS_META[bid.status].label}
                </StatusChip>
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-right font-num text-body text-text-subtle">
                {formatTime(bid.createdAt)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-border-strong px-5 py-3 text-label text-text-subtle ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

/** 모바일 — 표를 접은 것이 아니라 형식이 다르다. 금액이 첫 줄 주인공이다. */
function BidCardList({ bids }: { bids: BidSummary[] }) {
  return (
    <ul className="sm:hidden">
      {bids.map((bid, index) => {
        const delta = deltaOf(bids, index);
        const top = bid.status === 'ACTIVE';
        return (
          <li
            key={bid.bidPublicId}
            className={`border-b border-border-muted px-5 py-4 last:border-b-0 ${
              top ? 'bg-surface-band shadow-[inset_3px_0_0_0_theme(colors.text)]' : ''
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-num text-value font-extrabold text-text">
                {formatMoney(bid.amount)}
                <span className="ml-0.5 text-micro font-medium text-text-muted">G</span>
              </span>
              <StatusChip tone={BID_STATUS_META[bid.status].tone}>
                {BID_STATUS_META[bid.status].label}
              </StatusChip>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-micro text-text-subtle">
              <span className="font-semibold text-text-muted">{bid.bidderMasked}</span>
              <span aria-hidden="true">·</span>
              <span className="font-num">{formatTime(bid.createdAt)}</span>
              {delta === null ? null : (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-num">+{formatMoney(delta)}</span>
                </>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * offset 페이저([5.7]) — 현재 페이지는 `primary-selected`(퍼플 soft 틴트 + 퍼플 텍스트).
 *
 * ★ FC-038 이월 "마지막 페이지 포커스 소실": 다음/이전 버튼이 마지막 페이지에서 `disabled` 가 되면
 * 포커스가 body 로 떨어져 키보드 사용자가 위치를 잃는다. 그래서 **버튼을 DOM 에서 지우지 않고**
 * `disabled` 로만 두고, 경계에 닿으면 반대 방향 버튼으로 포커스를 옮긴다.
 */
function BidPager({
  page,
  totalPages,
  totalElements,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  onChange: (next: number) => void;
}) {
  const atFirst = page <= 0;
  const atLast = page >= totalPages - 1;

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-band px-5 py-3"
      aria-label="입찰 이력 페이지"
    >
      <span className="text-body text-text-muted">
        전체 <b className="font-num text-text">{totalElements}</b>건 · {page + 1} / {totalPages}{' '}
        페이지
      </span>
      <div className="flex gap-2">
        <PagerButton
          disabled={atFirst}
          onClick={(event) => {
            const next = page - 1;
            if (next <= 0) focusSibling(event.currentTarget, 'next');
            onChange(next);
          }}
        >
          이전
        </PagerButton>
        <PagerButton
          disabled={atLast}
          onClick={(event) => {
            const next = page + 1;
            if (next >= totalPages - 1) focusSibling(event.currentTarget, 'previous');
            onChange(next);
          }}
        >
          다음
        </PagerButton>
      </div>
    </nav>
  );
}

function PagerButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-10 min-w-[64px] rounded-md border border-border-strong bg-surface px-3 text-body font-semibold text-text transition-colors duration-fast hover:bg-surface-sunken disabled:cursor-not-allowed disabled:border-border disabled:text-text-subtle"
    >
      {children}
    </button>
  );
}

/** 방금 누른 버튼이 곧 비활성이 되므로, 포커스를 형제 버튼으로 미리 옮긴다. */
function focusSibling(button: HTMLButtonElement, direction: 'next' | 'previous'): void {
  const sibling = direction === 'next' ? button.nextElementSibling : button.previousElementSibling;
  if (sibling instanceof HTMLButtonElement) sibling.focus();
}

function BidHistorySkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5" aria-busy="true">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="h-6 w-full animate-pulse rounded-sm bg-surface-sunken" />
      ))}
    </div>
  );
}

/** 이력은 같은 날 안에서 초 단위로 촘촘하다 — 날짜가 아니라 시:분:초가 정보다. */
function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString('ko-KR', { hour12: false });
}
