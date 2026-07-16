import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { sanitizeReturnUrl } from '@/lib/returnUrl';
import { ROUTES } from '@/routes/paths';

/**
 * 로그인 화면 placeholder.
 * 실제 로그인(POST /auth/login) 폼·검증·플로우(P-009·P-010)는 auth feature 단계에서 구현한다.
 *
 * 스켈레톤 범위: returnUrl 안전 파싱(P-011) + 인증 가드 복귀 경로 검증.
 * 아래 "임시 세션" 버튼은 **스켈레톤 검증 전용**(가드 → login → returnUrl 복귀 동작 확인용)이며,
 * auth feature 착수 시 실제 로그인 호출로 대체·제거된다. 실 API·자격 검증은 하지 않는다.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnUrl = sanitizeReturnUrl(searchParams.get('returnUrl'));
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const handleStubSignIn = (asAdmin: boolean): void => {
    // 스켈레톤 전용 stub 세션 — 실제 토큰 발급 아님(메모리 세션, persist 없음).
    setSession({
      accessToken: 'skeleton-stub-access-token',
      accessExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      refreshToken: 'skeleton-stub-refresh-token',
      user: {
        userPublicId: '00000000000000000000000000',
        nickname: asAdmin ? '관리자(stub)' : '사용자(stub)',
        isAdmin: asAdmin,
      },
    });
    navigate(returnUrl, { replace: true });
  };

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text">로그인</h1>
      <p className="text-sm text-text-muted">
        로그인 폼은 auth feature 단계에서 구현됩니다(스켈레톤 placeholder).
      </p>

      <div className="rounded-md border border-border bg-surface p-3 text-xs text-text-subtle">
        복귀 경로(returnUrl): <span className="font-num text-text-muted">{returnUrl}</span>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
        <p className="text-xs text-text-subtle">
          스켈레톤 검증 전용 — 가드 복귀(returnUrl) 동작 확인용. auth feature 착수 시 제거됩니다.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleStubSignIn(false)}
            className="rounded-md border border-primary bg-primary px-3 py-2 text-sm text-primary-fg transition-colors duration-fast hover:border-border hover:bg-primary-hover"
          >
            임시 세션(사용자)
          </button>
          <button
            type="button"
            onClick={() => handleStubSignIn(true)}
            className="rounded-md border border-border px-3 py-2 text-sm text-text transition-colors duration-fast hover:bg-surface-raised"
          >
            임시 세션(관리자)
          </button>
        </div>
      </div>

      <p className="text-sm text-text-muted">
        계정이 없나요?{' '}
        <Link to={ROUTES.signup} className="text-text underline">
          회원가입
        </Link>
      </p>
    </section>
  );
}
