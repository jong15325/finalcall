import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Countdown } from '@/components/ui/Countdown';
import { useAuctionPreview } from '@/features/auction/api/useAuctions';
import { AuctionCard, AuctionCardSkeleton } from '@/features/auction/components/AuctionCard';
import { ElementBadge } from '@/features/item/components/ElementBadge';
import { ItemArtSlot } from '@/features/item/components/ItemArtSlot';
import { ELEMENT_CODES, ELEMENT_LABEL } from '@/features/item/lib/element';
import { useShopPreview } from '@/features/shop/api/useShops';
import { formatMoney } from '@/lib/format';
import { ROUTES, buildPath } from '@/routes/paths';
import type { AuctionSummary, ShopSummary } from '@/types/schema';

/**
 * 홈 (`/`, PublicLayout) — FC-048. 종전 `PagePlaceholder` 를 대체한다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 이 화면의 정체성 — **마케팅 랜딩이 아니라 거래소 첫 화면**이다(FC-041 확정).
 * ══════════════════════════════════════════════════════════════════════════════
 * 큰 카피 + 큰 버튼의 히어로를 쓰지 않는다(PRODUCT.md 반-레퍼런스: 과장 마케팅·가짜 긴급성 금지).
 * **스크롤 0px에 실제 카운트다운이 있다** — "경매 서비스"임을 3초 안에 증명하는 것은 문장이 아니라
 * 돌아가는 숫자다. 긴급성이 연출이 아니라 실데이터라는 점이 이 구조의 전부다.
 *
 * 섹션 순서와 구조 변주(같은 리듬 반복 금지):
 *   ① 마감 임박  — 피처드 1 + 행 목록 4 (좌측 안내 열과 2단)
 *   ② 새 매물    — 카드 격자
 *   ③ 고정가     — 행 목록 + `surface-band` 밴드(면 리듬은 얇은 선이 아니라 큰 면이 만든다, [2.1])
 *   ④ 거래 안전  — 활자 3열. 신뢰 설명은 **맨 아래**다. 위에서 실물을 다 보여준 뒤의 보증이지
 *                  첫인상 자리를 차지할 마케팅 문구가 아니다.
 * 여백 3단: 밀집 48(`py-12`) < 기본 64(`py-16`) < 여유 80(`pt-20`).
 *
 * ★ **Game-Color Containment**([1.2]) — element 색은 ①의 속성 퀵필터 칩과 카드 안 배지·아트 슬롯에만
 * 있다. 섹션 배경·제목·링크·버튼은 전부 크롬/조작 계층이다.
 *
 * ★ **계약에 없는 것은 만들지 않았다.** 목업의 "카테고리 개수 타일"(집계 API 없음)과 "최근 낙찰 시세
 * 표"(§4.1 `market-prices` 는 `typeCode`+`level` 단건 집계라 랭킹 목록이 아니다)는 실데이터로 채울 수
 * 없어 **하드코딩 대신 제외**했다. 상세는 FC-048 반환 보고.
 */
export function HomePage() {
  return (
    <>
      <ClosingSection />
      <NewListingsSection />
      <FixedPriceBand />
      <TrustSection />
    </>
  );
}

/** 전폭 밴드를 쓰려고 본문이 컨테이너 밖에 있으므로(PublicLayout), 섹션마다 안쪽에서 감싼다. */
function Container({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6">{children}</div>;
}

function SectionHead({
  title,
  sub,
  moreTo,
  moreLabel,
  id,
}: {
  title: string;
  sub?: string;
  moreTo?: string;
  moreLabel?: string;
  id?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {/* 섹션 제목은 `text-value`(17)다 — [3.2]가 이 역할에 배정한 단계이며, 목업의 22px 은 폐기값이다 */}
        <h2 id={id} className="text-value text-text">
          {title}
        </h2>
        {sub ? <p className="mt-1 text-body text-text-muted">{sub}</p> : null}
      </div>
      {moreTo ? (
        <Link
          to={moreTo}
          className="flex-none text-body font-medium text-text-muted no-underline hover:text-primary hover:underline"
        >
          {moreLabel ?? '전체 보기'} →
        </Link>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ① 마감 임박 — 첫 화면. 실데이터가 히어로다
   ══════════════════════════════════════════════════════════════════════════════ */

/** 피처드 1 + 행 4. `status=ACTIVE` 로 못 박는다 — "지금 마감되는" 이라고 말했으면 예정 경매가 섞이면 안 된다. */
const CLOSING_QUERY = { sort: 'endAt,asc', status: 'ACTIVE', size: 5 } as const;

function ClosingSection() {
  const query = useAuctionPreview(CLOSING_QUERY);
  const items = query.data?.content ?? [];
  const [featured, ...rest] = items;

  return (
    <section aria-labelledby="home-closing" className="pb-16 pt-12">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
          <ClosingIntro updatedAt={query.dataUpdatedAt} isLoaded={query.isSuccess} />

          <div className="grid gap-6 md:grid-cols-[264px_minmax(0,1fr)]">
            {query.isError ? (
              <div className="rounded-lg border border-border bg-surface md:col-span-2">
                <ErrorState error={query.error} onRetry={() => void query.refetch()} />
              </div>
            ) : query.isPending ? (
              <>
                <AuctionCardSkeleton />
                <ClosingRowSkeletonList />
              </>
            ) : featured === undefined ? (
              <ClosingEmpty />
            ) : (
              <>
                <FeaturedAuction auction={featured} />
                <ClosingRowList auctions={rest} />
              </>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

function ClosingIntro({ updatedAt, isLoaded }: { updatedAt: number; isLoaded: boolean }) {
  return (
    <div>
      {/* 페이지 제목은 화면당 1개다([3.2] `text-title`). ≤719px 축소는 index.css 가 중앙에서 처리한다. */}
      <h1 id="home-closing" className="text-title text-text">
        지금 마감되는 경매
      </h1>
      <p className="mt-3 max-w-[34ch] text-body text-text-muted">
        남은 시간과 최고가는 서버 마감 시각 기준으로 표시됩니다. 마감 직전 입찰이 들어오면 마감이
        자동으로 연장됩니다.
      </p>
      {/*
       * ★ 목업의 "10초마다 갱신" 문구는 쓰지 않는다 — 홈은 폴링하지 않으므로 거짓말이 된다.
       * 대신 이 목록이 **언제 받아온 것인지**를 그대로 적는다(남은 시간 자체는 매초 계산된다).
       */}
      {isLoaded ? (
        <p className="mt-5 text-micro text-text-subtle">
          목록 기준 <span className="font-num">{formatClock(updatedAt)}</span> · 남은 시간은 매초
          계산됩니다
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to={ROUTES.auctions}
          className="inline-flex h-12 items-center rounded-md bg-ink px-5 text-value font-bold text-primary-fg no-underline transition-colors duration-fast hover:bg-[#33333a] active:bg-black"
        >
          경매 전체 보기
        </Link>
        <Link
          to={ROUTES.shops}
          className="inline-flex h-12 items-center rounded-md border border-border-strong bg-surface px-5 text-value font-bold text-text no-underline transition-colors duration-fast hover:bg-surface-sunken"
        >
          고정가 보기
        </Link>
      </div>

      {/*
       * 속성 퀵필터 — 좌측 열을 채우는 장식이 아니라 실제 진입 경로다(`/auctions?element=N`).
       * element 색이 허용되는 자리다([1.2]③ "아이템 필터 칩"). 목록은 `ELEMENT_CODES` 를 순회한다 —
       * 코드 집합 크기를 화면이 가정하지 않으므로 축이 늘어도 여기는 그대로다(계약 §3.3 폴백 의무).
       */}
      <div className="mt-8 border-t border-border pt-6">
        <span className="mb-3 block text-label text-text-subtle">속성으로 좁혀 보기</span>
        <div className="flex flex-wrap gap-2">
          {ELEMENT_CODES.map(({ code, key }) => (
            <Link
              key={code}
              to={`${ROUTES.auctions}?element=${code}`}
              className="no-underline"
              aria-label={`${ELEMENT_LABEL[key]} 속성 경매 보기`}
            >
              <ElementBadge element={code} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 서열 1위만 다르게 그린다 — 그리드 안에서 크기로 위계를 만드는 **유일한** 지점이다.
 * 카운트다운을 `figure`(28)로 승격해 이 화면의 주인공 수치임을 표시한다(화면당 1개, [3.1] 원칙 4).
 *
 * 목업의 "마감선 게이지"(남은 시간 비율 막대)는 **구현하지 않았다.** 비율을 그리려면 경매의 시작
 * 기준점이 필요한데 `AuctionSummary` 의 `startAt` 은 nullable 이고 `createdAt` 은 상세에만 있다
 * (계약 §3.3). 임의 기준(예: 24시간)으로 채우면 눈금 없는 막대가 사실이 아닌 비율을 주장하게 된다.
 */
function FeaturedAuction({ auction }: { auction: AuctionSummary }) {
  const { item } = auction;
  const hasBid = auction.highestBidAmount != null;

  return (
    <Link
      to={buildPath.auctionDetail(auction.auctionPublicId)}
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface no-underline shadow-sm transition duration-fast hover:border-border-strong hover:shadow-lg"
    >
      <ItemArtSlot name={item.nameSnapshot} element={item.element} level={item.level} />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-sm bg-surface-sunken px-2 py-0.5 text-label text-text-muted">
            마감 1순위
          </span>
          <ElementBadge element={item.element} />
        </div>
        <h3 className="line-clamp-2 text-value text-text">{item.nameSnapshot}</h3>

        <div className="flex flex-col gap-0.5">
          <span className="text-label text-text-muted">
            {hasBid ? `현재가 · 입찰 ${auction.bidCount}회` : '입찰 없음 · 시작가'}
          </span>
          <span className="font-num text-value font-bold text-text">
            {formatMoney(hasBid ? (auction.highestBidAmount as number) : auction.startPrice)}
            <span className="ml-1 text-micro text-text-subtle">게임머니</span>
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-1 border-t border-border-muted pt-3">
          <span className="text-label text-text-muted">남은 시간</span>
          <Countdown endAt={auction.endAt} label={item.nameSnapshot} size="figure" />
        </div>
      </div>
    </Link>
  );
}

/** 나머지는 카드가 아니라 **행**이다 — 같은 카드를 다섯 번 반복하지 않고 밀도로 대비를 만든다. */
function ClosingRowList({ auctions }: { auctions: AuctionSummary[] }) {
  if (auctions.length === 0) {
    return (
      <div className="grid place-items-center rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-body text-text-muted">
          지금 마감을 앞둔 다른 경매가 없습니다. 위 매물이 유일한 진행 건입니다.
        </p>
      </div>
    );
  }

  return (
    <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {auctions.map((auction) => (
        <li key={auction.auctionPublicId}>
          <ClosingRow auction={auction} />
        </li>
      ))}
    </ol>
  );
}

function ClosingRow({ auction }: { auction: AuctionSummary }) {
  const { item } = auction;
  const hasBid = auction.highestBidAmount != null;

  return (
    <Link
      to={buildPath.auctionDetail(auction.auctionPublicId)}
      className="flex items-center gap-4 p-4 text-text no-underline transition-colors duration-fast hover:bg-surface-sunken"
    >
      <RowThumb level={item.level} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-text">{item.nameSnapshot}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-micro text-text-subtle">
          <ElementBadge element={item.element} />
          <span className="font-num">Lv.{item.level}</span>
          <span>
            입찰 <span className="font-num">{auction.bidCount}</span>회
          </span>
        </span>
      </span>
      <span className="flex-none text-right">
        <span className="block text-label text-text-subtle">{hasBid ? '최고가' : '시작가'}</span>
        <span className="block font-num text-body font-bold text-text">
          {formatMoney(hasBid ? (auction.highestBidAmount as number) : auction.startPrice)}
          <span className="ml-0.5 text-micro font-medium text-text-muted">G</span>
        </span>
      </span>
      <span className="w-[88px] flex-none text-right">
        <Countdown endAt={auction.endAt} label={item.nameSnapshot} />
      </span>
    </Link>
  );
}

/**
 * 작은 썸네일(56px). **글로우 그라데이션을 쓰지 않는다** — 그 크기에서는 보이지 않으므로
 * 엣지 단색으로 채운다([2.7]). 아트 자산은 아직 배선 전이라 레벨만 표시한다([5.3] 플레이스홀더 조항).
 */
function RowThumb({ level }: { level: number }) {
  return (
    <span
      className="grid h-14 w-14 flex-none place-items-center rounded-sm bg-glow-neutral-edge"
      aria-hidden="true"
    >
      <span className="font-num text-label text-white">Lv.{level}</span>
    </span>
  );
}

function ClosingRowSkeletonList() {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-center gap-4 p-4">
          <div className="h-14 w-14 flex-none animate-pulse rounded-sm bg-surface-sunken" />
          <div className="flex-1">
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-surface-sunken" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded-sm bg-surface-sunken" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded-sm bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}

/**
 * 빈 상태 — **첫 화면이 비면 제품이 죽어 보인다.** 그래서 패널을 지우지 않고 그 자리에서 다음 행동을
 * 준다. 두 열을 통째로 차지해 레이아웃이 무너지지 않게 한다.
 */
function ClosingEmpty() {
  return (
    <div className="grid place-items-center rounded-lg border border-border bg-surface p-10 text-center md:col-span-2">
      <p className="text-value text-text">지금 마감되는 경매가 없습니다</p>
      <p className="mt-2 max-w-[42ch] text-body text-text-muted">
        새 매물이 등록되면 이 자리에서 카운트다운이 시작됩니다. 먼저 올릴 아이템이 있다면 지금
        등록해도 좋습니다.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link
          to={ROUTES.sell}
          className="inline-flex h-11 items-center rounded-md bg-ink px-4 text-body font-medium text-primary-fg no-underline transition-colors duration-fast hover:bg-[#33333a]"
        >
          판매 등록하기
        </Link>
        <Link
          to={ROUTES.shops}
          className="inline-flex h-11 items-center rounded-md border border-border-strong bg-surface px-4 text-body font-medium text-text no-underline transition-colors duration-fast hover:bg-surface-sunken"
        >
          고정가 매물 보기
        </Link>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ② 새로 올라온 매물 — 페이지의 본문. 카드 격자
   ══════════════════════════════════════════════════════════════════════════════ */

const NEW_QUERY = { sort: 'createdAt,desc', size: 8 } as const;

function NewListingsSection() {
  const query = useAuctionPreview(NEW_QUERY);
  const auctions = query.data?.content ?? [];

  return (
    <section aria-labelledby="home-new" className="border-t border-border-muted py-16">
      <Container>
        <SectionHead
          id="home-new"
          title="새로 올라온 매물"
          sub="최근 등록순 · 진행 중이거나 시작을 기다리는 경매"
          moreTo={ROUTES.auctions}
          moreLabel="경매 전체 보기"
        />

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isPending ? (
          <CardGrid busy>
            {[0, 1, 2, 3].map((index) => (
              <li key={index}>
                <AuctionCardSkeleton />
              </li>
            ))}
          </CardGrid>
        ) : auctions.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-10 text-center">
            <p className="text-value text-text">아직 등록된 매물이 없습니다</p>
            <p className="mt-2 text-body text-text-muted">
              첫 매물의 자리입니다. 등록되면 이곳에 바로 나타납니다.
            </p>
          </div>
        ) : (
          <CardGrid>
            {auctions.map((auction) => (
              <li key={auction.auctionPublicId}>
                <AuctionCard auction={auction} />
              </li>
            ))}
          </CardGrid>
        )}
      </Container>
    </section>
  );
}

function CardGrid({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <ul
      className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy={busy}
    >
      {children}
    </ul>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ③ 고정가 — 밴드. 구조를 카드 격자에서 행 목록으로 바꿔 리듬을 끊는다
   ══════════════════════════════════════════════════════════════════════════════ */

const SHOP_QUERY = { sort: 'createdAt,desc', size: 4 } as const;

function FixedPriceBand() {
  const query = useShopPreview(SHOP_QUERY);
  const shops = query.data?.content ?? [];

  // 빈 밴드는 얼룩이 된다 — 보여 줄 것이 없으면 면 자체를 걷어낸다(에러는 숨기지 않는다).
  if (query.isSuccess && shops.length === 0) return null;

  return (
    <section aria-labelledby="home-fixed" className="bg-surface-band py-12">
      <Container>
        <SectionHead
          id="home-fixed"
          title="기다리지 않고 바로 사기"
          sub="고정가 매물은 입찰 없이 즉시 거래됩니다."
          moreTo={ROUTES.shops}
          moreLabel="고정가 전체 보기"
        />

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isPending ? (
          <ClosingRowSkeletonList />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {shops.map((shop) => (
              <li key={shop.shopPublicId}>
                <ShopRow shop={shop} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}

function ShopRow({ shop }: { shop: ShopSummary }) {
  const { item } = shop;

  return (
    <Link
      to={buildPath.shopDetail(shop.shopPublicId)}
      className="flex items-center gap-4 p-4 text-text no-underline transition-colors duration-fast hover:bg-surface-sunken"
    >
      <RowThumb level={item.level} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-text">{item.nameSnapshot}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-micro text-text-subtle">
          <ElementBadge element={item.element} />
          <span className="font-num">Lv.{item.level}</span>
          <span>판매자 {shop.sellerNickname}</span>
        </span>
      </span>
      <span className="flex-none text-right">
        <span className="block text-label text-text-subtle">즉시구매가</span>
        <span className="block font-num text-body font-bold text-text">
          {formatMoney(shop.price)}
          <span className="ml-0.5 text-micro font-medium text-text-muted">G</span>
        </span>
      </span>
    </Link>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ④ 거래 안전 — 맨 아래. 활자와 짧은 rule 만(아이콘 원 3개짜리 카드 그리드를 쓰지 않는다)
   ══════════════════════════════════════════════════════════════════════════════ */

const TRUST_POINTS = [
  {
    title: '입찰하면 금액이 홀드됩니다',
    body: '입찰한 금액은 즉시 사용할 수 없도록 잠깁니다. 상위 입찰에 밀리면 자동으로 풀립니다. 잔액이 없는 입찰은 애초에 성립하지 않습니다.',
  },
  {
    title: '마감 직전의 입찰은 마감을 미룹니다',
    body: '마지막 순간에 값을 던져 낚아채는 방식을 막습니다. 남은 시간이 얼마 없을 때 입찰이 들어오면 마감 시각이 다시 늘어납니다.',
  },
  {
    title: '낙찰 대금은 정산까지 보관됩니다',
    body: '구매 대금은 곧장 판매자에게 가지 않고 정산 단계에서 옮겨집니다. 취소·유찰이면 홀드된 금액이 그대로 돌아옵니다.',
  },
];

function TrustSection() {
  return (
    <section aria-labelledby="home-trust" className="border-t border-border-muted pb-16 pt-20">
      <Container>
        <SectionHead id="home-trust" title="거래가 안전한 이유" />
        <div className="grid gap-8 md:grid-cols-3 md:gap-10">
          {TRUST_POINTS.map((point) => (
            <div key={point.title}>
              {/* 짧은 near-black rule — 브랜드 마감선과 같은 2px 언어. 아이콘을 쓰지 않는다 */}
              <span className="mb-3 block h-0.5 w-6 bg-text" aria-hidden="true" />
              <h3 className="mb-2 text-body font-bold text-text">{point.title}</h3>
              <p className="max-w-[44ch] text-body leading-relaxed text-text-muted">{point.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/** 목록을 받아온 시각(HH:MM:SS). 날짜는 붙이지 않는다 — 방금 받은 값이라 시각만으로 충분하다. */
function formatClock(epochMs: number): string {
  if (!epochMs) return '--:--:--';
  return new Date(epochMs).toLocaleTimeString('ko-KR', { hour12: false });
}
