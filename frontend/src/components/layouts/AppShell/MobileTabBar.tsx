import { Link, useLocation } from 'react-router'
import {
    PiHouseLineDuotone,
    PiGavelDuotone,
    PiTagDuotone,
    PiBackpackDuotone,
    PiUserDuotone,
} from 'react-icons/pi'
import classNames from '@/utils/classNames'
import { MOBILE_TAB_DESTINATIONS, isDestinationActive } from './navigation'
import type { ReactNode } from 'react'

/**
 * 모바일 하단 탭바 (FC-057).
 *
 * ★★ **활성 표현은 템플릿 `MenuItem` 관례를 쓴다**(사용자 방침 2026-07-19).
 *    템플릿 `_menu-item.css` 의 `.menu-item` = `text-gray-600 dark:text-gray-400`,
 *    `.menu-item-active` = `text-primary`. 템플릿에는 **하단 탭바라는 컴포넌트가 없어**
 *    가장 가까운 내비 항목 관례를 빌려온 것이다(보고 대상).
 *
 * ★★ **액센트는 형태에, 대비는 라벨에**(사용자 판정 2026-07-19 — 선택지 (c)).
 *    데스크톱 밑줄을 **위아래로 뒤집어** 탭 상단 `border-t-2 border-primary` 로 둔다(탭바는
 *    화면 맨 아래라 밑줄이 기기 가장자리에 먹힌다). 선 색은 **템플릿 `--primary`**(비텍스트
 *    3:1 요구 — 현 `dark` 프리셋에서 17.72/17.93), 라벨은 프리셋과 무관한
 *    `text-gray-900 dark:text-gray-100`(17.93/16.44)이다. 근거는 `DesktopHeader` 주석 참조.
 *    종전 near-black 선(우리 값)과 달리 **색은 전부 템플릿 토큰**이다.
 *
 * ★ 5칸 **고정**이다. 균등 분할이라 개수가 바뀌면 모든 탭이 움직이므로 목적지가 늘어도
 *   탭을 늘리지 않는다(`navigation.ts` 참조).
 *
 * ★ **색 단독 전달 금지**(WCAG 1.4.1 — 접근성은 템플릿에 위임하지 않는다):
 *   아이콘에 **항상 텍스트 라벨을 병기**하고, 활성 탭은 `aria-current="page"` 로 의미를 준다.
 *   즉 활성 여부가 색에만 실리지 않는다.
 *
 * ★ 터치 표적 48px 이상(`h-16` = 64px). `pb-[env(safe-area-inset-bottom)]` 로 iOS 홈
 *   인디케이터를 피한다.
 */

const TAB_ICONS: Record<string, ReactNode> = {
    home: <PiHouseLineDuotone />,
    auctions: <PiGavelDuotone />,
    sell: <PiTagDuotone />,
    inventory: <PiBackpackDuotone />,
    account: <PiUserDuotone />,
}

const MobileTabBar = ({ className }: { className?: string }) => {
    const { pathname } = useLocation()

    return (
        <nav
            aria-label="하단 탭 메뉴"
            className={classNames(
                'fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-gray-700 dark:bg-gray-900',
                className,
            )}
        >
            <ul className="flex">
                {MOBILE_TAB_DESTINATIONS.map((destination) => {
                    const active = isDestinationActive(destination, pathname)
                    return (
                        <li key={destination.key} className="flex-1">
                            <Link
                                to={destination.path}
                                aria-current={active ? 'page' : undefined}
                                className={classNames(
                                    // 템플릿 `_menu-item.css` 의 색·굵기 관례를 따른다.
                                    'flex h-16 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-[11px] font-semibold transition-colors duration-150',
                                    active
                                        ? 'border-primary text-gray-900 dark:text-gray-100'
                                        : 'text-gray-600 dark:text-gray-400',
                                )}
                            >
                                <span aria-hidden="true" className="text-xl">
                                    {TAB_ICONS[destination.key]}
                                </span>
                                <span>{destination.label}</span>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}

export default MobileTabBar
