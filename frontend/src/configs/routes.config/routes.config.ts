import authRoute from './authRoute'
import othersRoute from './othersRoute'
import { ROUTES } from './paths'
import { placeholderRoute } from './placeholderRoute'
import type { Routes } from '@/@types/routes'

/**
 * 라우트 정본 (FC-055).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **버킷이 셋이다 — 템플릿은 둘이었다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * Ecme 는 **관리자 템플릿**이라 `publicRoutes`(= 로그인·회원가입) / `protectedRoutes`(= 나머지
 * 전부)의 이분법을 쓴다. 그 전제는 "**비로그인은 볼 게 없다**"이다.
 *
 * **우리는 공개 커머스다.** 홈·경매 목록·경매 상세·상점·시세는 **비로그인도 보고 로그인도 본다** —
 * 오히려 그게 유입 경로다. 그래서 세 번째 버킷 `sharedRoutes` 를 둔다.
 *
 * 이분법을 그대로 썼다면 둘 중 하나가 됐다:
 *   - 공개 화면을 `publicRoutes` 에 넣는다 → `PublicRoute` 가 **로그인 사용자를 홈으로 튕긴다**.
 *     로그인하면 경매 목록을 못 본다.
 *   - 공개 화면을 `protectedRoutes` 에 넣는다 → 비로그인이 **로그인 화면으로 튕긴다**.
 *     검색엔진·공유 링크로 들어온 손님이 매물을 못 본다.
 * 둘 다 커머스로서 성립하지 않는다.
 */

/** 누구나 보는 화면(비로그인·로그인 공통). 커머스의 본체다. */
export const sharedRoutes: Routes = [
    placeholderRoute('home', ROUTES.home, '홈'),
    placeholderRoute('auctions', ROUTES.auctions, '경매 목록'),
    placeholderRoute('auctionDetail', ROUTES.auctionDetail, '경매 상세'),
    placeholderRoute('shops', ROUTES.shops, '상점 목록'),
    placeholderRoute('shopDetail', ROUTES.shopDetail, '상점 상세'),
    placeholderRoute('itemDetail', ROUTES.itemDetail, '아이템 상세'),
    placeholderRoute('marketPrices', ROUTES.marketPrices, '시세'),
]

/** 비로그인 전용(로그인 상태로 오면 되돌린다). 인증 폼만 해당한다. */
export const publicRoutes: Routes = [...authRoute]

/** 로그인 필수(me 주체 · 관리자). */
export const protectedRoutes: Routes = [
    placeholderRoute('sell', ROUTES.sell, '판매 등록'),
    placeholderRoute('inventory', ROUTES.inventory, '인벤토리'),
    placeholderRoute('tempStorage', ROUTES.tempStorage, '임시보관'),
    placeholderRoute('orders', ROUTES.orders, '주문 내역'),
    placeholderRoute('orderDetail', ROUTES.orderDetail, '주문 상세'),
    placeholderRoute('wallet', ROUTES.wallet, '지갑'),
    placeholderRoute(
        'walletChargeConfirm',
        ROUTES.walletChargeConfirm,
        '충전 확인',
    ),
    placeholderRoute('profile', ROUTES.profile, '마이페이지'),
    placeholderRoute(
        'adminAuctionDetail',
        ROUTES.adminAuctionDetail,
        '관리자 — 경매 상세',
    ),
    ...othersRoute,
]
