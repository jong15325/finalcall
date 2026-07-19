import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { AuthAside, type AuthAsideRule } from '@/features/auth/components/AuthAside';
import { AuthBanner } from '@/features/auth/components/AuthBanner';
import { AuthScreen } from '@/features/auth/components/AuthScreen';
import { AuthSocialBlock } from '@/features/auth/components/AuthSocialBlock';
import { AuthStickyActions } from '@/features/auth/components/AuthStickyActions';
import { useSignup } from '@/features/auth/api/useAuth';
import { useDesktopAutoFocus } from '@/features/auth/hooks/useDesktopAutoFocus';
import { useRateLimit } from '@/features/auth/hooks/useRateLimit';
import { hasErrorCode, isRateLimited } from '@/lib/api/errors';
import { toFieldErrorMap } from '@/lib/api/fieldErrors';
import { ROUTES } from '@/routes/paths';
import { ERROR_CODES } from '@/types/errorCodes';

/** "무엇을 받고 무엇을 안 받는가"가 가입 시점 사용자의 실제 질문이다. */
const SIGNUP_RULES: AuthAsideRule[] = [
  {
    title: '아이디·비밀번호·닉네임만 받습니다',
    body: '가입에 필요한 값은 이 셋뿐입니다. 이름·전화번호·주민등록번호 같은 정보는 요구하지 않습니다. 닉네임은 거래 화면에 표시되고, 아이디는 표시되지 않습니다.',
  },
  {
    title: '가입이 끝나면 로그인 화면으로 이동합니다',
    body: '가입과 동시에 로그인되지는 않습니다. 방금 만든 아이디는 자동으로 채워지므로 비밀번호만 입력하면 됩니다.',
  },
  {
    title: '입찰하려면 게임머니가 필요합니다',
    body: '가입 직후 잔액은 0입니다. 지갑에서 충전한 뒤 입찰·즉시구매를 할 수 있고, 입찰한 금액은 낙찰 전까지 홀드됩니다.',
  },
];

/**
 * 회원가입 (`/signup`, AuthFormLayout). 계약 §2 · spec §3.2 · FC-043 목업 집행(FC-050).
 * POST /auth/signup → 성공 안내 → /login 이동(loginId prefill). 자동 로그인 없음(P-010).
 *
 * ★ **에러 처리가 로그인과 반대다.** 중복(AUTH_001·AUTH_002)은 **필드 단위**로 표시한다 — 어느 값을
 *   바꿔야 하는지가 곧 사용자의 다음 행동이기 때문이다. 로그인은 같은 특정이 회원 열거 힌트가 되므로
 *   폼 단위 배너만 띄운다(SEC-007, `LoginPage`). 가입 화면에서 "이미 사용 중"은 열거를 막을 수 없는
 *   정보다(그걸 알려주지 않으면 가입 자체가 불가능하다).
 *
 * ★ **창작하지 않은 것**(FC-043 결정 ⓑ·ⓒ + 계약 §2):
 *   - 약관 동의 **체크박스** — 계약 §2 signup body 에 동의 필드가 없다. 보낼 값이 없는 입력을 만들지
 *     않는다. 지금은 고지 문장이며, 명시 체크로 바꾸려면 계약 §2 변경 = 게이트2 대상이다.
 *   - **비밀번호 규칙 힌트** — 계약이 정책(길이·문자 구성)을 명세하지 않았다. 지어내면 "안내는 통과인데
 *     400"이 난다. 힌트가 놓일 자리는 구조적으로 비워 둔다.
 *   - **이메일 필드** — body 는 `{loginId, password, nickname}` 이다. 도입 시 위치는 아이디 바로
 *     다음이다(이메일은 프로필 정보가 아니라 또 하나의 **식별자**라 식별자끼리 붙고, 비밀번호 두 칸을
 *     갈라놓지 않는다). 폼은 flex column + 고정 gap 이라 필드가 늘어도 리듬이 유지된다.
 *
 * "비밀번호 확인"은 **클라이언트 일치 검증 전용이며 서버로 보내지 않는다**(P-009 — 계약 body 불변).
 * 그 사실은 주석과 힌트 문장으로 알린다. `<label>` 안에 태그로 적으면 인풋의 접근 가능한 이름에 합쳐져
 * 스크린리더가 "비밀번호 확인 클라이언트 확인"으로 읽는다.
 */
export function SignupPage() {
  const navigate = useNavigate();
  const signupMutation = useSignup();
  const rateLimit = useRateLimit();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const loginIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const busy = signupMutation.isPending;
  const disabled = busy || rateLimit.isLimited;

  useDesktopAutoFocus(loginIdRef);

  /*
   * 필드 단위 에러는 **폼 순서상 첫 번째 에러 필드**로 포커스를 옮긴다(FC-043 결정 ⑧).
   * 모바일에서 키보드가 올라온 채 제출하면 4필드 폼의 위쪽 필드가 뷰포트 밖일 수 있다 — 붉게 칠하는
   * 것만으로는 시각 사용자에게 아무 일도 일어나지 않은 것처럼 보인다.
   */
  useEffect(() => {
    const order: [string | null, RefObject<HTMLInputElement>][] = [
      [fieldErrors.loginId ?? null, loginIdRef],
      [fieldErrors.password ?? null, passwordRef],
      [confirmError, confirmRef],
      [fieldErrors.nickname ?? null, nicknameRef],
    ];
    const first = order.find(([message]) => message !== null);
    if (!first) return;
    first[1].current?.focus();
    first[1].current?.scrollIntoView?.({ block: 'nearest' });
  }, [fieldErrors, confirmError]);

  useEffect(() => {
    if (!formError) return;
    const banner = bannerRef.current;
    if (!banner) return;
    banner.focus();
    banner.scrollIntoView?.({ block: 'nearest' });
  }, [formError]);

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setConfirmError(null);

    // 클라 일치 검증(서버 400 아님)
    if (password !== passwordConfirm) {
      setConfirmError('비밀번호가 일치하지 않습니다.');
      return;
    }

    signupMutation.mutate(
      { loginId, password, nickname },
      {
        onSuccess: () =>
          navigate(ROUTES.login, { replace: true, state: { signupSuccess: true, loginId } }),
        onError: (error) => {
          if (isRateLimited(error)) {
            rateLimit.trigger(error.retryAfterMs);
            return;
          }
          if (hasErrorCode(error, ERROR_CODES.AUTH_001)) {
            setFieldErrors({ loginId: '이미 사용 중인 아이디입니다.' });
            return;
          }
          if (hasErrorCode(error, ERROR_CODES.AUTH_002)) {
            setFieldErrors({ nickname: '이미 사용 중인 닉네임입니다.' });
            return;
          }
          const fe = toFieldErrorMap(error);
          if (Object.keys(fe).length > 0) {
            setFieldErrors(fe);
            return;
          }
          setFormError(error instanceof Error ? error.message : '회원가입에 실패했습니다.');
        },
      },
    );
  };

  return (
    <AuthScreen
      title="회원가입"
      description="아이디와 닉네임만 있으면 가입할 수 있습니다."
      aside={<AuthAside title="가입할 때 알아 두면 좋은 것" rules={SIGNUP_RULES} />}
    >
      {formError ? (
        <AuthBanner ref={bannerRef} tone="danger" label="가입 실패">
          {formError}
        </AuthBanner>
      ) : null}

      {rateLimit.isLimited ? (
        <AuthBanner tone="warning" label="요청 제한">
          <span className="font-num">{rateLimit.secondsLeft}</span>초 후 다시 시도할 수 있습니다.
        </AuthBanner>
      ) : null}

      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <Field
          ref={loginIdRef}
          label="아이디"
          type="text"
          autoComplete="username"
          placeholder="로그인에 사용할 아이디"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          error={fieldErrors.loginId}
          disabled={busy}
          required
        />
        {/* 비밀번호 정책 힌트는 계약이 명세할 때 여기에 한 줄 붙는다(지금 창작하지 않는다) */}
        <Field
          ref={passwordRef}
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          disabled={busy}
          required
        />
        <Field
          ref={confirmRef}
          label="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호를 한 번 더"
          hint="위에 입력한 비밀번호와 같은지 확인합니다."
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          error={confirmError ?? undefined}
          disabled={busy}
          required
        />
        <Field
          ref={nicknameRef}
          label="닉네임"
          type="text"
          autoComplete="nickname"
          placeholder="다른 이용자에게 보이는 이름"
          hint="거래 목록과 상세에 표시됩니다."
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          error={fieldErrors.nickname}
          disabled={busy}
          required
        />

        <AuthStickyActions>
          <Button type="submit" size="lg" isLoading={busy} disabled={disabled} className="w-full">
            {busy ? '가입 중' : '가입하기'}
          </Button>
        </AuthStickyActions>
      </form>

      {/*
        약관 고지 — 체크박스가 아니라 **문장**이다(계약 §2 에 동의 필드가 없다).
        CTA **아래**에 두는 이유: 위에 두면 사용자가 읽지 않은 채 버튼으로 직행하고, 아래에 두면 버튼을
        누르기 직전 시선 경로에 걸린다(숨기지 않으므로 다크패턴이 아니다). 모바일에서 CTA 가 sticky 로
        떠오르면 이 문장은 그 아래에 남아 "버튼 바로 아래"라는 시선 경로가 유지된다 — 위에 뒀다면
        sticky 바에 가려 보이지 않았을 자리다.
        ※ 약관·개인정보처리방침을 링크로 걸지 않는다: 대응 라우트가 없어 죽은 링크가 된다
          (SiteFooter 가 같은 이유로 정책 링크 열을 들어낸 선례).
      */}
      <p className="mt-4 text-micro text-text-subtle">
        가입하면 이용약관과 개인정보처리방침에 동의하는 것으로 봅니다.
      </p>

      <AuthSocialBlock
        kakaoLabel="카카오로 시작하기"
        naverLabel="네이버로 시작하기"
        note="소셜 가입은 아직 연결되지 않았습니다. 지금은 위 항목을 입력해 가입해 주세요."
      />

      <p className="mt-6 border-t border-border-muted pt-5 text-center text-body text-text-muted">
        이미 계정이 있나요?{' '}
        <Link to={ROUTES.login} className="font-bold text-primary underline">
          로그인
        </Link>
      </p>
    </AuthScreen>
  );
}
