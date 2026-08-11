import { NavLink, useNavigate } from 'react-router'
import {
    TbMenu2,
    TbBell,
    TbCircleCheckFilled,
    TbGavel,
    TbBackpack,
    TbMail,
    TbChevronRight,
    TbUser,
    TbSettings,
    TbLogout,
} from 'react-icons/tb'
import useAuth from '@/auth/useAuth'
import { useMyBalance } from '@/lib/queries/balance'
import { useUnreadMemoCount } from '@/lib/queries/memos'
import CodeAmount from '@/components/common/CodeAmount'
import Dropdown from '@/components/common/Dropdown'
import { paths } from '@/app/paths'
import { usePageContext } from './pageContext'

/**
 * 상단 네비게이션 (FC-067 — HANDOVER §5.2). 검색바 없음.
 *
 * ★ PC: 페이지 문맥 · 거래 서버 상태 · 실시간 경매 · 인벤토리 · 보유 코드 · 알림 · 프로필.
 *   모바일: 문맥 아이콘 · 축약 보유 코드 · 알림 · 프로필(+햄버거).
 * ★ 보유 코드는 **로그인 시에만** — 잔액 쿼리는 `enabled: isAuthed` 라 손님 호출로 401 을
 *   깨우지 않는다(잔액 훅 주석). 값은 정수, 표기는 축약(`CodeAmount compact`).
 * ★ 알림은 [준비 중] — `/notifications` 컨트롤러 없음. 배지 없이 "준비 중" 자리 드롭다운으로,
 *   가짜 알림을 렌더하지 않는다(정직성·FC-048, rebuild-contract-map §5).
 */

interface TopNavbarProps {
    /** 모바일 사이드바 드로어 열기 */
    onOpenMobile: () => void
}

function TopNavbar({ onOpenMobile }: TopNavbarProps) {
    const { authenticated, user, signOut } = useAuth()
    const { data: balance } = useMyBalance()
    const { data: unreadMemo } = useUnreadMemoCount()
    const { title, icon: PageIcon } = usePageContext()
    const navigate = useNavigate()

    const unreadCount = unreadMemo?.count ?? 0

    const handleSignOut = async () => {
        await signOut()
        navigate(paths.home)
    }

    return (
        <header className="detail-chrome sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
            {/* 모바일 햄버거 — 사이드바 드로어 열기(데스크톱 접기/펼치기는 사이드바 헤더 토글) */}
            <button
                type="button"
                aria-label="메뉴 열기"
                className="flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 xl:hidden"
                onClick={onOpenMobile}
            >
                <TbMenu2 aria-hidden className="size-5" />
            </button>

            {/* 페이지 문맥 */}
            <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy text-gold-bright">
                    <PageIcon aria-hidden className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                    <span className="hidden text-[11px] font-semibold tracking-wide text-gray-400 sm:block">
                        JANGTEO MARKETPLACE
                    </span>
                    <strong className="truncate text-sm font-bold text-gray-900">
                        {title}
                    </strong>
                </span>
            </div>

            {/* 우측 클러스터 */}
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                {/* 거래 서버 상태 — PC 전용 */}
                <span className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-gray-600 lg:flex">
                    <TbCircleCheckFilled
                        aria-hidden
                        className="size-4 text-success"
                    />
                    거래 서버 <strong className="text-gray-900">정상</strong>
                </span>

                {/* 실시간 경매 바로가기 — PC 전용 */}
                <NavLink
                    to={paths.auctions}
                    className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-orange hover:text-orange-deep lg:flex"
                >
                    <TbGavel aria-hidden className="size-4" />
                    실시간 경매
                </NavLink>

                {/* 인벤토리 바로가기 — PC 전용, 로그인 시 */}
                {authenticated && (
                    <NavLink
                        to={paths.inventory}
                        aria-label="인벤토리 바로가기"
                        className="hidden size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 lg:flex"
                    >
                        <TbBackpack aria-hidden className="size-5" />
                    </NavLink>
                )}

                {/* 보유 코드 — 로그인 시. 모바일(phone)에서는 숨김(상단 혼잡 완화), sm↑ 노출 */}
                {authenticated && (
                    <NavLink
                        to={paths.wallet}
                        className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 hover:border-gold sm:flex"
                    >
                        <span className="hidden text-[11px] font-semibold text-gray-400 sm:block">
                            보유 코드
                        </span>
                        <CodeAmount
                            value={balance?.gameMoneyBalance ?? null}
                            mode="compact"
                            className="text-sm font-bold text-gray-900"
                        />
                        <TbChevronRight
                            aria-hidden
                            className="hidden size-4 text-gray-400 sm:block"
                        />
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
                        className="relative flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                    >
                        <TbMail aria-hidden className="size-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full bg-orange px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-surface tabular-nums">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </NavLink>
                )}

                {/* 알림 — 준비 중(빈 드롭다운) */}
                <Dropdown
                    triggerLabel="알림 열기"
                    triggerClassName="flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                    trigger={<TbBell aria-hidden className="size-5" />}
                    panelClassName="w-72"
                >
                    <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                        <h6 className="text-sm font-bold text-gray-900">
                            알림
                        </h6>
                        <span className="rounded-full bg-gold-subtle px-2 py-0.5 text-[10px] font-bold text-gold-deep">
                            준비 중
                        </span>
                    </div>
                    <p className="px-4 py-8 text-center text-sm text-gray-400">
                        알림 기능은 준비 중이에요
                    </p>
                </Dropdown>

                {/* 프로필 / 인증 */}
                {authenticated ? (
                    <Dropdown
                        triggerLabel="사용자 메뉴 열기"
                        triggerClassName="flex items-center rounded-full"
                        trigger={
                            <span className="flex size-9 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                                {user?.nickname?.slice(0, 1) ?? '?'}
                            </span>
                        }
                        panelClassName="w-56"
                    >
                        <div className="border-b border-line px-4 py-3">
                            <p className="truncate text-sm font-bold text-gray-900">
                                {user?.nickname ?? '회원'}
                            </p>
                            <p className="text-xs text-gray-400">
                                {user?.isAdmin ? '관리자' : '일반 회원'}
                            </p>
                        </div>
                        <nav className="p-1.5">
                            <NavLink
                                to={paths.me}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                            >
                                <TbUser aria-hidden className="size-5" />
                                마이페이지
                            </NavLink>
                            <NavLink
                                to={paths.me}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                            >
                                <TbSettings aria-hidden className="size-5" />
                                설정
                            </NavLink>
                        </nav>
                        <div className="border-t border-line p-1.5">
                            <button
                                type="button"
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-subtle"
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
                            className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                            로그인
                        </NavLink>
                        <NavLink
                            to={paths.signup}
                            className="detail-cta rounded-lg bg-orange px-3 py-2 text-sm font-bold text-white hover:bg-orange-deep"
                        >
                            회원가입
                        </NavLink>
                    </div>
                )}
            </div>
        </header>
    )
}

export default TopNavbar
