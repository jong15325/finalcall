import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ItemFrame from './ItemFrame'

/**
 * ItemFrame 검증 (rebuild-contract-map §6).
 * 정수배 픽셀 아트·플레이스홀더 폴백·골드포스 잔여일·STANDARD 폴백·오버레이 격리.
 */

const NOW = Date.parse('2026-07-21T00:00:00Z')
const DAY = 86_400_000
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

describe('<ItemFrame>', () => {
    it('아트를 픽셀레이트 + 명시 크기로 렌더한다(CLS 방지)', () => {
        render(
            <ItemFrame
                imageUrl="/art/x.png"
                name="불의 검"
                artWidth={50}
                artHeight={93}
            />,
        )
        const img = screen.getByRole('img', { name: '불의 검' })
        expect(img).toHaveAttribute('src', '/art/x.png')
        expect(img).toHaveAttribute('width', '50')
        expect(img).toHaveAttribute('height', '93')
        expect(img).toHaveClass('item-frame__art-img')
    })

    it('아트가 없으면 플레이스홀더로 폴백하되 접근성 이름은 유지', () => {
        render(<ItemFrame imageUrl={null} name="미상 아이템" />)
        // role=img + aria-label 로 이름을 유지(404 이미지 대신 폴백)
        expect(
            screen.getByRole('img', { name: '미상 아이템' }),
        ).toBeInTheDocument()
        // 실제 <img> 태그는 없다
        expect(screen.queryByRole('img')?.tagName).not.toBe('IMG')
    })

    it('골드포스 활성이면 잔여일 슬롯(3자리)과 전체값 aria-label 을 낸다', () => {
        render(
            <ItemFrame
                imageUrl="/art/x.png"
                name="검"
                visual={{ goldforceExpireAt: at(3 * DAY) }}
                now={NOW}
            />,
        )
        expect(screen.getByText('003')).toBeInTheDocument()
        expect(screen.getByLabelText('골드포스 잔여 3일')).toBeInTheDocument()
        expect(
            document.querySelector('.item-frame__art.is-goldforce'),
        ).not.toBeNull()
    })

    it('골드포스 만료/미적용은 STANDARD — 잔여일 슬롯 없음', () => {
        render(
            <ItemFrame
                imageUrl="/art/x.png"
                name="검"
                visual={{ goldforceExpireAt: at(-DAY) }}
                now={NOW}
            />,
        )
        expect(
            document.querySelector('.item-frame__art.is-standard'),
        ).not.toBeNull()
        expect(document.querySelector('.item-frame__days')).toBeNull()
    })

    it('hasSkill 이면 S 마크만(SS 렌더 금지)', () => {
        render(<ItemFrame hasSkill imageUrl="/art/x.png" name="검" />)
        expect(
            screen.getByRole('img', { name: '스킬 보유' }),
        ).toBeInTheDocument()
        expect(screen.getByText('S')).toBeInTheDocument()
    })

    it('오버레이는 이미지 DOM(.item-frame__art) 밖 별도 층에 렌더한다(§3.1-4)', () => {
        render(
            <ItemFrame
                imageUrl="/art/x.png"
                name="검"
                overlay={<button type="button">비교</button>}
            />,
        )
        const overlayBtn = screen.getByRole('button', { name: '비교' })
        // 오버레이는 이미지 DOM 안이 아니다
        expect(overlayBtn.closest('.item-frame__art')).toBeNull()
        expect(overlayBtn.closest('.item-frame__overlay')).not.toBeNull()
    })

    it('spriteUrl 미지정이면 imageUrl 을 --item-sprite 배경으로 재사용한다(§6.4)', () => {
        const { container } = render(
            <ItemFrame imageUrl="/art/x.png" name="검" />,
        )
        const stage = container.querySelector('.item-frame__stage')
        expect(stage?.getAttribute('style')).toContain(
            '--item-sprite: url("/art/x.png")',
        )
    })
})
