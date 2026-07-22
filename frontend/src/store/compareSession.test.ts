import { beforeEach, describe, expect, it } from 'vitest'
import {
    COMPARE_STORAGE_KEY,
    loadCompareSelection,
    MAX_COMPARE_ITEMS,
    saveCompareSelection,
} from './compareSession'
import type { CompareReference } from './compareSession'

/**
 * 비교 세션 어댑터 (FC-079 → FC-094 에서 MARKET 출처 허용).
 *
 * 고정하는 것: 참조만 저장·복원한다 / 경매·고정가 두 출처를 유지하고 미지의 출처·오염 참조는
 * 걸러진다 / 최대 3개 / 파싱 실패는 빈 배열.
 */

const ref = (listingId: string): CompareReference => ({
    source: 'AUCTION',
    listingId,
})

describe('compareSession', () => {
    beforeEach(() => sessionStorage.clear())

    it('저장한 참조를 그대로 복원한다(세션 지속)', () => {
        saveCompareSelection([ref('a'), ref('b')])
        expect(loadCompareSelection()).toEqual([ref('a'), ref('b')])
    })

    it('목업과 동일한 키에 배열로 쓴다', () => {
        saveCompareSelection([ref('a')])
        const raw = sessionStorage.getItem(COMPARE_STORAGE_KEY)
        expect(JSON.parse(raw as string)).toEqual([
            { source: 'AUCTION', listingId: 'a' },
        ])
    })

    it('경매·고정가 두 출처를 유지한다(FC-094 혼합 비교)', () => {
        sessionStorage.setItem(
            COMPARE_STORAGE_KEY,
            JSON.stringify([
                { source: 'MARKET', listingId: 'm1' },
                { source: 'AUCTION', listingId: 'a1' },
            ]),
        )
        expect(loadCompareSelection()).toEqual([
            { source: 'MARKET', listingId: 'm1' },
            { source: 'AUCTION', listingId: 'a1' },
        ])
    })

    it('미지의 출처·오염 참조는 걸러진다', () => {
        sessionStorage.setItem(
            COMPARE_STORAGE_KEY,
            JSON.stringify([
                { source: 'UNKNOWN', listingId: 'x1' },
                { listingId: 'noSource' },
                { source: 'AUCTION', listingId: 'a1' },
            ]),
        )
        expect(loadCompareSelection()).toEqual([ref('a1')])
    })

    it('중복 listingId 는 첫 항목만 남긴다', () => {
        sessionStorage.setItem(
            COMPARE_STORAGE_KEY,
            JSON.stringify([ref('a'), ref('a'), ref('b')]),
        )
        expect(loadCompareSelection()).toEqual([ref('a'), ref('b')])
    })

    it(`최대 ${MAX_COMPARE_ITEMS}개로 자른다`, () => {
        saveCompareSelection([ref('a'), ref('b'), ref('c'), ref('d')])
        expect(loadCompareSelection()).toHaveLength(MAX_COMPARE_ITEMS)
    })

    it('파싱 불가·비배열은 빈 배열로 흘린다(화면을 막지 않는다)', () => {
        sessionStorage.setItem(COMPARE_STORAGE_KEY, '{ not json')
        expect(loadCompareSelection()).toEqual([])
        sessionStorage.setItem(COMPARE_STORAGE_KEY, '{"a":1}')
        expect(loadCompareSelection()).toEqual([])
    })
})
