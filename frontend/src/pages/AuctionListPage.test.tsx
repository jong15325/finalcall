import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { stubApi } from '@/test/apiStub';
import { anAuctionSummary, anItem } from '@/test/fixtures';
import { renderWithProviders } from '@/test/testUtils';
import { AuctionListPage } from './AuctionListPage';

/**
 * 경매 목록 — FC-049 목업 집행 검증.
 *
 * 여기서 지키는 계약은 셋이다:
 *   ① **가격 구분의 3중 신호** — "입찰 없음 · 시작가"와 "현재가 · 입찰 N회"가 섞이면 실패다(부채 9).
 *   ② **`kind` 종속** — 대분류 없이 종류를 고를 수 없어야 한다(계약 §4.1 다의성).
 *   ③ **빈·로딩·에러** — 경매 시드가 없어 실행 시 빈 화면이 기본값이다. 초라하면 안 된다.
 */

function stubList(content: unknown[]) {
  stubApi([{ match: '/auctions', data: { content, nextCursor: null, hasNext: false } }]);
}

describe('경매 목록 — 가격 구분(부채 9)', () => {
  it('입찰 유무가 라벨 문구로 갈린다 — 시작가가 현재가로 위장되지 않는다', async () => {
    stubList([
      anAuctionSummary({ auctionPublicId: 'a-1', startPrice: 210_000 }),
      anAuctionSummary({
        auctionPublicId: 'a-2',
        startPrice: 800_000,
        highestBidAmount: 1_280_000,
        bidCount: 23,
      }),
    ]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    expect(await screen.findByText('입찰 없음 · 시작가')).toBeInTheDocument();
    expect(screen.getByText('현재가 · 입찰 23회')).toBeInTheDocument();
  });

  it('★ 문구 말고도 rule 이 실선/파선으로 갈린다 — 색·문구가 무너져도 형태가 남는다', async () => {
    stubList([
      anAuctionSummary({ auctionPublicId: 'a-1', startPrice: 210_000 }),
      anAuctionSummary({ auctionPublicId: 'a-2', highestBidAmount: 1_280_000, bidCount: 3 }),
    ]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    const noBid = (await screen.findByText('입찰 없음 · 시작가')).parentElement;
    const withBid = screen.getByText('현재가 · 입찰 3회').parentElement;

    expect(noBid?.className).toContain('border-dashed');
    expect(withBid?.className).toContain('border-solid');
  });

  it('즉시구매가는 있을 때만 적는다(20장 그리드에서 "없음" 20번은 잡음이다)', async () => {
    stubList([anAuctionSummary({ auctionPublicId: 'a-1', buyNowPrice: 2_000_000 })]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    expect(await screen.findByText(/즉시구매/)).toBeInTheDocument();
  });
});

describe('경매 목록 — 종료 카드(부채 11)', () => {
  it('"마감"으로 뭉뚱그리지 않고 사유를 병기한다', async () => {
    stubList([
      anAuctionSummary({
        auctionPublicId: 'a-1',
        status: 'SOLD',
        endAt: new Date(Date.now() - 1000).toISOString(),
      }),
      anAuctionSummary({
        auctionPublicId: 'a-2',
        status: 'UNSOLD',
        endAt: new Date(Date.now() - 1000).toISOString(),
      }),
    ]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    expect(await screen.findByText('마감 · 낙찰')).toBeInTheDocument();
    expect(screen.getByText('마감 · 유찰')).toBeInTheDocument();
  });
});

describe('경매 목록 — 필터(부채 7, 계약 §4.1)', () => {
  it('★ 대분류 미선택이면 종류가 잠기고 잠금 사유가 문장으로 붙는다', async () => {
    stubList([]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    expect(await screen.findByText(/대분류를 먼저 고르세요/)).toBeInTheDocument();
    // 잠금 상태에서는 종류 선택지 자체가 없다 — 비활성 칩을 늘어놓지 않는다.
    expect(screen.queryByRole('button', { name: '도끼' })).not.toBeInTheDocument();
  });

  it('대분류를 고르면 그 대분류의 종류만 열린다 — 무기 4종', async () => {
    stubList([]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    fireEvent.click(await screen.findByRole('button', { name: '무기' }));

    const kinds = screen.getByRole('group', { name: '종류' });
    expect(within(kinds).getByRole('button', { name: '도끼' })).toBeInTheDocument();
    expect(within(kinds).getByRole('button', { name: '활' })).toBeInTheDocument();
    expect(within(kinds).queryByRole('button', { name: '방패' })).not.toBeInTheDocument();
  });

  it('★ 마법을 고르면 종류가 2개로 줄어든다(kind 3·4는 마법에 없다)', async () => {
    stubList([]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    fireEvent.click(await screen.findByRole('button', { name: '마법' }));

    const kinds = screen.getByRole('group', { name: '종류' });
    expect(within(kinds).getAllByRole('button')).toHaveLength(2);
    expect(within(kinds).getByRole('button', { name: '일반' })).toBeInTheDocument();
    expect(within(kinds).getByRole('button', { name: '특수' })).toBeInTheDocument();
  });

  it('★ URL 에 kind 만 실려 들어와도 부모 없는 자식은 버려진다(다의적 요청 방지)', async () => {
    stubList([]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions?kind=1' });

    // 적용된 필터 칩에 종류가 서지 않는다.
    expect(await screen.findByText(/대분류를 먼저 고르세요/)).toBeInTheDocument();
    expect(screen.queryByText(/종류 ·/)).not.toBeInTheDocument();
  });

  it('적용된 필터가 제거 가능한 칩으로 가시화된다', async () => {
    stubList([]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions?subGroup=1&kind=3&element=2' });

    expect(
      await screen.findByRole('button', { name: '필터 제거: 대분류 · 무기' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '필터 제거: 종류 · 검' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '필터 제거: 속성 · 불' })).toBeInTheDocument();
  });
});

describe('경매 목록 — 빈·에러 상태', () => {
  /** ★ 경매 시드가 없어 **실행 시 이 상태가 기본값**이다. 초라하면 첫 화면이 초라해진다. */
  it('필터 없이 비면 "등록되면 여기서 시작한다"는 안내를 준다', async () => {
    stubList([]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    expect(await screen.findByText('진행 중인 경매가 없습니다')).toBeInTheDocument();
    expect(screen.getByText(/새 매물이 등록되면/)).toBeInTheDocument();
  });

  it('필터가 걸린 빈 결과는 초기화 CTA를 함께 준다', async () => {
    stubList([]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions?element=2' });

    expect(await screen.findByText('조건에 맞는 매물이 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '필터 초기화' })).toBeInTheDocument();
  });

  it('에러는 코드와 재시도 수단을 함께 노출한다', async () => {
    stubApi([]); // 스텁되지 않은 요청 → 실패

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});

describe('경매 목록 — 아트(부채 2·4·5)', () => {
  it('카드에 실아트가 뜬다 — 레벨·속성·종류가 경로에 그대로 실린다', async () => {
    stubList([
      anAuctionSummary({
        auctionPublicId: 'a-1',
        item: anItem({ subGroup: 1, kind: 3, element: 2, level: 7 }),
      }),
    ]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    const art = await screen.findByRole('img', { name: /불 속성 무기 · 검 레벨 7/ });
    expect(art).toHaveAttribute('src', '/art/items/level7/l/fire/sword.png');
    // l 아트에는 레벨이 구워져 있다 — 웹이 겹쳐 그리지 않는다.
    expect(screen.queryByText('Lv.7')).not.toBeInTheDocument();
  });

  it('아트가 없는 레벨은 플레이스홀더로 폴백한다(깨진 이미지 금지)', async () => {
    stubList([anAuctionSummary({ auctionPublicId: 'a-1', item: anItem({ level: 12 }) })]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    expect(await screen.findByText('Lv.12')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /레벨 12/ })).not.toHaveAttribute('src');
  });
});
