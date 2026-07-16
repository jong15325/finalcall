/**
 * 라우트 경로 상수 (screen-spec [2], skeleton-plan [3]).
 * 파라미터 경로는 빌더 함수로 둔다(외부 식별자 = public_id ULID, 계약 [1.1]).
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
} as const;

export const buildPath = {
  auctionDetail: (auctionPublicId: string) => `/auctions/${auctionPublicId}`,
  shopDetail: (shopPublicId: string) => `/shops/${shopPublicId}`,
  itemDetail: (itemInstancePublicId: string) => `/items/${itemInstancePublicId}`,
  orderDetail: (orderPublicId: string) => `/me/orders/${orderPublicId}`,
  adminAuctionDetail: (auctionPublicId: string) => `/admin/auctions/${auctionPublicId}`,
};
