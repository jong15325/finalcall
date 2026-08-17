import { useEffect, useRef } from 'react'

export interface ElementParticle {
    x: number
    y: number
    speed: number
    size: number
    phase: number
}

export interface ElementParticleFrame<TColors> {
    context: CanvasRenderingContext2D
    width: number
    height: number
    time: number
    particles: readonly ElementParticle[]
    colors: TColors
    coarse: boolean
}

interface ElementParticleCanvasProps<TColors, TRenderer extends string> {
    id: string
    label: string
    particleCount: number
    seed: number
    colors: TColors
    renderer: TRenderer
    staticTime: number
    renderFrame: (
        renderer: TRenderer,
        frame: ElementParticleFrame<TColors>,
    ) => void
    dataAttribute: 'fire' | 'water'
    region: {
        viewBox: string
        heightRatio: number
    }
}

const FALLBACK_WIDTH = 560
const FRAME_INTERVAL = 1000 / 30

export default function ElementParticleCanvas<
    TColors,
    TRenderer extends string,
>({
    id,
    label,
    particleCount,
    seed,
    colors,
    renderer,
    staticTime,
    renderFrame,
    dataAttribute,
    region,
}: ElementParticleCanvasProps<TColors, TRenderer>) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context) return

        const reducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches
        const coarse = window.matchMedia('(pointer: coarse)').matches
        const connection = (
            navigator as Navigator & { connection?: { saveData?: boolean } }
        ).connection
        const staticFrame = reducedMotion || connection?.saveData === true
        const count = coarse ? Math.ceil(particleCount / 2) : particleCount
        const particles = createParticles(seed, count)
        let animationFrame = 0
        let previousFrame = 0

        canvas.dataset.motionMode = staticFrame
            ? 'static'
            : coarse
              ? 'capped'
              : 'animated'
        canvas.dataset.particleCount = String(count)

        const draw = (time: number) => {
            const width = canvas.clientWidth || FALLBACK_WIDTH
            const height = Math.round(width * region.heightRatio)
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
            const targetWidth = Math.round(width * pixelRatio)
            const targetHeight = Math.round(height * pixelRatio)
            if (
                canvas.width !== targetWidth ||
                canvas.height !== targetHeight
            ) {
                canvas.width = targetWidth
                canvas.height = targetHeight
            }
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
            context.clearRect(0, 0, width, height)
            context.globalAlpha = 1
            context.globalCompositeOperation = 'source-over'
            context.filter = 'none'
            renderFrame(renderer, {
                context,
                width,
                height,
                time: time / 1000,
                particles,
                colors,
                coarse,
            })
            context.globalAlpha = 1
            context.globalCompositeOperation = 'source-over'
            context.filter = 'none'
        }

        if (staticFrame) {
            draw(staticTime)
            return
        }

        const tick = (time: number) => {
            if (!coarse || time - previousFrame >= FRAME_INTERVAL) {
                draw(time)
                previousFrame = time
            }
            animationFrame = window.requestAnimationFrame(tick)
        }
        const start = () => {
            window.cancelAnimationFrame(animationFrame)
            animationFrame = 0
            if (!document.hidden) {
                animationFrame = window.requestAnimationFrame(tick)
            }
        }
        const onVisibilityChange = () => start()

        start()
        document.addEventListener('visibilitychange', onVisibilityChange)

        return () => {
            window.cancelAnimationFrame(animationFrame)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [
        colors,
        particleCount,
        region.heightRatio,
        renderFrame,
        renderer,
        seed,
        staticTime,
    ])

    const data =
        dataAttribute === 'fire'
            ? { 'data-fire-canvas': id }
            : { 'data-water-canvas': id }

    return (
        <div className="relative overflow-hidden rounded-xl border border-chrome-selected bg-chrome-strong">
            <svg
                aria-hidden="true"
                viewBox={region.viewBox}
                className="pointer-events-none absolute inset-0 h-full w-full"
            >
                <image
                    href="/img/backgrounds/world-map/world-map-1920.jpg"
                    width="1920"
                    height="1080"
                />
            </svg>
            <canvas
                ref={canvasRef}
                width={FALLBACK_WIDTH}
                height={Math.round(FALLBACK_WIDTH * region.heightRatio)}
                {...data}
                data-renderer={renderer}
                className="relative block h-auto w-full"
                aria-label={label}
                role="img"
            />
        </div>
    )
}

function createParticles(seed: number, count: number): ElementParticle[] {
    const random = mulberry32(seed)
    return Array.from({ length: count }, () => ({
        x: random(),
        y: random(),
        speed: 0.04 + random() * 0.13,
        size: 0.6 + random() * 1.8,
        phase: random() * Math.PI * 2,
    }))
}

function mulberry32(seed: number) {
    let state = seed
    return () => {
        state += 0x6d2b79f5
        let value = state
        value = Math.imul(value ^ (value >>> 15), value | 1)
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
}
