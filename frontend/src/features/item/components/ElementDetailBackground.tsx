import { useEffect, useRef } from 'react'
import { toElementKey } from '@/features/item/lib/element'
import type { ElementKey } from '@/features/item/lib/element'
import {
    RouteAccentScope,
    useRouteAccent,
} from '@/components/layout/RouteAccentContext'
import './ElementDetailBackground.css'

export default function ElementDetailBackground({
    element,
    children,
}: {
    element: number
    children: React.ReactNode
    ambientOnly?: boolean
}) {
    const key = toElementKey(element)
    const { registerAccent } = useRouteAccent()

    useEffect(() => {
        registerAccent(key)
        return () => registerAccent(null)
    }, [key, registerAccent])

    return (
        <RouteAccentScope accent={key}>
            <div className="element-detail" data-element={key ?? 'neutral'}>
                <div className="element-detail__content">{children}</div>
            </div>
        </RouteAccentScope>
    )
}

export function AmbientCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context) return

        const reducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        )
        const coarsePointer = window.matchMedia('(pointer: coarse)')
        const mobileViewport = window.matchMedia('(max-width: 639px)')
        const slowUpdates = window.matchMedia('(update: slow)')
        const forcedColors = window.matchMedia('(forced-colors: active)')
        let frame = 0
        let visible = !document.hidden
        let previous = 0
        let width = 0
        let height = 0
        let resizeTimer: ReturnType<typeof setTimeout> | null = null
        const elements: ElementKey[] = ['earth', 'fire', 'wind', 'water']
        const desktopBounds = {
            earth: [0, 0.43, 0, 0.43],
            wind: [0, 0.43, 0.35, 1],
            fire: [0.55, 1, 0, 0.47],
            water: [0.52, 1, 0.39, 1],
        } as const
        const mobileBounds = {
            earth: [0, 0.43, 0.37, 0.482],
            wind: [0, 0.43, 0.461, 0.63],
            fire: [0.55, 1, 0.37, 0.492],
            water: [0.52, 1, 0.471, 0.63],
        } as const
        let particles: AmbientParticle[] = []

        const seedParticles = () => {
            const particleCount = coarsePointer.matches ? 24 : 48
            particles = Array.from({ length: particleCount }, (_, index) => ({
                element: elements[index % elements.length],
                x: ((index * 47) % 97) / 100,
                y: ((index * 37) % 97) / 100,
                speed: 0.16 + (index % 5) * 0.025,
                size: 1.2 + (index % 4) * 0.45,
                phase: index * 0.73,
                drift: ((index % 7) - 3) * 0.008,
            }))
            canvas.dataset.particleLimit = String(particleCount)
        }

        const resize = () => {
            const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
            width = canvas.clientWidth
            height = canvas.clientHeight
            canvas.width = Math.round(width * ratio)
            canvas.height = Math.round(height * ratio)
            context.setTransform(ratio, 0, 0, ratio, 0, 0)
        }

        const draw = (time: number) => {
            const delta = Math.min((time - previous) / 1000 || 0, 0.04)
            previous = time
            context.clearRect(0, 0, width, height)
            const bounds = mobileViewport.matches ? mobileBounds : desktopBounds
            for (const particle of particles) {
                const [minX, maxX, minY, maxY] = bounds[particle.element]
                const drawParticle = {
                    ...particle,
                    x: minX + particle.x * (maxX - minX),
                    y: minY + particle.y * (maxY - minY),
                }
                if (particle.element === 'wind') {
                    particle.x += particle.speed * delta * 0.52
                    particle.y +=
                        Math.sin(time * 0.0011 + particle.phase) * delta * 0.01
                } else if (particle.element === 'fire') {
                    particle.y -= particle.speed * delta * 0.9
                    particle.x +=
                        Math.sin(time * 0.0015 + particle.phase) * delta * 0.006
                    drawFire(context, drawParticle, width, height, time)
                } else if (particle.element === 'earth') {
                    particle.x += particle.drift * delta
                    particle.y +=
                        Math.sin(time * 0.0007 + particle.phase) * delta * 0.009
                    drawEarth(context, drawParticle, width, height, time)
                } else {
                    particle.y +=
                        particle.speed *
                        delta *
                        (1.65 + Math.max(0, particle.y) * 1.35)
                    drawWater(context, drawParticle, width, height)
                }
                if (particle.y < -0.1) particle.y = 1.02
                if (particle.y > 1.02) particle.y = -0.08
                if (particle.x < -0.1) particle.x = 1.02
                if (particle.x > 1.02) particle.x = -0.08
            }
            drawWindField(context, particles, bounds.wind, width, height, time)
            if (
                visible &&
                !reducedMotion.matches &&
                !slowUpdates.matches &&
                !forcedColors.matches
            ) {
                frame = requestAnimationFrame(draw)
            }
        }

        const stop = () => {
            cancelAnimationFrame(frame)
            frame = 0
        }

        const start = () => {
            stop()
            if (
                !visible ||
                reducedMotion.matches ||
                slowUpdates.matches ||
                forcedColors.matches
            ) {
                context.clearRect(0, 0, width, height)
                return
            }
            previous = 0
            frame = requestAnimationFrame(draw)
        }

        const onVisibilityChange = () => {
            visible = !document.hidden
            start()
        }

        const onCoarsePointerChange = () => {
            seedParticles()
            start()
        }

        const onResize = () => {
            if (resizeTimer !== null) clearTimeout(resizeTimer)
            resizeTimer = setTimeout(() => {
                resizeTimer = null
                resize()
            }, 120)
        }

        seedParticles()
        resize()
        start()
        window.addEventListener('resize', onResize, { passive: true })
        document.addEventListener('visibilitychange', onVisibilityChange)
        reducedMotion.addEventListener('change', start)
        coarsePointer.addEventListener('change', onCoarsePointerChange)
        mobileViewport.addEventListener('change', start)
        slowUpdates.addEventListener('change', start)
        forcedColors.addEventListener('change', start)
        return () => {
            stop()
            if (resizeTimer !== null) clearTimeout(resizeTimer)
            window.removeEventListener('resize', onResize)
            document.removeEventListener('visibilitychange', onVisibilityChange)
            reducedMotion.removeEventListener('change', start)
            coarsePointer.removeEventListener('change', onCoarsePointerChange)
            mobileViewport.removeEventListener('change', start)
            slowUpdates.removeEventListener('change', start)
            forcedColors.removeEventListener('change', start)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="element-detail__ambient-canvas"
            data-particle-limit="48"
            aria-hidden="true"
        />
    )
}

interface AmbientParticle {
    element: ElementKey
    x: number
    y: number
    speed: number
    size: number
    phase: number
    drift: number
}

type ElementBounds = readonly [number, number, number, number]

const AMBIENT_COLORS = {
    wind: 'rgba(220, 255, 248, .5)',
    fireCore: 'rgba(255, 220, 120, .72)',
    fireEdge: 'rgba(255, 70, 20, 0)',
    fireFill: 'rgba(255, 155, 48, .58)',
    earthCore: 'rgba(232, 255, 184, .72)',
    earthMid: 'rgba(158, 205, 92, .26)',
    earthEdge: 'rgba(84, 120, 48, 0)',
    earthFill: 'rgba(94, 132, 56, .34)',
    earthStroke: 'rgba(232, 250, 190, .74)',
    waterStroke: 'rgba(225, 250, 253, .62)',
    waterFill: 'rgba(220, 250, 255, .46)',
    waterDrop: 'rgba(225, 250, 253, .44)',
} as const

function drawWindField(
    context: CanvasRenderingContext2D,
    particles: readonly AmbientParticle[],
    bounds: ElementBounds,
    width: number,
    height: number,
    time: number,
) {
    const [minX, maxX, minY, maxY] = bounds
    const regionX = minX * width
    const regionY = minY * height
    const regionWidth = (maxX - minX) * width
    const regionHeight = (maxY - minY) * height

    context.save()
    context.beginPath()
    context.rect(regionX, regionY, regionWidth, regionHeight)
    context.clip()
    context.globalCompositeOperation = 'screen'
    context.lineCap = 'round'

    for (const particle of particles) {
        if (particle.element !== 'wind') continue
        const x = (minX + particle.x * (maxX - minX)) * width
        const y = (minY + particle.y * (maxY - minY)) * height
        const length = Math.min(regionWidth * 0.24, particle.size * 42)
        const wave = Math.sin(time * 0.001 + particle.phase) * particle.size * 7

        context.beginPath()
        context.moveTo(x - length, y + wave * 0.25)
        context.bezierCurveTo(
            x - length * 0.7,
            y - wave,
            x - length * 0.28,
            y + wave * 0.8,
            x + particle.size * 8,
            y,
        )
        context.strokeStyle = AMBIENT_COLORS.wind
        context.globalAlpha = 0.14
        context.lineWidth = 5 + particle.size * 1.8
        context.stroke()
        context.globalAlpha = 0.48
        context.lineWidth = 0.7 + particle.size * 0.42
        context.stroke()
    }

    drawGustPulseBands(context, bounds, width, height, time)
    context.restore()
    context.globalAlpha = 1
    context.globalCompositeOperation = 'source-over'
}

function drawGustPulseBands(
    context: CanvasRenderingContext2D,
    bounds: ElementBounds,
    width: number,
    height: number,
    time: number,
) {
    const cycle = (time % 6200) / 6200
    if (cycle < 0.12 || cycle > 0.34) return

    const intensity = Math.sin(((cycle - 0.12) / 0.22) * Math.PI)
    const [minX, maxX, minY, maxY] = bounds
    const left = minX * width
    const right = maxX * width
    const regionHeight = (maxY - minY) * height
    const progress = (cycle - 0.12) / 0.22

    context.strokeStyle = AMBIENT_COLORS.wind
    for (let band = 0; band < 3; band += 1) {
        const y =
            (minY + 0.24 * (maxY - minY)) * height + band * regionHeight * 0.2
        const phase = progress * Math.PI * 2 + band * 0.8
        context.beginPath()
        context.moveTo(left - regionHeight * 0.08, y)
        context.bezierCurveTo(
            left + (right - left) * 0.3,
            y - Math.sin(phase) * regionHeight * 0.08,
            left + (right - left) * 0.68,
            y + Math.cos(phase) * regionHeight * 0.07,
            right + regionHeight * 0.08,
            y - Math.sin(phase * 0.7) * regionHeight * 0.04,
        )
        context.globalAlpha = intensity * (0.18 - band * 0.035)
        context.lineWidth = 2.6 + band * 1.2
        context.stroke()
    }
}

function drawFire(
    context: CanvasRenderingContext2D,
    particle: AmbientParticle,
    width: number,
    height: number,
    time: number,
) {
    const x = particle.x * width
    const y = particle.y * height
    const pulse = 2.8 + Math.sin(time * 0.004 + particle.phase) * 1.2
    const glow = context.createRadialGradient(
        x,
        y,
        0,
        x,
        y,
        particle.size * pulse,
    )
    glow.addColorStop(0, AMBIENT_COLORS.fireCore)
    glow.addColorStop(1, AMBIENT_COLORS.fireEdge)
    context.fillStyle = glow
    context.beginPath()
    context.arc(x, y, particle.size * pulse, 0, Math.PI * 2)
    context.fill()
    context.beginPath()
    context.moveTo(x, y - particle.size * 4)
    context.quadraticCurveTo(x + particle.size * 2, y, x, y + particle.size)
    context.quadraticCurveTo(x - particle.size * 2, y, x, y - particle.size * 4)
    context.fillStyle = AMBIENT_COLORS.fireFill
    context.fill()
}

function drawEarth(
    context: CanvasRenderingContext2D,
    particle: AmbientParticle,
    width: number,
    height: number,
    time: number,
) {
    const x = particle.x * width
    const y = particle.y * height
    const glow = context.createRadialGradient(x, y, 0, x, y, particle.size * 6)
    glow.addColorStop(0, AMBIENT_COLORS.earthCore)
    glow.addColorStop(0.48, AMBIENT_COLORS.earthMid)
    glow.addColorStop(1, AMBIENT_COLORS.earthEdge)
    context.fillStyle = glow
    context.beginPath()
    context.arc(x, y, particle.size * 6, 0, Math.PI * 2)
    context.fill()
    context.save()
    context.translate(x, y)
    context.rotate(time * 0.0002 + particle.phase)
    context.fillStyle = AMBIENT_COLORS.earthFill
    context.strokeStyle = AMBIENT_COLORS.earthStroke
    context.lineWidth = 0.8 + particle.size * 0.12
    context.beginPath()
    context.moveTo(-particle.size * 2.8, 0)
    context.lineTo(0, -particle.size * 2.8)
    context.lineTo(particle.size * 2.8, 0)
    context.lineTo(0, particle.size * 2.8)
    context.closePath()
    context.fill()
    context.stroke()
    context.restore()
}

function drawWater(
    context: CanvasRenderingContext2D,
    particle: AmbientParticle,
    width: number,
    height: number,
) {
    const x = particle.x * width
    const impactY = Math.min(0.94, particle.y + 0.12) * height
    const y = particle.y * height
    const size = particle.size + 0.8
    if (y < impactY) {
        context.strokeStyle = AMBIENT_COLORS.waterStroke
        context.beginPath()
        context.moveTo(x - particle.drift * 60, y - size * 5)
        context.lineTo(x, y)
        context.stroke()
        context.beginPath()
        context.ellipse(
            x,
            y,
            size,
            size * 1.16,
            particle.drift * 6,
            0,
            Math.PI * 2,
        )
        context.fillStyle = AMBIENT_COLORS.waterFill
        context.fill()
        return
    }
    const progress = Math.min(1, (y - impactY) / Math.max(1, height - impactY))
    context.strokeStyle = `rgba(220, 250, 255, ${0.55 * (1 - progress)})`
    context.beginPath()
    context.ellipse(
        x,
        impactY,
        size * (2 + progress * 7),
        size * (0.5 + progress),
        0,
        0,
        Math.PI * 2,
    )
    context.stroke()
    if (progress < 0.42 && particle.phase % 4 > 2.4) {
        context.beginPath()
        context.ellipse(
            x + size,
            impactY - size * Math.sin(progress * Math.PI) * 2.2,
            size * 0.5,
            size,
            0,
            0,
            Math.PI * 2,
        )
        context.fillStyle = AMBIENT_COLORS.waterDrop
        context.fill()
    }
}
