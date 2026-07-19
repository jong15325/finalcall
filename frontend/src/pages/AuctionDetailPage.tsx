import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useCountdown } from '@/lib/countdown';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuctionDetail } from '@/features/auction/api/useAuctions';
import { AuctionBidBar, AuctionBidBarSkeleton } from '@/features/auction/components/AuctionBidBar';
import { AuctionMobileBar } from '@/features/auction/components/AuctionMobileBar';
import { isAuctionEnded } from '@/features/auction/lib/auctionStatus';
import { AUCTION_STATUS_META } from '@/features/auction/types';
import { BidHistory } from '@/features/bid/components/BidHistory';
import { ElementBadge } from '@/features/item/components/ElementBadge';
import { ItemArtLightbox } from '@/features/item/components/ItemArtLightbox';
import { ItemArtSlot } from '@/features/item/components/ItemArtSlot';
import { ItemSpecList } from '@/features/item/components/ItemSpecList';
import { itemTypeLabel } from '@/features/item/lib/itemCode';
import { hasErrorCode } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { ROUTES } from '@/routes/paths';
import { ERROR_CODES } from '@/types/errorCodes';
import type { AuctionDetail } from '@/types/schema';

/**
 * 경매 상세 (`/auctions/:auctionPublicId`) — FC-049에서 FC-042 목업 3차 확정안(안2)으로 재구성.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 데스크톱(≥lg) — 안2                        모바일(<lg)
 * ┌────────────────────────────────────┐     ┌──────────────────────────┐
 * │ 빵부스러기 / 상태칩·속성 / 제목      │     │ 빵부스러기·상태칩·제목    │
 * ├──────────────┬─────────────────────┤     ├──────────────────────────┤
 * │ 아트 패널     │ 아이템 스펙(펼침)    │     │ 아트 패널(가운데 정렬)    │
 * │  ┌────────┐  │ ┌────┬────┬────┐   │     ├──────────────────────────┤
 * │  │  아트   │  │ │타입│속성│레벨│   │     │ 입찰 바(정적 · 세로 스택) │
 * │  │  l 3x  │  │ ├────┼────┼────┤   │     ├──────────────────────────┤
 * │  │[크게보기]│  │ │스킬│확률│ GF │   │     │ 아이템 스펙(아코디언 접힘)│
 * │  └────────┘  │ └────┴────┴────┘   │     ├──────────────────────────┤
 * │  정체성 스트립│                     │     │ 입찰 이력(카드 리스트)    │
 * ├──────────────┴─────────────────────┤     ├──────────────────────────┤
 * │ ▣ 입찰 바 — 전폭 STICKY             │     │ 유의사항                  │
 * │   남은시간 │ 현재가 │ CTA            │     └──────────────────────────┘
 * │   소프트클로즈 규칙 고지(상시)       │     ┌──────────────────────────┐
 * ├────────────────────────────────────┤     │ ▣ FIXED 하단 바            │
 * │ 입찰 이력 — 전폭 표 + offset 페이저  │     │ 1,240,000G  4분 남음 [입찰]│
 * ├────────────────────────────────────┤     └──────────────────────────┘
 * │ 거래 유의사항 3열                    │
 * └────────────────────────────────────┘
 *
 * ★ **좌우 높이를 맞추려 하지 않는다.** 안1(아트 전폭 3/5)이 실패한 지점이 정확히 그 제약이었다.
 *   아트가 작아도 좌단이 성립하는 이유는 **아트가 혼자 채우지 않기 때문**이다 —
 *   [아트 슬롯 + 정체성 스트립]이 하나의 블록이다(references [2-1]①, Steam 커뮤니티 마켓 구조).
 *
 * ★ **모바일은 열을 접은 게 아니라 IA가 다르다**([8-3] 대조표):
 *   입찰 이력 표 → 카드 리스트 · 스펙 펼침 → 아코디언 · 마감 절대시각 → 상대시간 ·
 *   상시 노출 sticky → 하단 fixed 바 · 아트 인라인 확대 → 바텀시트.
 * ══════════════════════════════════════════════════════════════════════════════
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
  const bidBarRef = useRef<HTMLDivElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  /*
   * ★ **단일 시계**([8-3]): 남은 시간을 여기서 한 번만 구독해 입찰 바·하단 바에 내려보낸다.
   * 두 컴포넌트가 각자 `Date.now()` 를 재면 1초씩 어긋난 두 값이 같은 화면에 뜬다.
   */
  const { remaining, phase } = useCountdown(auction.endAt);

  /*
   * 상세 진입 시 포커스 관리(accessibility [3]): SPA 는 페이지 전환에도 포커스가 이전 화면(목록 카드
   * 링크)에 남아 스크린리더가 새 화면을 인지하지 못한다. 제목이 확정된 시점에 제목으로 옮긴다.
   * 포커스 링은 지우지 않는다 — `outline-none` 을 두면 키보드 사용자에게 포커스 위치가 보이지 않는다.
   */
  useEffect(() => {
    headingRef.current?.focus();
  }, [auction.auctionPublicId]);

  return (
    // 하단 fixed 바 높이만큼 미리 확보한다(바가 콘텐츠를 가리지 않게, CLS 없이).
    <div className="pb-28 lg:pb-12">
      <header className="pb-5 pt-6">
        <nav aria-label="위치" className="mb-4 flex items-center gap-2 text-micro text-text-subtle">
          <Link
            to={ROUTES.home}
            className="text-text-muted no-underline hover:text-primary hover:underline"
          >
            홈
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            to={ROUTES.auctions}
            className="text-text-muted no-underline hover:text-primary hover:underline"
          >
            경매
          </Link>
          <span aria-hidden="true">/</span>
          <span>상세</span>
        </nav>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
          <ElementBadge element={item.element} />
        </div>

        {/* 페이지 제목은 화면당 1개다([3.2]). ≤719px 축소는 index.css 가 중앙에서 처리한다. */}
        <h1 ref={headingRef} tabIndex={-1} className="text-title text-text">
          {item.nameSnapshot}
        </h1>
        <p className="mt-3 text-body text-text-muted">
          판매자 <b className="text-text">{auction.sellerNickname}</b> · 등록{' '}
          {formatDateTime(auction.createdAt)}
        </p>
      </header>

      {/* ── 상단 2단: 아트+정체성 | 스펙 ─────────────────────────────────────── */}
      <div className="grid items-start gap-6 pb-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-10">
        <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-lg border border-border bg-surface lg:mx-0">
          {/*
           * 아트 전체가 라이트박스 트리거다. img 에 onClick 을 걸지 않고 button 으로 감싼다 —
           * 키보드·스크린리더에서 "누를 수 있는 것"으로 노출되어야 하기 때문이다.
           */}
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-haspopup="dialog"
            className="group block w-full"
          >
            <span className="relative block">
              <ItemArtSlot item={item} variant="detail" />
              {/* 확대 신호 — 썸네일·화살표·닷 같은 갤러리 UI를 흉내 내지 않는다. 아트가 1장이면 1장으로 다룬다. */}
              <span className="absolute bottom-3 right-3 inline-flex h-8 items-center rounded-full border border-black/10 bg-white/95 px-3 text-label text-text transition-colors duration-fast group-hover:bg-ink group-hover:text-primary-fg">
                크게 보기
              </span>
            </span>
          </button>

          {/* 정체성 스트립 — 아트가 좌단을 혼자 채우지 않게 하는 장치(references [2-1]①) */}
          <div className="border-t border-border px-5 pb-5 pt-4">
            <span className="block text-label text-text-subtle">아이템</span>
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-value text-text">
                {itemTypeLabel(item.subGroup, item.kind)}
              </span>
              <span className="font-num text-value font-extrabold text-text">Lv.{item.level}</span>
            </p>
            <p className="mt-2 text-micro leading-relaxed text-text-subtle">
              원본 카드 아트를 정수배로 확대했습니다. 레벨 표기는 아트에 포함돼 있습니다.
            </p>
          </div>
        </div>

        <ItemSpecList item={item} />
      </div>

      {/* ── 입찰 바(전폭) ───────────────────────────────────────────────────── */}
      <div ref={bidBarRef}>
        <AuctionBidBar auction={auction} phase={phase} remaining={remaining} ended={ended} />
      </div>

      {/* ── 입찰 이력(전폭) ─────────────────────────────────────────────────── */}
      <BidHistory auctionPublicId={auction.auctionPublicId} startPrice={auction.startPrice} />

      <TradeNotes />

      <AuctionMobileBar
        auction={auction}
        phase={phase}
        remaining={remaining}
        ended={ended}
        observeRef={bidBarRef}
      />

      <ItemArtLightbox item={item} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </div>
  );
}

/** 거래 유의사항 — 홈의 신뢰 섹션과 같은 문안을 쓴다(같은 규칙을 두 화면이 다르게 말하지 않게). */
const TRADE_NOTES = [
  {
    title: '입찰하면 금액이 홀드됩니다',
    body: '입찰한 금액은 즉시 사용할 수 없도록 잠깁니다. 상위 입찰에 밀리면 자동으로 풀립니다.',
  },
  {
    title: '마감 직전 입찰은 마감을 미룹니다',
    body: '남은 시간이 30초 아래일 때 입찰이 들어오면 마감 시각이 다시 늘어납니다. 낙찰 판정은 서버가 입찰을 수신한 시각을 기준으로 합니다.',
  },
  {
    title: '낙찰 대금은 정산까지 보관됩니다',
    body: '구매 대금은 곧장 판매자에게 가지 않고 정산 단계에서 옮겨집니다. 취소·유찰이면 홀드된 금액이 그대로 돌아옵니다.',
  },
];

function TradeNotes() {
  return (
    <section className="pt-12" aria-labelledby="trade-notes-heading">
      <h2 id="trade-notes-heading" className="mb-5 text-value text-text">
        거래 유의사항
      </h2>
      <div className="grid gap-6 md:grid-cols-3 md:gap-10">
        {TRADE_NOTES.map((note) => (
          <div key={note.title}>
            <span className="mb-3 block h-0.5 w-6 bg-text" aria-hidden="true" />
            <h3 className="mb-2 text-body font-bold text-text">{note.title}</h3>
            <p className="max-w-[46ch] text-body leading-relaxed text-text-muted">{note.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BackToList() {
  return (
    <Link to={ROUTES.auctions} className="w-fit text-body text-text-muted hover:text-text">
      ← 경매 목록
    </Link>
  );
}

function AuctionNotFound() {
  return (
    <div className="flex flex-col gap-6 py-8">
      <BackToList />
      <EmptyState
        title="경매를 찾을 수 없습니다"
        description="이미 삭제되었거나 주소가 잘못되었을 수 있습니다."
        action={
          <Link
            to={ROUTES.auctions}
            className="inline-flex h-11 items-center rounded-md border border-border-strong px-4 text-body text-text no-underline transition-colors duration-fast hover:bg-surface-sunken"
          >
            경매 목록으로
          </Link>
        }
      />
    </div>
  );
}

/** 로딩 스켈레톤 — 실제 화면과 같은 골격을 그려 데이터 도착 시 이동이 없게 한다. */
function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-6" aria-busy="true">
      <div className="h-4 w-32 animate-pulse rounded-sm bg-surface-sunken" />
      <div className="flex flex-col gap-3">
        <div className="h-5 w-32 animate-pulse rounded-full bg-surface-sunken" />
        <div className="h-9 w-2/3 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-48 animate-pulse rounded-sm bg-surface-sunken" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-10">
        <div className="h-[420px] w-full max-w-[360px] animate-pulse rounded-lg bg-surface-sunken" />
        <div className="h-64 w-full animate-pulse rounded-lg bg-surface-sunken" />
      </div>
      <AuctionBidBarSkeleton />
    </div>
  );
}
