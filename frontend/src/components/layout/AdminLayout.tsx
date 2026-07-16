import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuthStore, useIsAuthenticated } from '@/stores/authStore';
import { sanitizeReturnUrl } from '@/lib/returnUrl';
import { ROUTES } from '@/routes/paths';

/**
 * 관리자 가드 + 레이아웃.
 * 미인증 → login?returnUrl. 인증했으나 비관리자 → 홈.
 * 클라 isAdmin 은 UI 노출 제어일 뿐 인가는 서버 권위다(계약 [1.2]) — 서버가 AUTH_005(403)로 최종 차단.
 */
export function AdminLayout() {
  const isAuthed = useIsAuthenticated();
  const isAdmin = useAuthStore((s) => s.user?.isAdmin ?? false);
  const location = useLocation();

  if (!isAuthed) {
    const target = sanitizeReturnUrl(location.pathname + location.search);
    return <Navigate to={`${ROUTES.login}?returnUrl=${encodeURIComponent(target)}`} replace />;
  }
  if (!isAdmin) return <Navigate to={ROUTES.home} replace />;

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold text-text">FinalCall · 관리자</span>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
