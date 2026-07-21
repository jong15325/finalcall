import { useState } from 'react'
import { NavLink } from 'react-router'
import {
    TbChevronDown,
    TbChevronsLeft,
    TbChevronsRight,
    TbHeadset,
    TbX,
} from 'react-icons/tb'
import BrandLogo from '@/components/brand/BrandLogo'
import { sidebarNav } from './navItems'
import type { NavEntry, NavGroup, NavLeaf } from './navItems'

/**
 * 좌측 사이드바 (FC-067 — HANDOVER §5.1).
 *
 * ★ 반응형 두 모드(모바일 우선):
 *   - < xl: **드로어 오버레이**. 상단 햄버거로 열고 백드롭·닫기 버튼·Escape 로 닫는다. 항상 펼침 메뉴.
 *   - ≥ xl 펼침: **인-플로우 레일** 260px.
 *   - ≥ xl 접힘: **아이콘 레일 70px + hover/focus 시 확장 flyout**(Vuexy `layout-menu-hover`, FC-086 #3).
 *     레일은 70px 자리(spacer)를 그대로 두고, 확장 패널이 **콘텐츠 위로 겹쳐**(absolute) 떠서
 *     본문을 밀지 않는다. 고정 펼침은 헤더 토글로만(상단바 토글 제거).
 * ★ `collapsed` 는 xl 이상에서만 유효하다(드로어는 항상 펼침). 라벨·아이콘 숨김 기준은 **레일 상태**
 *   (`railCollapsed = collapsed && !flyout`) → 유틸리티 `xl:` 접두사로 표현한다.
 * ★ 키보드 접근성: hover 없이 **focus-within** 으로도 flyout 이 열려 탭 이동으로 전 메뉴에 닿는다.
 * ★ 준비 중(ready=false) 메뉴는 링크가 아니라 **`disabled` 버튼**으로 낸다 — opacity 만으로
 *   비활성 시늉하면 보조기술엔 활성으로 남는다(WCAG 4.1.2, FC-065 교훈).
 * ★ 접힘 시 안전거래센터는 아이콘만 — **세로 글자 금지**(§5.1).
 */

interface SidebarProps {
    /** xl 이상 접힘 상태 */
    collapsed: boolean
    /** xl 접힘 토글 */
    onToggleCollapse: () => void
    /** 모바일 드로어 열림 */
    mobileOpen: boolean
    /** 모바일 드로어 닫기 */
    onCloseMobile: () => void
    /** 실시간 경매 수(배지). 준비되면 실데이터로 교체. */
    liveAuctionCount?: number
}

/** 메뉴 행 공통 스타일 */
const rowBase =
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors'
const rowIdle = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
const rowActive = 'bg-orange-subtle text-orange-deep'

/** 준비 중(비활성) 행 */
function DisabledRow({
    leaf,
    collapsed,
}: {
    leaf: NavLeaf
    collapsed: boolean
}) {
    const Icon = leaf.icon
    return (
        <button
            disabled
            type="button"
            aria-disabled="true"
            title={`${leaf.label} · 준비 중`}
            className={`${rowBase} w-full text-gray-400`}
        >
            {Icon && <Icon aria-hidden className="size-5 shrink-0" />}
            <span className={collapsed ? 'xl:hidden' : ''}>{leaf.label}</span>
            <span
                className={`ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-400 ${
                    collapsed ? 'xl:hidden' : ''
                }`}
            >
                준비 중
            </span>
        </button>
    )
}

/** 실연동 leaf 링크 */
function LeafRow({
    leaf,
    collapsed,
    onNavigate,
    badge,
}: {
    leaf: NavLeaf
    collapsed: boolean
    onNavigate: () => void
    badge?: number
}) {
    if (!leaf.ready) return <DisabledRow leaf={leaf} collapsed={collapsed} />
    const Icon = leaf.icon
    return (
        <NavLink
            to={leaf.to}
            end={leaf.to === '/'}
            title={leaf.label}
            className={({ isActive }) =>
                `${rowBase} ${isActive ? rowActive : rowIdle}`
            }
            onClick={onNavigate}
        >
            {Icon && <Icon aria-hidden className="size-5 shrink-0" />}
            <span className={collapsed ? 'xl:hidden' : ''}>{leaf.label}</span>
            {badge !== undefined && badge > 0 && (
                <span
                    className={`ml-auto rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white ${
                        collapsed ? 'xl:hidden' : ''
                    }`}
                >
                    {badge}
                </span>
            )}
        </NavLink>
    )
}

/** 서브메뉴를 가진 그룹 */
function GroupRow({
    group,
    collapsed,
    onNavigate,
    liveAuctionCount,
}: {
    group: NavGroup
    collapsed: boolean
    onNavigate: () => void
    liveAuctionCount?: number
}) {
    const [open, setOpen] = useState(true)
    const Icon = group.icon

    return (
        <li>
            <button
                type="button"
                aria-expanded={open}
                title={group.label}
                className={`${rowBase} ${rowIdle} w-full`}
                onClick={() => setOpen((v) => !v)}
            >
                <Icon aria-hidden className="size-5 shrink-0" />
                <span className={collapsed ? 'xl:hidden' : ''}>
                    {group.label}
                </span>
                <TbChevronDown
                    aria-hidden
                    className={`ml-auto size-4 shrink-0 transition-transform ${
                        open ? '' : '-rotate-90'
                    } ${collapsed ? 'xl:hidden' : ''}`}
                />
            </button>
            {open && (
                <ul
                    className={`mt-1 space-y-1 pl-4 ${collapsed ? 'xl:hidden' : ''}`}
                >
                    {group.children.map((child) => (
                        <li key={child.to}>
                            <LeafRow
                                leaf={child}
                                collapsed={false}
                                badge={
                                    child.to === '/auctions'
                                        ? liveAuctionCount
                                        : undefined
                                }
                                onNavigate={onNavigate}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </li>
    )
}

function renderEntry(
    entry: NavEntry,
    collapsed: boolean,
    onNavigate: () => void,
    liveAuctionCount?: number,
) {
    if (entry.kind === 'group') {
        return (
            <GroupRow
                key={entry.label}
                group={entry}
                collapsed={collapsed}
                liveAuctionCount={liveAuctionCount}
                onNavigate={onNavigate}
            />
        )
    }
    return (
        <li key={entry.to}>
            <LeafRow
                leaf={entry}
                collapsed={collapsed}
                onNavigate={onNavigate}
            />
        </li>
    )
}

function Sidebar({
    collapsed,
    onToggleCollapse,
    mobileOpen,
    onCloseMobile,
    liveAuctionCount,
}: SidebarProps) {
    // 드로어 링크 클릭 시 자동 닫힘(모바일). 데스크톱은 no-op 이어도 무해.
    const onNavigate = () => onCloseMobile()

    // 데스크톱 접힘 상태의 hover/focus 확장(flyout). 마우스·키보드를 각각 추적해
    // 마우스가 떠나도 포커스가 안에 있으면 닫히지 않는다(키보드 접근성).
    const [hover, setHover] = useState(false)
    const [focused, setFocused] = useState(false)
    const flyout = collapsed && (hover || focused)
    // 레일(70px)·라벨 숨김 기준 — 펼침이거나 flyout 이 열리면 풀뷰.
    const railCollapsed = collapsed && !flyout

    return (
        <>
            {/* 모바일 드로어 백드롭 */}
            {mobileOpen && (
                <div
                    aria-hidden
                    className="fixed inset-0 z-40 bg-navy/40 xl:hidden"
                    onClick={onCloseMobile}
                />
            )}

            {/* 데스크톱 접힘 레일 자리(70px) — flyout 은 이 위로 겹쳐 뜨고 본문을 밀지 않는다.
                펼침 상태에선 aside 가 인-플로우(260px)라 이 spacer 를 두지 않는다. */}
            {collapsed && (
                <div aria-hidden className="hidden shrink-0 xl:block xl:w-[70px]" />
            )}

            <aside
                aria-label="주 메뉴"
                className={[
                    'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface',
                    'w-[260px] transition-[transform,width] duration-200',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                    'xl:translate-x-0',
                    // 접힘: 콘텐츠 위 오버레이(레일 위치). 펼침: 인-플로우 레일.
                    collapsed
                        ? 'xl:absolute xl:inset-y-0 xl:left-0 xl:z-40'
                        : 'xl:static xl:z-auto',
                    railCollapsed ? 'xl:w-[70px]' : 'xl:w-[260px]',
                    flyout ? 'xl:shadow-2xl' : '',
                ].join(' ')}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                onFocus={() => setFocused(true)}
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setFocused(false)
                    }
                }}
            >
                {/* 브랜드 — 가운데 정렬(목업 §5.1). 토글은 오른쪽 가장자리에 겹쳐 띄운다. */}
                <div className="relative flex h-16 items-center justify-center px-3">
                    <NavLink
                        to="/"
                        aria-label="장터 홈"
                        className="flex min-w-0 items-center justify-center"
                        onClick={onNavigate}
                    >
                        <BrandLogo collapsed={railCollapsed} />
                    </NavLink>

                    {/* 데스크톱 접기/펼치기 토글 — 아이콘 레일(70px)엔 자리가 없어 감추고,
                        flyout(hover/focus) 또는 고정 펼침일 때만 노출한다. 고정 펼침의 유일 창구다
                        (상단바 토글 제거, FC-086 #3). */}
                    <button
                        type="button"
                        aria-label={collapsed ? '메뉴 고정 펼치기' : '메뉴 접기'}
                        aria-expanded={!collapsed}
                        className={`absolute right-2 hidden size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 ${
                            railCollapsed ? '' : 'xl:flex'
                        }`}
                        onClick={onToggleCollapse}
                    >
                        {collapsed ? (
                            <TbChevronsRight aria-hidden className="size-5" />
                        ) : (
                            <TbChevronsLeft aria-hidden className="size-5" />
                        )}
                    </button>

                    {/* 모바일 닫기 */}
                    <button
                        type="button"
                        aria-label="메뉴 닫기"
                        className="absolute right-2 flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 xl:hidden"
                        onClick={onCloseMobile}
                    >
                        <TbX aria-hidden className="size-5" />
                    </button>
                </div>

                {/* 메뉴 */}
                <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                    <ul className="space-y-1">
                        {sidebarNav.map((entry) =>
                            renderEntry(
                                entry,
                                railCollapsed,
                                onNavigate,
                                liveAuctionCount,
                            ),
                        )}
                    </ul>
                </nav>

                {/* 안전 거래 센터 */}
                <div className="p-3">
                    <div
                        role="note"
                        aria-label="안전 거래 센터 · 도움이 필요하신가요?"
                        title="안전 거래 센터"
                        className="flex items-center gap-3 rounded-xl bg-navy px-3 py-3 text-white"
                    >
                        <TbHeadset
                            aria-hidden
                            className="size-6 shrink-0 text-gold-bright"
                        />
                        <div className={railCollapsed ? 'xl:hidden' : ''}>
                            <p className="text-sm font-bold leading-tight">
                                안전 거래 센터
                            </p>
                            <p className="text-xs text-gray-300">
                                도움이 필요하신가요?
                            </p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    )
}

export default Sidebar
