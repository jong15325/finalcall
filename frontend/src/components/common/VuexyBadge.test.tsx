import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import VuexyBadge, { VUEXY_BADGE_GEOMETRY } from './VuexyBadge'

describe('VuexyBadge', () => {
    it('Vuexy Chip의 variant와 slot anatomy를 제공한다', () => {
        render(
            <VuexyBadge
                dot
                leading={<span>시</span>}
                shape="pill"
                trailing={<span>끝</span>}
                variant="outlined"
            >
                12:48
            </VuexyBadge>,
        )

        const badge = screen.getByText('12:48').closest('[data-vuexy-badge]')
        expect(badge).toHaveClass(
            'vuexy-badge',
            'vuexy-badge--outlined',
            'vuexy-badge--pill',
        )
        expect(badge?.querySelector('.vuexy-badge__dot')).toBeInTheDocument()
        expect(badge?.querySelectorAll('.vuexy-badge__icon')).toHaveLength(2)
    })

    it('Vuexy small Chip geometry mapping을 고정한다', () => {
        expect(VUEXY_BADGE_GEOMETRY).toEqual({
            height: '1.5rem',
            paddingInline: '0.625rem',
            paddingBlock: '0.125rem',
            typeSize: '0.8125rem',
            lineHeight: '1.53846154',
            fontWeight: 500,
            iconSize: '1rem',
            shadow: 'none',
        })
    })

    it('label을 ellipsis로 축약하지 않는다', () => {
        const css = readFileSync(
            resolve(process.cwd(), 'src/components/common/VuexyBadge.css'),
            'utf8',
        )
        expect(css).toContain('overflow: visible')
        expect(css).toContain('text-overflow: clip')
        expect(css).not.toContain('text-overflow: ellipsis')
    })
})
