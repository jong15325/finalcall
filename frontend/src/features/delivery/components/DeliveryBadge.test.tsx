import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DeliveryBadge from './DeliveryBadge'

/**
 * 배송 배지 — 상태 3표현(FC-190).
 *
 * 고정하는 것:
 *  1. 배송 계열은 "배송중"(short)·"게임으로 배송중"(long).
 *  2. APPLIED="게임 도착", FAILED="문제"/"문제 발생 · 문의".
 */
describe('<DeliveryBadge>', () => {
    it('배송중(PENDING/CLAIMED/DEFERRED)은 배송중 라벨', () => {
        for (const s of ['PENDING', 'CLAIMED', 'DEFERRED'] as const) {
            const { unmount } = render(<DeliveryBadge status={s} />)
            expect(screen.getByText('배송중')).toBeInTheDocument()
            unmount()
        }
    })

    it('long 은 긴 라벨을 쓴다', () => {
        render(<DeliveryBadge long status="PENDING" />)
        expect(screen.getByText('게임으로 배송중')).toBeInTheDocument()
    })

    it('APPLIED=게임 도착, FAILED=문제', () => {
        const { unmount } = render(<DeliveryBadge status="APPLIED" />)
        expect(screen.getByText('게임 도착')).toBeInTheDocument()
        unmount()

        render(<DeliveryBadge long status="FAILED" />)
        expect(screen.getByText('문제 발생 · 문의')).toBeInTheDocument()
    })
})
