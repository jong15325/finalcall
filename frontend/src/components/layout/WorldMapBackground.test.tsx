import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '@/test/renderWithProviders'
import WorldMapBackground from './WorldMapBackground'

function createContext() {
    const gradient = { addColorStop: vi.fn() }
    return {
        arc: vi.fn(),
        beginPath: vi.fn(),
        clearRect: vi.fn(),
        closePath: vi.fn(),
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
            'absolute',
            'inset-0',
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

        fireEvent.error(view.container.querySelector('img')!)
        expect(view.container.firstElementChild).toHaveAttribute(
            'data-image-state',
            'failed',
        )
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
        expect(context.createRadialGradient).toHaveBeenCalled()
        expect(context.rotate).toHaveBeenCalled()
        expect(context.ellipse).toHaveBeenCalled()
        expect(view.container.querySelector('canvas')).toHaveAttribute(
            'data-particle-limit',
            '48',
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
