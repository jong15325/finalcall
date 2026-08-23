import { cardInfoFixture } from '@/test/cardInfoFixture'
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import DeliveredBanner from './DeliveredBanner'
import type { DeliverySummary } from '@/lib/api/deliveries'

/**
 * 게임 도착 배너 — 세션 1회 dismiss(FC-190 디자인 승인).
 *
 * 고정하는 것:
 *  1. 도착이 있으면 아이템명 + 안내를 노출.
 *  2. 닫으면 사라지고, sessionStorage 에 기억돼 재마운트해도 안 뜬다.
 *  3. 도착이 없으면 아무것도 안 그린다.
 */

function applied(id: string, shortName: string): DeliverySummary {
    return {
        deliveryPublicId: id,
        status: 'APPLIED',
        itemInstancePublicId: `INST-${id}`,
        createdAt: '2026-08-05T00:00:00Z',
        appliedAt: '2026-08-05T01:00:00Z',
        item: {
            typeCode: 1123,
            displayName: '호환 표시명',
            level: 3,
            skill1Code: null,
            skill2Code: null,
            skillPercent: 0,
            goldforceExpireAt: null,
            cardInfo: cardInfoFixture({ shortName }),
        },
    }
}

afterEach(() => sessionStorage.clear())

describe('<DeliveredBanner>', () => {
    it('닫기 버튼은 success-soft 배경에 success-ink 포커스 표시를 사용한다', () => {
        render(<DeliveredBanner arrived={[applied('D1', 'Lv.3 불도')]} />)

        expect(screen.getByRole('status')).toHaveClass('bg-success-soft')
        const closeButton = screen.getByRole('button')
        expect(closeButton).toHaveClass(
            'focus-visible:outline',
            'focus-visible:outline-2',
            'focus-visible:outline-offset-2',
            'focus-visible:outline-success-ink',
        )
    })

    it('도착이 없으면 렌더하지 않는다', () => {
        const { container } = render(<DeliveredBanner arrived={[]} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('도착 아이템명을 노출하고, 닫으면 세션에 기억돼 재마운트해도 안 뜬다', () => {
        const arrived = [applied('D1', 'Lv.9 바검')]

        const first = render(<DeliveredBanner arrived={arrived} />)
        expect(screen.getByText('Lv.9 바검')).toBeInTheDocument()
        expect(screen.queryByText('호환 표시명')).not.toBeInTheDocument()

        fireEvent.click(
            screen.getByRole('button', { name: '게임 도착 알림 닫기' }),
        )
        expect(screen.queryByText('Lv.9 바검')).toBeNull()
        first.unmount()

        // 재마운트(다음 방문) — 같은 세션이라 다시 뜨지 않는다.
        const { container } = render(<DeliveredBanner arrived={arrived} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('여러 건은 "외 N건"으로 요약한다', () => {
        render(
            <DeliveredBanner
                arrived={[
                    applied('D1', 'Lv.9 바검'),
                    applied('D2', 'Lv.7 물갑'),
                ]}
            />,
        )
        expect(screen.getByText('Lv.9 바검 외 1건')).toBeInTheDocument()
    })
})
