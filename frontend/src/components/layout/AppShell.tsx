import type { ReactNode } from 'react';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';

/**
 * AppShell — 헤더·본문·푸터·모바일 탭바를 묶은 공통 셸(FC-048).
 *
 * 레이아웃(Public·Protected)이 각자 헤더를 복제하던 구조를 걷어낸다 — 종전에는 같은 워드마크·내비가
 * 두 파일에 따로 있어 한쪽만 고치면 화면 사이에서 셸이 달라 보였다.
 *
 * `contained`: 홈은 **섹션 밴드가 화면 전폭으로 흘러야 하므로**([2.1] "면 리듬은 얇은 선이 아니라 큰
 * 면이 만든다") 본문을 컨테이너로 감싸지 않는다. 나머지 화면은 종전대로 max-width 컨테이너 안에 든다.
 *
 * `pb-14`: 모바일 하단 탭바(56px)가 `fixed` 라 본문 끝을 가린다 — 푸터 마지막 줄이 탭바 뒤로 숨지
 * 않도록 같은 높이를 비워 둔다. 데스크톱(md)에서는 탭바가 없으므로 0으로 되돌린다.
 */
export function AppShell({
  children,
  contained = true,
}: {
  children: ReactNode;
  contained?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* 키보드 첫 정지점 — 헤더 내비를 매 화면 통과하지 않게 한다(accessibility [5]) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-40 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-body focus:text-primary-fg"
      >
        본문 바로가기
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {contained ? (
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6">{children}</div>
        ) : (
          children
        )}
      </main>
      <SiteFooter />
      <div className="pb-14 md:pb-0" aria-hidden="true" />
      <MobileTabBar />
    </div>
  );
}
