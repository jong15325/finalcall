import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { useLocation } from 'react-router'
import { renderWithProviders } from '@/test/renderWithProviders'
import ShopCard from './ShopCard'
import type { ShopSummary } from '@/lib/api/shop'

/** 현재 경로를 노출해 내비게이션 유무를 단언한다. */
function LocationProbe() {
    const location = useLocation()
    return <div data-testid="location">{location.pathname}</div>
}

const NOW = Date.parse('2026-07-23T00:00:00Z')

const baseShop: ShopSummary = {
    shopPublicId: '01JMARKET0001',
    status: 'ACTIVE',
    item: {
        typeCode: 1121,
        mainCategory: 1,
        subGroup: 1,
        element: 2,
        kind: 1,
        level: 3,
        skill1: 11,
        skill2: 202,
        skill1Name: '공격시간 3 감소',
        skill2Name: '트리플샷',
        skillPercent: 33,
        goldforceExpireAt: null,
        nameSnapshot: '불의 전투도끼',
        specSnapshot: '공격력이 높은 한손 도끼',
    },
    price: 2_480_000,
    endAt: '2026-07-30T00:00:00Z',
    sellerNickname: '신뢰상점',
}

describe('<ShopCard>', () => {
    it('상세 링크와 플립·비교 버튼을 중첩하지 않는다', () => {
        const { container } = renderWithProviders(
            <ShopCard shop={baseShop} now={NOW} />,
        )
        const link = screen.getByRole('link', {
            name: '불의 전투도끼 상세 보기',
        })
        expect(link).toHaveAttribute('href', '/market/01JMARKET0001')
        expect(link.querySelector('button')).toBeNull()
        expect(container.querySelectorAll('button')).toHaveLength(2)
    })

    it('비교 버튼 클릭은 상세 페이지로 이동시키지 않는다(확정 UX)', () => {
        renderWithProviders(
            <>
                <ShopCard shop={baseShop} now={NOW} />
                <LocationProbe />
            </>,
            { route: '/market' },
        )
        expect(screen.getByTestId('location')).toHaveTextContent('/market')

        fireEvent.click(
            screen.getByRole('button', { name: '불의 전투도끼 비교에 담기' }),
        )

        // 담기는 상세 링크와 독립 상위 레이어 — 경로 불변, 상세 링크는 그대로 존재.
        expect(screen.getByTestId('location')).toHaveTextContent('/market')
        expect(
            screen.getByRole('link', { name: '불의 전투도끼 상세 보기' }),
        ).toHaveAttribute('href', '/market/01JMARKET0001')
    })

    it('스킬이 없어도 마켓 이미지 높이 클래스는 유지하고 토글만 생략한다', () => {
        const { container } = renderWithProviders(
            <ShopCard
                shop={{
                    ...baseShop,
                    item: { ...baseShop.item, skill1: null, skill2: null },
                }}
                now={NOW}
            />,
        )
        const flip = container.querySelector('.item-card__skill-flip')
        expect(flip).toHaveClass('is-market')
        expect(flip).not.toHaveClass('is-enabled')
        expect(
            screen.queryByRole('button', {
                name: '불의 전투도끼 스킬 보기',
            }),
        ).not.toBeInTheDocument()
    })
})
