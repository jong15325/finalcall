import { NavLink, useNavigate } from 'react-router'
import {
    TbMenu2,
    TbBell,
    TbBackpack,
    TbMail,
    TbMessages,
    TbUser,
    TbSettings,
    TbLogout,
} from 'react-icons/tb'
import useAuth from '@/auth/useAuth'
import { useUnreadMemoCount } from '@/lib/queries/memos'
import { useUnreadChatCount } from '@/lib/queries/chat'
import Dropdown from '@/components/common/Dropdown'
import { paths } from '@/app/paths'
import { usePageContext } from './pageContext'
import { UNREAD_BADGE_CLASS } from './unreadBadge'
import BrandLogo from '@/components/brand/BrandLogo'
import ProfileAvatar from '@/features/member/components/ProfileAvatar'
import type { RefObject } from 'react'

/**
 * 상단 네비게이션 (FC-067 — HANDOVER §5.2). 검색바 없음.
 *
 * ★ PC: 페이지 문맥 · 인벤토리 · 대화 · 쪽지 · 알림 · 프로필.
 *   모바일: 문맥 아이콘 · 대화 · 쪽지 · 알림 · 프로필(+햄버거).
 * ★ 알림은 [준비 중] — `/notifications` 컨트롤러 없음. 배지 없이 "준비 중" 자리 드롭다운으로,
 *   가짜 알림을 렌더하지 않는다(정직성·FC-048, rebuild-contract-map §5).
 */

interface TopNavbarProps {
    /** 모바일 사이드바 드로어 열기 */
    onOpenMobile: () => void
    menuButtonRef?: RefObject<HTMLButtonElement | null>
}

function TopNavbar({ menuButtonRef, onOpenMobile }: TopNavbarProps) {
    const { authenticated, user, signOut } = useAuth()
    const { data: unreadMemo } = useUnreadMemoCount()
    const { data: unreadChat } = useUnreadChatCount()
    const { title, icon: PageIcon } = usePageContext()
    const navigate = useNavigate()

    const unreadCount = unreadMemo?.count ?? 0
    const unreadChatCount = unreadChat?.count ?? 0

    const handleSignOut = async () => {
        await signOut()
        navigate(paths.home)
    }

    return (
        <header className="app-chrome h-16 rounded-xl border-b border-chrome-selected bg-chrome text-chrome-fg xl:rounded-b-none xl:rounded-t-2xl">
            <div className="flex h-full w-full items-center gap-3 px-4">
                <NavLink
                    to={paths.home}
                    aria-label="장터 홈"
                    className="hidden shrink-0 border-r border-chrome-selected pr-4 xl:block"
                >
                    <BrandLogo className="max-h-10 w-[132px] brightness-0 invert" />
                </NavLink>
                {/* 모바일 햄버거 — 사이드바 드로어 열기(데스크톱 접기/펼치기는 사이드바 헤더 토글) */}
                <button
                    ref={menuButtonRef}
                    type="button"
                    aria-label="메뉴 열기"
                    className="flex size-9 items-center justify-center rounded-lg text-chrome-muted hover:bg-chrome-raised hover:text-chrome-fg xl:hidden"
                    onClick={onOpenMobile}
                >
                    <TbMenu2 aria-hidden className="size-5" />
                </button>

                {/* 페이지 문맥 */}
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chrome-raised text-brand-highlight-bright">
                        <PageIcon aria-hidden className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-col leading-tight">
                        <span className="hidden text-[11px] font-semibold tracking-wide text-chrome-muted sm:block">
                            JANGTEO MARKETPLACE
                        </span>
                        <strong className="truncate text-sm font-bold text-chrome-fg">
                            {title}
                        </strong>
                    </span>
                </div>

                {/* 우측 클러스터 */}
                <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                    {/* 인벤토리 바로가기 — PC 전용, 로그인 시 */}
                    {authenticated && (
                        <NavLink
                            to={paths.inventory}
                            aria-label="인벤토리 바로가기"
                            className="hidden size-9 items-center justify-center rounded-lg text-chrome-muted hover:bg-chrome-raised hover:text-chrome-fg lg:flex"
                        >
                            <TbBackpack aria-hidden className="size-5" />
                        </NavLink>
                    )}

                    {/* 채팅 — 로그인 시, 전체 unread 뱃지(계약 §2.7) */}
                    {authenticated && (
                        <NavLink
                            to={paths.chat}
                            aria-label={
                                unreadChatCount > 0
                                    ? `채팅 · 안 읽음 ${unreadChatCount}건`
                                    : '채팅'
                            }
                            className="relative flex size-9 items-center justify-center rounded-lg text-chrome-muted hover:bg-chrome-raised hover:text-chrome-fg"
                        >
                            <TbMessages aria-hidden className="size-5" />
                            {unreadChatCount > 0 && (
                                <span
                                    className={`absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full px-1 text-[10px] leading-4 ring-2 ring-chrome ${UNREAD_BADGE_CLASS}`}
                                >
                                    {unreadChatCount > 99
                                        ? '99+'
                                        : unreadChatCount}
                                </span>
                            )}
                        </NavLink>
                    )}

                    {/* 쪽지 — 로그인 시, 미열람 뱃지(계약 §2.6) */}
                    {authenticated && (
                        <NavLink
                            to={paths.messages}
                            aria-label={
                                unreadCount > 0
                                    ? `쪽지 · 안 읽음 ${unreadCount}건`
                                    : '쪽지'
                            }
                            className="relative flex size-9 items-center justify-center rounded-lg text-chrome-muted hover:bg-chrome-raised hover:text-chrome-fg"
                        >
                            <TbMail aria-hidden className="size-5" />
                            {unreadCount > 0 && (
                                <span
                                    className={`absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full px-1 text-[10px] leading-4 ring-2 ring-chrome ${UNREAD_BADGE_CLASS}`}
                                >
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </NavLink>
                    )}

                    {/* 알림 — 준비 중(빈 드롭다운) */}
                    <Dropdown
                        triggerLabel="알림 열기"
                        triggerClassName="flex size-9 items-center justify-center rounded-lg text-chrome-muted hover:bg-chrome-raised hover:text-chrome-fg"
                        trigger={<TbBell aria-hidden className="size-5" />}
                        panelClassName="w-72"
                    >
                        <div className="flex items-center gap-2 border-b border-chrome-selected px-4 py-3">
                            <h6 className="text-sm font-bold text-chrome-fg">
                                알림
                            </h6>
                            <span className="rounded-full bg-brand-highlight-soft px-2 py-0.5 text-[10px] font-bold text-brand-highlight-deep">
                                준비 중
                            </span>
                        </div>
                        <p className="px-4 py-8 text-center text-sm text-chrome-muted">
                            알림 기능은 준비 중이에요
                        </p>
                    </Dropdown>

                    {/* 프로필 / 인증 */}
                    {authenticated ? (
                        <Dropdown
                            triggerLabel="사용자 메뉴 열기"
                            triggerClassName="flex items-center rounded-full"
                            trigger={
                                <ProfileAvatar
                                    primaryCharacterId={
                                        user?.primaryCharacterId
                                    }
                                    name={user?.nickname ?? '회원'}
                                    className="size-9 rounded-full"
                                />
                            }
                            panelClassName="w-56"
                        >
                            <div className="flex items-center gap-2.5 border-b border-chrome-selected px-4 py-3">
                                <ProfileAvatar
                                    primaryCharacterId={
                                        user?.primaryCharacterId
                                    }
                                    name={user?.nickname ?? '회원'}
                                    className="size-9 rounded-full"
                                />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-chrome-fg">
                                        {user?.nickname ?? '회원'}
                                    </p>
                                    <p className="text-xs text-chrome-muted">
                                        {user?.isAdmin ? '관리자' : '일반 회원'}
                                    </p>
                                </div>
                            </div>
                            <nav className="p-1.5">
                                <NavLink
                                    to={paths.me}
                                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-chrome-muted hover:bg-chrome-selected hover:text-chrome-fg"
                                >
                                    <TbUser aria-hidden className="size-5" />
                                    마이페이지
                                </NavLink>
                                <NavLink
                                    to={paths.me}
                                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-chrome-muted hover:bg-chrome-selected hover:text-chrome-fg"
                                >
                                    <TbSettings
                                        aria-hidden
                                        className="size-5"
                                    />
                                    설정
                                </NavLink>
                            </nav>
                            <div className="border-t border-chrome-selected p-1.5">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-danger-ink hover:bg-danger-soft"
                                    onClick={handleSignOut}
                                >
                                    <TbLogout aria-hidden className="size-5" />
                                    로그아웃
                                </button>
                            </div>
                        </Dropdown>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <NavLink
                                to={paths.login}
                                className="rounded-lg px-3 py-2 text-sm font-semibold text-chrome-muted hover:bg-chrome-selected hover:text-chrome-fg"
                            >
                                로그인
                            </NavLink>
                            <NavLink
                                to={paths.signup}
                                className="rounded-lg bg-control-action px-3 py-2 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                            >
                                회원가입
                            </NavLink>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}

export default TopNavbar
