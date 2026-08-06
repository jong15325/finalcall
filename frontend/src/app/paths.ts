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
    market: '/market', // 고정가 마켓 (FC-094 — /shops 실기능)
    marketDetail: '/market/:id', // 고정가 상세 (FC-094 게이트 — 카드→상세→구매)
    auctions: '/auctions',
    auctionDetail: '/auctions/:id',
    sell: '/sell',

    /* 게시판 (EPIC-BOARD, FC-202) — 허브 → 목록 → 상세 → 작성/수정 */
    boards: '/boards', // 게시판 허브(커뮤니티·공지·이벤트 카드)
    board: '/boards/:slug', // 게시판별 글 목록(커서 무한스크롤)
    boardWrite: '/boards/:slug/write', // 글 작성
    boardPost: '/boards/:slug/:postId', // 글 상세
    boardPostEdit: '/boards/:slug/:postId/edit', // 글 수정
    // 구 커뮤니티 자리 — /boards/community 로 리다이렉트(하위호환)
    community: '/community',

    /* 비교 */
    compare: '/compare',

    /* 마이페이지 */
    me: '/me',
    orders: '/me/orders',
    inventory: '/me/inventory',
    tempStorage: '/me/temp-storage',
    messages: '/me/messages', // 메모/쪽지 (FC-172 — /me/memos 실기능)
    itemDetail: '/items/:id',

    /* 지갑 */
    wallet: '/me/wallet',
    walletCharge: '/wallet/charge', // [준비 중] 코드 충전 — /charges 없음

    /* 인증 */
    login: '/login',
    signup: '/signup',
    oauthCallback: '/oauth/callback', // 소셜 로그인 provider 복귀지 (FC-156)
} as const

/** 경매 상세 경로 조립 */
export const auctionDetailPath = (id: string) => `/auctions/${id}`

/** 고정가 마켓 상세 경로 조립 */
export const marketDetailPath = (id: string) => `/market/${id}`

/** 보유 아이템 인스턴스 상세 경로 조립 */
export const itemDetailPath = (id: string) => `/items/${id}`

/** 게시판 목록 경로 조립 */
export const boardPath = (slug: string) => `/boards/${slug}`

/** 게시판 글 작성 경로 조립 */
export const boardWritePath = (slug: string) => `/boards/${slug}/write`

/** 게시글 상세 경로 조립 */
export const boardPostPath = (slug: string, postId: string) =>
    `/boards/${slug}/${postId}`

/** 게시글 수정 경로 조립 */
export const boardPostEditPath = (slug: string, postId: string) =>
    `/boards/${slug}/${postId}/edit`
