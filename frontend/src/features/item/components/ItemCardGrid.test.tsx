import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ItemCardGrid, { ItemCardGridSkeleton } from './ItemCardGrid'

/**
 * ItemCardGrid 검증 (EPIC-CARD-SYSTEM T3 · 제안 §2.2·§3 단계1).
 *
 * 고정하는 것:
 *  1. variant → 반응형 그리드 클래스(market/auction 픽셀 보존, inventory 간격 축소 gap-2).
 *  2. 래퍼 요소는 `as`(section/ul) — 접근성 라벨 유지.
 *  3. 스켈레톤은 count 만큼 aria-hidden 카드를 같은 그리드 클래스로 그린다.
 */

describe('<ItemCardGrid>', () => {
    it('market variant = 2/3/6열 gap-3 section(픽셀 보존)', () => {
        render(
            <ItemCardGrid variant="market" ariaLabel="마켓 상품 목록">
                <div>card</div>
            </ItemCardGrid>,
        )
        const grid = screen.getByRole('region', { name: '마켓 상품 목록' })
        expect(grid.tagName).toBe('SECTION')
        expect(grid.className).toContain('grid-cols-2')
        expect(grid.className).toContain('gap-3')
        expect(grid.className).toContain('xs:grid-cols-3')
        expect(grid.className).toContain('min-[1200px]:grid-cols-6')
    })

    it('auction variant = 1/2/3열 gap-4(픽셀 보존)', () => {
        render(
            <ItemCardGrid variant="auction" ariaLabel="경매 목록">
                <div>card</div>
            </ItemCardGrid>,
        )
        const grid = screen.getByRole('region', { name: '경매 목록' })
        expect(grid.className).toContain('grid-cols-1')
        expect(grid.className).toContain('gap-4')
        expect(grid.className).toContain('xs:grid-cols-2')
        expect(grid.className).toContain('min-[1200px]:grid-cols-3')
    })

    it('inventory variant = 마켓과 동일 2/3/6열이되 간격만 gap-2 로 축소(FC-179)', () => {
        render(
            <ItemCardGrid variant="inventory" as="ul" ariaLabel="인벤토리 슬롯">
                <li>slot</li>
            </ItemCardGrid>,
        )
        const grid = screen.getByRole('list', { name: '인벤토리 슬롯' })
        expect(grid.tagName).toBe('UL')
        // 마켓과 같은 열
        expect(grid.className).toContain('grid-cols-2')
        expect(grid.className).toContain('xs:grid-cols-3')
        expect(grid.className).toContain('min-[1200px]:grid-cols-6')
        // 간격만 축소 — gap-2(마켓 gap-3 아님)
        expect(grid.className).toContain('gap-2')
        expect(grid.className).not.toContain('gap-3')
    })

    it('children(카드들) 을 그대로 배치한다', () => {
        render(
            <ItemCardGrid variant="market" ariaLabel="마켓 상품 목록">
                <div>카드A</div>
                <div>카드B</div>
            </ItemCardGrid>,
        )
        expect(screen.getByText('카드A')).toBeInTheDocument()
        expect(screen.getByText('카드B')).toBeInTheDocument()
    })
})

describe('<ItemCardGridSkeleton>', () => {
    it('count 만큼 카드 스켈레톤을 그리고 컨테이너는 같은 그리드 클래스', () => {
        const { container } = render(
            <ItemCardGridSkeleton variant="market" count={5} />,
        )
        const grid = container.firstElementChild as HTMLElement
        expect(grid.getAttribute('aria-hidden')).toBe('true')
        expect(grid.className).toContain('grid-cols-2')
        expect(grid.className).toContain('gap-3')
        expect(grid.children).toHaveLength(5)
    })

    it('inventory 스켈레톤은 축소 간격(gap-2) 그리드를 쓴다(ready 와 무드리프트)', () => {
        const { container } = render(
            <ItemCardGridSkeleton variant="inventory" count={3} />,
        )
        const grid = container.firstElementChild as HTMLElement
        expect(grid.className).toContain('gap-2')
        expect(grid.className).not.toContain('gap-3')
        expect(grid.children).toHaveLength(3)
    })

    it('auction 스켈레톤은 1/2/3열 gap-4 그리드를 쓴다', () => {
        const { container } = render(
            <ItemCardGridSkeleton variant="auction" count={2} />,
        )
        const grid = container.firstElementChild as HTMLElement
        expect(grid.className).toContain('grid-cols-1')
        expect(grid.className).toContain('gap-4')
        expect(grid.children).toHaveLength(2)
        expect(grid.firstElementChild).toHaveClass('min-h-[256px]')
    })
})
