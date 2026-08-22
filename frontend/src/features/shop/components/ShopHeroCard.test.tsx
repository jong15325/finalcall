import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ShopHeroCard from './ShopHeroCard'
import type { ShopDetail } from '@/lib/api/shop'

const NOW = Date.parse('2026-08-15T00:00:00Z')

const baseShop: ShopDetail = {
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
        specSnapshot: '공격력이 높은 양손 도끼',
    },
    price: 2_480_000,
    endAt: '2026-08-22T00:00:00Z',
    sellerNickname: '판매왕',
    sellerCompletedSales: 128,
    createdAt: '2026-08-15T00:00:00Z',
}

function skillRows() {
    return ([1, 2] as const).map(
        (slot) =>
            screen.getByText(`스킬 ${slot}`).closest('div') as HTMLElement,
    )
}

describe('<ShopHeroCard>', () => {
    it('스킬1만 있으면 슬롯2를 대시로 유지한다', () => {
        render(
            <ShopHeroCard
                shop={{
                    ...baseShop,
                    item: {
                        ...baseShop.item,
                        skill2: null,
                        skill2Name: null,
                    },
                }}
                now={NOW}
            />,
        )

        const rows = skillRows()
        expect(rows).toHaveLength(2)
        expect(rows[0]).toHaveTextContent('스킬 1공격시간 3 감소')
        expect(rows[1]).toHaveTextContent('스킬 2-')
        rows.forEach((row) => expect(row).toHaveClass('h-10'))
    })

    it('스킬2만 있으면 슬롯1은 대시, 슬롯2는 값과 확률을 표시한다', () => {
        render(
            <ShopHeroCard
                shop={{
                    ...baseShop,
                    item: {
                        ...baseShop.item,
                        skill1: null,
                        skill1Name: null,
                    },
                }}
                now={NOW}
            />,
        )

        const rows = skillRows()
        expect(rows[0]).toHaveTextContent('스킬 1-')
        expect(rows[1]).toHaveTextContent('스킬 2트리플샷(33%)')
    })

    it('스킬이 없으면 두 슬롯을 모두 대시로 표시한다', () => {
        render(
            <ShopHeroCard
                shop={{
                    ...baseShop,
                    item: {
                        ...baseShop.item,
                        skill1: null,
                        skill2: null,
                        skill1Name: null,
                        skill2Name: null,
                    },
                }}
                now={NOW}
            />,
        )

        const rows = skillRows()
        expect(rows).toHaveLength(2)
        expect(rows[0]).toHaveTextContent('스킬 1-')
        expect(rows[1]).toHaveTextContent('스킬 2-')
    })

    it('긴 스킬값은 고정 행 안에서 말줄임한다', () => {
        const longSkill =
            '공격 성공 시 상대의 방어력을 오랫동안 크게 감소시키는 매우 긴 스킬'
        render(
            <ShopHeroCard
                shop={{
                    ...baseShop,
                    item: { ...baseShop.item, skill1Name: longSkill },
                }}
                now={NOW}
            />,
        )

        expect(screen.getByText(longSkill)).toHaveClass('truncate')
        expect(screen.getByText(longSkill).closest('div')).toHaveClass('h-10')
    })
})
