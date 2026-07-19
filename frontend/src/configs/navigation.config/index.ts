import { NAV_ITEM_TYPE_ITEM } from '@/constants/navigation.constant'

import type { NavigationTree } from '@/@types/navigation'

/**
 * 내비게이션 트리 (FC-055).
 *
 * ★ **의도적으로 최소다.** 템플릿 예시 메뉴(single/collapse/group)는 전부 걷어냈다 —
 *   경로가 없는 메뉴는 그 자체로 죽은 링크다.
 *
 * ★ **이 파일은 사이드바용 자료구조다.** 우리 셸이 사이드바를 쓸지 상단 내비를 쓸지는
 *   **FC-057 에서 확정**한다(레이아웃 미확정). 여기 항목을 늘리는 건 그 결정 다음이다 —
 *   지금 채우면 사이드바 IA 를 기정사실로 만든다.
 */
const navigationConfig: NavigationTree[] = [
    {
        key: 'auctions',
        path: '/auctions',
        title: '경매',
        translateKey: '',
        icon: 'home',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
    },
]

export default navigationConfig
