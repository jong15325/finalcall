import { describe, expect, it } from 'vitest'
import {
    deliveryBadgeStyleOf,
    deliveryBucketOf,
    isArrived,
    isFailed,
    isShipping,
} from './deliveryView'

/**
 * 배송 상태 3버킷 매핑(FC-190 · 디자인 승인 통일).
 *
 * 고정하는 것:
 *  1. PENDING/CLAIMED/DEFERRED → SHIPPING(배송중, 세분 없음).
 *  2. APPLIED → ARRIVED(게임 도착), FAILED → FAILED(문제).
 *  3. 미등록 상태 → SHIPPING 보수 폴백(재판매 잠금 유지).
 */
describe('deliveryView', () => {
    it('배송 계열 3값을 SHIPPING 하나로 통일한다', () => {
        for (const s of ['PENDING', 'CLAIMED', 'DEFERRED'] as const) {
            expect(deliveryBucketOf(s)).toBe('SHIPPING')
            expect(isShipping(s)).toBe(true)
            expect(isArrived(s)).toBe(false)
            expect(isFailed(s)).toBe(false)
        }
    })

    it('APPLIED=ARRIVED, FAILED=FAILED', () => {
        expect(deliveryBucketOf('APPLIED')).toBe('ARRIVED')
        expect(isArrived('APPLIED')).toBe(true)
        expect(deliveryBucketOf('FAILED')).toBe('FAILED')
        expect(isFailed('FAILED')).toBe(true)
    })

    it('미등록 상태값은 SHIPPING 으로 보수 폴백한다(재판매 잠금 유지)', () => {
        expect(deliveryBucketOf('SOMETHING_NEW')).toBe('SHIPPING')
        expect(isShipping('SOMETHING_NEW')).toBe(true)
    })

    it('배지 스타일은 버킷별 라벨·팔레트 클래스를 준다', () => {
        expect(deliveryBadgeStyleOf('PENDING').shortLabel).toBe('배송중')
        expect(deliveryBadgeStyleOf('PENDING').longLabel).toBe(
            '게임으로 배송중',
        )
        expect(deliveryBadgeStyleOf('APPLIED').shortLabel).toBe('게임 도착')
        expect(deliveryBadgeStyleOf('FAILED').badgeClass).toContain('danger')
        expect(deliveryBadgeStyleOf('PENDING').badgeClass).toContain(
            'control-action',
        )
        expect(deliveryBadgeStyleOf('APPLIED').badgeClass).toContain('success')
    })
})
