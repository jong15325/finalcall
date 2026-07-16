import { Link, NavLink, Outlet } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuthStore, useIsAuthenticated } from '@/stores/authStore';
import { ROUTES } from '@/routes/paths';

/**
 * 공개 레이아웃 — 내비게이션 있는 최상위 셸(인증 불요 영역).
 * 도메인 콘텐츠는 없다(스켈레톤). 링크는 IA 셸(skeleton-plan [3]) 기준.
 */
const navClass = ({ isActive }: { isActive: boolean }): string =>
  `text-sm transition-colors duration-fast hover:text-text ${
    isActive ? 'text-text font-semibold' : 'text-text-muted'
  }`;

export function PublicLayout() {
  const isAuthed = useIsAuthenticated();
  const nickname = useAuthStore((s) => s.user?.nickname);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to={ROUTES.home} className="text-lg font-bold text-text">
            FinalCall
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink to={ROUTES.auctions} className={navClass}>
              경매
            </NavLink>
            <NavLink to={ROUTES.shops} className={navClass}>
              고정가
            </NavLink>
            <NavLink to={ROUTES.marketPrices} className={navClass}>
              시세
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthed ? (
              <NavLink to={ROUTES.profile} className={navClass}>
                {nickname ?? '마이페이지'}
              </NavLink>
            ) : (
              <NavLink to={ROUTES.login} className={navClass}>
                로그인
              </NavLink>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
