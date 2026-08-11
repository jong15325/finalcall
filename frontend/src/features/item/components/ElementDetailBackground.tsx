import { useEffect, useRef, useState } from 'react'
import { toElementKey } from '@/features/item/lib/element'
import type { ElementKey } from '@/features/item/lib/element'
import { useRouteVisualTheme } from '@/components/layout/RouteVisualThemeContext'
import './ElementDetailBackground.css'

const BACKGROUND_ROOT = '/img/backgrounds/item-elements'

export default function ElementDetailBackground({
    element,
    children,
}: {
    element: number
    children: React.ReactNode
}) {
    const key = toElementKey(element)
    const [loadedKey, setLoadedKey] = useState<ElementKey | null>(null)
    const [lowPower] = useState(isLowPowerDevice)
    const { registerTheme } = useRouteVisualTheme()

    useEffect(() => {
        registerTheme(key)
        return () => registerTheme(null)
    }, [key, registerTheme])

    useEffect(() => {
        setLoadedKey(null)
        if (!key) return

        let active = true
        const image = new Image()
        image.onload = () => {
            if (active) setLoadedKey(key)
        }
        image.onerror = () => {
            if (active) setLoadedKey(null)
        }
        image.src = `${BACKGROUND_ROOT}/${key}-detail-v3.jpg`

        return () => {
            active = false
            image.onload = null
            image.onerror = null
        }
    }, [key])

    return (
        <div
            className="element-detail"
            data-element={key ?? 'neutral'}
            data-background-loaded={loadedKey === key ? 'true' : 'false'}
            data-performance={lowPower ? 'reduced' : 'full'}
        >
            <div
                className="element-detail__scene fixed inset-0 z-0"
                aria-hidden="true"
            >
                {loadedKey === key && key && (
                    <div
                        className="element-detail__image"
                        style={{
                            backgroundImage: `url(${BACKGROUND_ROOT}/${key}-detail-v3.jpg)`,
                        }}
                    />
                )}
                <div className="element-detail__effect" />
                {loadedKey === key && key && !lowPower && (
                    <AmbientCanvas element={key} />
                )}
            </div>
            <div className="element-detail__content">{children}</div>
        </div>
    )
}

function isLowPowerDevice() {
    const navigatorWithMemory = navigator as Navigator & {
        deviceMemory?: number
    }
    return (
        (navigator.hardwareConcurrency > 0 &&
            navigator.hardwareConcurrency <= 4) ||
        (navigatorWithMemory.deviceMemory !== undefined &&
            navigatorWithMemory.deviceMemory <= 4) ||
        window.matchMedia('(update: slow)').matches
    )
}

function AmbientCanvas({ element }: { element: ElementKey }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context) return

        const reducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        )
        const coarsePointer = window.matchMedia('(pointer: coarse)')
        const forcedColors = window.matchMedia('(forced-colors: active)')
        let frame = 0
        let visible = !document.hidden
        let previous = 0
        let width = 0
        let height = 0
        let resizeTimer: ReturnType<typeof setTimeout> | null = null
        const particleCount = coarsePointer.matches ? 24 : 48
        const particles = Array.from({ length: particleCount }, (_, index) => ({
            x: ((index * 47) % 97) / 100,
            y: -((index * 31) % 100) / 100,
            speed: 0.16 + (index % 5) * 0.025,
            size: 1.2 + (index % 4) * 0.45,
        }))

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
            const color = {
                water: 'rgba(220, 250, 255, .5)',
                fire: 'rgba(255, 170, 80, .42)',
                earth: 'rgba(210, 230, 170, .38)',
                wind: 'rgba(220, 255, 248, .46)',
            }[element]
            context.strokeStyle = color
            context.fillStyle = color
            context.lineWidth = 1

            for (const particle of particles) {
                const direction = element === 'fire' ? -1 : 1
                particle.y += particle.speed * delta * direction
                if (particle.y > 0.95) particle.y = -0.08
                if (particle.y < -0.1) particle.y = 0.92
                const x = width * (0.08 + particle.x * 0.84)
                const y = height * particle.y
                context.beginPath()
                if (element === 'water') {
                    context.moveTo(x, y - particle.size * 5)
                    context.lineTo(x, y)
                    context.stroke()
                } else {
                    context.arc(x, y, particle.size, 0, Math.PI * 2)
                    context.fill()
                }
            }
            if (visible && !reducedMotion.matches) {
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
                coarsePointer.matches ||
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

        const onResize = () => {
            if (resizeTimer !== null) clearTimeout(resizeTimer)
            resizeTimer = setTimeout(() => {
                resizeTimer = null
                resize()
            }, 120)
        }

        resize()
        start()
        window.addEventListener('resize', onResize, { passive: true })
        document.addEventListener('visibilitychange', onVisibilityChange)
        reducedMotion.addEventListener('change', start)
        forcedColors.addEventListener('change', start)
        return () => {
            stop()
            if (resizeTimer !== null) clearTimeout(resizeTimer)
            window.removeEventListener('resize', onResize)
            document.removeEventListener('visibilitychange', onVisibilityChange)
            reducedMotion.removeEventListener('change', start)
            forcedColors.removeEventListener('change', start)
        }
    }, [element])

    return (
        <canvas
            ref={canvasRef}
            className="element-detail__ambient-canvas"
            data-particle-limit="48"
            aria-hidden="true"
        />
    )
}
