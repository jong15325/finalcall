/**
 * 라우트 경로 상수 (screen-spec [2], skeleton-plan [3]).
 * 파라미터 경로는 빌더 함수로 둔다(외부 식별자 = public_id ULID, 계약 [1.1]).
 *
 * ★ FC-055 이관 — Ecme 템플릿 재구성 이전 `src/routes/paths.ts` 의 내용을 그대로 옮겼다.
 *   경로 문자열은 **계약·화면 스펙이 정한 값**이라 템플릿 관례(`/sign-in` 등)로 바꾸지 않는다.
 */
export const ROUTES = {
    // 공개
    home: '/',
    auctions: '/auctions',
    auctionDetail: '/auctions/:auctionPublicId',
    shops: '/shops',
    shopDetail: '/shops/:shopPublicId',
    itemDetail: '/items/:itemInstancePublicId',
    marketPrices: '/market-prices',

    // 인증 폼
    login: '/login',
    signup: '/signup',

    // 보호(me 주체)
    sell: '/sell',
    inventory: '/me/inventory',
    tempStorage: '/me/temp-storage',
    orders: '/me/orders',
    orderDetail: '/me/orders/:orderPublicId',
    wallet: '/me/wallet',
    walletChargeConfirm: '/me/wallet/charge/confirm',
    profile: '/me/profile',

    // 관리자
    adminAuctionDetail: '/admin/auctions/:auctionPublicId',
} as const

export const buildPath = {
    auctionDetail: (auctionPublicId: string) => `/auctions/${auctionPublicId}`,
    shopDetail: (shopPublicId: string) => `/shops/${shopPublicId}`,
    itemDetail: (itemInstancePublicId: string) =>
        `/items/${itemInstancePublicId}`,
    orderDetail: (orderPublicId: string) => `/me/orders/${orderPublicId}`,
    adminAuctionDetail: (auctionPublicId: string) =>
        `/admin/auctions/${auctionPublicId}`,
}
