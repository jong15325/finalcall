import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const tailwindConfig = require('../../tailwind.config.cjs') as {
    theme: {
        fontFamily: {
            sans: string[]
            mono: string[]
        }
    }
}

const readProjectFile = (path: string) =>
    readFileSync(`${process.cwd()}/${path}`, 'utf8')

describe('전역 타이포그래피 계약', () => {
    it('Pretendard Variable 동적 서브셋을 전역 sans로 사용한다', () => {
        const entrySource = readProjectFile('src/main.tsx')
        const indexCss = readProjectFile('src/index.css')
        const fontCss = readProjectFile(
            'node_modules/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css',
        )

        expect(entrySource).toContain(
            "import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'",
        )
        expect(indexCss).toMatch(/body\s*\{[\s\S]*?@apply[^;]*font-sans/)
        expect(tailwindConfig.theme.fontFamily.sans[0]).toBe(
            '"Pretendard Variable"',
        )
        expect(fontCss).toContain("font-family: 'Pretendard Variable'")
        expect(fontCss).toContain('font-display: swap')
        expect(fontCss).toContain('unicode-range:')
        expect(fontCss).toContain('woff2-dynamic-subset')
        expect(fontCss).not.toMatch(/url\(https?:\/\//)
    })

    it('경매 시간과 게임 미리보기의 monospace 의도를 유지한다', () => {
        const auctionTimeCss = readProjectFile(
            'src/components/common/AuctionTimeDisplay.css',
        )
        const gamePreviewSource = readProjectFile(
            'src/features/memo/components/GamePreview.tsx',
        )

        expect(tailwindConfig.theme.fontFamily.mono).toContain('ui-monospace')
        expect(auctionTimeCss).toContain('font-family: ui-monospace')
        expect(gamePreviewSource.match(/\bfont-mono\b/g)).toHaveLength(2)
    })
})
