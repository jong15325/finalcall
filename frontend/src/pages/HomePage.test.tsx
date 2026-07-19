import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { stubApi } from '@/test/apiStub';
import { anAuctionSummary, anItem } from '@/test/fixtures';
import { renderWithProviders } from '@/test/testUtils';
import { HomePage } from './HomePage';

/**
 * 홈 실구현 테스트(FC-048).
 *
 * 홈은 **첫 화면이라 실패가 곧 제품 실패**다. 그래서 정상 렌더보다 **비정상 상태**를 더 촘촘히 건다 —
 * 백엔드가 안 떠 있거나 시드가 비어 있는 상황이 개발 중 기본값이기 때문이다.
 *
 * 스텁 순서 주의: `apiStub` 은 URL **부분일치**이고 먼저 등록된 것이 우선한다. `/auctions` 와
 * `/shops` 는 겹치지 않지만, 홈이 `/auctions` 를 **두 번**(마감 임박·새 매물) 호출하므로 한 스텁이
 * 두 요청에 함께 응답한다.
 */
describe('홈 — 거래소 첫 화면', () => {
  it('실데이터 카운트다운과 매물이 그려진다', async () => {
    stubApi([
      {
        match: '/auctions',
        data: {
          content: [
            anAuctionSummary({
              auctionPublicId: 'a-1',
              item: anItem({ nameSnapshot: '마감 임박 아이템' }),
            }),
            anAuctionSummary({
              auctionPublicId: 'a-2',
              item: anItem({ nameSnapshot: '두 번째 아이템' }),
              highestBidAmount: 55_000,
              bidCount: 7,
            }),
          ],
          nextCursor: null,
          hasNext: false,
        },
      },
      {
        match: '/shops',
        data: {
          content: [
            {
              shopPublicId: 's-1',
              status: 'ACTIVE',
              item: anItem({ nameSnapshot: '고정가 아이템' }),
              price: 99_000,
              endAt: null,
              sellerNickname: '판매자',
            },
          ],
          nextCursor: null,
          hasNext: false,
        },
      },
    ]);

    renderWithProviders(<HomePage />);

    // 스크롤 0px 의 주인공 — 페이지 제목은 화면당 1개다
    expect(
      screen.getByRole('heading', { level: 1, name: '지금 마감되는 경매' }),
    ).toBeInTheDocument();

    // 피처드(1순위) + 행 목록이 같은 응답에서 갈린다
    expect(await screen.findAllByText('마감 임박 아이템')).not.toHaveLength(0);
    expect(await screen.findByText('마감 1순위')).toBeInTheDocument();

    // 카운트다운이 실제로 계산돼 나온다(하드코딩이 아니라 endAt 파생)
    expect(await screen.findAllByText(/마감까지 .*남음/)).not.toHaveLength(0);

    // 고정가 밴드는 별도 API 를 탄다
    expect(await screen.findByText('고정가 아이템')).toBeInTheDocument();
    expect(screen.getByText('즉시구매가')).toBeInTheDocument();
  });

  it('빈 목록에서 크래시하지 않고 다음 행동을 준다', async () => {
    stubApi([
      { match: '/auctions', data: { content: [], nextCursor: null, hasNext: false } },
      { match: '/shops', data: { content: [], nextCursor: null, hasNext: false } },
    ]);

    renderWithProviders(<HomePage />);

    expect(await screen.findByText('지금 마감되는 경매가 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '판매 등록하기' })).toBeInTheDocument();
    expect(await screen.findByText('아직 등록된 매물이 없습니다')).toBeInTheDocument();

    // 빈 고정가 밴드는 얼룩이 되므로 면 자체가 사라진다
    await waitFor(() =>
      expect(screen.queryByText('기다리지 않고 바로 사기')).not.toBeInTheDocument(),
    );
  });

  it('로딩 중에도 셸과 안내가 서 있다(백지 아님)', () => {
    // 응답을 영원히 지연시켜 pending 상태에 머문다
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );

    renderWithProviders(<HomePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: '지금 마감되는 경매' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '경매 전체 보기' })).toBeInTheDocument();
    // 속성 퀵필터는 데이터와 무관한 진입 경로라 로딩 중에도 즉시 쓸 수 있어야 한다
    expect(screen.getByRole('link', { name: '물 속성 경매 보기' })).toHaveAttribute(
      'href',
      '/auctions?element=1',
    );
    expect(screen.getByRole('link', { name: '바람 속성 경매 보기' })).toBeInTheDocument();
  });

  it('API 실패에서 크래시하지 않고 재시도를 준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('네트워크 연결 실패'))),
    );

    renderWithProviders(<HomePage />);

    // 에러가 나도 셸(제목·CTA)은 살아 있다 — 홈 전체가 죽지 않는다
    expect(
      screen.getByRole('heading', { level: 1, name: '지금 마감되는 경매' }),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(await screen.findAllByRole('button', { name: '다시 시도' })).not.toHaveLength(0);
  });

  it('미등록 속성 코드가 섞여도 중립 표기로 폴백한다', async () => {
    stubApi([
      {
        match: '/auctions',
        data: {
          content: [anAuctionSummary({ item: anItem({ element: 99 }) })],
          nextCursor: null,
          hasNext: false,
        },
      },
      { match: '/shops', data: { content: [], nextCursor: null, hasNext: false } },
    ]);

    renderWithProviders(<HomePage />);

    expect(await screen.findAllByText('속성 99')).not.toHaveLength(0);
  });
});
