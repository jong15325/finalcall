import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import CompareBar from '@/features/item/components/CompareBar'
import Sidebar from './Sidebar'
import TopNavbar from './TopNavbar'
import MobileBottomNav from './MobileBottomNav'
import HorizontalNav from './HorizontalNav'
import useDesktopLayout from './useDesktopLayout'
import WorldMapBackground from './WorldMapBackground'
import {
    RouteVisualThemeProvider,
    routeThemeStyle,
    useRouteVisualTheme,
} from './RouteVisualThemeContext'

/**
 * 앱 셸 (FC-067 — HANDOVER §5·§20).
 *
 * 구성: Sidebar · TopNavbar · MobileBottomNav · RouteOutlet.
 *
 * ★ 폭 규약(§3.4): 본문은 `container-xxl` 대응(`max-w-[1440px]` 중앙 정렬), `#view`·본문 래퍼는
 *   `min-w-0`, `html`에 `scrollbar-gutter: stable`(index.css)로 페이지별 세로 스크롤 유무에 따른
 *   가로 흔들림을 없앤다. 외부 가로 오버플로는 body `overflow-x:hidden`으로 차단.
 * ★ 모바일 하단 네비 높이만큼 본문 하단 여백(`pb-16 xl:pb-0`) — 콘텐츠·모달·비교바 겹침 방지(§5.3).
 * ★ 네비게이션 **고정(핀)** 상태는 localStorage 에 보존한다(세션 간 유지). **기본은 미고정**
 *   (레일 + hover 확장, Vuexy 핀 모델). 핀 OFF 레일의 hover/focus 확장(flyout)·핀 토글은
 *   `Sidebar` 가 담당한다(FC-086 #3 · FC-087). 핀 OFF 시 사이드바가 콘텐츠 위로 겹치도록
 *   루트를 `relative` 로 둔다.
 * ★ 모바일 드로어는 햄버거(상단바)로 열고 백드롭·Escape 로 닫는다.
 */

function AppShell() {
    return (
        <RouteVisualThemeProvider>
            <ThemedAppShell />
        </RouteVisualThemeProvider>
    )
}

function ThemedAppShell() {
    const { theme } = useRouteVisualTheme()
    // 기본 미고정(localStorage 없으면 false = 레일 + hover). 명세: 버튼 OFF 일 때 hover 가 기본 동작.
    const [mobileOpen, setMobileOpen] = useState(false)
    const desktop = useDesktopLayout()
    const { pathname } = useLocation()
    const menuButtonRef = useRef<HTMLButtonElement>(null)
    const previousPathRef = useRef(pathname)

    const closeMobile = useCallback(
        (restoreFocus = true) => {
            setMobileOpen(false)
            if (restoreFocus && !desktop) {
                requestAnimationFrame(() => menuButtonRef.current?.focus())
            }
        },
        [desktop],
    )

    useEffect(() => {
        if (desktop) closeMobile(false)
    }, [closeMobile, desktop])

    useEffect(() => {
        if (previousPathRef.current === pathname) return
        previousPathRef.current = pathname
        closeMobile()
    }, [closeMobile, pathname])

    // 모바일 드로어 열림 중 Escape 로 닫는다(접근성).
    useEffect(() => {
        if (!mobileOpen) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMobile()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [closeMobile, mobileOpen])

    return (
        <div
            className="relative isolate flex min-h-screen bg-transparent"
            data-detail-theme={theme ?? undefined}
            style={theme ? routeThemeStyle(theme) : undefined}
        >
            <WorldMapBackground accent={theme} />
            {!desktop && mobileOpen && (
                <Sidebar mobileOpen onCloseMobile={closeMobile} />
            )}

            <div className="relative z-10 flex min-w-0 flex-1 flex-col">
                <TopNavbar
                    menuButtonRef={menuButtonRef}
                    onOpenMobile={() => setMobileOpen(true)}
                />
                {desktop && <HorizontalNav />}

                <main
                    id="view"
                    className="min-w-0 flex-1 px-3 py-2 pb-20 sm:px-5 sm:py-5 sm:pb-20 xl:px-8 xl:py-7 xl:pb-7"
                >
                    <div
                        data-testid="app-content-plane"
                        className="mx-auto min-h-full w-full min-w-0 max-w-[1440px] bg-surface px-3 py-4 sm:rounded-xl sm:border sm:border-line sm:px-6 sm:py-6 sm:shadow-sm xl:rounded-2xl"
                    >
                        <Outlet />
                    </div>
                </main>

                <footer className="detail-chrome relative z-10 hidden border-t border-line bg-surface px-6 py-4 text-xs text-gray-600 xl:block">
                    © 2026 장터 · 안전한 게임 아이템 거래
                </footer>
            </div>

            <CompareBar />

            <MobileBottomNav />
        </div>
    )
}

export default AppShell
