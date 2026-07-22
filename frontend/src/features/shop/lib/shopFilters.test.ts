import { describe, expect, it } from 'vitest'
import {
    SHOP_DEFAULT_SORT,
    activeShopFilterChipsOf,
    normalizeShopFilters,
    parseShopFilters,
    toShopListQuery,
    toShopSearchParams,
} from './shopFilters'

/**
 * 고정가 마켓 필터 정규화 (계약 §3 · §4.1 · §3.3.1) — FC-094.
 *
 * 고정하는 것: `kind` 는 `subGroup` 종속 / 범위 뒤집힘은 맞바꾼다 / 정렬 화이트리스트 /
 * URL 왕복 / 고정가 정렬엔 `highestBidAmount` 가 없다.
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
        expect(normalizeShopFilters({ sort: 'highestBidAmount,desc' }).sort).toBe(
            SHOP_DEFAULT_SORT,
        )
        expect(normalizeShopFilters({ sort: 'price,asc' }).sort).toBe('price,asc')
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

describe('activeShopFilterChipsOf', () => {
    it('kind 칩은 대분류를 함께 적는다(다의성 방지)', () => {
        const chips = activeShopFilterChipsOf(
            normalizeShopFilters({ subGroup: 1, kind: 3 }),
        )
        const kindChip = chips.find((chip) => chip.id === 'kind')
        expect(kindChip?.label).toBe('무기 · 검')
    })
})
