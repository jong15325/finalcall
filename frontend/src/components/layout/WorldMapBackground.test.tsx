import { act, fireEvent, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '@/test/renderWithProviders'
import WorldMapBackground from './WorldMapBackground'

function createContext() {
    const gradient = { addColorStop: vi.fn() }
    const compositionModes: string[] = []
    let compositionMode = 'source-over'
    const context = {
        gradient,
        compositionModes,
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
        rect: vi.fn(),
        clip: vi.fn(),
        restore: vi.fn(),
        rotate: vi.fn(),
        save: vi.fn(),
        setTransform: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '',
        translate: vi.fn(),
        globalAlpha: 1,
        globalCompositeOperation: compositionMode,
        lineCap: 'butt',
        lineWidth: 0,
    }
    Object.defineProperty(context, 'globalCompositeOperation', {
        configurable: true,
        get: () => compositionMode,
        set: (value: string) => {
            compositionMode = value
            compositionModes.push(value)
        },
    })
    return context
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

    it('모바일과 데스크톱에서 동일한 지도 원본을 사용한다', () => {
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
            view.container.querySelectorAll(
                'source[media="(max-width: 639px)"]',
            ),
        ).toHaveLength(0)
        expect(
            view.container.querySelector('source[type="image/avif"]'),
        ).toHaveAttribute(
            'srcset',
            '/img/backgrounds/world-map/world-map-1920.avif',
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

    it('모바일 배경은 키보드 viewport 변화와 분리된 안정 높이를 사용한다', () => {
        const css = readFileSync(
            `${process.cwd()}/src/components/layout/WorldMapBackground.css`,
            'utf8',
        )
        const mobile = css.slice(
            css.indexOf('@media (max-width: 639px)'),
            css.indexOf('@media (prefers-reduced-motion: reduce)'),
        )

        expect(mobile).toContain('bottom: auto')
        expect(mobile).toContain('height: 100vh')
        expect(mobile).toContain('@supports (height: 100lvh)')
        expect(mobile).toContain('height: 100lvh')
        expect(mobile).toContain('world-map-1920.jpg')
        expect(mobile).toContain('filter: blur(18px)')
        expect(mobile).toContain('mask-image: linear-gradient')
        expect(css).toContain('width: 100vw')
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
        expect(context.bezierCurveTo).toHaveBeenCalledTimes(15)
        expect(context.createRadialGradient).toHaveBeenCalled()
        expect(context.rotate).toHaveBeenCalled()
        expect(context.ellipse).toHaveBeenCalled()
        expect(view.container.querySelector('canvas')).toHaveAttribute(
            'data-particle-limit',
            '48',
        )
    })

    it('wind는 clip 내부 비단 리본 위로 간헐적 돌풍 band를 겹친다', () => {
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
        act(() => callbacks[1]?.(4000))
        const secondFrameCurveCount =
            context.bezierCurveTo.mock.calls.length - firstFrameCurveCount

        expect(firstFrameCurveCount).toBe(15)
        expect(secondFrameCurveCount).toBe(12)
        expect(context.rect).toHaveBeenCalledWith(0, 280, 430, 520)
        expect(context.clip).toHaveBeenCalledTimes(2)
        expect(context.compositionModes).toContain('screen')
        expect(context.globalCompositeOperation).toBe('source-over')
    })

    it('wind 렌더러는 회전 스포트라이트를 재도입하지 않는다', () => {
        const source = readFileSync(
            `${process.cwd()}/src/features/item/components/ElementDetailBackground.tsx`,
            'utf8',
        )
        const windRenderer = source.slice(
            source.indexOf('function drawWindField'),
            source.indexOf('function drawFire'),
        )

        expect(windRenderer).toContain('drawGustPulseBands')
        expect(windRenderer).toContain('context.clip()')
        expect(windRenderer).not.toContain('rotate(')
        expect(source).not.toContain('function drawWind(')
    })

    it('wind 변경 뒤에도 earth·fire·water motif와 명암을 유지한다', () => {
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

        expect(context.createRadialGradient).toHaveBeenCalled()
        expect(context.rotate).toHaveBeenCalledTimes(12)
        expect(context.ellipse).toHaveBeenCalled()
        expect(context.gradient.addColorStop).toHaveBeenCalledWith(
            0.48,
            'rgba(158, 205, 92, .26)',
        )
    })

    it('모바일 wind clip도 지정된 왼쪽 하단 경계를 벗어나지 않는다', () => {
        Object.defineProperties(HTMLCanvasElement.prototype, {
            clientWidth: { configurable: true, value: 1000 },
            clientHeight: { configurable: true, value: 800 },
        })
        const media = stubMatchMedia()
        media.setMatches('(max-width: 639px)', true)
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

        expect(context.rect).toHaveBeenCalledWith(
            0,
            0.461 * 800,
            0.43 * 1000,
            (0.63 - 0.461) * 800,
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
