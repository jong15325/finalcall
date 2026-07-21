import { beforeEach, describe, expect, it } from 'vitest'
import { COMPARE_STORAGE_KEY, MAX_COMPARE_ITEMS } from './compareSession'
import { useCompareStore } from './compareStore'
import type { CompareReference } from './compareSession'

/**
 * 비교 선택 스토어 (FC-079 — 선택 상태 소유자).
 *
 * 고정하는 것: 토글 add/remove / 최대 3(4번째 무시) / remove·clear / 변경이 세션에 지속.
 */

const ref = (listingId: string): CompareReference => ({
    source: 'AUCTION',
    listingId,
})

const store = () => useCompareStore.getState()
const idsOf = () => store().items.map((item) => item.listingId)

beforeEach(() => {
    sessionStorage.clear()
    // 모듈 싱글턴이라 테스트 간 상태를 초기화한다.
    useCompareStore.setState({ items: [] })
})

describe('compareStore', () => {
    it('토글로 담고, 다시 토글하면 뺀다', () => {
        store().toggle(ref('a'))
        expect(idsOf()).toEqual(['a'])

        store().toggle(ref('a'))
        expect(idsOf()).toEqual([])
    })

    it('최대 3개 — 4번째 담기는 무시된다', () => {
        for (const id of ['a', 'b', 'c', 'd']) store().toggle(ref(id))
        expect(idsOf()).toEqual(['a', 'b', 'c'])
        expect(store().items).toHaveLength(MAX_COMPARE_ITEMS)
    })

    it('가득 찬 상태에서도 담긴 항목은 토글로 뺄 수 있다', () => {
        for (const id of ['a', 'b', 'c']) store().toggle(ref(id))
        store().toggle(ref('b')) // 이미 담김 → 제거
        expect(idsOf()).toEqual(['a', 'c'])
    })

    it('remove 는 listingId 로 뺀다', () => {
        for (const id of ['a', 'b']) store().toggle(ref(id))
        store().remove('a')
        expect(idsOf()).toEqual(['b'])
    })

    it('clear 는 전체를 해제한다', () => {
        for (const id of ['a', 'b']) store().toggle(ref(id))
        store().clear()
        expect(idsOf()).toEqual([])
    })

    it('변경은 세션에 지속된다', () => {
        store().toggle(ref('a'))
        const raw = sessionStorage.getItem(COMPARE_STORAGE_KEY)
        expect(JSON.parse(raw as string)).toEqual([
            { source: 'AUCTION', listingId: 'a' },
        ])

        store().clear()
        expect(
            JSON.parse(sessionStorage.getItem(COMPARE_STORAGE_KEY) as string),
        ).toEqual([])
    })
})
