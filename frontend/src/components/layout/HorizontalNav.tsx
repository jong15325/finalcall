import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { TbChevronDown } from 'react-icons/tb'
import { sidebarNav } from './navItems'
import type { NavGroup } from './navItems'

function pathIsActive(pathname: string, target: string) {
    if (target === '/market' && pathname.startsWith('/items/')) return true
    return target === '/' ? pathname === '/' : pathname.startsWith(target)
}

function GroupMenu({ group }: { group: NavGroup }) {
    const { pathname } = useLocation()
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLLIElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const focusFirstOnOpenRef = useRef(false)
    const panelId = useId()
    const active = group.children.some((child) =>
        pathIsActive(pathname, child.to),
    )

    useEffect(() => setOpen(false), [pathname])
    useEffect(() => {
        if (!open || !focusFirstOnOpenRef.current) return
        focusFirstOnOpenRef.current = false
        focusItem(0)
    }, [open])
    useEffect(() => {
        if (!open) return
        const onPointer = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onPointer)
        return () => document.removeEventListener('mousedown', onPointer)
    }, [open])

    const focusItem = (index: number) => {
        const links = rootRef.current?.querySelectorAll<HTMLAnchorElement>(
            '[data-horizontal-leaf]',
        )
        links?.[index]?.focus()
    }

    return (
        <li
            ref={rootRef}
            className="relative flex"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOpen(false)
                }
            }}
        >
            <button
                ref={triggerRef}
                data-horizontal-root
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                className={`flex items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
                    active || open
                        ? 'border-orange text-gray-900'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setOpen((value) => !value)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        focusFirstOnOpenRef.current = true
                        setOpen(true)
                    }
                    if (event.key === 'Escape') setOpen(false)
                }}
            >
                <group.icon aria-hidden className="size-[18px]" />
                {group.label}
                <TbChevronDown
                    aria-hidden
                    className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <div
                    id={panelId}
                    className="absolute left-0 top-full z-40 mt-1 min-w-52 rounded-xl border border-line bg-surface p-1.5 shadow-lg"
                    onKeyDown={(event) => {
                        const links = Array.from(
                            rootRef.current?.querySelectorAll<HTMLAnchorElement>(
                                '[data-horizontal-leaf]',
                            ) ?? [],
                        )
                        const index = links.indexOf(
                            document.activeElement as HTMLAnchorElement,
                        )
                        if (event.key === 'ArrowDown') {
                            event.preventDefault()
                            links[(index + 1) % links.length]?.focus()
                        } else if (event.key === 'ArrowUp') {
                            event.preventDefault()
                            links[
                                (index - 1 + links.length) % links.length
                            ]?.focus()
                        } else if (event.key === 'Escape') {
                            event.preventDefault()
                            setOpen(false)
                            triggerRef.current?.focus()
                        }
                    }}
                >
                    {group.children.map((child) =>
                        child.ready ? (
                            <NavLink
                                key={child.to}
                                data-horizontal-leaf
                                to={child.to}
                                className={({ isActive }) =>
                                    `flex rounded-lg px-3 py-2 text-sm font-semibold ${
                                        isActive
                                            ? 'bg-orange-subtle text-orange-deep'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`
                                }
                            >
                                {child.label}
                            </NavLink>
                        ) : (
                            <button
                                key={child.to}
                                disabled
                                type="button"
                                className="flex w-full rounded-lg px-3 py-2 text-sm font-semibold text-gray-400"
                            >
                                {child.label} · 준비 중
                            </button>
                        ),
                    )}
                </div>
            )}
        </li>
    )
}

export default function HorizontalNav() {
    return (
        <nav
            aria-label="주요 메뉴"
            className="detail-chrome sticky top-16 z-20 hidden h-12 border-b border-line bg-surface xl:block"
            onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                    return
                const items = Array.from(
                    event.currentTarget.querySelectorAll<HTMLElement>(
                        '[data-horizontal-root]:not([disabled])',
                    ),
                )
                const index = items.indexOf(
                    document.activeElement as HTMLElement,
                )
                if (index < 0) return
                event.preventDefault()
                const offset = event.key === 'ArrowRight' ? 1 : -1
                items[(index + offset + items.length) % items.length]?.focus()
            }}
        >
            <ul className="mx-auto flex h-full w-full max-w-[1440px] px-6">
                {sidebarNav.map((entry) =>
                    entry.kind === 'group' ? (
                        <GroupMenu key={entry.label} group={entry} />
                    ) : entry.ready ? (
                        <li key={entry.to} className="flex">
                            <NavLink
                                data-horizontal-root
                                to={entry.to}
                                end={entry.to === '/'}
                                className={({ isActive }) =>
                                    `flex items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
                                        isActive
                                            ? 'border-orange text-gray-900'
                                            : 'border-transparent text-gray-600 hover:text-gray-900'
                                    }`
                                }
                            >
                                <entry.icon
                                    aria-hidden
                                    className="size-[18px]"
                                />
                                {entry.label}
                            </NavLink>
                        </li>
                    ) : (
                        <li key={entry.to} className="flex">
                            <button
                                disabled
                                type="button"
                                className="flex items-center gap-2 px-4 text-sm font-semibold text-gray-400"
                            >
                                <entry.icon
                                    aria-hidden
                                    className="size-[18px]"
                                />
                                {entry.label}
                            </button>
                        </li>
                    ),
                )}
            </ul>
        </nav>
    )
}
