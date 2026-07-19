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
 * ★★ **활성 표현은 템플릿 `Tabs`(underline variant)의 관례를 그대로 쓴다**(사용자 방침
 *    2026-07-19). 템플릿 `ui/Tabs/TabNav.tsx` 가 활성 탭에 붙이는 조합이
 *    `tab-nav-active text-primary` + `border-primary` 이고, 비활성은 `border-transparent`
 *    (`_tabs.css` 의 `.tab-nav-underline`)다. 클래스도 템플릿 CSS(`tab-nav`·
 *    `tab-nav-underline`)를 그대로 재사용한다 — 우리가 값을 만들지 않는다.
 *    **폐기**: 종전의 near-black 2px 밑줄(`border-gray-900`).
 *
 * ★★ **액센트는 형태에, 대비는 라벨에**(사용자 판정 2026-07-19 — 선택지 (c)).
 *    템플릿 `TabNav` 는 활성 탭에 `text-primary` 도 함께 주지만, **`--primary` 는 프리셋마다
 *    바뀌는 값**이라 라벨 가독성을 거기에 묶으면 안 된다. 흰 헤더 위 실측:
 *    default 3.56 · green 2.87 · purple 3.96 · orange 2.77 · dark 17.72 — **5종 중 4종이
 *    AA(4.5) 미달**이다(현재 프리셋은 `dark`라 통과하지만 그건 우연에 기대는 것이다).
 *    - **라벨은 `text-gray-900 dark:text-gray-100`** — 프리셋과 무관하게 17.93 / 16.44.
 *    - **선만 `border-primary`** — 비텍스트라 요구가 3:1 이고, 현 프리셋에서 17.72 / 17.93.
 *    hover 도 같은 이유로 템플릿 `.menu-item-hoverable` 관례를 쓴다.
 *    ★ **템플릿 토큰은 건드리지 않았다** — 토큰을 덮는 대신 **어느 토큰을 어디에 쓸지**만 골랐다.
 *
 * ★ 색만으로 전달하지 않는다(WCAG 1.4.1 — 접근성은 템플릿에 위임하지 않는다):
 *   활성 항목은 **밑줄(형태) + `aria-current="page"`(의미)** 를 함께 갖는다.
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
            // 템플릿 `_tabs.css` 의 underline 탭 클래스를 그대로 쓴다(`py-3 px-5` 는 셸 높이에 맞춰 제외).
            'tab-nav relative -mb-px h-12 border-b-2 border-transparent px-1 text-sm',
            active
                ? 'tab-nav-active border-primary text-gray-900 dark:text-gray-100'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
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
