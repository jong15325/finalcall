import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { AuthAside, type AuthAsideRule } from '@/features/auth/components/AuthAside';
import { AuthBanner } from '@/features/auth/components/AuthBanner';
import { AuthScreen } from '@/features/auth/components/AuthScreen';
import { AuthSocialBlock } from '@/features/auth/components/AuthSocialBlock';
import { AuthStickyActions } from '@/features/auth/components/AuthStickyActions';
import { useLogin } from '@/features/auth/api/useAuth';
import { useDesktopAutoFocus } from '@/features/auth/hooks/useDesktopAutoFocus';
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
 * 보조 설명 — 장식이 아니라 **실제 도메인 규칙**이다(홀드·소프트클로즈·정산). 조작된 다급함이 아니라
 * 사실이므로 PRODUCT.md 반-레퍼런스에 걸리지 않고, 홈 하단 "거래가 안전한 이유"와 같은 문안이라 두
 * 화면이 한 목소리로 말한다.
 */
const LOGIN_RULES: AuthAsideRule[] = [
  {
    title: '입찰하면 금액이 홀드됩니다',
    body: '입찰한 금액은 즉시 사용할 수 없도록 잠깁니다. 상위 입찰에 밀리면 자동으로 풀립니다. 잔액이 없는 입찰은 애초에 성립하지 않습니다.',
  },
  {
    title: '마감 30초 안의 입찰은 마감을 미룹니다',
    body: '마지막 순간에 값을 던져 낚아채는 방식을 막습니다. 남은 시간이 30초 아래일 때 입찰이 들어오면 마감 시각이 다시 늘어납니다.',
  },
  {
    title: '낙찰 대금은 정산까지 보관됩니다',
    body: '구매 대금은 곧장 판매자에게 가지 않고 정산 단계에서 옮겨집니다. 취소·유찰이면 홀드된 금액이 그대로 돌아옵니다.',
  },
];

/**
 * 로그인 (`/login`, AuthFormLayout). 계약 §2 · spec §3.1 · FC-043 목업 집행(FC-050).
 * POST /auth/login → GET /me 하이드레이션 → setSession → returnUrl 복귀.
 * AuthFormLayout 이 인증 시 홈으로 되돌리므로 별도 처리 불요.
 *
 * ★ **에러 처리가 회원가입과 반대다.** 로그인 실패는 **폼 단위 배너만** 띄우고 필드를 강조하지 않는다
 *   — 어느 쪽이 틀렸는지 특정하면 계정 존재 여부가 드러나 회원 열거에 쓰인다(SEC-007). 특정 필드를
 *   붉게 칠하는 것 자체가 힌트다. 반면 가입 중복은 어느 값을 바꿔야 하는지가 곧 사용자의 다음 행동이라
 *   필드 단위로 표시한다(`SignupPage`). **이 비대칭은 취향이 아니라 보안 요건이며 테스트로 고정돼 있다.**
 *   서버 검증 400(`fieldErrors`)은 열거와 무관하므로 로그인에서도 필드 단위로 매핑한다.
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

  const loginIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const busy = loginMutation.isPending;
  const disabled = busy || rateLimit.isLimited;
  const signupSuccess = state?.signupSuccess === true;

  /* 가입 직후 복귀면 아이디가 이미 채워져 있다 — 포커스는 다음 할 일(비밀번호)로 보낸다. */
  useDesktopAutoFocus(signupSuccess ? passwordRef : loginIdRef);

  /*
   * role="alert" 는 낭독을 보장하지만 시야는 보장하지 않는다 — 모바일에서 키보드가 올라온 채 제출하면
   * 폼 위 배너가 뷰포트 밖일 수 있다. 포커스를 옮기고 시야로 끌어온다(FC-043 결정 ⑧).
   * 성공 배너는 대상이 아니다(사용자가 원한 결과라 흐름을 가로챌 이유가 없다).
   */
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
            // 계정/비번 어느 쪽인지 특정 금지(열거 완화 SEC-007) — 필드도 함께 강조하지 않는다
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
    <AuthScreen
      title="로그인"
      description="입찰·판매·정산은 로그인한 뒤에 이용할 수 있습니다."
      aside={<AuthAside title="FinalCall이 거래를 처리하는 방식" rules={LOGIN_RULES} />}
    >
      {signupSuccess ? (
        <AuthBanner tone="success" label="가입 완료">
          이제 로그인해 주세요.
        </AuthBanner>
      ) : null}

      {formError ? (
        <AuthBanner ref={bannerRef} tone="danger" label="로그인 실패">
          {formError}
        </AuthBanner>
      ) : null}

      {rateLimit.isLimited ? (
        <AuthBanner tone="warning" label="요청 제한">
          {/* 자릿수가 줄어도(30→9) 문장이 밀리지 않도록 font-num — 값이 흔들리는 자리다 */}
          <span className="font-num">{rateLimit.secondsLeft}</span>초 후 다시 시도할 수 있습니다.
        </AuthBanner>
      ) : null}

      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <Field
          ref={loginIdRef}
          label="아이디"
          type="text"
          autoComplete="username"
          placeholder="아이디를 입력하세요"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          error={fieldErrors.loginId}
          disabled={busy}
          required
        />
        <Field
          ref={passwordRef}
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          disabled={busy}
          required
        />

        <AuthStickyActions>
          <Button type="submit" size="lg" isLoading={busy} disabled={disabled} className="w-full">
            {busy ? '로그인 중' : '로그인'}
          </Button>
        </AuthStickyActions>
      </form>

      <AuthSocialBlock
        kakaoLabel="카카오로 계속하기"
        naverLabel="네이버로 계속하기"
        note="소셜 로그인은 아직 연결되지 않았습니다. 지금은 아이디와 비밀번호로 로그인해 주세요."
      />

      {/* 폼 이탈 경로는 여기 한 곳으로 모은다 — 헤더에 중복 배치하지 않는다(최소 셸) */}
      <p className="mt-6 border-t border-border-muted pt-5 text-center text-body text-text-muted">
        계정이 없나요?{' '}
        <Link to={ROUTES.signup} className="font-bold text-primary underline">
          회원가입
        </Link>
      </p>
    </AuthScreen>
  );
}
