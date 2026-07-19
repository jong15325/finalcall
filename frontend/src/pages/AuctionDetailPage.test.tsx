import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { stubApi } from '@/test/apiStub';
import { anAuctionDetail, anItem } from '@/test/fixtures';
import { renderWithProviders } from '@/test/testUtils';
import type { AuctionDetail } from '@/types/schema';
import { AuctionDetailPage } from './AuctionDetailPage';

/**
 * 경매 상세 — FC-049 목업(안2) 집행 검증.
 *
 * ★ `IntersectionObserver` 는 jsdom 에 없다. 하단 고정 바가 이를 쓰므로 테스트 환경에서 스텁한다
 *   (관측 결과 자체는 여기서 검증하지 않는다 — 스크롤은 jsdom 이 재현하지 못한다).
 */
class StubObserver {
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}
Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: StubObserver,
});

function renderDetail(auction: AuctionDetail, bids: unknown[] = []) {
  stubApi([
    // 부분일치라 등록 순서가 곧 우선순위다 — 하위 경로를 먼저 둔다.
    {
      match: '/bids',
      data: { content: bids, page: 0, size: 10, totalElements: bids.length, totalPages: 1 },
    },
    { match: '/auctions/', data: auction },
  ]);

  return renderWithProviders(
    <Routes>
      <Route path="/auctions/:auctionPublicId" element={<AuctionDetailPage />} />
    </Routes>,
    { route: `/auctions/${auction.auctionPublicId}` },
  );
}

describe('경매 상세 — 거래 바(부채 12·13·14·15)', () => {
  it('★ buyNowPrice 가 null 이어도 줄이 사라지지 않는다 — "설정 없음"으로 자리를 지킨다', async () => {
    renderDetail(anAuctionDetail({ auctionPublicId: 'a-1', buyNowPrice: null }));

    const bar = await screen.findByRole('region', { name: '거래 정보' });
    expect(within(bar).getByText('설정 없음')).toBeInTheDocument();
  });

  it('buyNowPrice 가 있으면 같은 자리에 금액이 들어간다', async () => {
    renderDetail(anAuctionDetail({ auctionPublicId: 'a-1', buyNowPrice: 2_000_000 }));

    const bar = await screen.findByRole('region', { name: '거래 정보' });
    expect(within(bar).getByText('2,000,000G')).toBeInTheDocument();
    expect(within(bar).queryByText('설정 없음')).not.toBeInTheDocument();
  });

  it('★ 소프트클로즈 규칙은 연장이 0회여도 상시 안내한다(부채 15)', async () => {
    renderDetail(anAuctionDetail({ auctionPublicId: 'a-1', extensionCount: 0 }));

    const bar = await screen.findByRole('region', { name: '거래 정보' });
    expect(within(bar).getByText(/마감이 미뤄집니다/)).toBeInTheDocument();
    // 실제 연장 횟수는 있을 때만 덧붙인다.
    expect(within(bar).queryByText(/지금까지/)).not.toBeInTheDocument();
  });

  it('연장이 있었으면 횟수를 덧붙인다', async () => {
    renderDetail(anAuctionDetail({ auctionPublicId: 'a-1', extensionCount: 2 }));

    const bar = await screen.findByRole('region', { name: '거래 정보' });
    expect(within(bar).getByText(/지금까지/)).toBeInTheDocument();
  });

  it('비활성 CTA에는 사유가 반드시 붙는다(사유 없는 disabled 금지)', async () => {
    renderDetail(anAuctionDetail({ auctionPublicId: 'a-1' }));

    const bar = await screen.findByRole('region', { name: '거래 정보' });
    const cta = within(bar).getByRole('button', { name: '입찰하기' });
    expect(cta).toBeDisabled();
    expect(cta).toHaveAccessibleDescription(/입찰 기능은 준비 중입니다/);
  });

  it('★ SCHEDULED 는 "마감됨"이 아니라 "아직 시작 안 함"으로 안내한다(계약 v1.8 F4 정합)', async () => {
    renderDetail(
      anAuctionDetail({
        auctionPublicId: 'a-1',
        status: 'SCHEDULED',
        startAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    );

    const bar = await screen.findByRole('region', { name: '거래 정보' });
    expect(within(bar).getByText(/아직 시작하지 않은 경매입니다/)).toBeInTheDocument();
  });
});

describe('경매 상세 — 아트(부채 2·5·6) + 라이트박스', () => {
  it('아트가 3배로 뜨고 레벨·속성·종류가 대체텍스트에 실린다', async () => {
    renderDetail(
      anAuctionDetail({
        auctionPublicId: 'a-1',
        item: anItem({ subGroup: 2, kind: 4, element: 4, level: 3 }),
      }),
    );

    const art = await screen.findByRole('img', { name: /바람 속성 방어구 · 신발 레벨 3/ });
    expect(art).toHaveAttribute('src', '/art/items/level3/l/wind/boots.png');
    expect(art).toHaveAttribute('width', '150');
    expect(art).toHaveAttribute('height', '279');
  });

  it('★ 아트 클릭은 스펙 모달이 아니라 확대 라이트박스를 연다(Baymard — 퀵뷰 금지)', async () => {
    renderDetail(anAuctionDetail({ auctionPublicId: 'a-1' }));

    fireEvent.click(await screen.findByRole('button', { name: /크게 보기/ }));

    const dialog = screen.getByRole('dialog', { name: '카드 아트' });
    // 아트는 4배로 커지고, 스펙·거래 액션은 들어오지 않는다.
    expect(within(dialog).getByRole('img')).toHaveAttribute('width', '200');
    expect(within(dialog).queryByText('발동 확률')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /입찰/ })).not.toBeInTheDocument();
  });

  it('라이트박스는 Esc 로 닫힌다', async () => {
    renderDetail(anAuctionDetail({ auctionPublicId: 'a-1' }));

    fireEvent.click(await screen.findByRole('button', { name: /크게 보기/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('★ 골드포스는 색(아웃라인) 없이도 정보가 남는다 — 배지 + 본문줄 3경로([5.12])', async () => {
    renderDetail(
      anAuctionDetail({
        auctionPublicId: 'a-1',
        item: anItem({
          goldforceExpireAt: new Date(Date.now() + 9 * 86_400_000 + 60_000).toISOString(),
        }),
      }),
    );

    // ① 아트 위 배지(+ sr-only 보충) ② 스펙 표의 본문줄 — 아웃라인(색)을 지워도 둘이 남는다.
    expect(await screen.findByText('적용됨, 남은 기간')).toBeInTheDocument();
    expect(screen.getAllByText('골드포스').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('9일 남음')).toBeInTheDocument();
  });

  it('만료된 골드포스는 표시하지 않는다(클라 파생 — 서버는 시각만 준다)', async () => {
    renderDetail(
      anAuctionDetail({
        auctionPublicId: 'a-1',
        item: anItem({ goldforceExpireAt: new Date(Date.now() - 1000).toISOString() }),
      }),
    );

    await screen.findByRole('region', { name: '거래 정보' });
    expect(screen.queryByText('골드포스', { selector: 'span' })).not.toBeInTheDocument();
  });
});

describe('경매 상세 — 입찰 이력(부채 16)', () => {
  it('이력이 없으면 첫 입찰을 권하는 빈 상태가 뜬다(하단이 휑해지지 않게)', async () => {
    renderDetail(anAuctionDetail({ auctionPublicId: 'a-1', startPrice: 800_000 }), []);

    const history = await screen.findByRole('region', { name: '입찰 이력' });
    expect(await within(history).findByText('아직 입찰이 없습니다')).toBeInTheDocument();
    expect(within(history).getByText('800,000G')).toBeInTheDocument();
  });

  it('이력이 있으면 표와 카드 리스트가 모두 마크업된다(반응형 IA 교체)', async () => {
    renderDetail(anAuctionDetail({ auctionPublicId: 'a-1' }), [
      {
        bidPublicId: 'b-1',
        bidderMasked: '서리***',
        amount: 1_280_000,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      {
        bidPublicId: 'b-2',
        bidderMasked: '달빛***',
        amount: 1_240_000,
        status: 'OUTBID',
        createdAt: new Date().toISOString(),
      },
    ]);

    // 표(데스크톱) — 증분은 직전 행과의 차이로 계산한다.
    expect(await screen.findByRole('table', { name: /입찰 이력/ })).toBeInTheDocument();
    // 표와 카드 리스트 두 벌에 각각 실린다.
    expect(screen.getAllByText('+40,000')).toHaveLength(2);
    // 두 벌(표 + 카드 리스트)이 DOM 에 함께 있고 CSS 가 하나만 보인다.
    expect(screen.getAllByText('서리***')).toHaveLength(2);
    expect(screen.getAllByText('현재 최고')).toHaveLength(2);
  });

  it('★ 자금 정보를 그리지 않는다 — 계약이 응답에서 뺀 경계를 화면도 넘지 않는다', async () => {
    renderDetail(anAuctionDetail({ auctionPublicId: 'a-1' }), [
      {
        bidPublicId: 'b-1',
        bidderMasked: '서리***',
        amount: 1_280_000,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
    ]);

    // 섹션 안내문은 정책 고지라 '홀드·잔액'을 언급한다 — 검증 대상은 **데이터 행**이다.
    const table = await screen.findByRole('table', { name: /입찰 이력/ });
    expect(within(table).queryByText(/홀드/)).not.toBeInTheDocument();
    expect(within(table).queryByText(/잔액/)).not.toBeInTheDocument();
  });
});

describe('경매 상세 — 없는 매물', () => {
  it('404 는 에러 박스가 아니라 안내 + 목록 복귀 동선이다', async () => {
    stubApi([]); // 실패시켜 에러 분기로 보낸다

    renderWithProviders(
      <Routes>
        <Route path="/auctions/:auctionPublicId" element={<AuctionDetailPage />} />
      </Routes>,
      { route: '/auctions/missing' },
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
