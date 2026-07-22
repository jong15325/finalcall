import { describe, expect, it } from 'vitest'
import {
    isShopPurchasable,
    shopRemainingDays,
    shopStatusLabelOf,
} from './shopStatus'

/**
 * 고정가 상태·기한 파생 (계약 §3.2 · shop-spec §2.1) — FC-094.
 *
 * 고정하는 것: 상태 라벨 / 구매 가능 = ACTIVE ∧ 기한 전 / 남은 일수(무기한 null·지남 0).
 */

const NOW = Date.parse('2026-07-22T00:00:00Z')
const future = (days: number) =>
    new Date(NOW + days * 86_400_000).toISOString()
const past = (days: number) => new Date(NOW - days * 86_400_000).toISOString()

describe('shopStatusLabelOf', () => {
    it('상태 코드를 한국어 라벨로', () => {
        expect(shopStatusLabelOf('ACTIVE')).toBe('판매 중')
        expect(shopStatusLabelOf('SOLD')).toBe('판매 완료')
        expect(shopStatusLabelOf('EXPIRED')).toBe('기한 만료')
        expect(shopStatusLabelOf('CANCELLED')).toBe('판매 취소')
    })

    it('미등록 상태는 코드를 노출한다(무음 실패 방지)', () => {
        expect(shopStatusLabelOf('WEIRD')).toBe('WEIRD')
    })
})

describe('isShopPurchasable', () => {
    it('ACTIVE ∧ 기한 전이면 구매 가능', () => {
        expect(isShopPurchasable('ACTIVE', future(3), NOW)).toBe(true)
    })

    it('무기한(endAt null)은 ACTIVE 면 항상 구매 가능', () => {
        expect(isShopPurchasable('ACTIVE', null, NOW)).toBe(true)
    })

    it('기한이 지났으면 구매 불가(만료 워커와 시간축 배타)', () => {
        expect(isShopPurchasable('ACTIVE', past(1), NOW)).toBe(false)
    })

    it('ACTIVE 아니면 구매 불가', () => {
        expect(isShopPurchasable('SOLD', future(3), NOW)).toBe(false)
        expect(isShopPurchasable('EXPIRED', future(3), NOW)).toBe(false)
    })
})

describe('shopRemainingDays', () => {
    it('무기한(null)은 null', () => {
        expect(shopRemainingDays(null, NOW)).toBeNull()
    })

    it('남은 일수를 올림한다', () => {
        expect(shopRemainingDays(future(3), NOW)).toBe(3)
    })

    it('이미 지났으면 0(음수로 새지 않는다)', () => {
        expect(shopRemainingDays(past(2), NOW)).toBe(0)
    })
})
