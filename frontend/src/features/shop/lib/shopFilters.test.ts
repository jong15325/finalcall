import { describe, expect, it } from 'vitest'
import {
    EMPTY_SHOP_FILTERS,
    SHOP_DEFAULT_SORT,
    SHOP_RELEVANCE_SORT,
    activeShopFilterChipsOf,
    normalizeShopFilters,
    parseShopFilters,
    shopSearchPatch,
    toShopListQuery,
    toShopSearchParams,
} from './shopFilters'

/**
 * 고정가 마켓 필터 정규화 (계약 §3 · §4.1 · §3.3.1) — FC-094 · 검색 FC-108.
 *
 * 고정하는 것: `kind` 는 `subGroup` 종속 / 범위 뒤집힘은 맞바꾼다 / 정렬 화이트리스트 /
 * URL 왕복 / 고정가 정렬엔 `highestBidAmount` 가 없다 / 자유문 `q`·`relevance`(EPIC-SEARCH).
 */

describe('normalizeShopFilters', () => {
    it('subGroup 없는 kind 는 버린다(단독 축 불가, §4.1)', () => {
        const result = normalizeShopFilters({ kind: 3 })
        expect(result.subGroup).toBeNull()
        expect(result.kind).toBeNull()
    })

    it('subGroup 에 없는 kind 조합은 버린다(마법은 kind 1·2뿐)', () => {
        const result = normalizeShopFilters({ subGroup: 3, kind: 4 })
        expect(result.subGroup).toBe(3)
        expect(result.kind).toBeNull()
    })

    it('레벨·가격 범위 뒤집힘은 맞바꾼다(빈 결과 방지)', () => {
        const result = normalizeShopFilters({
            minLevel: 9,
            maxLevel: 3,
            minPrice: 500,
            maxPrice: 100,
        })
        expect([result.minLevel, result.maxLevel]).toEqual([3, 9])
        expect([result.minPrice, result.maxPrice]).toEqual([100, 500])
    })

    it('화이트리스트 밖 정렬은 기본값으로 되돌린다', () => {
        expect(
            normalizeShopFilters({ sort: 'highestBidAmount,desc' }).sort,
        ).toBe(SHOP_DEFAULT_SORT)
        expect(normalizeShopFilters({ sort: 'price,asc' }).sort).toBe(
            'price,asc',
        )
    })
})

describe('toShopListQuery', () => {
    it('null 축은 undefined 로 흘려 쿼리에서 빠지게 한다', () => {
        const query = toShopListQuery(normalizeShopFilters({}), 24)
        expect(query.subGroup).toBeUndefined()
        expect(query.status).toBeUndefined()
        expect(query.size).toBe(24)
        expect(query.sort).toBe(SHOP_DEFAULT_SORT)
    })
})

describe('URL 왕복', () => {
    it('상태 → URL → 상태가 보존된다', () => {
        const state = normalizeShopFilters({
            subGroup: 1,
            kind: 3,
            element: 2,
            minPrice: 1000,
            goldforceActive: true,
            sort: 'price,desc',
        })
        const restored = parseShopFilters(toShopSearchParams(state))
        expect(restored).toEqual(state)
    })

    it('기본 정렬은 URL 에 적지 않는다', () => {
        const params = toShopSearchParams(normalizeShopFilters({}))
        expect(params.has('sort')).toBe(false)
    })
})

describe('자유문 검색 q · 관련도순 relevance — 계약 C1~C3 (EPIC-SEARCH)', () => {
    it('q 가 없으면 쿼리·URL 에서 빠진다', () => {
        expect(toShopListQuery(EMPTY_SHOP_FILTERS, 24).q).toBeUndefined()
        expect(toShopSearchParams(EMPTY_SHOP_FILTERS).has('q')).toBe(false)
    })

    it('2~64자만 통과하고 트림된다(1자·65자는 버림 — C3)', () => {
        expect(normalizeShopFilters({ q: '  물의 검 ' }).q).toBe('물의 검')
        expect(normalizeShopFilters({ q: '불' }).q).toBeNull()
        expect(normalizeShopFilters({ q: 'a'.repeat(65) }).q).toBeNull()
    })

    it('★ q 없이 relevance 정렬은 기본 정렬로 강등된다(무 q relevance 는 서버 400 — C2)', () => {
        expect(normalizeShopFilters({ sort: SHOP_RELEVANCE_SORT }).sort).toBe(
            SHOP_DEFAULT_SORT,
        )
    })

    it('q 있고 정렬 미지정이면 관련도순이 기본이고 URL 에서 생략된다', () => {
        const state = normalizeShopFilters({ q: '불꽃검' })
        expect(state.sort).toBe(SHOP_RELEVANCE_SORT)
        expect(toShopSearchParams(state).has('sort')).toBe(false)
        expect(toShopSearchParams(state).get('q')).toBe('불꽃검')
    })

    it('★ shopSearchPatch — 최초 입력 시 기본 정렬이면 관련도순 승격, 명시 정렬은 보존', () => {
        expect(shopSearchPatch(EMPTY_SHOP_FILTERS, '불꽃검')).toEqual({
            q: '불꽃검',
            sort: SHOP_RELEVANCE_SORT,
        })
        const explicit = normalizeShopFilters({ sort: 'price,asc' })
        expect(shopSearchPatch(explicit, '불꽃검')).toEqual({ q: '불꽃검' })
    })

    it('URL 에 q 를 실어 왕복해도 보존된다', () => {
        const state = normalizeShopFilters({ q: '불꽃검', sort: 'price,desc' })
        expect(parseShopFilters(toShopSearchParams(state))).toEqual(state)
    })
})

describe('activeShopFilterChipsOf', () => {
    it('kind 칩은 대분류를 함께 적는다(다의성 방지)', () => {
        const chips = activeShopFilterChipsOf(
            normalizeShopFilters({ subGroup: 1, kind: 3 }),
        )
        const kindChip = chips.find((chip) => chip.id === 'kind')
        expect(kindChip?.label).toBe('무기 · 검')
    })
})
