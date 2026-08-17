import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AuctionCountdownTagsScenario layout', () => {
    it('390px 1열과 1280px 3열에서 12개를 한 화면 흐름으로 비교한다', () => {
        const css = readFileSync(
            resolve(
                process.cwd(),
                'src/components/common/AuctionTimeDisplay.css',
            ),
            'utf8',
        )
        expect(css).toContain('max-width: 21.375rem')
        expect(css).toContain('grid-template-columns: minmax(0, 1fr)')
        expect(css).toContain('@media (min-width: 68.75rem)')
        expect(css).toContain(
            'grid-template-columns: repeat(3, minmax(0, 1fr))',
        )
    })
})
