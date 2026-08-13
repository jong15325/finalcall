import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ElementParticleCanvas from './ElementParticleCanvas'

const renderFrame = vi.fn()
const context = createContextMock()

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        context as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(560)
    vi.stubGlobal('matchMedia', createMatchMedia())
})

afterEach(() => {
    Reflect.deleteProperty(navigator, 'connection')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    renderFrame.mockClear()
})

describe('ElementParticleCanvas lifecycle', () => {
    it('animated RAF를 예약하고 unmount 시 취소한다', () => {
        const requestAnimationFrame = vi.fn(() => 73)
        const cancelAnimationFrame = vi.fn()
        vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
        vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
        const addEventListener = vi.spyOn(document, 'addEventListener')
        const removeEventListener = vi.spyOn(document, 'removeEventListener')

        const view = renderCanvas()
        const canvas = view.container.querySelector('canvas')!
        expect(canvas).toHaveAttribute('data-motion-mode', 'animated')
        expect(canvas).toHaveAttribute('data-particle-count', '18')
        expect(requestAnimationFrame).toHaveBeenCalledOnce()
        expect(addEventListener).toHaveBeenCalledWith(
            'visibilitychange',
            expect.any(Function),
        )

        view.unmount()
        expect(cancelAnimationFrame).toHaveBeenCalledWith(73)
        expect(removeEventListener).toHaveBeenCalledWith(
            'visibilitychange',
            expect.any(Function),
        )
    })

    it('reduced-motion과 save-data는 RAF 없는 정적 대표 프레임이다', () => {
        const requestAnimationFrame = vi.fn(() => 1)
        vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
        vi.stubGlobal('matchMedia', createMatchMedia({ reducedMotion: true }))

        const reduced = renderCanvas()
        expect(reduced.container.querySelector('canvas')).toHaveAttribute(
            'data-motion-mode',
            'static',
        )
        expect(renderFrame).toHaveBeenCalledWith(
            'sample-renderer',
            expect.objectContaining({ time: 2.5 }),
        )
        expect(requestAnimationFrame).not.toHaveBeenCalled()
        reduced.unmount()

        vi.stubGlobal('matchMedia', createMatchMedia())
        Object.defineProperty(navigator, 'connection', {
            configurable: true,
            value: { saveData: true },
        })
        const saveData = renderCanvas()
        expect(saveData.container.querySelector('canvas')).toHaveAttribute(
            'data-motion-mode',
            'static',
        )
        expect(requestAnimationFrame).not.toHaveBeenCalled()
    })

    it('coarse pointer는 입자를 절반으로 제한하고 30fps capped mode를 쓴다', () => {
        vi.stubGlobal('matchMedia', createMatchMedia({ coarse: true }))
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn(() => 9),
        )
        vi.stubGlobal('cancelAnimationFrame', vi.fn())

        const view = renderCanvas()
        expect(view.container.querySelector('canvas')).toHaveAttribute(
            'data-motion-mode',
            'capped',
        )
        expect(view.container.querySelector('canvas')).toHaveAttribute(
            'data-particle-count',
            '9',
        )
    })
})

function renderCanvas() {
    return render(
        <ElementParticleCanvas
            id="sample"
            label="샘플"
            particleCount={18}
            seed={1301}
            colors={{ bright: 'fixture-color' }}
            renderer="sample-renderer"
            staticTime={2500}
            renderFrame={renderFrame}
            dataAttribute="fire"
            region={{ viewBox: '0 0 560 480', heightRatio: 6 / 7 }}
        />,
    )
}

function createMatchMedia({
    reducedMotion = false,
    coarse = false,
}: {
    reducedMotion?: boolean
    coarse?: boolean
} = {}) {
    return (query: string) => ({
        matches:
            (query === '(prefers-reduced-motion: reduce)' && reducedMotion) ||
            (query === '(pointer: coarse)' && coarse),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    })
}

function createContextMock() {
    return {
        setTransform: vi.fn(),
        clearRect: vi.fn(),
    }
}
