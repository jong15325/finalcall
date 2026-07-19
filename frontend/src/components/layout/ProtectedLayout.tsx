import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { sanitizeReturnUrl } from '@/lib/returnUrl';
import { ROUTES } from '@/routes/paths';
import { useIsAuthenticated } from '@/stores/authStore';

/**
 * 인증 가드 + 보호 영역 레이아웃 (`me` 주체).
 * 미인증 접근 → `/login?returnUrl=<원경로>` 복귀(P-011, 앱 내부 라우트 한정).
 * returnUrl 은 현재 pathname+search 로 구성하되 내부 경로만 통과시킨다(sanitize).
 *
 * ★ 셸은 공개 영역과 **같은 것**을 쓴다(FC-048 — AppShell). 종전에는 여기에 별도 헤더와 별도 주 내비가
 * 있어 로그인 후 화면으로 넘어가는 순간 셸이 통째로 바뀌어 다른 사이트처럼 읽혔다.
 * `me` 하위 내비는 **셸이 아니라 본문 상단의 하위 탭**으로 내린다 — 위계가 주 내비보다 아래임을
 * 위치로 표현한다. 활성 표시 언어(near-black 2px 밑줄)는 셸과 동일하게 유지한다.
 */
const ME_NAV = [
  { to: ROUTES.sell, label: '판매 등록' },
  { to: ROUTES.inventory, label: '인벤토리' },
  { to: ROUTES.orders, label: '거래 내역' },
  { to: ROUTES.wallet, label: '지갑' },
  { to: ROUTES.profile, label: '프로필' },
];

export function ProtectedLayout() {
  const isAuthed = useIsAuthenticated();
  const location = useLocation();

  if (!isAuthed) {
    const target = sanitizeReturnUrl(location.pathname + location.search);
    return <Navigate to={`${ROUTES.login}?returnUrl=${encodeURIComponent(target)}`} replace />;
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* 좁은 화면에서는 가로 스크롤 — 항목 수가 5개라 접거나 숨기지 않는다 */}
        <nav aria-label="내 계정 메뉴" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex min-w-max items-center gap-5 border-b border-border">
            {ME_NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={meNavClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <Outlet />
      </div>
    </AppShell>
  );
}

function meNavClass({ isActive }: { isActive: boolean }): string {
  const base =
    'relative inline-flex h-11 items-center whitespace-nowrap text-body no-underline transition-colors duration-fast';
  return isActive
    ? `${base} font-bold text-text after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-text`
    : `${base} font-medium text-text-muted hover:text-text`;
}
