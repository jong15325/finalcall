/**
 * 내비게이션 구성 (FC-067).
 *
 * ★ 사이드바·모바일 하단 내비가 **같은 출처**를 참조한다 — 메뉴가 두 곳에서 갈라지지 않게.
 * ★ `ready: false` = 백엔드 미구현(준비 중). 클릭 시 404 대신 비활성/안내로 처리한다
 *   (rebuild-contract-map §5 · 부록 주의 5). 라우트 자체는 존재하되(플레이스홀더 화면),
 *   내비에서는 비활성으로 노출한다.
 * ★ 아이콘은 Tabler(react-icons/tb) — 목업 아이콘 계열과 일치.
 */
import {
    TbSmartHome,
    TbShoppingBag,
    TbGavel,
    TbMessageCircle,
    TbUserCircle,
    TbBuildingStore,
    TbLayoutGrid,
    TbHome,
} from 'react-icons/tb'
import { paths } from '@/app/paths'
import type { ComponentType } from 'react'

export interface NavLeaf {
    label: string
    to: string
    /** 백엔드 연동 완료 여부. false 면 준비 중(비활성). */
    ready: boolean
    icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

export interface NavGroup {
    label: string
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    children: NavLeaf[]
}

export type NavEntry =
    | ({ kind: 'leaf' } & NavLeaf & {
              icon: ComponentType<{
                  className?: string
                  'aria-hidden'?: boolean
              }>
          })
    | ({ kind: 'group' } & NavGroup)

/** 좌측 사이드바 메인 메뉴(HANDOVER §5.1). */
export const sidebarNav: NavEntry[] = [
    {
        kind: 'leaf',
        label: '홈',
        to: paths.home,
        ready: true,
        icon: TbSmartHome,
    },
    {
        kind: 'group',
        label: '마켓',
        icon: TbShoppingBag,
        children: [
            { label: '아이템 마켓', to: paths.market, ready: true },
            { label: '실시간 경매', to: paths.auctions, ready: true },
            { label: '아이템 판매', to: paths.sell, ready: true },
        ],
    },
    {
        kind: 'group',
        label: '커뮤니티',
        icon: TbMessageCircle,
        children: [{ label: '자유 게시판', to: paths.community, ready: false }],
    },
    {
        kind: 'leaf',
        label: '마이페이지',
        to: paths.me,
        ready: true,
        icon: TbUserCircle,
    },
]

/** 모바일 하단 내비(HANDOVER §5.3). 순서 고정. */
export const mobileNav: NavLeaf[] = [
    {
        label: '아이템마켓',
        to: paths.market,
        ready: true,
        icon: TbBuildingStore,
    },
    { label: '실시간 경매', to: paths.auctions, ready: true, icon: TbGavel },
    { label: '홈', to: paths.home, ready: true, icon: TbHome },
    { label: '인벤토리', to: paths.inventory, ready: true, icon: TbLayoutGrid },
    { label: '마이페이지', to: paths.me, ready: true, icon: TbUserCircle },
]
