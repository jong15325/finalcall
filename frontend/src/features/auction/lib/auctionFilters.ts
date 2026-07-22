import { ELEMENT_CODES, elementLabelOf } from '@/features/item/lib/element'
import {
    SUB_GROUPS,
    kindsOf,
    subGroupLabelOf,
} from '@/features/item/lib/itemCode'
import type { AuctionListQuery } from '@/lib/api/auctions'

/**
 * 경매 목록 필터 상태 (계약 §3 공통 목록 필터 · §4.1 · v1.10 §3.3.1) — FC-059.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **`kind` 는 `subGroup` 없이는 존재할 수 없다 — 타입이 아니라 정규화가 강제한다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 계약 §4.1 이 명문화한다: *"`kind=1` 은 무기의 도끼와 방어구의 방패와 마법의 일반을
 * **모두** 반환한다. 서버는 이를 400 으로 막지 않고 요청대로 처리한다 —
 * **다의성 해소는 클라이언트 책임**이다."*
 *
 * 그래서 이 모듈은 **한 곳(`normalizeFilters`)에서 세 가지를 동시에 보장**한다:
 *   ① `subGroup` 이 없으면 `kind` 를 **버린다**(단독 축이 될 수 없다)
 *   ② `kind` 가 그 `subGroup` 의 종류 표에 없으면 **버린다**
 *      (마법은 `kind` 1·2 뿐 — `subGroup=3 & kind=4` 는 **성립 불가 조합**이라 서버는
 *       200 + 빈 결과를 준다. 에러가 아니므로 화면은 "결과 없음"만 보이고 사용자는
 *       **왜 없는지 영영 알 수 없다.** 그래서 요청을 보내기 전에 지운다.)
 *   ③ `subGroup` 이 바뀌면 `kind` 는 자동으로 ①②에 걸려 떨어진다
 *
 * URL 파싱·화면 조작·API 쿼리 생성이 **전부 이 함수를 통과**하므로, 다의적인 `kind` 가
 * 서버로 나갈 경로가 구조적으로 없다. (검증을 UI 컴포넌트에 두면 URL 직접 입력·뒤로가기로
 * 새어 나간다 — 실제로 링크 공유가 그 경로다.)
 *
 * ★ **URL 파라미터명 = 계약 쿼리명**이다. 링크가 곧 API 요청이라 번역 표가 필요 없고,
 *   공유된 URL 이 무엇을 거르는지 주소창만 봐도 읽힌다.
 */

/** 화면이 다루는 필터 축 전체. */
export interface AuctionFilterState {
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
    /** 미지정이면 서버 `statusScope()` 가 SCHEDULED·ACTIVE 만 노출한다(계약 §3.1) */
    status: string | null
    /**
     * `<field>,<asc|desc>` 또는 `relevance`(관련도순). 화이트리스트 밖이면 기본값으로 되돌린다.
     * `relevance` 는 **`q` 가 있을 때만 유효**하다(계약 C2) — q 가 없으면 기본 정렬로 강등된다.
     */
    sort: string
}

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * 정렬 — 계약 §3 화이트리스트 그대로. **`bidCount` 는 없다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * FC-058 이 "인기순 섹션을 만들 수 없다"로 이미 보고한 사안이다. 목록에서도 같다 —
 * 입찰 수로 정렬하는 선택지를 만들면 서버가 무시하거나 400 을 낸다. 둘 다
 * **동작하지 않는 컨트롤**이다.
 */
export const AUCTION_SORT_FIELDS: readonly string[] = [
    'price',
    'endAt',
    'createdAt',
    'highestBidAmount',
]

export const AUCTION_SORT_OPTIONS: readonly {
    value: string
    label: string
}[] = [
    { value: 'endAt,asc', label: '마감 임박순' },
    { value: 'createdAt,desc', label: '최근 등록순' },
    { value: 'price,asc', label: '가격 낮은순' },
    { value: 'price,desc', label: '가격 높은순' },
    { value: 'highestBidAmount,desc', label: '최고 입찰가순' },
]

export const DEFAULT_SORT = 'endAt,asc'

/*
 * 관련도순(계약 C2 · EPIC-SEARCH) — **`q` 가 있을 때만** 선택지에 노출된다(무 q 시 서버 400).
 * 방향(asc/desc)이 없는 단일 토큰이다(서버는 `_score desc` 로 처리). `AUCTION_SORT_FIELDS`
 * 화이트리스트에는 넣지 않고 `normalizeFilters` 가 별도로 다룬다(q 종속이라 조건이 다르다).
 */
export const RELEVANCE_SORT = 'relevance'

export const RELEVANCE_SORT_OPTION = {
    value: RELEVANCE_SORT,
    label: '관련도순',
} as const

/*
 * 상태 — 계약 §3.1 `AuctionStatus`.
 *
 * ★★ **빈 값이 "전체"가 아니다.** 서버 `statusScope()` 는 status 미지정 시 SCHEDULED·ACTIVE
 *    만 노출한다. 그래서 기본 선택지 라벨을 "전체"라고 적으면 **거짓말**이 된다 —
 *    마감된 경매가 빠져 있는데 사용자는 다 봤다고 믿는다. "진행 중 · 예약"으로 적는다.
 *
 * ★ `CANCELLED` 를 선택지에 두지 않았다 — 판매자가 내린 매물이라 **구매 탐색의 축이 아니다**
 *   (서버는 받아준다. 선택지에서 뺀 것이지 막은 것이 아니며, URL 로 오면 그대로 통과한다).
 */
export const AUCTION_STATUS_OPTIONS: readonly {
    value: string
    label: string
}[] = [
    { value: '', label: '진행 중 · 예약' },
    { value: 'SCHEDULED', label: '예약' },
    { value: 'ACTIVE', label: '진행 중' },
    { value: 'SOLD', label: '낙찰' },
    { value: 'UNSOLD', label: '유찰' },
]

export const EMPTY_FILTERS: AuctionFilterState = {
    q: null,
    subGroup: null,
    kind: null,
    element: null,
    minLevel: null,
    maxLevel: null,
    goldforceActive: false,
    minPrice: null,
    maxPrice: null,
    status: null,
    sort: DEFAULT_SORT,
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

/** 선택지 목록에 있는 코드만 통과. 미등록 코드는 필터로 쓰지 않는다(선택지가 없으니까). */
function pickCode(
    raw: string | number | null | undefined,
    allowed: readonly number[],
): number | null {
    const value = toPositiveInt(raw)
    return value !== null && allowed.includes(value) ? value : null
}

/**
 * ★★ **모든 필터 변경이 반드시 여기를 지난다.** URL 파싱도, 칩 클릭도, 초기화도.
 *
 * `kind` 의존성(위 ★★)에 더해 **범위 뒤집힘도 여기서 바로잡는다** — 최소 > 최대면
 * 서버는 조건을 만족하는 행이 없어 **빈 결과**를 준다. 그것도 에러가 아니라
 * "결과 없음"으로만 보이므로 사용자가 원인을 알 수 없다. 값을 버리지 않고 **맞바꾼다**
 * (입력한 두 숫자는 사용자의 의도이고 순서만 뒤집혔을 뿐이다).
 */
export function normalizeFilters(
    raw: Partial<AuctionFilterState>,
): AuctionFilterState {
    const subGroup = pickCode(
        raw.subGroup,
        SUB_GROUPS.map((entry) => entry.code),
    )

    // ★ 종속의 핵심 한 줄 — subGroup 이 null 이면 kindsOf 가 빈 배열이라 kind 는 반드시 null.
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

    const status = raw.status ? String(raw.status) : null

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
        status,
        sort,
    }
}

/**
 * 정렬 정규화 — 계약 C2 의 `relevance`·`q` 종속을 한곳에서 강제한다.
 *  - `relevance` 는 **q 있을 때만** 유효(없으면 기본 정렬로 강등 → 무 q + relevance 400 원천 차단).
 *  - 화이트리스트(field) 밖·미지정이면 기본값. 단 **q 있고 미지정이면 관련도순이 기본**이다.
 */
function normalizeSort(raw: string | undefined | null, hasQ: boolean): string {
    const field = raw ? String(raw).split(',')[0] : ''
    if (field === RELEVANCE_SORT) return hasQ ? RELEVANCE_SORT : DEFAULT_SORT
    if (AUCTION_SORT_FIELDS.includes(field)) return String(raw)
    return hasQ ? RELEVANCE_SORT : DEFAULT_SORT
}

/** URL → 상태. 정규화를 거치므로 **손으로 고친 주소도 안전하다**(위 ★★ ③). */
export function parseAuctionFilters(
    params: URLSearchParams,
): AuctionFilterState {
    return normalizeFilters({
        q: params.get('q'),
        subGroup: params.get('subGroup'),
        kind: params.get('kind'),
        element: params.get('element'),
        minLevel: params.get('minLevel'),
        maxLevel: params.get('maxLevel'),
        goldforceActive: params.get('goldforceActive') === 'true',
        minPrice: params.get('minPrice'),
        maxPrice: params.get('maxPrice'),
        status: params.get('status'),
        sort: params.get('sort'),
    } as Partial<AuctionFilterState>)
}

/**
 * 상태 → URL. **기본값은 적지 않는다** — 주소창에 `sort=endAt,asc&goldforceActive=false`
 * 가 늘 붙어 있으면 링크가 길어지고, 무엇을 실제로 고른 것인지 눈으로 구분되지 않는다.
 */
export function toSearchParams(state: AuctionFilterState): URLSearchParams {
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
    put('status', state.status)
    // ★ 기본 정렬은 q 여부에 따라 다르다(계약 C2) — q 있으면 relevance 가 기본이라 URL 에서 생략.
    const defaultSort = state.q !== null ? RELEVANCE_SORT : DEFAULT_SORT
    if (state.sort !== defaultSort) params.set('sort', state.sort)

    return params
}

/**
 * 상태 → API 쿼리(계약 §3.1 `GET /auctions`).
 *
 * ★ `null` 은 `apiClient` 가 쿼리스트링에서 **빼준다**(`lib/api/client.ts`). 그래서
 *   "값 없음"을 빈 문자열로 보내 서버에 `status=` 같은 빈 조건이 가는 사고가 없다.
 * ★ `cursor` 는 여기서 넣지 않는다 — 페이지 파라미터는 `useInfiniteQuery` 소관이고,
 *   **쿼리 키의 안정성**을 위해 필터 쿼리와 커서를 섞지 않는다(섞으면 커서가 바뀔 때마다
 *   새 키가 생겨 무한스크롤이 캐시를 잃는다).
 */
export function toListQuery(
    state: AuctionFilterState,
    size: number,
): AuctionListQuery {
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
        status: state.status ?? undefined,
        sort: state.sort,
        size,
    }
}

/**
 * 검색어 입력 → 필터 patch (계약 C2 기본 정렬).
 *
 * ★ 검색어를 **새로 넣을 때** 정렬이 기본값이면 관련도순으로 승격한다 — 명시 정렬(가격·마감 등)은
 *   보존한다. 지울 때(빈 문자열)는 `q=null` 만 넘기고, relevance→기본 강등은 `normalizeFilters`
 *   가 처리한다. URL 직접 진입(`?q=...` sort 생략)도 정규화가 같은 결과(관련도순)를 만든다.
 */
export function searchPatch(
    state: AuctionFilterState,
    q: string,
): Partial<AuctionFilterState> {
    const next = q.trim().length >= 2 ? q.trim() : null
    const promote =
        next !== null && state.q === null && state.sort === DEFAULT_SORT
    return promote ? { q: next, sort: RELEVANCE_SORT } : { q: next }
}

/** 적용된 필터 칩 하나. `patch` 를 적용하면 그 축만 풀린다(정규화가 뒤처리를 한다). */
export interface ActiveFilterChip {
    id: string
    label: string
    patch: Partial<AuctionFilterState>
}

/**
 * 적용된 필터를 글자로 되돌려 준다.
 *
 * ★★ **`kind` 칩은 대분류를 함께 적는다** — "검"이 아니라 **"무기 · 검"**.
 *    칩에 "검"만 있으면 화면 어디에도 그 종류가 어느 대분류의 것인지 남지 않아
 *    §4.1 이 경고한 다의성이 **UI 표면에서** 되살아난다.
 *
 * ★ 정렬은 칩이 아니다 — 항상 하나가 선택돼 있어 "해제"라는 동작이 없다.
 */
export function activeFilterChipsOf(
    state: AuctionFilterState,
): ActiveFilterChip[] {
    const chips: ActiveFilterChip[] = []

    if (state.subGroup !== null) {
        chips.push({
            id: 'subGroup',
            label: subGroupLabelOf(state.subGroup),
            // 대분류를 풀면 kind 도 함께 떨어진다(normalizeFilters ①).
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
    if (state.status !== null) {
        const label =
            AUCTION_STATUS_OPTIONS.find(
                (option) => option.value === state.status,
            )?.label ?? state.status
        chips.push({ id: 'status', label, patch: { status: null } })
    }

    return chips
}

/** "3 이상" · "9 이하" · "3~9" — 한쪽만 넣은 경우를 "3~" 처럼 흘리지 않는다. */
function rangeLabel(min: number | null, max: number | null): string {
    if (min !== null && max !== null) return `${min}~${max}`
    if (min !== null) return `${min} 이상`
    return `${max} 이하`
}

/** 필터 버튼 옆 숫자. **정렬은 세지 않는다**(항상 값이 있으므로 늘 1이 더해진다). */
export function countActiveFilters(state: AuctionFilterState): number {
    return activeFilterChipsOf(state).length
}
