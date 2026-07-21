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
 * ★ 접힘 상태는 localStorage 에 보존한다(세션 간 유지). 기본은 펼침.
 */

const COLLAPSE_KEY = 'jangteo.sidebar.collapsed'

function AppShell() {
    const [collapsed, setCollapsed] = useState(
        () => localStorage.getItem(COLLAPSE_KEY) === '1',
    )
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    }, [collapsed])

    return (
        <div className="flex min-h-screen bg-surface-sunken">
            <Sidebar
                collapsed={collapsed}
                mobileOpen={mobileOpen}
                onToggleCollapse={() => setCollapsed((v) => !v)}
                onCloseMobile={() => setMobileOpen(false)}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                <TopNavbar onOpenMobile={() => setMobileOpen(true)} />

                <main id="view" className="min-w-0 flex-1 pb-16 xl:pb-0">
                    <div className="mx-auto w-full min-w-0 max-w-[1440px] px-4 py-6 sm:px-6">
                        <Outlet />
                    </div>
                </main>

                <footer className="hidden border-t border-line px-6 py-4 text-xs text-gray-400 xl:block">
                    © 2026 장터 · 안전한 게임 아이템 거래
                </footer>
            </div>

            <CompareBar />

            <MobileBottomNav />
        </div>
    )
}

export default AppShell
