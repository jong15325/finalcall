import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    WIND_PARTICLE_COLORS,
    WIND_PARTICLE_OPTIONS,
} from '../fixtures/windParticles'
import WindParticleCanvas from './WindParticleCanvas'

const context = createContextMock()

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        context as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(560)
    vi.stubGlobal('matchMedia', createMatchMedia())
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    for (const method of Object.values(context)) {
        if (typeof method === 'function' && 'mockClear' in method) {
            method.mockClear()
        }
    }
})

describe('WindParticleCanvas', () => {
    it('10개 원리를 고유 renderer와 deterministic seed로 구성한다', () => {
        expect(WIND_PARTICLE_OPTIONS).toHaveLength(10)
        expect(
            new Set(WIND_PARTICLE_OPTIONS.map(({ renderer }) => renderer)).size,
        ).toBe(10)
        expect(
            new Set(WIND_PARTICLE_OPTIONS.map(({ seed }) => seed)).size,
        ).toBe(10)
    })

    it('animated mode의 RAF를 예약하고 unmount 시 정리한다', () => {
        const requestAnimationFrame = vi.fn(() => 41)
        const cancelAnimationFrame = vi.fn()
        vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
        vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)

        const view = render(
            <WindParticleCanvas
                option={WIND_PARTICLE_OPTIONS[0]}
                colors={WIND_PARTICLE_COLORS}
            />,
        )
        const canvas = view.container.querySelector('canvas')!

        expect(canvas).toHaveAttribute('data-motion-mode', 'animated')
        expect(canvas).toHaveAttribute(
            'data-particle-count',
            String(WIND_PARTICLE_OPTIONS[0].particleCount),
        )
        expect(requestAnimationFrame).toHaveBeenCalledOnce()

        view.unmount()
        expect(cancelAnimationFrame).toHaveBeenCalledWith(41)
    })

    it('reduced-motion에서는 RAF 없이 정적 대표 프레임을 그린다', () => {
        const requestAnimationFrame = vi.fn(() => 1)
        vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
        vi.stubGlobal('matchMedia', createMatchMedia({ reducedMotion: true }))

        const view = render(
            <WindParticleCanvas
                option={WIND_PARTICLE_OPTIONS[1]}
                colors={WIND_PARTICLE_COLORS}
            />,
        )
        const canvas = view.container.querySelector('canvas')!

        expect(canvas).toHaveAttribute('data-motion-mode', 'static')
        expect(requestAnimationFrame).not.toHaveBeenCalled()
        expect(context.bezierCurveTo).toHaveBeenCalled()
    })

    it('coarse pointer에서는 입자 수와 갱신률을 제한한다', () => {
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn(() => 7),
        )
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        vi.stubGlobal('matchMedia', createMatchMedia({ coarse: true }))

        const option = WIND_PARTICLE_OPTIONS[2]
        const view = render(
            <WindParticleCanvas
                option={option}
                colors={WIND_PARTICLE_COLORS}
            />,
        )
        const canvas = view.container.querySelector('canvas')!

        expect(canvas).toHaveAttribute('data-motion-mode', 'capped')
        expect(canvas).toHaveAttribute(
            'data-particle-count',
            String(Math.ceil(option.particleCount / 2)),
        )
    })
})

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
    const gradient = { addColorStop: vi.fn() }
    return {
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        arc: vi.fn(),
        ellipse: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        createRadialGradient: vi.fn(() => gradient),
    }
}
