import { Link } from 'react-router-dom';
import { CountdownChip } from '@/components/ui/Countdown';
import { ItemArtSlot } from '@/features/item/components/ItemArtSlot';
import { goldforceStateOf } from '@/features/item/lib/goldforce';
import { itemTypeLabel } from '@/features/item/lib/itemCode';
import { formatMoney } from '@/lib/format';
import { buildPath } from '@/routes/paths';
import type { AuctionSummary } from '@/types/schema';
import { isAuctionEnded, isTerminalStatus } from '../lib/auctionStatus';
import { AUCTION_STATUS_META } from '../types';

/**
 * AuctionCard — design-system [5.3] ItemCard 의 경매 적용 (FC-049 목업 집행).
 *
 * 구조: [상단] 속성별 딥 글로우 아트 슬롯(실아트 · 속성 배지 · 골드포스) + [하단] 웹 상거래 영역.
 * 하단은 전부 커머스 토큰이고, 게임색(element·금색)은 아트 슬롯 안에만 머문다([1.2] Containment).
 * 등급 배지는 없다(D-073 폐기).
 *
 * 카드 전체가 하나의 링크다 — 탭 정지점을 1개로 유지해 20장 그리드의 키보드 주행을 짧게 만든다.
 *
 * 카드 내부 리듬은 균일 패딩이 아니다: 위 12(아트와 맞닿음) / 옆 16 / 아래 20. 아래쪽에 여유를 줘야
 * 가격·판매자 줄이 카드 바닥에 붙어 보이지 않는다.
 */
export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  const { item, status } = auction;
  const meta = AUCTION_STATUS_META[status];
  const ended = isAuctionEnded(auction);
  const goldforce = goldforceStateOf(item.goldforceExpireAt);

  return (
    <article className="h-full">
      <Link
        to={buildPath.auctionDetail(auction.auctionPublicId)}
        className={`flex h-full flex-col overflow-hidden rounded-lg border text-text no-underline shadow-sm transition duration-base ${
          ended
            ? 'border-border bg-surface-band'
            : 'border-border bg-surface hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg'
        }`}
      >
        <div className="relative">
          <ItemArtSlot item={item} variant="card" />
          {ended ? <EndedMask auction={auction} /> : null}
        </div>

        <div className="flex flex-1 flex-col px-4 pb-5 pt-3">
          <h3 className="line-clamp-2 min-h-[2.7em] text-value text-text">{item.nameSnapshot}</h3>
          <p className="mt-1 text-micro text-text-subtle">
            {itemTypeLabel(item.subGroup, item.kind)} · {item.level}레벨
          </p>

          <div className="mt-auto">
            <AuctionPrice auction={auction} ended={ended} />

            {goldforce.active ? (
              /* 골드포스 3경로 중 ②본문줄([5.12]) — 아웃라인을 지워도 정보가 남아야 한다. */
              <p className="mt-2 flex items-center gap-1.5 text-micro text-text-muted">
                <span
                  className="h-1.5 w-1.5 flex-none rounded-full bg-gradient-to-br from-gf-2 to-gf-6"
                  aria-hidden="true"
                />
                골드포스 {goldforce.remainingLabel} 남음
              </p>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="truncate text-micro text-text-muted">
                판매자 <span className="text-text">{auction.sellerNickname}</span>
              </span>
              {ended ? (
                <span className="text-label text-text-subtle">{meta.label}</span>
              ) : (
                <CountdownChip endAt={auction.endAt} label={item.nameSnapshot} />
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

/**
 * ★ 종료 오버레이 — "마감" 한 마디로 뭉뚱그리지 않고 **사유를 병기**한다(FC-049 부채 11).
 * "마감"만 적으면 낙찰·유찰·취소가 한 덩어리가 되어, 사용자가 카드를 열어 봐야 결과를 안다.
 * 마감시각만 지난(상태 미정정) 구간은 서버가 확정하기 전이므로 사유를 지어내지 않는다.
 */
function EndedMask({ auction }: { auction: AuctionSummary }) {
  const terminal = isTerminalStatus(auction.status);
  const meta = AUCTION_STATUS_META[auction.status];

  return (
    <div className="absolute inset-0 grid place-items-center bg-black/60">
      <span className="text-value font-bold tracking-wide text-white">
        {terminal ? `마감 · ${meta.label}` : '마감'}
      </span>
    </div>
  );
}

/**
 * ★★ 가격 블록 — **계약이 정직하게 설계한 지점이라 시각도 정직해야 한다**(FC-049 부채 9).
 *
 * `highestBidAmount == null` 은 "시작가가 현재가"라는 뜻이 **아니라** "아직 아무 값도 실리지 않았다"는
 * 뜻이다(auction-domain-spec §9-b). 종전 구현은 라벨 문구 하나로만 이를 갈랐는데, 20장 그리드를
 * 훑는 동안 문구는 읽히지 않는다 — "입찰 없음 · 시작가 210,000"과 "현재가 · 입찰 23회 1,280,000"이
 * 같은 굵기·같은 색으로 나란히 서면 스캔 중에 섞인다.
 *
 * 그래서 **3중 신호**로 가른다:
 *   (a) 라벨 문구 — "입찰 없음 · 시작가" vs "현재가 · 입찰 N회"
 *   (b) 금액의 색·굵기 — 확정값은 near-black 800, 미확정값은 muted 700
 *   (c) 좌측 rule 의 **실선/파선** — 파선은 "아직 확정된 값이 없다"는 관례 기호이며,
 *       **색각 이상·저시력·주변시에서도 형태로 남는다**(색·굵기가 무너져도 이 축은 살아남는다).
 *
 * 종료 경매는 실선이되 회색이다 — 값은 확정됐지만 더는 움직이지 않는다.
 */
function AuctionPrice({ auction, ended }: { auction: AuctionSummary; ended: boolean }) {
  const hasBid = auction.highestBidAmount != null;
  const amount = hasBid ? (auction.highestBidAmount as number) : auction.startPrice;

  const rule = !hasBid
    ? 'border-l-2 border-dashed border-border-strong'
    : ended
      ? 'border-l-2 border-solid border-border-strong'
      : 'border-l-2 border-solid border-text';

  return (
    <div className={`mt-4 py-2 pl-3 ${rule}`}>
      <span className={`block text-label ${hasBid ? 'text-text-muted' : 'text-text-subtle'}`}>
        {hasBid ? `현재가 · 입찰 ${auction.bidCount}회` : '입찰 없음 · 시작가'}
      </span>
      <span
        className={`mt-0.5 block font-num text-value ${
          hasBid && !ended ? 'font-extrabold text-text' : 'font-bold text-text-muted'
        }`}
      >
        {formatMoney(amount)}
        <span className="ml-0.5 text-micro font-medium text-text-muted">G</span>
      </span>
      {/*
       * 즉시구매는 **있을 때만** 적는다. 상세 패널과 달리(부채 14 "설정 없음"으로 자리 유지) 카드에서는
       * 자리를 비워도 레이아웃이 흔들리지 않는다 — 가격 블록 위가 `mt-auto` 로 밀려 있어 카드 바닥이
       * 정렬되기 때문이다. 20장 그리드에 "즉시구매 없음"을 20번 반복하면 정보가 아니라 잡음이 된다.
       */}
      {auction.buyNowPrice != null ? (
        <span className="mt-1 block text-micro text-text-muted">
          즉시구매{' '}
          <span className="font-num font-bold text-text">{formatMoney(auction.buyNowPrice)}G</span>
        </span>
      ) : null}
    </div>
  );
}

/** 로딩 스켈레톤 — 카드와 같은 세로 슬롯 높이를 차지해 데이터 도착 시 레이아웃이 튀지 않는다. */
export function AuctionCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="h-[210px] w-full animate-pulse bg-surface-sunken" />
      <div className="flex flex-col gap-3 px-4 pb-5 pt-3">
        <div className="h-5 w-3/4 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-3 w-1/2 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-8 w-2/3 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-full animate-pulse rounded-sm bg-surface-sunken" />
      </div>
    </div>
  );
}
