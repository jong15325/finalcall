import { describe, expect, it } from 'vitest'
import {
    AUCTION_SORT_FIELDS,
    AUCTION_SORT_OPTIONS,
    AUCTION_STATUS_OPTIONS,
    DEFAULT_SORT,
    EMPTY_FILTERS,
    activeFilterChipsOf,
    countActiveFilters,
    normalizeFilters,
    parseAuctionFilters,
    toListQuery,
    toSearchParams,
} from './auctionFilters'

/**
 * 경매 목록 필터 정규화 (FC-059).
 *
 * 이 파일이 고정하는 것:
 *  1. **★★ `kind` 는 `subGroup` 없이 서버로 나가지 않는다** — 계약 §4.1 이 "서버는 400 으로
 *     막지 않는다, 다의성 해소는 클라이언트 책임"이라 못 박았으므로 **이 테스트가 유일한 방어**다.
 *  2. **정렬 화이트리스트** — `bidCount` 는 계약에 없다.
 *  3. **계약에 없는 축을 만들지 않았다** — `q`·`mainCategory`·`skill1`·`skill2`.
 *  4. URL ↔ 상태 왕복 무손실.
 */

describe('★★ kind 종속 — 다의성 해소는 클라이언트 책임 (계약 §4.1)', () => {
    it('subGroup 없이 들어온 kind 는 버려진다 — 단독으로는 도끼·방패·일반을 모두 가리킨다', () => {
        const state = normalizeFilters({ subGroup: null, kind: 1 })
        expect(state.kind).toBeNull()
    })

    it('URL 을 손으로 고쳐 kind 만 넣어도 서버 쿼리에 실리지 않는다', () => {
        const state = parseAuctionFilters(new URLSearchParams('kind=1'))
        expect(state.kind).toBeNull()
        expect(toListQuery(state, 24).kind).toBeUndefined()
    })

    it('대분류를 바꾸면 이전 종류가 따라오지 않는다 (무기 검 → 마법)', () => {
        // subGroup=3(마법)에는 kind 3 이 없다 — 성립 불가 조합이라 서버는 빈 결과를 준다.
        const state = normalizeFilters({ subGroup: 3, kind: 3 })
        expect(state.subGroup).toBe(3)
        expect(state.kind).toBeNull()
    })

    it('마법은 kind 1·2 만 허용한다 (§3.3.1 — kind 3·4 는 존재하지 않는다)', () => {
        expect(normalizeFilters({ subGroup: 3, kind: 2 }).kind).toBe(2)
        expect(normalizeFilters({ subGroup: 3, kind: 4 }).kind).toBeNull()
    })

    it('대분류가 맞으면 종류가 살아남는다 (과잉 방어가 아니다)', () => {
        expect(normalizeFilters({ subGroup: 1, kind: 3 }).kind).toBe(3)
        expect(normalizeFilters({ subGroup: 2, kind: 4 }).kind).toBe(4)
    })

    it('★ kind 칩은 대분류를 함께 적는다 — "검"만으로는 어느 대분류인지 알 수 없다', () => {
        const chips = activeFilterChipsOf(
            normalizeFilters({ subGroup: 1, kind: 3 }),
        )
        expect(chips.find((chip) => chip.id === 'kind')?.label).toBe(
            '무기 · 검',
        )
    })

    it('대분류 칩을 해제하면 종류도 함께 풀린다', () => {
        const state = normalizeFilters({ subGroup: 1, kind: 3 })
        const chip = activeFilterChipsOf(state).find(
            (c) => c.id === 'subGroup',
        )!
        const next = normalizeFilters({ ...state, ...chip.patch })
        expect(next.subGroup).toBeNull()
        expect(next.kind).toBeNull()
    })
})

describe('정렬 — 계약 §3 화이트리스트', () => {
    it('★ bidCount 는 화이트리스트에 없다 (인기순 정렬을 만들 수 없다)', () => {
        expect(AUCTION_SORT_FIELDS).not.toContain('bidCount')
        expect(
            AUCTION_SORT_OPTIONS.some((option) =>
                option.value.startsWith('bidCount'),
            ),
        ).toBe(false)
    })

    it('화이트리스트 밖 정렬은 기본값으로 되돌린다', () => {
        expect(normalizeFilters({ sort: 'bidCount,desc' }).sort).toBe(
            DEFAULT_SORT,
        )
        expect(normalizeFilters({ sort: 'nickname,asc' }).sort).toBe(
            DEFAULT_SORT,
        )
    })

    it('선택지의 필드는 전부 화이트리스트 안에 있다', () => {
        for (const option of AUCTION_SORT_OPTIONS) {
            expect(AUCTION_SORT_FIELDS).toContain(option.value.split(',')[0])
        }
    })

    it('정렬은 필터 칩이 아니다 — 항상 하나가 선택돼 있어 "해제"가 없다', () => {
        const state = normalizeFilters({ sort: 'price,desc' })
        expect(activeFilterChipsOf(state)).toHaveLength(0)
        expect(countActiveFilters(state)).toBe(0)
    })
})

describe('★ 계약에 없는 축은 만들지 않았다', () => {
    it('자유문 검색(q·keyword)이 쿼리에 없다 — 계약에 없어 동작하지 않는 컨트롤이 된다', () => {
        const query = toListQuery(EMPTY_FILTERS, 24) as Record<string, unknown>
        expect(query).not.toHaveProperty('q')
        expect(query).not.toHaveProperty('keyword')
        expect(query).not.toHaveProperty('search')
    })

    it('mainCategory 는 값이 1뿐이라 축이 되지 않는다 — 쿼리에 없다', () => {
        const query = toListQuery(EMPTY_FILTERS, 24) as Record<string, unknown>
        expect(query).not.toHaveProperty('mainCategory')
    })

    it('skill1·skill2 는 코드→이름 매핑 API 가 없어 선택지를 만들 수 없다 — 쿼리에 없다', () => {
        const query = toListQuery(EMPTY_FILTERS, 24) as Record<string, unknown>
        expect(query).not.toHaveProperty('skill1')
        expect(query).not.toHaveProperty('skill2')
    })

    it('URL 에 q 가 실려 들어와도 무시된다', () => {
        const state = parseAuctionFilters(new URLSearchParams('q=물의검'))
        expect(state).toEqual(EMPTY_FILTERS)
    })
})

describe('상태 — 기본값이 "전체"가 아니다 (서버 statusScope)', () => {
    it('기본 선택지를 "전체"라고 적지 않는다 — 종료 경매가 빠져 있다', () => {
        const base = AUCTION_STATUS_OPTIONS.find((o) => o.value === '')!
        expect(base.label).not.toBe('전체')
        expect(base.label).toBe('진행 중 · 예약')
    })

    it('상태 미지정이면 쿼리에 status 가 실리지 않는다', () => {
        expect(toListQuery(EMPTY_FILTERS, 24).status).toBeUndefined()
    })

    it('낙찰·유찰은 명시 필터로만 볼 수 있다', () => {
        const state = normalizeFilters({ status: 'SOLD' })
        expect(toListQuery(state, 24).status).toBe('SOLD')
    })
})

describe('값 위생 — 서버에 쓰레기를 보내지 않는다', () => {
    it('숫자가 아닌 값·음수·소수는 버린다', () => {
        const state = parseAuctionFilters(
            new URLSearchParams('minLevel=abc&maxLevel=-3&minPrice=1.5'),
        )
        expect(state.minLevel).toBeNull()
        expect(state.maxLevel).toBeNull()
        expect(state.minPrice).toBeNull()
    })

    it('★ 뒤집힌 범위는 버리지 않고 맞바꾼다 — 빈 결과의 원인이 화면에 안 남기 때문', () => {
        const state = normalizeFilters({ minPrice: 9000, maxPrice: 100 })
        expect(state.minPrice).toBe(100)
        expect(state.maxPrice).toBe(9000)
    })

    it('사전에 없는 속성 코드는 필터로 쓰지 않는다 (선택지가 없다)', () => {
        expect(normalizeFilters({ element: 9 }).element).toBeNull()
        expect(normalizeFilters({ element: 4 }).element).toBe(4)
    })
})

describe('URL 왕복', () => {
    it('기본값은 URL 에 적지 않는다 — 링크가 짧고 고른 것만 보인다', () => {
        expect(toSearchParams(EMPTY_FILTERS).toString()).toBe('')
    })

    it('상태 → URL → 상태 가 손실 없이 돌아온다', () => {
        const state = normalizeFilters({
            subGroup: 2,
            kind: 1,
            element: 3,
            minLevel: 2,
            maxLevel: 8,
            goldforceActive: true,
            minPrice: 1000,
            maxPrice: 50_000,
            status: 'SOLD',
            sort: 'price,desc',
        })
        expect(parseAuctionFilters(toSearchParams(state))).toEqual(state)
    })

    it('goldforceActive 는 켰을 때만 URL 에 실린다', () => {
        expect(toSearchParams(EMPTY_FILTERS).has('goldforceActive')).toBe(false)
        expect(
            toSearchParams(normalizeFilters({ goldforceActive: true })).get(
                'goldforceActive',
            ),
        ).toBe('true')
    })
})

describe('적용 필터 칩', () => {
    it('축마다 하나씩 세고 정렬은 세지 않는다', () => {
        const state = normalizeFilters({
            subGroup: 1,
            kind: 3,
            element: 1,
            minLevel: 5,
            goldforceActive: true,
            sort: 'price,asc',
        })
        expect(countActiveFilters(state)).toBe(5)
    })

    it('한쪽만 넣은 범위도 읽히는 문장이 된다', () => {
        const labels = activeFilterChipsOf(
            normalizeFilters({ minLevel: 5, maxPrice: 3000 }),
        ).map((chip) => chip.label)
        expect(labels).toContain('레벨 5 이상')
        expect(labels).toContain('가격 3000 이하')
    })
})
