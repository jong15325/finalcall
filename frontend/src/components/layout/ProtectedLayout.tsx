import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuthStore, useIsAuthenticated } from '@/stores/authStore';
import { sanitizeReturnUrl } from '@/lib/returnUrl';
import { ROUTES } from '@/routes/paths';

/**
 * 인증 가드 + 보호 영역 레이아웃 (`me` 주체).
 * 미인증 접근 → `/login?returnUrl=<원경로>` 복귀(P-011, 앱 내부 라우트 한정).
 * returnUrl 은 현재 pathname+search 로 구성하되 내부 경로만 통과시킨다(sanitize).
 */
const navClass = ({ isActive }: { isActive: boolean }): string =>
  `text-sm transition-colors duration-fast hover:text-text ${
    isActive ? 'text-text font-semibold' : 'text-text-muted'
  }`;

export function ProtectedLayout() {
  const isAuthed = useIsAuthenticated();
  const nickname = useAuthStore((s) => s.user?.nickname);
  const location = useLocation();

  if (!isAuthed) {
    const target = sanitizeReturnUrl(location.pathname + location.search);
    return <Navigate to={`${ROUTES.login}?returnUrl=${encodeURIComponent(target)}`} replace />;
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to={ROUTES.home} className="text-lg font-bold text-text">
            FinalCall
          </NavLink>
          <nav className="flex items-center gap-4">
            <NavLink to={ROUTES.sell} className={navClass}>
              판매
            </NavLink>
            <NavLink to={ROUTES.inventory} className={navClass}>
              인벤토리
            </NavLink>
            <NavLink to={ROUTES.orders} className={navClass}>
              거래내역
            </NavLink>
            <NavLink to={ROUTES.wallet} className={navClass}>
              지갑
            </NavLink>
            <NavLink to={ROUTES.profile} className={navClass}>
              {nickname ?? '마이페이지'}
            </NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
