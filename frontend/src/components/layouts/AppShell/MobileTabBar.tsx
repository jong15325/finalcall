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
 * ★★ **활성 표시를 위아래로 뒤집는다.** 데스크톱 내비는 밑줄이지만 탭바는 화면 **맨 아래**라
 *    밑줄이 기기 가장자리에 먹힌다. 그래서 **탭 상단 2px**로 올린다 — 규칙(2px near-black
 *    선)은 같고 위치만 뒤집힌 것이다.
 *
 * ★ 5칸 **고정**이다. 균등 분할이라 개수가 바뀌면 모든 탭이 움직이므로 목적지가 늘어도
 *   탭을 늘리지 않는다(`navigation.ts` 참조).
 *
 * ★ 색만으로 전달하지 않는다 — 활성 탭은 상단 선 + `font-bold` + `aria-current="page"` 를
 *   함께 갖는다. 아이콘에도 라벨을 반드시 병기한다.
 *
 * ★ 터치 표적 48px 이상(`h-16` = 64px). `pb-[env(safe-area-inset-bottom)]` 로 iOS 홈
 *   인디케이터를 피한다.
 *
 * 대비: 비활성 `gray-600`/흰 **7.81:1**, 활성 `gray-900`/흰 **17.93:1**.
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
                                    'flex h-16 flex-col items-center justify-center gap-1 border-t-2 text-[11px] transition-colors',
                                    active
                                        ? 'border-gray-900 font-bold text-gray-900 dark:border-gray-100 dark:text-gray-100'
                                        : 'border-transparent font-medium text-gray-600 dark:text-gray-400',
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
