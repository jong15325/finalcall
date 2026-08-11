import { useState } from 'react'
import { NavLink } from 'react-router'
import { TbChevronDown, TbHeadset, TbX } from 'react-icons/tb'
import BrandLogo from '@/components/brand/BrandLogo'
import { paths } from '@/app/paths'
import { useUnreadMemoCount } from '@/lib/queries/memos'
import { sidebarNav } from './navItems'
import type { NavGroup } from './navItems'

interface SidebarProps {
    mobileOpen: boolean
    onCloseMobile: () => void
    liveAuctionCount?: number
}

const row =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors'

function MobileGroup({
    group,
    onNavigate,
}: {
    group: NavGroup
    onNavigate: () => void
}) {
    const [open, setOpen] = useState(true)
    return (
        <li>
            <button
                type="button"
                aria-expanded={open}
                className={`${row} justify-between text-gray-700 hover:bg-gray-100`}
                onClick={() => setOpen((value) => !value)}
            >
                <span className="flex items-center gap-3">
                    <group.icon aria-hidden className="size-5" />
                    {group.label}
                </span>
                <TbChevronDown
                    aria-hidden
                    className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <ul className="ml-8 border-l border-line pl-2">
                    {group.children.map((child) => (
                        <li key={child.to}>
                            {child.ready ? (
                                <NavLink
                                    to={child.to}
                                    className={({ isActive }) =>
                                        `${row} ${isActive ? 'bg-orange-subtle text-orange-deep' : 'text-gray-600 hover:bg-gray-100'}`
                                    }
                                    onClick={onNavigate}
                                >
                                    {child.label}
                                </NavLink>
                            ) : (
                                <button disabled type="button" className={`${row} text-gray-400`}>
                                    {child.label} · 준비 중
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    )
}

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
    const { data: unreadMemo } = useUnreadMemoCount()
    return (
        <>
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="메뉴 닫기"
                    className="fixed inset-0 z-40 bg-navy/40 xl:hidden"
                    onClick={onCloseMobile}
                />
            )}
            <aside
                aria-label="모바일 메뉴"
                aria-hidden={!mobileOpen}
                className={`fixed inset-y-0 left-0 z-50 flex w-[min(82vw,280px)] flex-col border-r border-line bg-surface shadow-xl transition-transform xl:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex h-16 items-center justify-between border-b border-line px-4">
                    <BrandLogo />
                    <button type="button" aria-label="메뉴 닫기" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" onClick={onCloseMobile}>
                        <TbX aria-hidden className="size-5" />
                    </button>
                </div>
                <nav aria-label="모바일 주요 메뉴" className="min-h-0 flex-1 overflow-y-auto p-3">
                    <ul className="space-y-1">
                        {sidebarNav.map((entry) =>
                            entry.kind === 'group' ? (
                                <MobileGroup key={entry.label} group={entry} onNavigate={onCloseMobile} />
                            ) : entry.ready ? (
                                <li key={entry.to}>
                                    <NavLink to={entry.to} end={entry.to === '/'} className={({ isActive }) => `${row} ${isActive ? 'bg-orange-subtle text-orange-deep' : 'text-gray-600 hover:bg-gray-100'}`} onClick={onCloseMobile}>
                                        <entry.icon aria-hidden className="size-5" />{entry.label}
                                    </NavLink>
                                </li>
                            ) : null,
                        )}
                    </ul>
                </nav>
                <div className="border-t border-line p-3">
                    <NavLink to={paths.messages} className={`${row} text-gray-700 hover:bg-gray-100`} onClick={onCloseMobile}>
                        <TbHeadset aria-hidden className="size-5" />안전거래센터
                        {(unreadMemo?.count ?? 0) > 0 && <span className="ml-auto rounded-full bg-orange px-2 py-0.5 text-xs font-bold text-zinc-900">{unreadMemo?.count}</span>}
                    </NavLink>
                </div>
            </aside>
        </>
    )
}
