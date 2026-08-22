import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
} from 'react'
import { Outlet, useLocation } from 'react-router'
import { paths } from '@/app/paths'
import { resolveRouteUi } from '@/app/routeUi'
import CompareBar from '@/features/item/components/CompareBar'
import Sidebar from './Sidebar'
import TopNavbar from './TopNavbar'
import MobileBottomNav from './MobileBottomNav'
import HorizontalNav from './HorizontalNav'
import useDesktopLayout from './useDesktopLayout'
import WorldMapBackground from './WorldMapBackground'
import AppFooter from './AppFooter'
import { RouteAccentProvider, useRouteAccent } from './RouteAccentContext'
import { ChatRealtimeProvider } from '@/features/chat/lib/ChatRealtimeProvider'

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
        <ChatRealtimeProvider>
            <RouteAccentProvider>
                <AppShellContent />
            </RouteAccentProvider>
        </ChatRealtimeProvider>
    )
}

function AppShellContent() {
    const { accent } = useRouteAccent()
    // 기본 미고정(localStorage 없으면 false = 레일 + hover). 명세: 버튼 OFF 일 때 hover 가 기본 동작.
    const [mobileOpen, setMobileOpen] = useState(false)
    const desktop = useDesktopLayout()
    const { pathname } = useLocation()
    const chatRoute = pathname === paths.chat
    const routeUi = resolveRouteUi(pathname)
    const menuButtonRef = useRef<HTMLButtonElement>(null)
    const navigationSentinelRef = useRef<HTMLDivElement>(null)
    const previousPathRef = useRef(pathname)
    const [navigationStuck, setNavigationStuck] = useState(false)

    useEffect(() => {
        if (!chatRoute) return

        const updateChatViewportHeight = () => {
            const height = window.visualViewport?.height ?? window.innerHeight
            document.documentElement.style.setProperty(
                '--chat-viewport-height',
                `${Math.round(height)}px`,
            )
        }
        const viewport = window.visualViewport
        updateChatViewportHeight()
        viewport?.addEventListener('resize', updateChatViewportHeight)
        window.addEventListener('resize', updateChatViewportHeight)
        return () => {
            viewport?.removeEventListener('resize', updateChatViewportHeight)
            window.removeEventListener('resize', updateChatViewportHeight)
            document.documentElement.style.removeProperty(
                '--chat-viewport-height',
            )
        }
    }, [chatRoute])

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

    useEffect(() => {
        const sentinel = navigationSentinelRef.current
        if (!sentinel || !('IntersectionObserver' in window)) return
        const observer = new IntersectionObserver(([entry]) => {
            setNavigationStuck(
                !entry.isIntersecting && entry.boundingClientRect.bottom <= 0,
            )
        })
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [])

    return (
        <div
            data-chat-shell={chatRoute || undefined}
            style={
                chatRoute
                    ? ({
                          height: 'var(--chat-viewport-height, 100dvh)',
                      } as CSSProperties)
                    : undefined
            }
            className={`relative isolate flex bg-transparent ${chatRoute ? 'min-h-0 overflow-hidden' : 'app-shell-height'}`}
        >
            <WorldMapBackground accent={accent} />
            {!desktop && mobileOpen && (
                <Sidebar mobileOpen onCloseMobile={closeMobile} />
            )}

            <div
                className={`flex min-w-0 flex-1 flex-col pb-[calc(5.75rem+env(safe-area-inset-bottom))] xl:pb-0 ${chatRoute ? 'min-h-0 overflow-hidden' : ''}`}
            >
                <div
                    ref={navigationSentinelRef}
                    aria-hidden
                    data-app-navigation-sentinel
                    className="h-2 xl:h-3"
                />
                <div
                    data-app-navigation-frame
                    data-dock-state={navigationStuck ? 'stuck' : 'flow'}
                    className={`sticky z-30 px-3 sm:px-5 xl:px-8 ${navigationStuck ? 'top-0' : 'top-2 xl:top-3'}`}
                >
                    <div
                        data-app-navigation-surface
                        className="app-chrome mx-auto w-full max-w-[1440px] rounded-xl border border-chrome-selected bg-chrome text-chrome-fg shadow-sm xl:rounded-2xl"
                    >
                        <TopNavbar
                            menuButtonRef={menuButtonRef}
                            onOpenMobile={() => setMobileOpen(true)}
                        />
                        {desktop && <HorizontalNav />}
                    </div>
                </div>

                <main
                    id="view"
                    className={`min-w-0 flex-1 px-3 pb-4 sm:px-5 sm:pb-5 xl:px-8 xl:pb-7 ${chatRoute ? 'flex min-h-0 overflow-hidden' : ''}`}
                >
                    <div
                        data-testid="app-content-plane"
                        data-content-plane={routeUi.contentPlane}
                        className={`mx-auto w-full min-w-0 max-w-[1440px] bg-content-surface px-3 py-4 sm:rounded-xl sm:border sm:border-content-line sm:px-6 sm:py-6 sm:shadow-sm xl:rounded-2xl ${chatRoute ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : ''}`}
                    >
                        <Outlet />
                    </div>
                </main>

                <div className={chatRoute ? 'hidden' : 'contents'}>
                    <AppFooter variant={routeUi.footer} />
                </div>
            </div>

            <CompareBar />

            <MobileBottomNav />
        </div>
    )
}

export default AppShell

