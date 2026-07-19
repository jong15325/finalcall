import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { stubApi } from '@/test/apiStub';
import { anAuctionDetail, anAuctionSummary } from '@/test/fixtures';
import { renderWithProviders, signIn } from '@/test/testUtils';
import { AuctionDetailPage } from './AuctionDetailPage';
import { AuctionListPage } from './AuctionListPage';
import { LoginPage } from './LoginPage';
import { ProfilePage } from './ProfilePage';
import { SignupPage } from './SignupPage';

/**
 * 실구현 화면 5종 스모크(FC-051).
 *
 * ★ **여기는 화면별 테스트 스위트가 아니라 "터지지 않는가" 검문소다.** 각 화면의 상호작용·분기 검증은
 * 해당 구현 티켓(FC-048~050)이 자기 파일로 동반한다. 이 파일이 잡는 것은 리팩터링·토큰 교체가
 * 렌더를 통째로 깨뜨리는 유형이다 — FC-038 의 M-1 이 리뷰까지 살아남은 것도 이 층이 없어서였다.
 *
 * 판정 기준은 "제목이 보인다"로 잡는다. 문구를 세밀하게 걸면 카피 수정마다 테스트가 깨져
 * 스모크가 잔소리로 전락한다.
 */
describe('화면 스모크 — 크래시 없이 렌더된다', () => {
  it('로그인', () => {
    renderWithProviders(<LoginPage />, { route: '/login' });

    expect(screen.getByRole('heading', { level: 1, name: '로그인' })).toBeInTheDocument();
    expect(screen.getByLabelText(/아이디/)).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호/)).toBeInTheDocument();
  });

  it('회원가입', () => {
    renderWithProviders(<SignupPage />, { route: '/signup' });

    expect(screen.getByRole('heading', { level: 1, name: '회원가입' })).toBeInTheDocument();
    // 제목은 "회원가입", CTA 는 "가입하기"다(FC-043 목업 — 문구 확정은 사용자 판단 대기 4건 중 하나)
    expect(screen.getByRole('button', { name: '가입하기' })).toBeInTheDocument();
  });

  it('마이페이지 — /me·/me/balance 응답 반영', async () => {
    signIn(); // 보호 리소스 훅은 `enabled: isAuthed` — 세션이 없으면 요청 자체가 나가지 않는다
    stubApi([
      // `/me/balance` 가 `/me` 보다 먼저 와야 한다(부분일치라 순서가 곧 우선순위다).
      {
        match: '/me/balance',
        data: {
          cashBalance: 50_000,
          gameMoneyBalance: 120_000,
          gameMoneyHeld: 20_000,
          gameMoneyAvailable: 100_000,
        },
      },
      {
        match: '/me',
        data: {
          userPublicId: 'user-0001',
          nickname: '시험계정',
          isAdmin: false,
          createdAt: '2026-01-01T00:00:00Z',
        },
      },
    ]);

    renderWithProviders(<ProfilePage />, { route: '/me/profile' });

    expect(screen.getByRole('heading', { level: 1, name: '마이페이지' })).toBeInTheDocument();
    expect(await screen.findByText('시험계정')).toBeInTheDocument();
  });

  it('경매 목록 — 카드가 그려진다', async () => {
    stubApi([
      {
        match: '/auctions',
        data: {
          content: [
            // 입찰 전(현 서버 상태)과 입찰 후(EPIC-BID) 두 분기를 한 화면에 함께 태운다.
            anAuctionSummary({ auctionPublicId: 'a-1' }),
            anAuctionSummary({ auctionPublicId: 'a-2', highestBidAmount: 33_000, bidCount: 4 }),
          ],
          nextCursor: null,
          hasNext: false,
        },
      },
    ]);

    renderWithProviders(<AuctionListPage />, { route: '/auctions' });

    expect(screen.getByRole('heading', { level: 1, name: '경매' })).toBeInTheDocument();
    expect(await screen.findAllByText('시험용 아이템')).toHaveLength(2);
  });

  it('경매 목록 — 필터 쿼리스트링이 유입돼도 렌더된다', async () => {
    stubApi([{ match: '/auctions', data: { content: [], nextCursor: null, hasNext: false } }]);

    // URL 로 직접 들어오는 값은 사용자 입력과 같다 — 화이트리스트 밖 정렬·미등록 속성 코드가 섞여도 살아야 한다.
    renderWithProviders(<AuctionListPage />, {
      route: '/auctions?sort=nonsense&status=BOGUS&element=99&minPrice=abc',
    });

    expect(await screen.findByText('조건에 맞는 매물이 없습니다')).toBeInTheDocument();
  });

  it('경매 상세', async () => {
    stubApi([
      {
        match: '/auctions/',
        data: anAuctionDetail({ auctionPublicId: 'a-1' }),
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/auctions/:auctionPublicId" element={<AuctionDetailPage />} />
      </Routes>,
      { route: '/auctions/a-1' },
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: '시험용 아이템' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '거래 정보' })).toBeInTheDocument();
  });
});
