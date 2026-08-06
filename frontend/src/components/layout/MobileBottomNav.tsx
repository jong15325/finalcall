import { NavLink } from 'react-router'
import { paths } from '@/app/paths'
import { useUnreadMemoCount } from '@/lib/queries/memos'
import { mobileNav } from './navItems'

/**
 * 모바일 하단 네비게이션 (FC-067 — HANDOVER §5.3).
 *
 * ★ 순서 고정: 아이템마켓 · 실시간경매 · 홈 · 게시판 · 마이페이지(FC-205 인벤토리 탭 제거).
 * ★ xl 이상에서는 숨긴다(데스크톱은 사이드바). safe-area·하단 여백은 이 바 높이만큼
 *   `AppShell` 이 본문에 확보한다(비교바·모달과 겹침 금지, §5.3).
 * ★ 준비 중(ready=false) 항목은 **`disabled` 버튼** — opacity 만의 비활성 금지(WCAG 4.1.2).
 */
function MobileBottomNav() {
    const { data: unreadMemo } = useUnreadMemoCount()
    const unreadCount = unreadMemo?.count ?? 0

    return (
        <nav
            aria-label="모바일 주요 메뉴"
            className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] xl:hidden"
        >
            {mobileNav.map((item) => {
                const Icon = item.icon
                if (!item.ready) {
                    return (
                        <button
                            key={item.label}
                            disabled
                            type="button"
                            aria-disabled="true"
                            title={`${item.label} · 준비 중`}
                            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-gray-300"
                        >
                            {Icon && <Icon aria-hidden className="size-6" />}
                            <span className="text-[11px] font-medium">
                                {item.label}
                            </span>
                        </button>
                    )
                }
                const showBadge =
                    item.to === paths.messages && unreadCount > 0
                return (
                    <NavLink
                        key={item.label}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                                isActive ? 'text-orange-deep' : 'text-gray-500'
                            }`
                        }
                    >
                        <span className="relative">
                            {Icon && <Icon aria-hidden className="size-6" />}
                            {showBadge && (
                                <span className="absolute -right-2 -top-1 grid min-w-[15px] place-items-center rounded-full bg-orange px-1 text-[9px] font-bold leading-[15px] text-white tabular-nums">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </span>
                        <span>{item.label}</span>
                    </NavLink>
                )
            })}
        </nav>
    )
}

export default MobileBottomNav
