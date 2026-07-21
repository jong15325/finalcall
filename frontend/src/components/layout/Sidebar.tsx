import { useState } from 'react'
import { NavLink } from 'react-router'
import { TbChevronDown, TbChevronsLeft, TbHeadset, TbX } from 'react-icons/tb'
import BrandLogo from '@/components/brand/BrandLogo'
import { sidebarNav } from './navItems'
import type { NavEntry, NavGroup, NavLeaf } from './navItems'

/**
 * 좌측 사이드바 (FC-067 — HANDOVER §5.1).
 *
 * ★ 반응형 두 모드(모바일 우선):
 *   - < xl: **드로어 오버레이**. 상단 햄버거로 열고 백드롭·닫기 버튼으로 닫는다. 항상 펼침 메뉴.
 *   - ≥ xl: **인-플로우 레일**. `collapsed` 로 260px↔70px 전환(펼침 260·접힘 70·심볼 44, §5.1).
 * ★ `collapsed` 는 xl 이상에서만 유효하다(드로어는 항상 펼침). 라벨은 `collapsed && xl` 에서만
 *   숨긴다 → 유틸리티 `xl:` 접두사로 표현한다.
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

            <aside
                aria-label="주 메뉴"
                className={[
                    'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface',
                    'w-[260px] transition-[transform,width] duration-200',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                    // 데스크톱: 인-플로우 레일, 접힘 폭 반영
                    'xl:static xl:z-auto xl:translate-x-0',
                    collapsed ? 'xl:w-[70px]' : 'xl:w-[260px]',
                ].join(' ')}
            >
                {/* 브랜드 — 가운데 정렬(목업 §5.1). 토글은 오른쪽 가장자리에 겹쳐 띄운다. */}
                <div className="relative flex h-16 items-center justify-center px-3">
                    <NavLink
                        to="/"
                        aria-label="장터 홈"
                        className="flex min-w-0 items-center justify-center"
                        onClick={onNavigate}
                    >
                        <BrandLogo collapsed={collapsed} />
                    </NavLink>

                    {/* 데스크톱 접기 토글 — 접힘 상태에선 숨긴다(§5.1, 펼치기는 상단 바 토글). */}
                    {!collapsed && (
                        <button
                            type="button"
                            aria-label="메뉴 접기"
                            className="absolute right-2 hidden size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 xl:flex"
                            onClick={onToggleCollapse}
                        >
                            <TbChevronsLeft aria-hidden className="size-5" />
                        </button>
                    )}

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
                                collapsed,
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
                        <div className={collapsed ? 'xl:hidden' : ''}>
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
