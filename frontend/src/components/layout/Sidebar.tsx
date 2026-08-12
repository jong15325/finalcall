import { useEffect, useRef, useState } from 'react'
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
                className={`${row} justify-between text-chrome-fg hover:bg-chrome-raised`}
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
                <ul className="ml-8 border-l border-content-line pl-2">
                    {group.children.map((child) => (
                        <li key={child.to}>
                            {child.ready ? (
                                <NavLink
                                    to={child.to}
                                    className={({ isActive }) =>
                                        `${row} ${isActive ? 'bg-chrome-selected text-chrome-fg' : 'text-chrome-muted hover:bg-chrome-raised'}`
                                    }
                                    onClick={onNavigate}
                                >
                                    {child.label}
                                </NavLink>
                            ) : (
                                <button
                                    disabled
                                    type="button"
                                    className={`${row} text-chrome-muted opacity-60`}
                                >
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
    const asideRef = useRef<HTMLElement>(null)

    useEffect(() => {
        if (mobileOpen) {
            asideRef.current
                ?.querySelector<HTMLElement>(
                    'nav a[href], nav button:not([disabled])',
                )
                ?.focus()
        }
    }, [mobileOpen])
    return (
        <>
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="메뉴 닫기"
                    className="fixed inset-0 z-40 bg-brand-structure/40 xl:hidden"
                    onClick={onCloseMobile}
                />
            )}
            <aside
                ref={asideRef}
                aria-label="모바일 메뉴"
                aria-hidden={!mobileOpen}
                className={`app-chrome fixed inset-y-0 left-0 z-50 flex w-[min(82vw,280px)] flex-col border-r border-chrome-selected bg-chrome shadow-xl transition-transform xl:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex h-16 items-center justify-between border-b border-chrome-selected px-4">
                    <BrandLogo className="brightness-0 invert" />
                    <button
                        type="button"
                        aria-label="메뉴 닫기"
                        className="rounded-lg p-2 text-chrome-muted hover:bg-chrome-raised hover:text-chrome-fg"
                        onClick={onCloseMobile}
                    >
                        <TbX aria-hidden className="size-5" />
                    </button>
                </div>
                <nav
                    aria-label="모바일 주요 메뉴"
                    className="min-h-0 flex-1 overflow-y-auto p-3"
                >
                    <ul className="space-y-1">
                        {sidebarNav.map((entry) =>
                            entry.kind === 'group' ? (
                                <MobileGroup
                                    key={entry.label}
                                    group={entry}
                                    onNavigate={onCloseMobile}
                                />
                            ) : entry.ready ? (
                                <li key={entry.to}>
                                    <NavLink
                                        to={entry.to}
                                        end={entry.to === '/'}
                                        className={({ isActive }) =>
                                            `${row} ${isActive ? 'bg-chrome-selected text-chrome-fg' : 'text-chrome-muted hover:bg-chrome-raised'}`
                                        }
                                        onClick={onCloseMobile}
                                    >
                                        <entry.icon
                                            aria-hidden
                                            className="size-5"
                                        />
                                        {entry.label}
                                    </NavLink>
                                </li>
                            ) : null,
                        )}
                    </ul>
                </nav>
                <div className="border-t border-chrome-selected p-3">
                    <NavLink
                        to={paths.messages}
                        className={`${row} text-chrome-fg hover:bg-chrome-raised`}
                        onClick={onCloseMobile}
                    >
                        <TbHeadset aria-hidden className="size-5" />
                        안전거래센터
                        {(unreadMemo?.count ?? 0) > 0 && (
                            <span className="ml-auto rounded-full bg-control-action px-2 py-0.5 text-xs font-bold text-content-fg">
                                {unreadMemo?.count}
                            </span>
                        )}
                    </NavLink>
                </div>
            </aside>
        </>
    )
}
