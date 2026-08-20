import { matchPath, useLocation } from 'react-router'
import {
    TbSmartHome,
    TbGavel,
    TbTag,
    TbUserCircle,
    TbLayoutGrid,
    TbArchive,
    TbWallet,
    TbBox,
    TbScale,
    TbBuildingStore,
    TbMessageCircle,
    TbMail,
    TbMessages,
    TbCreditCard,
} from 'react-icons/tb'
import { paths } from '@/app/paths'
import type { ComponentType } from 'react'

/**
 * 현재 경로 → 페이지 문맥(아이콘 + 이름) (FC-067 — TopNavbar §5.2 PageContext).
 *
 * ★ 라우트마다 상단 문맥 라벨을 준다. 매칭은 **구체 경로 우선**(예: `/me/inventory` 를
 *   `/me` 보다 먼저) 순서로 둔다.
 */
type Ctx = {
    title: string
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

const table: Array<{ pattern: string; ctx: Ctx }> = [
    { pattern: paths.home, ctx: { title: '홈', icon: TbSmartHome } },
    {
        pattern: paths.auctionDetail,
        ctx: { title: '경매 상세', icon: TbGavel },
    },
    { pattern: paths.auctions, ctx: { title: '실시간 경매', icon: TbGavel } },
    { pattern: paths.sell, ctx: { title: '아이템 판매', icon: TbTag } },
    { pattern: paths.compare, ctx: { title: '아이템 비교', icon: TbScale } },
    {
        pattern: paths.inventory,
        ctx: { title: '인벤토리', icon: TbLayoutGrid },
    },
    {
        pattern: paths.tempStorage,
        ctx: { title: '임시 보관함', icon: TbArchive },
    },
    { pattern: paths.wallet, ctx: { title: '지갑', icon: TbWallet } },
    { pattern: paths.itemDetail, ctx: { title: '아이템 상세', icon: TbBox } },
    { pattern: paths.messages, ctx: { title: '쪽지', icon: TbMail } },
    { pattern: paths.chat, ctx: { title: '채팅', icon: TbMessages } },
    { pattern: paths.me, ctx: { title: '마이페이지', icon: TbUserCircle } },
    {
        pattern: paths.marketDetail,
        ctx: { title: '마켓 상세', icon: TbBuildingStore },
    },
    {
        pattern: paths.market,
        ctx: { title: '아이템 마켓', icon: TbBuildingStore },
    },
    // 게시판 — 구체 경로 우선(작성/수정 → 상세 → 목록 → 허브)
    {
        pattern: paths.boardPostEdit,
        ctx: { title: '글 수정', icon: TbMessageCircle },
    },
    {
        pattern: paths.boardWrite,
        ctx: { title: '글쓰기', icon: TbMessageCircle },
    },
    {
        pattern: paths.boardPost,
        ctx: { title: '게시글', icon: TbMessageCircle },
    },
    { pattern: paths.board, ctx: { title: '게시판', icon: TbMessageCircle } },
    { pattern: paths.boards, ctx: { title: '게시판', icon: TbMessageCircle } },
    {
        pattern: paths.community,
        ctx: { title: '커뮤니티', icon: TbMessageCircle },
    },
    {
        pattern: paths.walletCharge,
        ctx: { title: '코드 충전', icon: TbCreditCard },
    },
]

const fallback: Ctx = { title: '장터', icon: TbSmartHome }

export function usePageContext(): Ctx {
    const { pathname } = useLocation()
    for (const { pattern, ctx } of table) {
        if (matchPath({ path: pattern, end: true }, pathname)) return ctx
    }
    return fallback
}
