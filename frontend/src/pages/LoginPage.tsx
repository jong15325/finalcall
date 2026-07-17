import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useLogin } from '@/features/auth/api/useAuth';
import { useRateLimit } from '@/features/auth/hooks/useRateLimit';
import { hasErrorCode, isRateLimited } from '@/lib/api/errors';
import { toFieldErrorMap } from '@/lib/api/fieldErrors';
import { sanitizeReturnUrl } from '@/lib/returnUrl';
import { ROUTES } from '@/routes/paths';
import { ERROR_CODES } from '@/types/errorCodes';

/** 회원가입 성공 후 /login 이동 시 넘어오는 state(loginId prefill + 안내). */
interface LoginLocationState {
  signupSuccess?: boolean;
  loginId?: string;
}

/**
 * 로그인 (`/login`, AuthFormLayout). 계약 §2 · spec §3.1.
 * POST /auth/login → GET /me 하이드레이션 → setSession → returnUrl 복귀.
 * AuthFormLayout 이 인증 시 홈으로 되돌리므로 별도 처리 불요.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnUrl = sanitizeReturnUrl(searchParams.get('returnUrl'));
  const navigate = useNavigate();
  const state = (useLocation().state ?? null) as LoginLocationState | null;

  const loginMutation = useLogin();
  const rateLimit = useRateLimit();

  const [loginId, setLoginId] = useState(state?.loginId ?? '');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const busy = loginMutation.isPending;
  const disabled = busy || rateLimit.isLimited;

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    loginMutation.mutate(
      { loginId, password },
      {
        onSuccess: () => navigate(returnUrl, { replace: true }),
        onError: (error) => {
          if (isRateLimited(error)) {
            rateLimit.trigger(error.retryAfterMs);
            return;
          }
          if (hasErrorCode(error, ERROR_CODES.AUTH_003)) {
            // 계정/비번 어느 쪽인지 특정 금지(열거 완화 SEC-007)
            setFormError('아이디 또는 비밀번호가 올바르지 않습니다.');
            return;
          }
          const fe = toFieldErrorMap(error);
          if (Object.keys(fe).length > 0) {
            setFieldErrors(fe);
            return;
          }
          setFormError(error instanceof Error ? error.message : '로그인에 실패했습니다.');
        },
      },
    );
  };

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">로그인</h1>

      {state?.signupSuccess ? (
        <Alert tone="success">회원가입이 완료되었습니다. 로그인해 주세요.</Alert>
      ) : null}
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />
        <Button type="submit" size="lg" isLoading={busy} disabled={disabled} className="mt-2">
          {busy ? '로그인 중' : '로그인'}
        </Button>
      </form>

      <p className="text-sm text-text-muted">
        계정이 없나요?{' '}
        <Link to={ROUTES.signup} className="text-primary underline">
          회원가입
        </Link>
      </p>
    </section>
  );
}
