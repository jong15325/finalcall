import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { useCompareStore } from '@/store/compareStore'
import CompareBar from './CompareBar'

const refs = [
    { source: 'MARKET' as const, listingId: 'one' },
    { source: 'AUCTION' as const, listingId: 'two' },
    { source: 'MARKET' as const, listingId: 'three' },
]
const frostCss = readFileSync(
    resolve(process.cwd(), 'src/styles/liquid-frost.css'),
    'utf8',
)
const tokensCss = readFileSync(
    resolve(process.cwd(), 'src/styles/tokens.css'),
    'utf8',
)
const itemFrameCss = readFileSync(
    resolve(process.cwd(), 'src/features/item/components/ItemFrame.css'),
    'utf8',
)
const cardInfoCss = readFileSync(
    resolve(process.cwd(), 'src/features/item/components/CardInfoDialog.css'),
    'utf8',
)

afterEach(() => useCompareStore.setState({ items: [] }))

function renderBar(count: number) {
    useCompareStore.setState({ items: refs.slice(0, count) })
    return render(
        <MemoryRouter>
            <CompareBar />
        </MemoryRouter>,
    )
}

function pageScopedSkillColorOverrides(css: string) {
    const targets = [
        '.item-skill-content',
        '.item-skill-label',
        '.item-skill-percent',
        '.item-skill-summary__slot',
        '.item-skill-summary__percent',
        '.item-card__skill-percent',
        '.item-card__skill-row',
    ]

    return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
        .filter(([, selector, declarations]) => {
            const pageScoped =
                selector.includes('#view') || selector.includes('[data-')
            const target = targets.some((value) => selector.includes(value))
            const directColor = /(?:^|[;\n])\s*color\s*:/m.test(declarations)
            return pageScoped && target && directColor
        })
        .map(([, selector]) => selector.trim())
}

describe('CompareBar', () => {
    it('keeps the mobile nav gap and skill foreground contracts', () => {
        expect(frostCss).toMatch(
            /\.compare-bar\s*\{[^}]*bottom:\s*calc\(5\.75rem \+ env\(safe-area-inset-bottom\)\)/s,
        )
        expect(tokensCss).toContain('--item-skill-body: var(--chrome-fg)')
        expect(tokensCss).toContain('--item-skill-slot: var(--chrome-muted)')
        expect(tokensCss).toContain(
            '--item-skill-percent: var(--brand-highlight-bright)',
        )
        expect(itemFrameCss).toMatch(
            /\.item-skill-content\s*\{[^}]*var\(--item-skill-body\)/s,
        )
        expect(itemFrameCss).toMatch(
            /\.item-skill-summary__slot\s*\{[^}]*var\(--item-skill-slot\)/s,
        )
        expect(itemFrameCss).toMatch(
            /\.item-skill-percent,\s*\.item-skill-summary__percent,\s*\.item-card__skill-percent\s*\{[^}]*var\(--item-skill-percent\)/s,
        )
        expect(cardInfoCss).toMatch(
            /\.card-info-content \.skill-list li\s*\{[^}]*var\(--item-skill-body\)/s,
        )
        expect(cardInfoCss).toMatch(
            /\.card-info-content \.skill-list \.n\s*\{[^}]*var\(--item-skill-slot\)/s,
        )
        expect(cardInfoCss).toMatch(
            /\.card-info-content \.skill-list \.pct\s*\{[^}]*var\(--item-skill-percent\)/s,
        )
        expect(cardInfoCss).not.toMatch(
            /\.card-info-content \.skill-list \.pct\s*\{[^}]*var\(--control-action/s,
        )
        expect(pageScopedSkillColorOverrides(frostCss)).toEqual([])
    })
    it.each([1, 2, 3])('renders %i selected item slots', (count) => {
        renderBar(count)
        const bar = screen.getByRole('complementary', {
            name: '아이템 비교 선택',
        })
        expect(bar).toHaveClass(
            'compare-bar',
            'liquid-frost',
            'liquid-frost--strong',
            'fixed',
            'z-40',
        )
        expect(
            screen.getAllByRole('button', { name: /번 아이템 비교에서 빼기/ }),
        ).toHaveLength(count)
        expect(screen.getByText(`${count}/3`)).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '비교하기' }) !== null).toBe(
            count >= 2,
        )
    })
})
