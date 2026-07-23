import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ItemFrame from './ItemFrame'

/**
 * ItemFrame 검증 (rebuild-contract-map §6 · 목업 item-frame.css 이식).
 * 골드포스 PNG 프레임+스프라이트 잔여일·STANDARD 폴백·스킬마크·플레이스홀더·오버레이 격리.
 */

const NOW = Date.parse('2026-07-21T00:00:00Z')
const DAY = 86_400_000
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
const ART = '/art/items/level3/l/fire/axe.png'

describe('<ItemFrame>', () => {
    it('본체 아트를 item-art 로 렌더한다(object-fit fill + pixelated 는 CSS)', () => {
        const { container } = render(
            <ItemFrame imageUrl={ART} name="불의 검" />,
        )
        const img = screen.getByRole('img', { name: '불의 검' })
        expect(img).toHaveAttribute('src', ART)
        expect(img).toHaveClass('item-art')
        expect(container.querySelector('.card-bevel .item-art')).not.toBeNull()
    })

    it('아트가 없으면 플레이스홀더로 폴백하되 접근성 이름은 유지', () => {
        render(<ItemFrame imageUrl={null} name="미상 아이템" />)
        const placeholder = screen.getByRole('img', { name: '미상 아이템' })
        expect(placeholder.tagName).not.toBe('IMG')
        expect(placeholder).toHaveClass('item-frame__placeholder')
    })

    it('골드포스 활성이면 gold 프레임 오버레이 + 3자리 스프라이트 잔여일 + 전체 aria-label', () => {
        const { container } = render(
            <ItemFrame
                imageUrl={ART}
                name="검"
                visual={{ goldforceExpireAt: at(42 * DAY) }}
                now={NOW}
            />,
        )
        const goldFrame = container.querySelector('img.card-gold-frame')
        expect(goldFrame).toHaveAttribute(
            'src',
            '/art/frames/gold-Photoroom.png',
        )
        expect(goldFrame).toHaveAttribute('alt', '')
        // 잔여일 = 3자리 스프라이트 글리프(042 → i×3) + 원문 일수 aria-label
        expect(screen.getByLabelText('골드포스 잔여 42일')).toBeInTheDocument()
        expect(container.querySelectorAll('.card-number i')).toHaveLength(3)
        expect(container.querySelector('.card-art.is-goldforce')).not.toBeNull()
    })

    it('잔여일 슬롯을 숨겨도 골드 프레임 효과는 유지한다', () => {
        const { container } = render(
            <ItemFrame
                imageUrl={ART}
                name="검"
                visual={{ goldforceExpireAt: at(42 * DAY) }}
                now={NOW}
                showGoldforceDays={false}
            />,
        )
        expect(container.querySelector('.card-gold-frame')).not.toBeNull()
        expect(container.querySelector('.card-number-slot')).toBeNull()
        expect(container.querySelector('.card-art.is-goldforce')).toHaveClass(
            'hide-goldforce-days',
        )
        expect(
            screen.queryByLabelText('골드포스 잔여 42일'),
        ).not.toBeInTheDocument()
    })
    it('골드포스 만료/미적용은 STANDARD — gold 프레임·잔여일 없음', () => {
        const { container } = render(
            <ItemFrame
                imageUrl={ART}
                name="검"
                visual={{ goldforceExpireAt: at(-DAY) }}
                now={NOW}
            />,
        )
        expect(container.querySelector('.card-art.is-standard')).not.toBeNull()
        expect(container.querySelector('.card-gold-frame')).toBeNull()
        expect(container.querySelector('.card-number-slot')).toBeNull()
    })

    it('hasSkill 이면 일반 S 마크(card-rank)만 — 특수 SS 렌더 금지', () => {
        const { container } = render(
            <ItemFrame hasSkill imageUrl={ART} name="검" />,
        )
        expect(screen.getByLabelText('아이템 스킬 적용')).toBeInTheDocument()
        expect(container.querySelectorAll('.card-rank')).toHaveLength(1)
    })

    it('오버레이는 이미지 DOM(.card-art) 밖 별도 층에 렌더한다(§3.1-4)', () => {
        render(
            <ItemFrame
                imageUrl={ART}
                name="검"
                overlay={<button type="button">비교</button>}
            />,
        )
        const overlayBtn = screen.getByRole('button', { name: '비교' })
        expect(overlayBtn.closest('.card-art')).toBeNull()
        expect(overlayBtn.closest('.item-frame__overlay')).not.toBeNull()
    })

    it('spriteUrl 미지정이면 imageUrl 을 --item-sprite 배경으로 재사용한다(§6.4)', () => {
        const { container } = render(<ItemFrame imageUrl={ART} name="검" />)
        // --item-sprite 는 루트(.item-frame)에 주입되어 스테이지 ::before 로 상속된다.
        const root = container.querySelector('.item-frame')
        expect(root?.getAttribute('style')).toContain(
            `--item-sprite: url("${ART}")`,
        )
    })

    it('scale 을 주면 --art-scale 을 루트에 주입한다(정수배 확대, §6.1)', () => {
        const { container } = render(
            <ItemFrame imageUrl={ART} name="검" scale={2} />,
        )
        const root = container.querySelector('.item-frame')
        expect(root?.getAttribute('style')).toContain('--art-scale: 2')
    })
})
