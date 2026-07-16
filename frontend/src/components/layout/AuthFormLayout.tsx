import { Navigate, Outlet } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useIsAuthenticated } from '@/stores/authStore';
import { ROUTES } from '@/routes/paths';

/**
 * 인증 폼 레이아웃 (login·signup) — 내비 없는 폼 전용 최소 변형(skeleton-plan [3] 주).
 * 이미 인증 상태면 홈으로 되돌린다.
 */
export function AuthFormLayout() {
  const isAuthed = useIsAuthenticated();
  if (isAuthed) return <Navigate to={ROUTES.home} replace />;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
