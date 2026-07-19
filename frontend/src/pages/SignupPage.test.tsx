import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { stubApiError } from '@/test/apiStub';
import { renderWithProviders } from '@/test/testUtils';
import { ERROR_CODES } from '@/types/errorCodes';
import { SignupPage } from './SignupPage';

/**
 * 회원가입 화면(FC-050 — FC-043 목업 집행).
 *
 * ★ 로그인과 **반대로** 중복은 필드 단위로 표시한다. 가입 화면에서 "이미 사용 중"은 애초에 감출 수
 *   없는 정보이고(감추면 가입 자체가 불가능하다), 어느 값을 바꿔야 하는지가 곧 사용자의 다음 행동이다.
 *   `LoginPage.test.tsx` 의 SEC-007 테스트와 짝을 이룬다 — 두 파일이 함께 그 비대칭을 고정한다.
 *
 * ★ **없는 것이 없음을 확인한다.** 약관 동의 체크박스·비밀번호 규칙 힌트·이메일 필드는 계약 §2 에
 *   근거가 없어 의도적으로 만들지 않았다. 나중에 "폼이 허전하다"는 이유로 되살아나는 것을 막는다.
 */
function fillSignup(overrides: Partial<Record<string, string>> = {}): void {
  const values: Record<string, string> = {
    아이디: 'finalcall_user',
    비밀번호: 'pw-12345678',
    '비밀번호 확인': 'pw-12345678',
    닉네임: '파이널콜러',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

function submitSignup(): void {
  fireEvent.click(screen.getByRole('button', { name: '가입하기' }));
}

describe('회원가입 — 계약 §2 가 정한 만큼만 묻는다', () => {
  it('필드 4개와 OAuth 자리가 서고, 계약에 없는 입력은 만들지 않는다', () => {
    renderWithProviders(<SignupPage />, { route: '/signup' });

    expect(screen.getByRole('heading', { level: 1, name: '회원가입' })).toBeInTheDocument();
    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호 확인')).toBeInTheDocument();
    expect(screen.getByLabelText('닉네임')).toBeInTheDocument();

    // ★ 창작 금지 항목 — 계약 §2 signup body 는 {loginId, password, nickname} 뿐이다
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
    // 동의는 체크박스가 아니라 고지 문장이다(보낼 값이 없는 입력을 만들지 않는다)
    expect(screen.getByText(/동의하는 것으로 봅니다/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /카카오로 시작하기/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login');
  });

  it('비밀번호 불일치는 서버에 가기 전에 클라이언트가 잡는다(P-009)', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('요청이 나가면 안 된다')));
    vi.stubGlobal('fetch', fetchSpy);

    renderWithProviders(<SignupPage />, { route: '/signup' });
    fillSignup({ '비밀번호 확인': 'pw-different' });
    submitSignup();

    const confirmInput = screen.getByLabelText('비밀번호 확인');
    await waitFor(() => expect(confirmInput).toHaveAttribute('aria-invalid', 'true'));
    expect(confirmInput).toHaveAccessibleDescription('비밀번호가 일치하지 않습니다.');
    // "비밀번호 확인"은 계약 body 에 없다 — 검증만 하고 서버로 보내지 않으므로 요청 자체가 없다
    expect(fetchSpy).not.toHaveBeenCalled();

    // 에러 필드로 포커스가 옮겨진다(4필드 폼에서 붉은 테두리만으로는 시야 밖일 수 있다)
    await waitFor(() => expect(confirmInput).toHaveFocus());
  });

  it('중복 아이디(AUTH_001)는 필드 단위로 표시된다 — 로그인과 반대', async () => {
    stubApiError([
      {
        match: '/auth/signup',
        status: 409,
        code: ERROR_CODES.AUTH_001,
        message: '이미 사용 중인 아이디입니다.',
      },
    ]);

    renderWithProviders(<SignupPage />, { route: '/signup' });
    fillSignup();
    submitSignup();

    const loginIdInput = screen.getByLabelText('아이디');
    await waitFor(() => expect(loginIdInput).toHaveAttribute('aria-invalid', 'true'));
    expect(loginIdInput).toHaveAccessibleDescription('이미 사용 중인 아이디입니다.');

    // 필드가 말하고 있으므로 폼 단위 배너는 뜨지 않는다(같은 말을 두 번 하지 않는다)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('닉네임')).not.toHaveAttribute('aria-invalid');
  });

  it('중복 닉네임(AUTH_002)은 닉네임 필드가 받는다', async () => {
    stubApiError([
      {
        match: '/auth/signup',
        status: 409,
        code: ERROR_CODES.AUTH_002,
        message: '이미 사용 중인 닉네임입니다.',
      },
    ]);

    renderWithProviders(<SignupPage />, { route: '/signup' });
    fillSignup();
    submitSignup();

    const nicknameInput = screen.getByLabelText('닉네임');
    await waitFor(() => expect(nicknameInput).toHaveAttribute('aria-invalid', 'true'));
    expect(nicknameInput).toHaveAccessibleDescription('이미 사용 중인 닉네임입니다.');
    expect(screen.getByLabelText('아이디')).not.toHaveAttribute('aria-invalid');
  });

  it('코드 없는 실패는 폼 단위 배너로 떨어진다(role=alert)', async () => {
    stubApiError([
      {
        match: '/auth/signup',
        status: 500,
        code: 'COMMON_999',
        message: '일시적인 오류가 발생했습니다.',
      },
    ]);

    renderWithProviders(<SignupPage />, { route: '/signup' });
    fillSignup();
    submitSignup();

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('가입 실패');
    await waitFor(() => expect(banner).toHaveFocus());
  });
});
