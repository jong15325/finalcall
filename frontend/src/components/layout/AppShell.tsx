import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import CompareBar from '@/features/item/components/CompareBar'
import Sidebar from './Sidebar'
import TopNavbar from './TopNavbar'
import MobileBottomNav from './MobileBottomNav'

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

const PIN_KEY = 'jangteo.sidebar.pinned'

function AppShell() {
    // 기본 미고정(localStorage 없으면 false = 레일 + hover). 명세: 버튼 OFF 일 때 hover 가 기본 동작.
    const [pinned, setPinned] = useState(
        () => localStorage.getItem(PIN_KEY) === '1',
    )
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        localStorage.setItem(PIN_KEY, pinned ? '1' : '0')
    }, [pinned])

    // 모바일 드로어 열림 중 Escape 로 닫는다(접근성).
    useEffect(() => {
        if (!mobileOpen) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMobileOpen(false)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [mobileOpen])

    return (
        <div className="relative isolate flex min-h-screen bg-surface-sunken">
            <Sidebar
                pinned={pinned}
                mobileOpen={mobileOpen}
                onTogglePin={() => setPinned((v) => !v)}
                onCloseMobile={() => setMobileOpen(false)}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                <TopNavbar onOpenMobile={() => setMobileOpen(true)} />

                <main id="view" className="min-w-0 flex-1 pb-16 xl:pb-0">
                    <div className="mx-auto w-full min-w-0 max-w-[1440px] px-4 py-6 sm:px-6">
                        <Outlet />
                    </div>
                </main>

                <footer className="relative z-10 hidden border-t border-line bg-surface px-6 py-4 text-xs text-gray-600 xl:block">
                    © 2026 장터 · 안전한 게임 아이템 거래
                </footer>
            </div>

            <CompareBar />

            <MobileBottomNav />
        </div>
    )
}

export default AppShell
