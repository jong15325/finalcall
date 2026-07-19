import { ROUTES } from '@/configs/routes.config'

/**
 * 내비 목적지 정본 (FC-057).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **백엔드가 있는 목적지만 싣는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * FC-048 에서 미구현 화면을 내비에 올렸고, 누른 손님은 **빈 화면**을 봤다. 내비는 "여기 뭔가
 * 있다"는 약속이라 못 지키면 신뢰가 깎인다. `backend/src/main/java/com/finalcall/api` 를
 * 직접 확인한 결과(FC-057):
 *
 * | 목적지 | 컨트롤러 | 판정 |
 * |---|---|---|
 * | `/` 홈 | (조합) | **싣는다** |
 * | `/auctions` | `AuctionController` | **싣는다** |
 * | `/sell` | `AuctionController#create` | **싣는다** |
 * | `/me/inventory` | `InventoryController` | **싣는다** |
 * | `/shops` 고정가 | 없음 | **뺀다** |
 * | `/market-prices` 시세 | 없음 | **뺀다** |
 * | `/me/orders` 거래내역 | 없음 | **뺀다** |
 * | `/me/wallet` 충전 | 없음(`ExchangeController` 는 교환만) | **뺀다** |
 *
 * 뺀 경로도 **라우트는 살아 있다**(FC-055 가 등록해둔 자리표시자). 직접 주소를 치면 자리표시자가
 * 뜨고 404 가 아니다 — 내비에서 **광고하지 않을 뿐**이다.
 *
 * ★ **"뺐다가 나중에 넣으면 내비 폭이 바뀐다"에 대한 답 — 배치로 푼다.**
 *   데스크톱 2행 내비는 `justify-between` 으로 폭에 **분배하지 않고** 왼쪽 정렬 + 고정 간격이다.
 *   그래서 항목이 늘어도 **기존 항목의 x 좌표가 그대로**이고 새 항목만 오른쪽 빈자리에 붙는다.
 *   근육 기억이 깨지지 않는다.
 *   모바일 탭바는 반대로 균등 분할이라 개수가 바뀌면 전부 움직인다 → **5칸으로 고정**하고
 *   (§`MOBILE_TAB_DESTINATIONS`) 추후 목적지는 탭을 늘리지 않고 `MY` 안쪽으로 들인다.
 *
 * ★ `sell`·`inventory` 는 로그인 필수지만 **비로그인에게도 보인다.** 누르면 `ProtectedRoute` 가
 *   `?redirectUrl=` 을 달아 로그인으로 보내고 끝나면 되돌아온다(FC-057 복원). 빈 화면이 아니라
 *   **완결되는 흐름**이라 감추지 않는다 — 감추면 손님은 팔 수 있다는 사실 자체를 모른다.
 */

export interface NavDestination {
    key: string
    path: string
    label: string
    /** `true` 면 정확히 일치할 때만 활성(홈 전용 — 아니면 모든 경로에서 활성이 된다) */
    exact?: boolean
}

/** 데스크톱 2행 내비 — 왼쪽 정렬, 항목 추가 시 오른쪽으로만 자란다. */
export const PRIMARY_DESTINATIONS: NavDestination[] = [
    { key: 'home', path: ROUTES.home, label: '홈', exact: true },
    { key: 'auctions', path: ROUTES.auctions, label: '경매' },
    { key: 'sell', path: ROUTES.sell, label: '판매하기' },
    { key: 'inventory', path: ROUTES.inventory, label: '내 아이템' },
]

/**
 * 모바일 하단 탭바 — **5칸 고정.**
 * 데스크톱 4개 + `MY`(계정). `MY` 는 데스크톱에서 우상단 계정 메뉴가 맡는 자리라 중복이 아니다.
 */
export const MOBILE_TAB_DESTINATIONS: NavDestination[] = [
    ...PRIMARY_DESTINATIONS,
    { key: 'account', path: ROUTES.profile, label: 'MY' },
]

/**
 * 현재 경로가 목적지에 해당하는지.
 * 접두사 일치를 쓰되 **경계를 확인**한다 — `/me/inventory-x` 가 `/me/inventory` 로 잡히면 안 된다.
 */
export function isDestinationActive(
    destination: NavDestination,
    pathname: string,
): boolean {
    if (destination.exact) return pathname === destination.path
    if (pathname === destination.path) return true
    return pathname.startsWith(`${destination.path}/`)
}
