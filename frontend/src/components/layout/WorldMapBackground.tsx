import { useState } from 'react'
import { AmbientCanvas } from '@/features/item/components/ElementDetailBackground'
import type { ElementKey } from '@/features/item/lib/element'
import './WorldMapBackground.css'

export default function WorldMapBackground({
    accent,
}: {
    accent: ElementKey | null
}) {
    const [failed, setFailed] = useState(false)

    return (
        <div
            className="world-map-background fixed inset-0 z-0 overflow-hidden pointer-events-none"
            data-accent={accent ?? 'neutral'}
            data-image-state={failed ? 'failed' : 'ready'}
            aria-hidden="true"
        >
            {!failed && (
                <picture>
                    <source
                        type="image/avif"
                        media="(max-width: 639px)"
                        srcSet="/img/backgrounds/world-map/world-map-mobile.avif"
                    />
                    <source
                        type="image/avif"
                        srcSet="/img/backgrounds/world-map/world-map-1920.avif"
                    />
                    <source
                        type="image/webp"
                        media="(max-width: 639px)"
                        srcSet="/img/backgrounds/world-map/world-map-mobile.webp"
                    />
                    <source
                        type="image/webp"
                        srcSet="/img/backgrounds/world-map/world-map-1920.webp"
                    />
                    <source
                        type="image/jpeg"
                        media="(max-width: 639px)"
                        srcSet="/img/backgrounds/world-map/world-map-mobile.jpg"
                    />
                    <img
                        className="world-map-background__image"
                        src="/img/backgrounds/world-map/world-map-1920.jpg"
                        alt=""
                        onError={() => setFailed(true)}
                    />
                </picture>
            )}
            <div className="world-map-background__glow world-map-background__glow--earth" />
            <div className="world-map-background__glow world-map-background__glow--wind" />
            <div className="world-map-background__glow world-map-background__glow--fire" />
            <div className="world-map-background__glow world-map-background__glow--water" />
            <AmbientCanvas />
        </div>
    )
}
