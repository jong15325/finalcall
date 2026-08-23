import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(
    path.resolve(process.cwd(), 'src/styles/liquid-frost.css'),
    'utf8',
)
const systemStart = css.indexOf('/* Shared modal system:')
const systemCss = css.slice(systemStart)

describe('공통 모달 CSS 계약', () => {
    it('390px·480px 모바일에서 size와 무관하게 가용 폭을 모두 사용한다', () => {
        const mobileStart = systemCss.indexOf('@media (max-width: 639px)')
        const desktopStart = systemCss.indexOf('@media (min-width: 640px)')
        const mobileCss = systemCss.slice(mobileStart, desktopStart)

        expect(mobileCss).toMatch(
            /\.app-modal-panel\[data-size\]\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/s,
        )
    })

    it('1280px 데스크톱에서 size별 최대 폭을 유지한다', () => {
        const desktopStart = systemCss.indexOf('@media (min-width: 640px)')
        const reducedMotionStart = systemCss.indexOf(
            '@media (prefers-reduced-motion: reduce)',
        )
        const desktopCss = systemCss.slice(desktopStart, reducedMotionStart)

        expect(desktopCss).toContain(".app-modal-panel[data-size='sm']")
        expect(desktopCss).toContain('max-width: 420px')
        expect(desktopCss).toContain('max-width: 560px')
        expect(desktopCss).toContain('max-width: 760px')
        expect(desktopCss).toContain('max-width: 980px')
    })

    it('공통 버튼의 variant·상호작용·접근성 상태를 한곳에서 정의한다', () => {
        for (const variant of ['primary', 'secondary', 'danger']) {
            expect(css).toContain(
                `.app-modal-button[data-modal-button='${variant}']`,
            )
        }
        expect(css).toContain('.app-modal-button:hover:not(:disabled)')
        expect(css).toContain('.app-modal-button:active:not(:disabled)')
        expect(css).toContain('.app-modal-button:focus-visible')
        expect(css).toContain('.app-modal-button:disabled')
        expect(css).toContain('.app-modal-button__label')
        expect(css).toContain('@media (prefers-reduced-motion: reduce)')
        expect(css).toMatch(
            /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.app-modal-button::before\s*\{\s*display:\s*none;/,
        )
    })
})
