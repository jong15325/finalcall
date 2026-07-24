import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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

    it('skillFlip 이면 이미지 영역에 스킬 뒷면과 터치 토글을 렌더한다', () => {
        const { container } = render(
            <ItemCard
                skillFlip
                item={baseItem}
                price={1000}
                sellerNickname="신뢰상점"
                overlay={<button type="button">비교</button>}
            />,
        )
        const trigger = screen.getByRole('button', {
            name: '불의 전투도끼 스킬 보기',
        })
        const front = container.querySelector('.item-card__skill-flip-front')
        const back = container.querySelector('.item-card__skill-flip-back')
        expect(screen.getAllByText('블랙 - 무기')).toHaveLength(2)
        expect(screen.getAllByText('도끼 · Lv.3')).toHaveLength(2)
        expect(screen.getByText('불')).toBeInTheDocument()
        expect(screen.getByText('판매자')).toHaveTextContent('신뢰상점')
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        // disclosure(m3): 스킬 뒷면 region 은 트리거의 aria-controls 로 이어진다.
        const controls = trigger.getAttribute('aria-controls')
        expect(controls).toBeTruthy()
        expect(back).toHaveAttribute('id', controls)
        expect(front).toHaveAttribute('aria-hidden', 'false')
        expect(front).not.toHaveAttribute('inert')
        expect(back).toHaveAttribute('aria-hidden', 'true')
        expect(back).toHaveAttribute('inert')
        expect(
            screen
                .getByRole('button', { name: '비교' })
                .closest('.item-card__skill-flip-face'),
        ).toBeNull()

        fireEvent.click(trigger)
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        expect(trigger).toHaveAccessibleName('불의 전투도끼 스킬 닫기')
        expect(
            container.querySelector('.item-card__skill-flip'),
        ).toHaveAttribute('data-flipped', 'true')
        expect(front).toHaveAttribute('aria-hidden', 'true')
        expect(front).toHaveAttribute('inert')
        expect(back).toHaveAttribute('aria-hidden', 'false')
        expect(back).not.toHaveAttribute('inert')

        fireEvent.keyDown(window, { key: 'Escape' })
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        expect(front).toHaveAttribute('aria-hidden', 'false')
        expect(front).not.toHaveAttribute('inert')
        expect(back).toHaveAttribute('aria-hidden', 'true')
        expect(back).toHaveAttribute('inert')
        expect(
            screen
                .getByRole('button', { name: '비교' })
                .closest('.item-card__skill-flip-face'),
        ).toBeNull()
    })

    it('활성 골드포스는 카드 타입 제목을 골드로 파생한다', () => {
        render(
            <ItemCard
                skillFlip
                item={{
                    ...baseItem,
                    goldforceExpireAt: '2026-08-02T00:00:00Z',
                }}
                now={Date.parse('2026-08-01T00:00:00Z')}
                price={1000}
            />,
        )
        expect(screen.getAllByText('골드 - 무기')).toHaveLength(2)
        expect(screen.queryByText(/골드포스 잔여/)).not.toBeInTheDocument()
        expect(screen.getByLabelText(/골드포스 잔여/)).toBeInTheDocument()
    })
    it('스킬이 없으면 skillFlip 이어도 이미지 토글을 만들지 않는다', () => {
        render(
            <ItemCard
                skillFlip
                item={{ ...baseItem, skill1: null, skill2: null }}
                price={1000}
            />,
        )
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
    it('미등록 조합은 아트를 폴백(플레이스홀더)한다 — 깨진 이미지 금지', () => {
        // element 9 는 사전에 없음 → itemArt null → 플레이스홀더
        render(<ItemCard item={{ ...baseItem, element: 9 }} price={1000} />)
        const placeholder = screen.getByRole('img', { name: '불의 전투도끼' })
        expect(placeholder.tagName).not.toBe('IMG')
    })
})
