import LayoutBase from '@/components/template/LayoutBase'
import { LAYOUT_BLANK } from '@/constants/theme.constant'
import AppFooter from './AppFooter'
import DesktopHeader from './DesktopHeader'
import MobileHeader from './MobileHeader'
import MobileTabBar from './MobileTabBar'
import type { CommonProps } from '@/@types/common'

/**
 * 공용 셸 — **레이아웃 B(blank + 자체 셸)** (FC-057, 사용자 판정 2026-07-19).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **인증 여부로 셸을 가르지 않는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 종전 `Layouts.tsx` 는 `authenticated ? PostLoginLayout : PreLoginLayout` 이었고,
 * 그 결과 **비로그인 손님은 헤더도 내비도 없는 화면**을 봤다. 그건 "로그인 안 했으면 볼 게
 * 없다"는 **관리자 템플릿의 전제**다. 우리는 공개 커머스라 반대다 — 손님은 첫 화면부터
 * 둘러봐야 하고, 검색엔진·공유 링크로 들어온 사람이 가장 먼저 만나는 것이 이 셸이다.
 * (라우트 이분법은 FC-055 가 `sharedRoutes` 3버킷으로 이미 고쳤다. 이 파일이 나머지 절반이다.)
 *
 * 셸은 **인증 상태에 따라 사라지지 않고, 안의 내용물만 바뀐다**(계정 자리 = 로그인 CTA ↔
 * 계정 메뉴, 잔액 = 없음 ↔ 있음).
 *
 * ★ `LayoutBase type={LAYOUT_BLANK}` 로 감싼 이유 — 템플릿 `PageContainer` 가 `useLayout()`
 *   을 호출하고 **컨텍스트가 없으면 throw** 한다. `blank` 는 "템플릿 크롬을 쓰지 않겠다"는
 *   선언이므로 레이아웃 B 그 자체다. 템플릿 사이드바 레이아웃 6종은 참조하지 않는다.
 *
 * ★ 데스크톱/모바일은 **접기가 아니라 각각의 구조**다 — 데스크톱은 2행 헤더(내비가 위에),
 *   모바일은 1행 헤더 + 하단 탭바(내비가 아래). 두 트리가 함께 DOM 에 있고 `lg` 브레이크포인트가
 *   하나씩만 보여준다.
 *
 * ★ §1.2 Game-Color Containment — **셸에 게임 색이 하나도 없다.** 무채색 + 브랜드 퍼플
 *   마감선 1개뿐이다. 게임색은 아이템 아트 슬롯 안에서만 나타난다(FC-059·062 소관).
 */
const AppShell = ({ children }: CommonProps) => {
    return (
        <LayoutBase
            type={LAYOUT_BLANK}
            className="app-shell flex min-h-screen flex-col bg-gray-100 dark:bg-gray-950"
        >
            {/* 키보드 사용자가 탭바까지 훑지 않고 본문으로 건너뛴다. 포커스 시에만 보인다. */}
            <a
                href="#main-content"
                className="sr-only rounded-md bg-gray-900 px-4 py-2 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
            >
                본문 바로가기
            </a>

            <DesktopHeader className="hidden lg:block" />
            <MobileHeader className="lg:hidden" />

            {/*
             * `pb-16` — 모바일 탭바가 `fixed` 라 본문 마지막 줄을 덮는다. 데스크톱에선 탭바가
             * 없으므로 되돌린다.
             */}
            <main
                id="main-content"
                className="flex w-full min-w-0 flex-1 flex-col pb-16 lg:pb-0"
            >
                {children}
            </main>

            <AppFooter />
            <MobileTabBar className="lg:hidden" />
        </LayoutBase>
    )
}

export default AppShell
