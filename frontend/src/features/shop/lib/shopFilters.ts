import { ELEMENT_CODES, elementLabelOf } from '@/features/item/lib/element'
import {
    SUB_GROUPS,
    kindsOf,
    subGroupLabelOf,
} from '@/features/item/lib/itemCode'
import type { ShopListQuery } from '@/lib/api/shop'

/**
 * 고정가 마켓 필터 상태 (계약 §3 공통 목록 필터 · §4.1 · §3.3.1) — FC-094.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **경매 필터(`auctionFilters`)의 구조를 그대로 계승하되 두 가지가 다르다.**
 * ══════════════════════════════════════════════════════════════════════════════
 *   ① **정렬 화이트리스트가 다르다** — 고정가엔 입찰이 없어 `highestBidAmount` 정렬이 없다(§3).
 *      `price·endAt·createdAt` 만이다.
 *   ② **상태(status) 축을 UI 에 두지 않는다** — 마켓은 구매 탐색면이라 판매 중(ACTIVE)만 보이면
 *      충분하다(SOLD·EXPIRED·CANCELLED 는 탐색 대상이 아니다). 서버 기본이 판매 중을 노출하므로
 *      status 를 굳이 필터로 열지 않는다(경매가 `mainCategory` 를 뺀 것과 같은 판단).
 *
 * `kind` 종속(§4.1 다의성)·범위 뒤집힘 정규화는 경매와 동일하게 **한 곳(`normalizeShopFilters`)에서**
 * 강제한다. URL 파싱·화면 조작·API 쿼리 생성이 전부 이 함수를 통과하므로 다의적 `kind` 가 서버로
 * 나갈 경로가 구조적으로 없다.
 *
 * ★ **URL 파라미터명 = 계약 쿼리명**이다 — 링크가 곧 API 요청이라 번역 표가 필요 없다.
 */

/** 화면이 다루는 필터 축 전체. */
export interface ShopFilterState {
    /**
     * 자유문 검색어(계약 §3 C1 · EPIC-SEARCH). 없으면 null. 트림 후 2~64자만 유효하고
     * (계약 C3) 그 밖은 정규화가 null 로 만든다. `q` 는 코드 축 필터와 AND 결합된다.
     */
    q: string | null
    /** 대분류(§3.3.1). `kind` 의 의미를 결정한다 */
    subGroup: number | null
    /** 종류. **`subGroup` 종속** — 단독으로는 null 로 정규화된다 */
    kind: number | null
    element: number | null
    minLevel: number | null
    maxLevel: number | null
    goldforceActive: boolean
    minPrice: number | null
    maxPrice: number | null
    /**
     * `<field>,<asc|desc>` 또는 `relevance`(관련도순). 화이트리스트 밖이면 기본값으로 되돌린다.
     * `relevance` 는 **`q` 가 있을 때만 유효**하다(계약 C2) — q 가 없으면 기본 정렬로 강등된다.
     */
    sort: string
}

/** 정렬 — 계약 §3 고정가 화이트리스트(`price·endAt·createdAt`). **입찰가 정렬 없음.** */
export const SHOP_SORT_FIELDS: readonly string[] = [
    'price',
    'endAt',
    'createdAt',
]

export const SHOP_SORT_OPTIONS: readonly { value: string; label: string }[] = [
    { value: 'createdAt,desc', label: '최근 등록순' },
    { value: 'price,asc', label: '가격 낮은순' },
    { value: 'price,desc', label: '가격 높은순' },
    { value: 'endAt,asc', label: '마감 임박순' },
]

export const SHOP_DEFAULT_SORT = 'createdAt,desc'

/*
 * 관련도순(계약 C2 · EPIC-SEARCH) — **`q` 가 있을 때만** 선택지에 노출된다(무 q 시 서버 400).
 * 방향이 없는 단일 토큰이다(서버는 `_score desc` 로 처리). 화이트리스트에는 넣지 않고
 * `normalizeShopFilters` 가 별도로 다룬다(q 종속이라 조건이 다르다).
 */
export const SHOP_RELEVANCE_SORT = 'relevance'

export const SHOP_RELEVANCE_SORT_OPTION = {
    value: SHOP_RELEVANCE_SORT,
    label: '관련도순',
} as const

export const EMPTY_SHOP_FILTERS: ShopFilterState = {
    q: null,
    subGroup: null,
    kind: null,
    element: null,
    minLevel: null,
    maxLevel: null,
    goldforceActive: false,
    minPrice: null,
    maxPrice: null,
    sort: SHOP_DEFAULT_SORT,
}

/** 검색어 위생 — 트림 후 2~64자만 통과(계약 C3). 그 밖은 null(검색 안 함). */
function normalizeQ(raw: string | null | undefined): string | null {
    if (raw === null || raw === undefined) return null
    const trimmed = String(raw).trim()
    if (trimmed.length < 2 || trimmed.length > 64) return null
    return trimmed
}

/** 0 이상 정수만 통과. `"abc"`·`-1`·`1.5` 는 전부 null(서버에 쓰레기를 보내지 않는다). */
function toPositiveInt(raw: string | number | null | undefined): number | null {
    if (raw === null || raw === undefined || raw === '') return null
    const value = Number(raw)
    if (!Number.isInteger(value) || value < 0) return null
    return value
}

/** 선택지 목록에 있는 코드만 통과. 미등록 코드는 필터로 쓰지 않는다. */
function pickCode(
    raw: string | number | null | undefined,
    allowed: readonly number[],
): number | null {
    const value = toPositiveInt(raw)
    return value !== null && allowed.includes(value) ? value : null
}

/**
 * ★★ **모든 필터 변경이 반드시 여기를 지난다.** URL 파싱도, 칩 클릭도, 초기화도
 *   (`auctionFilters.normalizeFilters` 와 동일 규율). `kind` 종속 + 범위 뒤집힘을 바로잡는다.
 */
export function normalizeShopFilters(
    raw: Partial<ShopFilterState>,
): ShopFilterState {
    const subGroup = pickCode(
        raw.subGroup,
        SUB_GROUPS.map((entry) => entry.code),
    )

    // ★ 종속의 핵심 — subGroup 이 null 이면 kindsOf 가 빈 배열이라 kind 는 반드시 null.
    const kind =
        subGroup === null
            ? null
            : pickCode(
                  raw.kind,
                  kindsOf(subGroup).map((entry) => entry.code),
              )

    const element = pickCode(
        raw.element,
        ELEMENT_CODES.map((entry) => entry.code),
    )

    let [minLevel, maxLevel] = [
        toPositiveInt(raw.minLevel),
        toPositiveInt(raw.maxLevel),
    ]
    if (minLevel !== null && maxLevel !== null && minLevel > maxLevel) {
        ;[minLevel, maxLevel] = [maxLevel, minLevel]
    }

    let [minPrice, maxPrice] = [
        toPositiveInt(raw.minPrice),
        toPositiveInt(raw.maxPrice),
    ]
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        ;[minPrice, maxPrice] = [maxPrice, minPrice]
    }

    const q = normalizeQ(raw.q)
    const sort = normalizeSort(raw.sort, q !== null)

    return {
        q,
        subGroup,
        kind,
        element,
        minLevel,
        maxLevel,
        goldforceActive: raw.goldforceActive === true,
        minPrice,
        maxPrice,
        sort,
    }
}

/**
 * 정렬 정규화 — 계약 C2 의 `relevance`·`q` 종속을 한곳에서 강제한다.
 *  - `relevance` 는 **q 있을 때만** 유효(없으면 기본 정렬로 강등 → 무 q + relevance 400 원천 차단).
 *  - 화이트리스트 밖·미지정이면 기본값. 단 **q 있고 미지정이면 관련도순이 기본**이다.
 */
function normalizeSort(raw: string | undefined | null, hasQ: boolean): string {
    const field = raw ? String(raw).split(',')[0] : ''
    if (field === SHOP_RELEVANCE_SORT)
        return hasQ ? SHOP_RELEVANCE_SORT : SHOP_DEFAULT_SORT
    if (SHOP_SORT_FIELDS.includes(field)) return String(raw)
    return hasQ ? SHOP_RELEVANCE_SORT : SHOP_DEFAULT_SORT
}

/** URL → 상태. 정규화를 거치므로 **손으로 고친 주소도 안전하다**. */
export function parseShopFilters(params: URLSearchParams): ShopFilterState {
    return normalizeShopFilters({
        q: params.get('q'),
        subGroup: params.get('subGroup'),
        kind: params.get('kind'),
        element: params.get('element'),
        minLevel: params.get('minLevel'),
        maxLevel: params.get('maxLevel'),
        goldforceActive: params.get('goldforceActive') === 'true',
        minPrice: params.get('minPrice'),
        maxPrice: params.get('maxPrice'),
        sort: params.get('sort'),
    } as Partial<ShopFilterState>)
}

/** 상태 → URL. **기본값은 적지 않는다**(주소창을 깨끗하게 유지). */
export function toShopSearchParams(state: ShopFilterState): URLSearchParams {
    const params = new URLSearchParams()
    const put = (key: string, value: number | string | null) => {
        if (value !== null && value !== '') params.set(key, String(value))
    }

    put('q', state.q)
    put('subGroup', state.subGroup)
    put('kind', state.kind)
    put('element', state.element)
    put('minLevel', state.minLevel)
    put('maxLevel', state.maxLevel)
    if (state.goldforceActive) params.set('goldforceActive', 'true')
    put('minPrice', state.minPrice)
    put('maxPrice', state.maxPrice)
    // ★ 기본 정렬은 q 여부에 따라 다르다(계약 C2) — q 있으면 relevance 가 기본이라 URL 에서 생략.
    const defaultSort =
        state.q !== null ? SHOP_RELEVANCE_SORT : SHOP_DEFAULT_SORT
    if (state.sort !== defaultSort) params.set('sort', state.sort)

    return params
}

/**
 * 상태 → API 쿼리(계약 §3.2 `GET /shops`).
 *
 * ★ `null` 은 `apiClient` 가 쿼리스트링에서 **빼준다**(`lib/api/client.ts`). `cursor` 는 여기서
 *   넣지 않는다 — 페이지 파라미터는 `useInfiniteQuery` 소관이다(쿼리 키 안정성).
 */
export function toShopListQuery(
    state: ShopFilterState,
    size: number,
): ShopListQuery {
    return {
        q: state.q ?? undefined,
        subGroup: state.subGroup ?? undefined,
        kind: state.kind ?? undefined,
        element: state.element ?? undefined,
        minLevel: state.minLevel ?? undefined,
        maxLevel: state.maxLevel ?? undefined,
        goldforceActive: state.goldforceActive ? true : undefined,
        minPrice: state.minPrice ?? undefined,
        maxPrice: state.maxPrice ?? undefined,
        sort: state.sort,
        size,
    }
}

/**
 * 검색어 입력 → 필터 patch (계약 C2 기본 정렬).
 *
 * ★ 검색어를 **새로 넣을 때** 정렬이 기본값이면 관련도순으로 승격한다 — 명시 정렬은 보존한다.
 *   지울 때(빈 문자열)는 `q=null` 만 넘기고, relevance→기본 강등은 `normalizeShopFilters` 가
 *   처리한다(경매 `searchPatch` 와 동형).
 */
export function shopSearchPatch(
    state: ShopFilterState,
    q: string,
): Partial<ShopFilterState> {
    const next = q.trim().length >= 2 ? q.trim() : null
    const promote =
        next !== null && state.q === null && state.sort === SHOP_DEFAULT_SORT
    return promote ? { q: next, sort: SHOP_RELEVANCE_SORT } : { q: next }
}

/** 적용된 필터 칩 하나. `patch` 를 적용하면 그 축만 풀린다(정규화가 뒤처리를 한다). */
export interface ShopFilterChip {
    id: string
    label: string
    patch: Partial<ShopFilterState>
}

/**
 * 적용된 필터를 글자로 되돌려 준다.
 *
 * ★★ **`kind` 칩은 대분류를 함께 적는다** — "검"이 아니라 **"무기 · 검"**(§4.1 다의성이 UI 표면에서
 *    되살아나지 않게, `auctionFilters` 와 동일).
 */
export function activeShopFilterChipsOf(
    state: ShopFilterState,
): ShopFilterChip[] {
    const chips: ShopFilterChip[] = []

    if (state.subGroup !== null) {
        chips.push({
            id: 'subGroup',
            label: subGroupLabelOf(state.subGroup),
            patch: { subGroup: null, kind: null },
        })
    }
    if (state.kind !== null && state.subGroup !== null) {
        const kindLabel =
            kindsOf(state.subGroup).find((entry) => entry.code === state.kind)
                ?.label ?? `종류 ${state.kind}`
        chips.push({
            id: 'kind',
            label: `${subGroupLabelOf(state.subGroup)} · ${kindLabel}`,
            patch: { kind: null },
        })
    }
    if (state.element !== null) {
        chips.push({
            id: 'element',
            label: `${elementLabelOf(state.element)} 속성`,
            patch: { element: null },
        })
    }
    if (state.minLevel !== null || state.maxLevel !== null) {
        chips.push({
            id: 'level',
            label: `레벨 ${rangeLabel(state.minLevel, state.maxLevel)}`,
            patch: { minLevel: null, maxLevel: null },
        })
    }
    if (state.goldforceActive) {
        chips.push({
            id: 'goldforceActive',
            label: '골드포스 적용',
            patch: { goldforceActive: false },
        })
    }
    if (state.minPrice !== null || state.maxPrice !== null) {
        chips.push({
            id: 'price',
            label: `가격 ${rangeLabel(state.minPrice, state.maxPrice)}`,
            patch: { minPrice: null, maxPrice: null },
        })
    }

    return chips
}

/** "3 이상" · "9 이하" · "3~9" — 한쪽만 넣은 경우를 "3~" 처럼 흘리지 않는다. */
function rangeLabel(min: number | null, max: number | null): string {
    if (min !== null && max !== null) return `${min}~${max}`
    if (min !== null) return `${min} 이상`
    return `${max} 이하`
}
