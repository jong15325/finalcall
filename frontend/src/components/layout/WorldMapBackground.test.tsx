import { act, fireEvent, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '@/test/renderWithProviders'
import WorldMapBackground from './WorldMapBackground'

function createContext() {
    const gradient = { addColorStop: vi.fn() }
    return {
        gradient,
        arc: vi.fn(),
        beginPath: vi.fn(),
        clearRect: vi.fn(),
        closePath: vi.fn(),
        bezierCurveTo: vi.fn(),
        createRadialGradient: vi.fn(() => gradient),
        ellipse: vi.fn(),
        fill: vi.fn(),
        fillStyle: '',
        lineTo: vi.fn(),
        moveTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        restore: vi.fn(),
        rotate: vi.fn(),
        save: vi.fn(),
        setTransform: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '',
        translate: vi.fn(),
        lineWidth: 0,
    }
}

describe('WorldMapBackground', () => {
    beforeEach(() => {
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: false,
        })
    })

    afterEach(() => {
        Reflect.deleteProperty(HTMLCanvasElement.prototype, 'clientWidth')
        Reflect.deleteProperty(HTMLCanvasElement.prototype, 'clientHeight')
        vi.useRealTimers()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('모바일 art-direction과 350KB 이하 JPEG fallback을 제공한다', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            null,
        )
        const view = render(<WorldMapBackground accent="water" />)

        expect(view.container.firstElementChild).toHaveClass(
            'fixed',
            'inset-0',
            '-z-10',
        )
        expect(view.container.firstElementChild).not.toHaveClass(
            'absolute',
            'sm:fixed',
        )

        expect(
            view.container.querySelector(
                'source[type="image/avif"][media="(max-width: 639px)"]',
            ),
        ).toHaveAttribute(
            'srcset',
            '/img/backgrounds/world-map/world-map-mobile.avif',
        )
        expect(
            view.container.querySelector(
                'source[type="image/jpeg"][media="(max-width: 639px)"]',
            ),
        ).toHaveAttribute(
            'srcset',
            '/img/backgrounds/world-map/world-map-mobile.jpg',
        )
        expect(view.container.querySelectorAll('canvas')).toHaveLength(1)
        expect(
            view.container.querySelector('.world-map-background__glow--wind'),
        ).not.toBeInTheDocument()
        expect(
            view.container.querySelector('.world-map-background__glow--fire'),
        ).toBeInTheDocument()

        fireEvent.error(view.container.querySelector('img')!)
        expect(view.container.firstElementChild).toHaveAttribute(
            'data-image-state',
            'failed',
        )
    })

    it('reduced motion은 정적 배경을 유지하고 forced colors만 scene을 숨긴다', () => {
        const css = readFileSync(
            `${process.cwd()}/src/components/layout/WorldMapBackground.css`,
            'utf8',
        )
        const reducedMotion = css.slice(
            css.indexOf('@media (prefers-reduced-motion: reduce)'),
            css.indexOf('@media (forced-colors: active)'),
        )
        const forcedColors = css.slice(
            css.indexOf('@media (forced-colors: active)'),
        )

        expect(reducedMotion).toContain('animation: none')
        expect(reducedMotion).toContain('element-detail__ambient-canvas')
        expect(reducedMotion).not.toContain('world-map-background__image')
        expect(forcedColors).toContain('display: none')
    })

    it('회전 스포트라이트 CSS만 제거하고 다른 글로우는 유지한다', () => {
        const css = readFileSync(
            `${process.cwd()}/src/components/layout/WorldMapBackground.css`,
            'utf8',
        )

        expect(css).not.toContain('world-map-background__glow--wind')
        expect(css).not.toContain('@keyframes world-map-wind')
        expect(css).not.toContain('conic-gradient')
        expect(css).toContain('world-map-background__glow--earth')
        expect(css).toContain('rgb(229 255 178 / 0.48)')
        expect(css).toContain('rgb(152 196 92 / 0.3)')
        expect(css).toContain('world-map-background__glow--fire')
        expect(css).toContain('world-map-background__glow--water')
        expect(css).toContain('@keyframes world-map-fire')
    })

    it('한 프레임에서 wind·fire·earth·water 네 motif를 모두 그린다', () => {
        const context = createContext()
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            context as unknown as CanvasRenderingContext2D,
        )
        const callbacks: FrameRequestCallback[] = []
        vi.stubGlobal(
            'requestAnimationFrame',
            (callback: FrameRequestCallback) => {
                callbacks.push(callback)
                return callbacks.length
            },
        )
        vi.stubGlobal('cancelAnimationFrame', vi.fn())

        const view = render(<WorldMapBackground accent={null} />)
        act(() => callbacks[0]?.(1000))

        expect(context.quadraticCurveTo).toHaveBeenCalled()
        expect(context.bezierCurveTo).toHaveBeenCalledTimes(36)
        expect(context.createRadialGradient).toHaveBeenCalled()
        expect(context.rotate).toHaveBeenCalled()
        expect(context.ellipse).toHaveBeenCalled()
        expect(view.container.querySelector('canvas')).toHaveAttribute(
            'data-particle-limit',
            '48',
        )
    })

    it('wind는 회전 대신 오른쪽으로 흐르는 복수 곡선이고 earth는 강화된 명암을 쓴다', () => {
        Object.defineProperties(HTMLCanvasElement.prototype, {
            clientWidth: { configurable: true, value: 1000 },
            clientHeight: { configurable: true, value: 800 },
        })
        const context = createContext()
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            context as unknown as CanvasRenderingContext2D,
        )
        const callbacks: FrameRequestCallback[] = []
        vi.stubGlobal(
            'requestAnimationFrame',
            (callback: FrameRequestCallback) => {
                callbacks.push(callback)
                return callbacks.length
            },
        )
        vi.stubGlobal('cancelAnimationFrame', vi.fn())

        render(<WorldMapBackground accent={null} />)
        act(() => callbacks[0]?.(1000))
        const firstFrameCurveCount = context.bezierCurveTo.mock.calls.length
        const firstEndX = context.bezierCurveTo.mock.calls[0][4]
        act(() => callbacks[1]?.(1040))
        const secondEndX =
            context.bezierCurveTo.mock.calls[firstFrameCurveCount][4]

        expect(firstFrameCurveCount).toBe(36)
        expect(secondEndX).toBeGreaterThan(firstEndX)
        expect(context.rotate).toHaveBeenCalledTimes(24)
        expect(context.gradient.addColorStop).toHaveBeenCalledWith(
            0.48,
            'rgba(158, 205, 92, .26)',
        )
    })

    it('coarse 전환 reseed와 media·visibility·resize·unmount cleanup을 수행한다', () => {
        vi.useFakeTimers()
        const media = stubMatchMedia()
        const context = createContext()
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            context as unknown as CanvasRenderingContext2D,
        )
        const raf = vi.fn(() => 41)
        const cancel = vi.fn()
        vi.stubGlobal('requestAnimationFrame', raf)
        vi.stubGlobal('cancelAnimationFrame', cancel)

        const view = render(<WorldMapBackground accent={null} />)
        const canvas = view.container.querySelector('canvas')!
        expect(canvas).toHaveAttribute('data-particle-limit', '48')

        media.setMatches('(pointer: coarse)', true)
        expect(canvas).toHaveAttribute('data-particle-limit', '24')
        media.setMatches('(pointer: coarse)', false)
        expect(canvas).toHaveAttribute('data-particle-limit', '48')

        media.setMatches('(prefers-reduced-motion: reduce)', true)
        media.setMatches('(prefers-reduced-motion: reduce)', false)
        media.setMatches('(update: slow)', true)
        media.setMatches('(update: slow)', false)
        media.setMatches('(forced-colors: active)', true)
        media.setMatches('(forced-colors: active)', false)
        expect(cancel).toHaveBeenCalledWith(41)

        window.dispatchEvent(new Event('resize'))
        window.dispatchEvent(new Event('resize'))
        act(() => vi.advanceTimersByTime(120))
        expect(context.setTransform).toHaveBeenCalledTimes(2)

        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: true,
        })
        document.dispatchEvent(new Event('visibilitychange'))
        const callsBeforeUnmount = raf.mock.calls.length
        view.unmount()

        media.setMatches('(pointer: coarse)', true)
        media.setMatches('(prefers-reduced-motion: reduce)', false)
        document.dispatchEvent(new Event('visibilitychange'))
        window.dispatchEvent(new Event('resize'))
        act(() => vi.advanceTimersByTime(120))
        expect(raf).toHaveBeenCalledTimes(callsBeforeUnmount)
    })
})
