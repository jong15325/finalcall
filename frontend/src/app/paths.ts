/**
 * 라우트 경로 상수 (FC-067).
 *
 * ★ 정본은 `docs/ux/rebuild-contract-map.md` §1 라우트 지도다. URL 문자열은 계약 대상이 아니라
 *   프론트 재량이나, 재구축 산출물 내 일관성을 위해 이 표를 단일 출처로 둔다. 화면·내비·가드가
 *   전부 이 상수를 참조해 오타·불일치를 없앤다.
 *
 * ★ **[준비 중]** 표시가 붙은 경로는 백엔드 미구현(동결)이라 이번 에픽에서 자리만 잡는다.
 *   클릭 시 404 대신 "준비 중" 안내를 낸다(§5 · 부록 주의 5).
 */
export const paths = {
    home: '/',

    /* 마켓 */
    market: '/market', // [준비 중] 고정가 마켓 — ShopController 없음
    auctions: '/auctions',
    auctionDetail: '/auctions/:id',
    sell: '/sell',

    /* 커뮤니티 */
    community: '/community', // [준비 중] 커뮤니티 CRUD 없음

    /* 비교 */
    compare: '/compare',

    /* 마이페이지 */
    me: '/me',
    orders: '/me/orders',
    inventory: '/me/inventory',
    tempStorage: '/me/temp-storage',
    itemDetail: '/items/:id',

    /* 지갑 */
    wallet: '/me/wallet',
    walletCharge: '/wallet/charge', // [준비 중] 코드 충전 — /charges 없음

    /* 인증 */
    login: '/login',
    signup: '/signup',
} as const

/** 경매 상세 경로 조립 */
export const auctionDetailPath = (id: string) => `/auctions/${id}`

/** 보유 아이템 인스턴스 상세 경로 조립 */
export const itemDetailPath = (id: string) => `/items/${id}`
