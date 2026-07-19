import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { stubApi } from '@/test/apiStub';
import { renderWithProviders, signIn } from '@/test/testUtils';
import { AppShell } from './AppShell';

/**
 * 공통 셸 테스트(FC-048).
 *
 * 셸은 **전 화면에 걸리므로** 여기가 깨지면 사이트 전체가 깨진다. 검증 축은 세 개다:
 * ① 로그인 전/후 두 상태가 모두 선다 ② 데스크톱 주 내비와 모바일 탭바가 **둘 다 마크업에 있다**
 * (CSS 미디어쿼리로 감추므로 jsdom 에서는 둘 다 존재하는 것이 정상) ③ 푸터·브랜드가 있다.
 *
 * 한계: 어느 쪽이 **실제로 보이는지**는 CSS 가 결정하므로 jsdom 으로 판정할 수 없다(반응형 분기는
 * 브라우저 확인 항목이다). 여기서는 "두 내비가 모두 렌더된다 + 목적지가 옳다"까지만 잠근다.
 */
describe('공통 셸(AppShell)', () => {
  it('비로그인 — 브랜드·주 내비·푸터가 선다', () => {
    renderWithProviders(
      <AppShell>
        <p>본문</p>
      </AppShell>,
    );

    // 브랜드는 헤더·푸터 두 곳(활자 워드마크 — 로고 이미지 없음)
    expect(screen.getAllByText('FINAL')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'FinalCall 홈' })).toBeInTheDocument();

    // 주 메뉴는 두 벌(데스크톱 2행 헤더 · 모바일 하단 탭바)
    const navs = screen.getAllByRole('navigation', { name: '주 메뉴' });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      expect(within(nav).getByRole('link', { name: '경매' })).toHaveAttribute('href', '/auctions');
    }

    // 비로그인 액션 — 헤더(로그인·회원가입)와 모바일 탭바 4번째 칸(로그인)이 함께 존재한다
    expect(screen.getAllByRole('link', { name: '로그인' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: '회원가입' })).toBeInTheDocument();

    // 푸터 — 자리표시자 고지를 문장으로 명시한다(가짜 사업자 정보 창작 금지)
    expect(screen.getByText(/위 사업자 정보는 자리표시자입니다/)).toBeInTheDocument();
    expect(screen.getByText('본문')).toBeInTheDocument();
  });

  it('로그인 — 잔액과 계정이 헤더에 상주한다', async () => {
    signIn('달빛상인');
    stubApi([
      {
        match: '/me/balance',
        data: {
          cashBalance: 0,
          gameMoneyBalance: 2_450_000,
          gameMoneyHeld: 300_000,
          gameMoneyAvailable: 2_150_000,
        },
      },
    ]);

    renderWithProviders(
      <AppShell>
        <p>본문</p>
      </AppShell>,
    );

    expect(await screen.findByText('2,150,000')).toBeInTheDocument();
    // 홀드는 색이 아니라 문구가 1차 신호다(색 단독 전달 금지)
    expect(screen.getByText('300,000G 홀드 중')).toBeInTheDocument();
    expect(screen.getByText('달빛상인')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument();
  });

  it('잔액 응답이 없어도 셸이 무너지지 않는다', () => {
    signIn();
    stubApi([{ match: '/me/balance', data: null }]);

    renderWithProviders(
      <AppShell>
        <p>본문</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'FinalCall 홈' })).toBeInTheDocument();
    expect(screen.getByText('본문')).toBeInTheDocument();
  });
});
