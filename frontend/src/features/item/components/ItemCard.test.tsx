import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ItemCard from './ItemCard'
import type { ItemCardData } from './ItemCard'

/**
 * ItemCard 검증 (rebuild-contract-map §2·§3).
 * 아트 파생·CodeAmount 연동·이름/설명·스킬요약 합성. 링크는 만들지 않는다(§2.1).
 */

const baseItem: ItemCardData = {
    subGroup: 1, // 무기
    kind: 1, // 도끼
    element: 2, // 불
    level: 3,
    skill1: 11,
    skill2: null,
    goldforceExpireAt: null,
    nameSnapshot: '불의 전투도끼',
    specSnapshot: '공격력이 높은 한손 도끼',
}

describe('<ItemCard>', () => {
    it('보존 itemArt 로 아트 경로를 파생해 렌더한다', () => {
        render(<ItemCard item={baseItem} price={2480000} />)
        const img = screen.getByRole('img', { name: '불의 전투도끼' })
        expect(img).toHaveAttribute('src', '/art/items/level3/l/fire/axe.png')
    })

    it('가격은 CodeAmount 축약 + 전체값 aria-label 로 연동한다', () => {
        render(<ItemCard item={baseItem} price={2480000} />)
        // 탐색용 축약 표기
        expect(screen.getByText('248만')).toBeInTheDocument()
        // 보조기술엔 전체값
        expect(screen.getByLabelText('2,480,000 코드')).toBeInTheDocument()
    })

    it('가격 없음(입찰 0건)은 "-" 로 표기한다', () => {
        render(<ItemCard item={baseItem} price={null} />)
        expect(screen.getByText('-')).toBeInTheDocument()
    })

    it('이름·부가설명 스냅샷을 표시한다', () => {
        render(<ItemCard item={baseItem} price={1000} />)
        expect(
            screen.getByRole('heading', { name: '불의 전투도끼' }),
        ).toBeInTheDocument()
        expect(screen.getByText('공격력이 높은 한손 도끼')).toBeInTheDocument()
    })

    it('스킬명 미제공 시 코드 중립 표기로 폴백', () => {
        render(<ItemCard item={baseItem} price={1000} />)
        expect(screen.getByText('스킬 #11')).toBeInTheDocument()
    })

    it('스킬명·발동확률을 두 줄로 표시(퍼센트는 스킬2 줄)', () => {
        render(
            <ItemCard
                item={{
                    ...baseItem,
                    skill1: 131,
                    skill2: 202,
                    skill1Name: '공격시간 3 감소',
                    skill2Name: '트리플샷',
                    skillPercent: 33,
                }}
                price={1000}
            />,
        )
        expect(screen.getByText('공격시간 3 감소')).toBeInTheDocument()
        const skill2Line = screen.getByText('트리플샷').closest('li')
        expect(skill2Line).toHaveTextContent('33%')
    })

    it('priceLabel·footer·overlay 슬롯을 렌더한다', () => {
        render(
            <ItemCard
                item={baseItem}
                price={1000}
                priceLabel="현재가"
                overlay={<span>OV</span>}
                footer={<button type="button">구매</button>}
            />,
        )
        expect(screen.getByText('현재가')).toBeInTheDocument()
        expect(screen.getByText('OV')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '구매' })).toBeInTheDocument()
    })

    it('미등록 조합은 아트를 폴백(플레이스홀더)한다 — 깨진 이미지 금지', () => {
        // element 9 는 사전에 없음 → itemArt null → 플레이스홀더
        render(<ItemCard item={{ ...baseItem, element: 9 }} price={1000} />)
        const placeholder = screen.getByRole('img', { name: '불의 전투도끼' })
        expect(placeholder.tagName).not.toBe('IMG')
    })
})
