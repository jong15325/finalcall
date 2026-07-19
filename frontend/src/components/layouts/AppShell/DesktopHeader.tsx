import { Link, useLocation } from 'react-router'
import classNames from '@/utils/classNames'
import BrandWordmark from '@/components/brand/BrandWordmark'
import { ROUTES } from '@/configs/routes.config'
import AccountMenu from './AccountMenu'
import BalanceIndicator from './BalanceIndicator'
import { PRIMARY_DESTINATIONS, isDestinationActive } from './navigation'

/**
 * 데스크톱 셸 헤더 — **2행 구조** (레이아웃 B, FC-057).
 *
 *   1행: 브랜드 ────────── [검색 자리(비움)] ────────── 잔액 · 계정
 *   2행: 홈  경매  판매하기  내 아이템          ← 활성 항목에 near-black 2px 밑줄
 *
 * ★★ **검색 컨트롤을 두지 않았다.** 계약 §3·§4.1 어디에도 `q`/`keyword` 파라미터가 없다
 *    (FC-048 확인, FC-057 재확인). 지금 입력창을 놓으면 **아무 일도 일어나지 않는 컨트롤**이
 *    되고 그건 design-system §5.2("사유 없는 비활성 금지") 위반이다.
 *    대신 **자리를 레이아웃이 수용**한다 — 1행이 `justify-between` 이라 브랜드와 계정 사이가
 *    이미 비어 있고, 검색이 계약에 생기면 그 `flex-1` 자리에 넣기만 하면 된다. **재설계 없음.**
 *    계약 신설은 게이트2 상신 대상(반환 참조).
 *
 * ★ 2행 내비는 **왼쪽 정렬 + 고정 간격**이다. 폭에 분배(`justify-between`)하지 않는 이유는
 *   `navigation.ts` 참조 — 목적지가 늘어도 기존 항목이 움직이지 않게 하려는 것이다.
 *
 * ★ 활성 표시는 **near-black 2px 밑줄**이다(퍼플 아님). 퍼플은 워드마크 마감선 하나로
 *   아껴 쓴다 — 액센트가 두 군데면 액센트가 아니다.
 *   색만으로 전달하지 않는다: 활성 항목은 `font-bold` + `aria-current="page"` 를 함께 갖는다.
 *
 * 대비: 비활성 라벨 `gray-600` #525252 / 흰 **7.81:1**, 다크 `gray-400` #A3A3A3 /
 * `gray-900` **7.11:1**. 활성 라벨·밑줄 17.93:1 / 16.44:1.
 */

const NavItem = ({
    to,
    label,
    active,
}: {
    to: string
    label: string
    active: boolean
}) => (
    <Link
        to={to}
        aria-current={active ? 'page' : undefined}
        className={classNames(
            'relative -mb-px flex h-12 items-center border-b-2 px-1 text-sm transition-colors',
            active
                ? 'border-gray-900 font-bold text-gray-900 dark:border-gray-100 dark:text-gray-100'
                : 'border-transparent font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
        )}
    >
        {label}
    </Link>
)

const DesktopHeader = ({ className }: { className?: string }) => {
    const { pathname } = useLocation()

    return (
        <header
            className={classNames(
                'border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
                className,
            )}
        >
            {/* 1행 — 브랜드 / 검색 자리 / 계정 */}
            <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-8 px-6">
                <Link to={ROUTES.home} className="shrink-0">
                    <BrandWordmark size="md" />
                </Link>

                {/*
                 * 검색이 들어올 자리. 지금은 **의도적으로 비어 있다**(위 주석 참조).
                 * 여백을 흡수하는 역할도 겸하므로 지우면 1행 배치가 바뀐다.
                 */}
                <div className="flex-1" />

                <div className="flex shrink-0 items-center gap-5">
                    <BalanceIndicator variant="full" />
                    <AccountMenu />
                </div>
            </div>

            {/* 2행 — 주요 내비 */}
            <nav
                aria-label="주요 메뉴"
                className="border-t border-gray-100 dark:border-gray-800"
            >
                <ul className="mx-auto flex h-12 w-full max-w-[1280px] items-center gap-7 px-6">
                    {PRIMARY_DESTINATIONS.map((destination) => (
                        <li key={destination.key}>
                            <NavItem
                                to={destination.path}
                                label={destination.label}
                                active={isDestinationActive(
                                    destination,
                                    pathname,
                                )}
                            />
                        </li>
                    ))}
                </ul>
            </nav>
        </header>
    )
}

export default DesktopHeader
