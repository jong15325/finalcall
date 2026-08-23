import {
    useInfiniteQuery,
    useMutation,
    useQueries,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import {
    cancelShop,
    createShop,
    getMyShops,
    getShop,
    getShops,
    purchaseShop,
} from '@/lib/api/shop'
import { balanceKeys } from './balance'
import { inventoryKeys } from './inventory'
import { orderKeys } from './orders'
import { tempStorageKeys } from './tempStorage'
import { useCardInfoExpiry } from './cardInfoExpiry'
import { useIsAuthenticated } from '@/store/authStore'
import type {
    CancelShopResponse,
    CreateShopRequest,
    CreateShopResponse,
    MyShopSummary,
    MyShopsQuery,
    PurchaseShopResponse,
    ShopDetail,
    ShopListQuery,
    ShopSummary,
} from '@/lib/api/shop'
import type { CursorPage } from '@/types/api'

/**
 * 고정가 마켓 쿼리 (계약 §3.2) — FC-094.
 *
 * ★ **경매 쿼리 키 구조를 그대로 계승**(`auctions.ts` 주). `browse`(목록)·`detail`(상세)를 형제로
 *   갈라, 목록 무효화가 상세를 딸려 치지 않게 한다. 홈 프리뷰(`preview`)는 고정가에 아직 없으므로
 *   두지 않는다(만들면 죽은 키다 — 필요할 때 추가).
 */
export const shopKeys = {
    all: ['shops'] as const,
    /** 마켓 목록 화면(사용자 필터 · 커서 페이징) */
    browses: () => [...shopKeys.all, 'browse'] as const,
    browse: (query: ShopListQuery) => [...shopKeys.browses(), query] as const,
    /** 고정가 상세(비교표가 재사용) */
    details: () => [...shopKeys.all, 'detail'] as const,
    detail: (shopPublicId: string) =>
        [...shopKeys.details(), shopPublicId] as const,
    /** 내 판매 목록(마이페이지 '내 판매' — 공개 `browse` 와 형제로 분리) */
    mines: () => [...shopKeys.all, 'mine'] as const,
    mine: (query: MyShopsQuery) => [...shopKeys.mines(), query] as const,
}

/**
 * 마켓 목록 화면용 커서 무한스크롤 (계약 §1.3 — 실시간 목록은 cursor 기본).
 *
 * ★★ **정렬·필터가 바뀌면 커서가 초기화된다 — 코드 한 줄 없이**(`useAuctionBrowse` 와 동일 구조).
 *   `query` 가 키에 통째로 실리므로 필터를 바꾸면 다른 쿼리가 되고, 새 키는 커서 없이 시작한다.
 * ★ `cursor` 는 `query` 에 넣지 않는다 — 페이지 파라미터는 react-query 가 따로 나른다.
 */
export function useShopBrowse(query: ShopListQuery) {
    const result = useInfiniteQuery<CursorPage<ShopSummary>>({
        queryKey: shopKeys.browse(query),
        queryFn: ({ pageParam, signal }) =>
            getShops(
                { ...query, cursor: (pageParam as string | null) ?? undefined },
                signal,
            ),
        initialPageParam: null,
        /*
         * ★ `hasNext` 와 `nextCursor` 를 **둘 다** 본다(계약 §1.3) — `hasNext=true` 인데 커서가
         *   null 로 오면 첫 페이지를 무한히 다시 받는 루프가 된다. 서버 버그를 여기서 끊는다.
         */
        getNextPageParam: (lastPage) =>
            lastPage.hasNext && lastPage.nextCursor
                ? lastPage.nextCursor
                : null,
        refetchOnWindowFocus: false,
    })
    useCardInfoExpiry(shopKeys.browse(query), result.data)
    return result
}

/**
 * 고정가 상세 (계약 §3.3) — 마켓은 별도 상세 화면이 없어(목업 §9 카드→다이얼로그) 주 소비처는
 * **비교표**(`useCompareShops`)다. 폴링하지 않는다(고정가는 실시간 값이 아니다).
 */
export function useShopDetail(shopPublicId: string, enabled = true) {
    const query = useQuery<ShopDetail>({
        queryKey: shopKeys.detail(shopPublicId),
        queryFn: ({ signal }) => getShop(shopPublicId, signal),
        enabled,
        refetchOnWindowFocus: false,
    })
    useCardInfoExpiry(shopKeys.detail(shopPublicId), query.data)
    return query
}

/**
 * 비교 대상 고정가 상세 묶음 (FC-094 — 경매·고정가 혼합 비교).
 *
 * ★ 비교 스토어는 참조(source·listingId)만 갖고 표시 데이터는 여기서 `GET /shops/{id}` 로 되받는다
 *   — 상세 캐시(`shopKeys.detail`) 재사용. **가변 개수라 `useQueries`**(경매 `useCompareAuctions` 대칭).
 */
export function useCompareShops(ids: string[]) {
    const queries = useQueries({
        queries: ids.map((id) => ({
            queryKey: shopKeys.detail(id),
            queryFn: ({ signal }: { signal: AbortSignal }) =>
                getShop(id, signal),
            refetchOnWindowFocus: false,
        })),
    })
    useCardInfoExpiry(
        shopKeys.details(),
        queries.map(({ data }) => data),
        false,
    )
    return queries
}

/**
 * 고정가 구매 (계약 §3.2 `POST /shops/{id}/purchase`) — FC-094.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **무효화 반경 = `usePurchaseAuction` 과 동일하다** — 즉시구매와 같은 리소스를 바꾼다.
 * ══════════════════════════════════════════════════════════════════════════════
 * 성립 시 (1) 리스팅이 `SOLD` 로 종료 → **목록** 재조회, (2) 구매자 게임머니 **직접 차감** →
 * **잔액**, (3) 아이템이 구매자 인벤토리(만실 시 **임시보관**)로 이전 → **인벤토리·임시보관**,
 * (4) 새 주문 생성 → **거래내역 목록**. 하나라도 빼면 화면이 방금 일어난 거래를 반영하지 못한다
 * (shop-spec §4.1·§4.2). 상세도 무효화한다(비교표가 그 캐시를 쓴다).
 */
export function usePurchaseShop(shopPublicId: string) {
    const queryClient = useQueryClient()

    return useMutation<PurchaseShopResponse, Error, void>({
        mutationFn: () => purchaseShop(shopPublicId),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: shopKeys.detail(shopPublicId),
            })
            void queryClient.invalidateQueries({
                queryKey: shopKeys.browses(),
            })
            void queryClient.invalidateQueries({ queryKey: balanceKeys.me() })
            void queryClient.invalidateQueries({ queryKey: inventoryKeys.me() })
            void queryClient.invalidateQueries({
                queryKey: tempStorageKeys.me(),
            })
            void queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
        },
    })
}

/**
 * 고정가 등록 (계약 §3.2 `POST /shops`) — FC-094.
 *
 * ★ 성공하면 아이템이 **인벤토리→출품 에스크로(LISTED)로 CAS 이동**한다(shop-spec §3). 그래서
 *   무효화 반경 = **인벤토리**(방금 출품한 아이템이 목록에서 빠져야 재선택 착시가 없다) +
 *   **마켓 목록(`browses`)**(새 리스팅이 목록에 등장). 잔액은 건드리지 않는다 — 등록은 홀드가 없다.
 * ★ 실패(`SHOP_001`·`SHOP_002`)는 호출부가 `error` 로 받아 문구를 낸다(`shopErrors.ts`).
 */
export function useCreateShop() {
    const queryClient = useQueryClient()

    return useMutation<CreateShopResponse, Error, CreateShopRequest>({
        mutationFn: (body) => createShop(body),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: inventoryKeys.me(),
            })
            void queryClient.invalidateQueries({
                queryKey: shopKeys.browses(),
            })
        },
    })
}

/**
 * 내 판매 목록 커서 무한스크롤 (계약 §3.2 `GET /me/shops`) — FC-096.
 *
 * ★★ **필터(status)가 바뀌면 커서가 초기화된다 — 코드 한 줄 없이**(`useShopBrowse` 와 동일 구조).
 *   `query` 가 키에 통째로 실리므로 다른 필터는 다른 쿼리가 되고 새 키는 커서 없이 시작한다.
 * ★ `enabled: isAuthed` — 마이페이지는 보호 라우트지만, 세션 만료 직후 401 이 refresh 회전을
 *   불필요하게 깨우지 않도록 가드를 둔다(`useMyInventory` 와 같은 태도).
 * ★ `hasNext`·`nextCursor` 를 **둘 다** 본다 — 서버가 hasNext=true 인데 커서를 null 로 주면 첫
 *   페이지 무한 재요청 루프가 되므로 여기서 끊는다(공개 목록과 동일).
 */
export function useMyShops(query: MyShopsQuery) {
    const isAuthed = useIsAuthenticated()

    const result = useInfiniteQuery<CursorPage<MyShopSummary>>({
        queryKey: shopKeys.mine(query),
        queryFn: ({ pageParam, signal }) =>
            getMyShops(
                { ...query, cursor: (pageParam as string | null) ?? undefined },
                signal,
            ),
        initialPageParam: null,
        getNextPageParam: (lastPage) =>
            lastPage.hasNext && lastPage.nextCursor
                ? lastPage.nextCursor
                : null,
        enabled: isAuthed,
        refetchOnWindowFocus: false,
    })
    useCardInfoExpiry(shopKeys.mine(query), result.data)
    return result
}

/**
 * 판매 내리기(취소) (계약 §3.2 `POST /shops/{id}/cancel`) — FC-096.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **무효화 반경 = 내 리스팅 · 인벤토리 · 임시보관 · 공개 마켓 목록.** 취소가 성립하면
 *    (1) 리스팅이 CANCELLED 로 내 판매에서 빠지고, (2) 아이템이 인벤토리(만실 시 임시보관)로
 *    회수되며, (3) 공개 마켓에서도 사라진다(shop-spec §4.3). 하나라도 빼면 화면이 방금 내린
 *    상품을 그대로 보여준다. 잔액은 건드리지 않는다 — 취소는 금전 이동이 없다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ★ `mutate(shopPublicId)` — 리스트의 여러 카드가 한 훅을 공유하고 대상은 변이 변수로 넘긴다.
 */
export function useCancelShop() {
    const queryClient = useQueryClient()

    return useMutation<CancelShopResponse, Error, string>({
        mutationFn: (shopPublicId) => cancelShop(shopPublicId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: shopKeys.mines() })
            void queryClient.invalidateQueries({
                queryKey: inventoryKeys.me(),
            })
            void queryClient.invalidateQueries({
                queryKey: tempStorageKeys.me(),
            })
            void queryClient.invalidateQueries({
                queryKey: shopKeys.browses(),
            })
        },
    })
}
