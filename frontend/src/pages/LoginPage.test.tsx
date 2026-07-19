import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { stubApiError } from '@/test/apiStub';
import { renderWithProviders } from '@/test/testUtils';
import { ERROR_CODES } from '@/types/errorCodes';
import { LoginPage } from './LoginPage';

/**
 * 로그인 화면(FC-050 — FC-043 목업 집행).
 *
 * ★ 이 스위트의 중심은 **에러 처리의 비대칭**이다. 로그인 실패는 폼 단위 배너만 띄우고 필드를
 *   강조하지 않는다 — 특정 필드를 붉게 칠하면 그 자체가 "이 아이디는 존재한다"는 힌트가 되어
 *   회원 열거에 쓰인다(SEC-007). **이건 취향이 아니라 보안 요건이 UI 에 걸린 자리라 회귀를 테스트로
 *   막는다.** 나중에 누군가 "어느 칸이 틀렸는지 알려주면 친절하겠다"고 고치는 순간 여기가 깨진다.
 */
function submitLogin(): void {
  fireEvent.change(screen.getByLabelText('아이디'), { target: { value: 'finalcall_user' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'pw-12345678' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
}

describe('로그인 — 폼이 주인공인 화면', () => {
  it('폼·OAuth 자리·전환 링크가 함께 선다', () => {
    renderWithProviders(<LoginPage />, { route: '/login' });

    expect(screen.getByRole('heading', { level: 1, name: '로그인' })).toBeInTheDocument();
    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();

    // OAuth 는 **지금** 자리를 잡는다 — 나중에 넣으면 카드 높이가 40% 뛰어 재설계가 된다(결정 ④)
    const kakao = screen.getByRole('button', { name: /카카오로 계속하기/ });
    expect(kakao).toBeDisabled();
    // 사유 없는 비활성은 금지 — 왜 못 누르는지가 문장으로 연결돼 있어야 한다
    expect(kakao).toHaveAccessibleDescription(/아직 연결되지 않았습니다/);
    expect(screen.getByRole('button', { name: /네이버로 계속하기/ })).toBeDisabled();

    // 폼 이탈 경로는 카드 하단 한 곳뿐이다(최소 셸)
    expect(screen.getByRole('link', { name: '회원가입' })).toHaveAttribute('href', '/signup');

    // 보조 설명은 장식이 아니라 실제 도메인 규칙이다
    expect(screen.getByText('입찰하면 금액이 홀드됩니다')).toBeInTheDocument();
  });

  it('★ SEC-007 — 로그인 실패는 폼 단위 배너만 띄우고 필드를 강조하지 않는다', async () => {
    stubApiError([
      {
        match: '/auth/login',
        status: 401,
        code: ERROR_CODES.AUTH_003,
        message: '자격 증명이 올바르지 않습니다.',
      },
    ]);

    renderWithProviders(<LoginPage />, { route: '/login' });
    submitLogin();

    // 배너는 role=alert 로 낭독되고, 어느 쪽이 틀렸는지 특정하지 않는다
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('아이디 또는 비밀번호가 올바르지 않습니다.');

    // ★ 핵심 — 두 필드 어디에도 에러 표시가 붙지 않는다(붙는 순간 회원 열거 힌트가 된다)
    expect(screen.getByLabelText('아이디')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('비밀번호')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('아이디')).not.toHaveAccessibleDescription();
    expect(screen.getByLabelText('비밀번호')).not.toHaveAccessibleDescription();

    // 배너로 포커스가 옮겨진다 — role=alert 는 낭독을 보장하지만 시야는 보장하지 않는다(결정 ⑧)
    await waitFor(() => expect(banner).toHaveFocus());
  });

  it('서버 검증 400 은 필드 단위로 매핑된다(열거와 무관한 경로)', async () => {
    stubApiError([
      {
        match: '/auth/login',
        status: 400,
        code: 'COMMON_001',
        message: '입력값이 올바르지 않습니다.',
        errors: [{ field: 'loginId', reason: '아이디를 입력해 주세요.' }],
      },
    ]);

    renderWithProviders(<LoginPage />, { route: '/login' });
    submitLogin();

    const loginIdInput = await screen.findByLabelText('아이디');
    await waitFor(() => expect(loginIdInput).toHaveAttribute('aria-invalid', 'true'));
    // 색 단독 전달 금지(1.4.1) — 문장이 aria-describedby 로 연결된다
    expect(loginIdInput).toHaveAccessibleDescription('아이디를 입력해 주세요.');
    expect(screen.getByLabelText('비밀번호')).not.toHaveAttribute('aria-invalid');
  });

  it('429 는 사용자 잘못이 아니라 대기로 말하고 제출을 잠근다', async () => {
    stubApiError([
      {
        match: '/auth/login',
        status: 429,
        code: ERROR_CODES.GATEWAY_429,
        message: '요청이 많습니다.',
        retryAfterSeconds: 30,
      },
    ]);

    renderWithProviders(<LoginPage />, { route: '/login' });
    submitLogin();

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('요청 제한');
    expect(notice).toHaveTextContent('30초 후 다시 시도할 수 있습니다.');
    expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled();

    // 잠금 사유가 화면에 남아 있어야 한다 — 자동 소멸하는 토스트를 쓰지 않는 이유([5.6])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
