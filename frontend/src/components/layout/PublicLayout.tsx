import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ROUTES } from '@/routes/paths';

/**
 * 공개 레이아웃 — 인증 불요 영역의 공통 셸(FC-048에서 AppShell 로 교체).
 *
 * 종전에는 이 파일이 헤더 마크업을 직접 갖고 있었고 ProtectedLayout 에 같은 것이 복제돼 있었다.
 * 셸은 전 화면에 걸리므로 단일 출처(AppShell)로 모은다.
 *
 * **홈만 전폭이다.** 홈은 섹션 밴드(`surface-band`)가 화면 끝까지 흘러 면 리듬을 만드는 구조라
 * ([2.1]) 컨테이너 안에 가두면 밴드가 "가운데 회색 박스"로 쪼그라든다. 나머지 공개 화면은 종전과
 * 같은 max-width 컨테이너를 쓴다.
 */
export function PublicLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === ROUTES.home;

  return (
    <AppShell contained={!isHome}>
      <Outlet />
    </AppShell>
  );
}
