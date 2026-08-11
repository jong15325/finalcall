import { useState } from 'react'
import { NavLink } from 'react-router'
import { TbChevronDown, TbHeadset, TbX } from 'react-icons/tb'
import BrandLogo from '@/components/brand/BrandLogo'
import { paths } from '@/app/paths'
import { useUnreadMemoCount } from '@/lib/queries/memos'
import { sidebarNav } from './navItems'
import type { NavEntry, NavGroup, NavLeaf } from './navItems'

/**
 * 좌측 사이드바 (FC-067 → FC-087 — HANDOVER §5.1 · Vuexy 핀 모델).
 *
 * ★ 데스크톱(≥xl)은 **핀(고정) 토글** 하나로 두 모드를 오간다(로고 옆 원형 라디오 버튼):
 *   - **핀 ON**(`pinned`): 사이드바 **항상 펼침 고정**(인-플로우 레일 260px). hover 무시 —
 *     마우스를 움직여도 접히지 않는다.
 *   - **핀 OFF**(기본): **아이콘 레일 70px** 이 기본. 마우스가 올라오면 **확장 오버레이(flyout 260px)**
 *     로 펼치고, **벗어나면 즉시 레일로 복귀**한다. 레일은 70px 자리(spacer)를 그대로 두고 확장 패널이
 *     **콘텐츠 위로 겹쳐**(absolute) 떠 본문을 밀지 않는다.
 * ★ **hover-out 은 항상 접힘**(stuck 금지). 단 키보드 Tab(`:focus-visible`)으로 들어온 포커스는
 *   flyout 을 유지해 탭 이동으로 전 메뉴·핀 버튼에 닿는다(마우스 클릭 포커스는 유지하지 않음).
 * ★ 라벨·아이콘 숨김 기준은 **레일 상태**(`railCollapsed = !pinned && !flyout`) → `xl:` 접두사로 표현.
 * ★ 핀 버튼은 **어느 상태에서도 접근 가능**하다 — 핀 ON(펼침)엔 상시 노출, 핀 OFF(레일)엔 hover/focus
 *   flyout 이 열리며 노출된다(다시 고정 못 하는 상태 없음).
 * ★ 준비 중(ready=false) 메뉴는 링크가 아니라 **`disabled` 버튼**으로 낸다 — opacity 만으로
 *   비활성 시늉하면 보조기술엔 활성으로 남는다(WCAG 4.1.2, FC-065 교훈).
 * ★ 접힘 시 안전거래센터는 아이콘만 — **세로 글자 금지**(§5.1).
 */

interface SidebarProps {
    /** xl 이상 네비게이션 고정(핀). false 면 레일 + hover 확장(기본). */
    pinned: boolean
    /** 핀(고정) 토글 */
    onTogglePin: () => void
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

/**
 * 네비게이션 고정(핀) 토글 아이콘 — Vuexy `menu-toggle-icon` 원형 라디오(§5.1).
 *
 * 목업(core.css)의 `mask-image` SVG 두 상태를 그대로 흡수한다(색만 브랜드 = `currentColor`):
 *  - 핀 ON(`pinned`): 바깥 원 + 가운데 점(채운 라디오) → "고정됨, 눌러서 해제".
 *  - 핀 OFF: 바깥 원만(빈 라디오) → "미고정, 눌러서 고정".
 */
function MenuToggleIcon({ pinned }: { pinned: boolean }) {
    return (
        <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0" />
            {pinned && <path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0" />}
        </svg>
    )
}

/**
 * 키보드 이동으로 들어온 포커스인지 판정(`:focus-visible`).
 *
 * ★ 마우스 **클릭**도 요소에 포커스를 주므로, 포커스만으로 flyout 을 열어 두면 마우스가 패널을
 *   벗어나도 닫히지 않는 **stuck 버그**가 된다(FC-086 회귀). 브라우저는 마우스 클릭엔
 *   `:focus-visible` 을 매치하지 않으므로 이걸로 키보드 이동만 골라 flyout 을 고정한다.
 * ★ `:focus-visible` 미지원 환경(일부 jsdom)에서 `matches` 가 던지면 접근성 우선으로 여는 쪽을
 *   택한다 — 실제 브라우저에선 정상 판정된다.
 */
function isKeyboardFocus(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    try {
        return target.matches(':focus-visible')
    } catch {
        return true
    }
}

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
    unreadMemoCount?: number,
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
                badge={
                    entry.to === paths.messages ? unreadMemoCount : undefined
                }
                onNavigate={onNavigate}
            />
        </li>
    )
}

function Sidebar({
    pinned,
    onTogglePin,
    mobileOpen,
    onCloseMobile,
    liveAuctionCount,
}: SidebarProps) {
    // 드로어 링크 클릭 시 자동 닫힘(모바일). 데스크톱은 no-op 이어도 무해.
    const onNavigate = () => onCloseMobile()

    // 쪽지 미열람 뱃지(계약 §2.6). 헤더·하단 내비와 같은 쿼리를 키로 공유(dedupe).
    const { data: unreadMemo } = useUnreadMemoCount()
    const unreadMemoCount = unreadMemo?.count ?? 0

    // 핀 OFF(미고정) 레일에서의 hover/focus 확장(flyout). 마우스·키보드를 각각 추적해
    // 마우스가 떠나도 키보드 포커스가 안에 있으면 닫히지 않는다(접근성). 핀 ON 이면 hover 무시.
    const [hover, setHover] = useState(false)
    const [focused, setFocused] = useState(false)
    const flyout = !pinned && (hover || focused)
    // 레일(70px)·라벨 숨김 기준 — 핀 ON(고정 펼침)이거나 flyout 이 열리면 풀뷰.
    const railCollapsed = !pinned && !flyout

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

            {/* 데스크톱 레일 자리(70px) — 핀 OFF 일 때. flyout 은 이 위로 겹쳐 뜨고 본문을 밀지 않는다.
                핀 ON(고정 펼침)이면 aside 가 인-플로우(260px)라 이 spacer 를 두지 않는다. */}
            {!pinned && (
                <div
                    aria-hidden
                    className="hidden shrink-0 xl:block xl:w-[70px]"
                />
            )}

            <aside
                aria-label="주 메뉴"
                className={[
                    'detail-chrome fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface',
                    'w-[260px] transition-[transform,width] duration-200',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                    'xl:translate-x-0',
                    // 핀 OFF: 콘텐츠 위 오버레이(레일 위치). 핀 ON: 인-플로우 레일.
                    pinned
                        ? 'xl:relative xl:z-20'
                        : 'xl:absolute xl:inset-y-0 xl:left-0 xl:z-40',
                    railCollapsed ? 'xl:w-[70px]' : 'xl:w-[260px]',
                    flyout ? 'xl:shadow-2xl' : '',
                ].join(' ')}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                onFocus={(event) => {
                    // 마우스 클릭 포커스로는 flyout 을 고정하지 않는다(stuck 방지).
                    // 키보드 이동(:focus-visible)일 때만 열어 둔다 — 탭 접근성은 유지.
                    if (isKeyboardFocus(event.target)) setFocused(true)
                }}
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

                    {/* 데스크톱 핀(고정) 토글 — 아이콘 레일(70px)엔 자리가 없어 감추고, flyout(hover/focus)
                        또는 핀 ON(고정 펼침)일 때 노출한다. 레일에서도 hover/focus 로 flyout 이 열리며
                        노출되므로 다시 고정할 수 있다(§5.1 · FC-086 #3, 상단바 토글 제거). */}
                    <button
                        type="button"
                        aria-label={
                            pinned ? '네비게이션 고정 해제' : '네비게이션 고정'
                        }
                        aria-pressed={pinned}
                        className={`absolute right-2 hidden size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 ${
                            railCollapsed ? '' : 'xl:flex'
                        }`}
                        onClick={onTogglePin}
                    >
                        <MenuToggleIcon pinned={pinned} />
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
                                unreadMemoCount,
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
