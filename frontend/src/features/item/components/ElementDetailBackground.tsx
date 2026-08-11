import { useEffect, useRef, useState } from 'react'
import { toElementKey } from '@/features/item/lib/element'
import type { ElementKey } from '@/features/item/lib/element'
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
            <div className="element-detail__scene" aria-hidden="true">
                {loadedKey === key && key && (
                    <div
                        className="element-detail__image"
                        style={{
                            backgroundImage: `url(${BACKGROUND_ROOT}/${key}-detail-v3.jpg)`,
                        }}
                    />
                )}
                <div className="element-detail__effect" />
                {key === 'water' && !lowPower && <WaterDrops />}
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

function WaterDrops() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context) return

        const reducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        )
        const coarsePointer = window.matchMedia('(pointer: coarse)')
        if (reducedMotion.matches || coarsePointer.matches) return

        let frame = 0
        let visible = !document.hidden
        let previous = 0
        let width = 0
        let height = 0
        const drops = Array.from({ length: 18 }, (_, index) => ({
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
            context.strokeStyle = 'rgba(220, 250, 255, .5)'
            context.lineWidth = 1

            for (const drop of drops) {
                drop.y += drop.speed * delta
                if (drop.y > 0.9) drop.y = -0.08
                const x = width * (0.42 + drop.x * 0.55)
                const y = height * drop.y
                context.beginPath()
                context.moveTo(x, y - drop.size * 5)
                context.lineTo(x, y)
                context.stroke()
            }
            if (visible) frame = requestAnimationFrame(draw)
        }

        const onVisibilityChange = () => {
            visible = !document.hidden
            cancelAnimationFrame(frame)
            if (visible) {
                previous = 0
                frame = requestAnimationFrame(draw)
            }
        }

        resize()
        frame = requestAnimationFrame(draw)
        window.addEventListener('resize', resize, { passive: true })
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener('resize', resize)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="element-detail__water-drops"
            aria-hidden="true"
        />
    )
}
