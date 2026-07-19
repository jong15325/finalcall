import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useSignup } from '@/features/auth/api/useAuth';
import { useRateLimit } from '@/features/auth/hooks/useRateLimit';
import { hasErrorCode, isRateLimited } from '@/lib/api/errors';
import { toFieldErrorMap } from '@/lib/api/fieldErrors';
import { ROUTES } from '@/routes/paths';
import { ERROR_CODES } from '@/types/errorCodes';

/**
 * 회원가입 (`/signup`, AuthFormLayout). 계약 §2 · spec §3.2.
 * POST /auth/signup → 성공 안내 → /login 이동(loginId prefill). 자동 로그인 없음(P-010).
 * password 확인은 클라 일치 검증 전용·서버 미전송(계약 body 불변).
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

  const busy = signupMutation.isPending;
  const disabled = busy || rateLimit.isLimited;

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
    <section className="flex flex-col gap-6">
      {/* 페이지 제목은 화면당 1개다([3.2] `text-title`). ≤719px 축소는 index.css 가 중앙에서 처리한다. */}
      <h1 className="text-title text-text">회원가입</h1>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      {rateLimit.isLimited ? (
        <Alert tone="warning">
          요청이 많습니다. {rateLimit.secondsLeft}초 후 다시 시도할 수 있습니다.
        </Alert>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field
          label="아이디"
          type="text"
          autoComplete="username"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          error={fieldErrors.loginId}
          required
        />
        <Field
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />
        <Field
          label="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          error={confirmError ?? undefined}
          required
        />
        <Field
          label="닉네임"
          type="text"
          autoComplete="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          error={fieldErrors.nickname}
          required
        />
        <Button type="submit" size="lg" isLoading={busy} disabled={disabled} className="mt-2">
          {busy ? '가입 중' : '회원가입'}
        </Button>
      </form>

      <p className="text-body text-text-muted">
        이미 계정이 있나요?{' '}
        <Link to={ROUTES.login} className="text-primary underline">
          로그인
        </Link>
      </p>
    </section>
  );
}
