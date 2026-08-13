import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    FIRE_PARTICLE_COLORS,
    FIRE_PARTICLE_OPTIONS,
    WATER_PARTICLE_COLORS,
    WATER_PARTICLE_OPTIONS,
} from '../fixtures/elementParticles'
import FireParticleCanvas from './FireParticleCanvas'
import WaterParticleCanvas from './WaterParticleCanvas'

const context = createContextMock()

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        context as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(560)
    vi.stubGlobal('matchMedia', () => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    }))
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('fire/water particle renderers', () => {
    it('불 10안은 고유 renderer·seed와 영역 clip을 사용한다', () => {
        const view = render(
            <>
                {FIRE_PARTICLE_OPTIONS.map((option) => (
                    <FireParticleCanvas
                        key={option.id}
                        option={option}
                        colors={FIRE_PARTICLE_COLORS}
                    />
                ))}
            </>,
        )

        expect(FIRE_PARTICLE_OPTIONS).toHaveLength(10)
        expect(
            new Set(FIRE_PARTICLE_OPTIONS.map(({ renderer }) => renderer)).size,
        ).toBe(10)
        expect(
            new Set(FIRE_PARTICLE_OPTIONS.map(({ seed }) => seed)).size,
        ).toBe(10)
        expect(
            view.container.querySelectorAll('[data-fire-canvas]'),
        ).toHaveLength(10)
        expect(view.container.querySelector('svg')).toHaveAttribute(
            'viewBox',
            '1056 0 864 508',
        )
        expect(context.clip).toHaveBeenCalledTimes(10)
    })

    it('물 10안은 고유 renderer·seed와 영역 clip을 사용한다', () => {
        const view = render(
            <>
                {WATER_PARTICLE_OPTIONS.map((option) => (
                    <WaterParticleCanvas
                        key={option.id}
                        option={option}
                        colors={WATER_PARTICLE_COLORS}
                    />
                ))}
            </>,
        )

        expect(WATER_PARTICLE_OPTIONS).toHaveLength(10)
        expect(
            new Set(WATER_PARTICLE_OPTIONS.map(({ renderer }) => renderer))
                .size,
        ).toBe(10)
        expect(
            new Set(WATER_PARTICLE_OPTIONS.map(({ seed }) => seed)).size,
        ).toBe(10)
        expect(
            view.container.querySelectorAll('[data-water-canvas]'),
        ).toHaveLength(10)
        expect(view.container.querySelector('svg')).toHaveAttribute(
            'viewBox',
            '998 421 922 659',
        )
        expect(context.clip).toHaveBeenCalledTimes(10)
    })
})

function createContextMock() {
    const gradient = { addColorStop: vi.fn() }
    return {
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        ellipse: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        createRadialGradient: vi.fn(() => gradient),
    }
}
