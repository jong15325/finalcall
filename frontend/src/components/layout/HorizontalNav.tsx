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
    const [explicitOpen, setExplicitOpen] = useState(false)
    const [hoverOpen, setHoverOpen] = useState(false)
    const [finePointer, setFinePointer] = useState(false)
    const rootRef = useRef<HTMLLIElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const focusFirstOnOpenRef = useRef(false)
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const panelId = useId()
    const open = explicitOpen || hoverOpen
    const active = group.children.some((child) =>
        pathIsActive(pathname, child.to),
    )

    const clearCloseTimer = () => {
        if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
    }

    useEffect(() => {
        const media = window.matchMedia('(hover: hover) and (pointer: fine)')
        const update = () => {
            setFinePointer(media.matches)
            if (!media.matches) {
                clearCloseTimer()
                setHoverOpen(false)
            }
        }
        update()
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [])
    useEffect(() => {
        clearCloseTimer()
        setExplicitOpen(false)
        setHoverOpen(false)
    }, [pathname])
    useEffect(() => () => clearCloseTimer(), [])
    useEffect(() => {
        if (!open || !focusFirstOnOpenRef.current) return
        focusFirstOnOpenRef.current = false
        focusItem(0)
    }, [open])
    useEffect(() => {
        if (!open) return
        const onPointer = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setExplicitOpen(false)
                setHoverOpen(false)
            }
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
                    setExplicitOpen(false)
                    setHoverOpen(false)
                }
            }}
            onMouseEnter={() => {
                clearCloseTimer()
                if (finePointer) setHoverOpen(true)
            }}
            onMouseLeave={() => {
                if (
                    !finePointer ||
                    rootRef.current?.contains(document.activeElement)
                )
                    return
                clearCloseTimer()
                closeTimerRef.current = setTimeout(() => {
                    setHoverOpen(false)
                    closeTimerRef.current = null
                }, 150)
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
                        ? 'border-control-action text-chrome-fg'
                        : 'border-transparent text-chrome-muted hover:text-chrome-fg'
                }`}
                onClick={() => {
                    clearCloseTimer()
                    if (open) {
                        setExplicitOpen(false)
                        setHoverOpen(false)
                    } else {
                        setExplicitOpen(true)
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        focusFirstOnOpenRef.current = true
                        setExplicitOpen(true)
                    }
                    if (event.key === 'Escape') {
                        setExplicitOpen(false)
                        setHoverOpen(false)
                    }
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
                    className="absolute left-0 top-full z-40 mt-1 min-w-52 rounded-xl border border-chrome-selected bg-chrome-raised p-1.5 shadow-lg"
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
                            setExplicitOpen(false)
                            setHoverOpen(false)
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
                                            ? 'bg-chrome-selected text-chrome-fg'
                                            : 'text-chrome-muted hover:bg-chrome-selected hover:text-chrome-fg'
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
                                className="flex w-full rounded-lg px-3 py-2 text-sm font-semibold text-chrome-muted opacity-60"
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
            className="app-chrome hidden h-12 bg-chrome xl:block xl:rounded-b-2xl"
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
            <ul className="flex h-full w-full px-6">
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
                                            ? 'border-control-action text-chrome-fg'
                                            : 'border-transparent text-chrome-muted hover:text-chrome-fg'
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
                                className="flex items-center gap-2 px-4 text-sm font-semibold text-chrome-muted opacity-60"
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
