import { useEffect, useRef } from 'react'
import type {
    WindParticleOption,
    WIND_PARTICLE_COLORS,
} from '../fixtures/windParticles'

type WindColors = typeof WIND_PARTICLE_COLORS

interface WindParticleCanvasProps {
    option: WindParticleOption
    colors: WindColors
}

interface Particle {
    x: number
    y: number
    speed: number
    size: number
    phase: number
}

interface Frame {
    context: CanvasRenderingContext2D
    width: number
    height: number
    time: number
    particles: readonly Particle[]
    colors: WindColors
    coarse: boolean
}

const FALLBACK_WIDTH = 560
const FALLBACK_HEIGHT = 480
const FRAME_INTERVAL = 1000 / 30

export default function WindParticleCanvas({
    option,
    colors,
}: WindParticleCanvasProps) {
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
        const slowUpdate = connection?.saveData === true
        const staticFrame = reducedMotion || slowUpdate
        const particleCount = coarse
            ? Math.ceil(option.particleCount / 2)
            : option.particleCount
        const particles = createParticles(option.seed, particleCount)
        let animationFrame = 0
        let previousFrame = 0

        canvas.dataset.motionMode = staticFrame
            ? 'static'
            : coarse
              ? 'capped'
              : 'animated'
        canvas.dataset.particleCount = String(particleCount)

        const draw = (time: number) => {
            const width = canvas.clientWidth || FALLBACK_WIDTH
            const height = Math.round((width * 6) / 7) || FALLBACK_HEIGHT
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
            context.globalCompositeOperation = 'source-over'
            context.globalAlpha = 0.24
            context.fillStyle = colors.depth
            context.fillRect(0, 0, width, height)
            context.globalAlpha = 1
            context.filter = 'none'

            renderVariant(option.renderer, {
                context,
                width,
                height,
                time: time / 1000,
                particles,
                colors,
                coarse,
            })
            context.globalCompositeOperation = 'source-over'
            context.globalAlpha = 1
            context.filter = 'none'
        }

        if (staticFrame) {
            draw(1800)
            return
        }

        const tick = (time: number) => {
            if (!coarse || time - previousFrame >= FRAME_INTERVAL) {
                draw(time)
                previousFrame = time
            }
            animationFrame = window.requestAnimationFrame(tick)
        }
        animationFrame = window.requestAnimationFrame(tick)

        return () => window.cancelAnimationFrame(animationFrame)
    }, [colors, option])

    return (
        <div className="relative overflow-hidden rounded-xl border border-chrome-selected bg-chrome-strong">
            <img
                src="/img/backgrounds/world-map/world-map-1920.jpg"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
            />
            <canvas
                ref={canvasRef}
                width={FALLBACK_WIDTH}
                height={FALLBACK_HEIGHT}
                data-wind-canvas={option.id}
                data-renderer={option.renderer}
                className="relative block h-auto w-full"
                aria-label={`${option.name} 바람 파티클 미리보기`}
                role="img"
            />
        </div>
    )
}

function createParticles(seed: number, count: number): Particle[] {
    const random = mulberry32(seed)
    return Array.from({ length: count }, () => ({
        x: random(),
        y: random(),
        speed: 0.045 + random() * 0.12,
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

function renderVariant(renderer: WindParticleOption['renderer'], frame: Frame) {
    switch (renderer) {
        case 'streamline':
            drawStreamlines(frame)
            break
        case 'silk-ribbon':
            drawSilkRibbons(frame)
            break
        case 'curl-noise':
            drawCurlField(frame)
            break
        case 'smoke':
            drawSmoke(frame)
            break
        case 'gust-bands':
            drawGustBands(frame)
            break
        case 'vortex':
            drawVortexShedding(frame)
            break
        case 'feathered':
            drawFeatheredDashes(frame)
            break
        case 'dust':
            drawLuminousDust(frame)
            break
        case 'pressure':
            drawPressureContours(frame)
            break
        case 'hybrid':
            drawSilkRibbons(frame, 0.55)
            drawSmoke(frame, 0.55)
            break
    }
}

function drawStreamlines(frame: Frame) {
    const { context, width, height, time, particles, colors } = frame
    context.lineCap = 'round'
    context.strokeStyle = colors.bright
    context.lineWidth = 1.4
    for (const particle of particles) {
        const x = wrap(particle.x + time * particle.speed, 1) * width
        const y =
            (particle.y * 0.82 + 0.09) * height +
            Math.sin(x * 0.018 + particle.phase) * height * 0.035
        const tail = width * (0.07 + particle.speed * 0.18)
        context.globalAlpha = 0.28 + particle.size * 0.2
        context.beginPath()
        context.moveTo(x - tail, y + Math.sin(particle.phase) * 8)
        context.quadraticCurveTo(x - tail * 0.45, y - 10, x, y)
        context.stroke()
    }
}

function drawSilkRibbons(frame: Frame, opacity = 1) {
    const { context, width, height, time, particles, colors } = frame
    context.globalCompositeOperation = 'screen'
    context.lineCap = 'round'
    for (let index = 0; index < Math.min(6, particles.length); index += 1) {
        const particle = particles[index]
        const phase = particle.phase + time * (0.18 + particle.speed)
        const y = height * (0.22 + index * 0.115)
        context.beginPath()
        context.moveTo(-width * 0.08, y + Math.sin(phase) * 18)
        context.bezierCurveTo(
            width * 0.24,
            y - 58 + Math.cos(phase) * 22,
            width * 0.6,
            y + 64 + Math.sin(phase * 0.7) * 20,
            width * 1.08,
            y - 12 + Math.cos(phase * 0.8) * 16,
        )
        context.strokeStyle = index % 2 === 0 ? colors.flow : colors.mist
        context.lineWidth = 7 + index * 1.8
        context.globalAlpha = (0.1 + index * 0.018) * opacity
        context.stroke()
        context.lineWidth = 1.2
        context.strokeStyle = colors.bright
        context.globalAlpha = (0.38 - index * 0.035) * opacity
        context.stroke()
    }
}

function drawCurlField(frame: Frame) {
    const { context, width, height, time, particles, colors } = frame
    context.strokeStyle = colors.flow
    context.lineCap = 'round'
    context.lineWidth = 1.3
    for (const particle of particles) {
        const x = wrap(particle.x + time * particle.speed * 0.55, 1) * width
        const field = Math.sin(x * 0.024 + particle.phase + time * 0.35)
        const y = (particle.y * 0.88 + 0.06) * height + field * height * 0.075
        const tangent = Math.cos(x * 0.024 + particle.phase + time * 0.35)
        context.globalAlpha = 0.25 + particle.size * 0.18
        context.beginPath()
        context.moveTo(x - 15, y - tangent * 14)
        context.quadraticCurveTo(x, y + field * 9, x + 10, y + tangent * 8)
        context.stroke()
    }
}

function drawSmoke(frame: Frame, opacity = 1) {
    const { context, width, height, time, particles, colors, coarse } = frame
    context.globalCompositeOperation = 'screen'
    context.fillStyle = colors.mist
    context.filter = coarse ? 'none' : 'blur(5px)'
    for (const particle of particles) {
        const progress = wrap(particle.x + time * particle.speed * 0.28, 1)
        const x = progress * width
        const y =
            (0.2 + particle.y * 0.64) * height +
            Math.sin(progress * 12 + particle.phase) * 22
        context.globalAlpha = (0.035 + particle.size * 0.035) * opacity
        context.beginPath()
        context.ellipse(
            x,
            y,
            34 + particle.size * 17,
            8 + particle.size * 5,
            -0.18 + Math.sin(particle.phase) * 0.12,
            0,
            Math.PI * 2,
        )
        context.fill()
    }
    context.filter = 'none'
}

function drawGustBands(frame: Frame) {
    const { context, width, height, time, particles, colors } = frame
    context.lineCap = 'round'
    context.globalCompositeOperation = 'screen'
    for (let index = 0; index < Math.min(5, particles.length); index += 1) {
        const phase = time * 1.2 + particles[index].phase
        const pulse = 0.12 + Math.max(0, Math.sin(phase)) * 0.32
        const y = height * (0.2 + index * 0.16)
        context.beginPath()
        context.moveTo(-30, y)
        context.bezierCurveTo(
            width * 0.28,
            y - 28,
            width * 0.68,
            y + 32,
            width + 30,
            y - 8,
        )
        context.strokeStyle = index % 2 === 0 ? colors.bright : colors.flow
        context.lineWidth = 3 + index * 1.4
        context.globalAlpha = pulse
        context.stroke()
    }
}

function drawVortexShedding(frame: Frame) {
    const { context, width, height, time, particles, colors } = frame
    context.strokeStyle = colors.flow
    context.lineCap = 'round'
    context.lineWidth = 1.5
    for (const particle of particles) {
        const progress = wrap(particle.x + time * particle.speed * 0.6, 1)
        const row = Math.floor(particle.y * 5)
        const direction = row % 2 === 0 ? 1 : -1
        const centerX = progress * width
        const centerY = height * (0.2 + row * 0.15)
        const angle = particle.phase + time * direction * 0.8
        const radius = 8 + progress * 26
        context.globalAlpha = 0.22 + particle.size * 0.16
        context.beginPath()
        context.arc(
            centerX + Math.cos(angle) * radius,
            centerY + Math.sin(angle) * radius,
            radius * 0.7,
            angle,
            angle + Math.PI * 1.25 * direction,
            direction < 0,
        )
        context.stroke()
    }
}

function drawFeatheredDashes(frame: Frame) {
    const { context, width, height, time, particles, colors } = frame
    context.strokeStyle = colors.bright
    context.lineCap = 'round'
    context.lineWidth = 1.1
    for (const particle of particles) {
        const x = wrap(particle.x + time * particle.speed, 1) * width
        const y =
            (particle.y * 0.86 + 0.07) * height +
            Math.sin(x * 0.02 + particle.phase) * 12
        const length = 9 + particle.size * 6
        context.globalAlpha = 0.3 + particle.size * 0.18
        context.beginPath()
        context.moveTo(x - length, y)
        context.lineTo(x + length, y - 3)
        context.moveTo(x - 2, y - 1)
        context.lineTo(x - 9, y - 8)
        context.moveTo(x + 4, y - 2)
        context.lineTo(x - 2, y + 6)
        context.stroke()
    }
}

function drawLuminousDust(frame: Frame) {
    const { context, width, height, time, particles, colors } = frame
    context.globalCompositeOperation = 'lighter'
    for (const particle of particles) {
        const x = wrap(particle.x + time * particle.speed * 0.72, 1) * width
        const y =
            (particle.y * 0.82 + 0.09) * height +
            Math.sin(x * 0.017 + particle.phase) * 20
        const radius = 2.5 + particle.size * 2.5
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, colors.bright)
        gradient.addColorStop(1, colors.depth)
        context.fillStyle = gradient
        context.globalAlpha = 0.3 + particle.size * 0.18
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
    }
}

function drawPressureContours(frame: Frame) {
    const { context, width, height, time, particles, colors } = frame
    context.strokeStyle = colors.mist
    context.lineWidth = 1.1
    for (let index = 0; index < 5; index += 1) {
        const centerX =
            wrap(0.08 + index * 0.22 + time * 0.018 * (index + 1), 1) * width
        const centerY = height * (0.28 + (index % 3) * 0.19)
        context.globalAlpha = 0.18 + index * 0.045
        context.beginPath()
        context.ellipse(
            centerX,
            centerY,
            56 + index * 10,
            22 + index * 6,
            -0.12,
            0,
            Math.PI * 2,
        )
        context.stroke()
    }
    context.fillStyle = colors.bright
    for (const particle of particles) {
        const x = wrap(particle.x + time * particle.speed * 0.35, 1) * width
        const y = (particle.y * 0.76 + 0.12) * height
        context.globalAlpha = 0.3
        context.beginPath()
        context.arc(x, y, 1.2 + particle.size * 0.5, 0, Math.PI * 2)
        context.fill()
    }
}

function wrap(value: number, limit: number) {
    return ((value % limit) + limit) % limit
}
