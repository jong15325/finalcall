import { useId, useState } from 'react'
import type { ReactNode } from 'react'

export interface ItemCardFlipProps {
    flipped: boolean
    onFlippedChange: (next: boolean) => void
    front: ReactNode
    back: ReactNode
    label: string
    overlay?: ReactNode
    leading?: ReactNode
    artworkAction?: ReactNode
    controlGapAction?: ReactNode
    interaction?: 'click' | 'hover-latch'
    contentLabel?: string
}

/** 카드별 global listener 없이 focus 범위 안에서만 Escape를 처리하는 controlled flip. */
export default function ItemCardFlip({
    flipped,
    onFlippedChange,
    front,
    back,
    label,
    overlay,
    leading,
    artworkAction,
    controlGapAction,
    interaction = 'click',
    contentLabel = '스킬',
}: ItemCardFlipProps) {
    const backId = useId()
    const [hovered, setHovered] = useState(false)
    const [suppressHover, setSuppressHover] = useState(false)
    const hoverLatch = interaction === 'hover-latch'
    const displayedFlipped =
        flipped || (hoverLatch && hovered && !suppressHover)

    const togglePinned = () => {
        if (flipped) {
            onFlippedChange(false)
            if (hovered) setSuppressHover(true)
            return
        }
        onFlippedChange(true)
    }

    const trigger = (
        <button
            type="button"
            className="item-card__skill-flip-trigger"
            data-card-hit-area="flip"
            aria-label={`${label} ${contentLabel} ${displayedFlipped ? '닫기' : '보기'}`}
            aria-expanded={displayedFlipped}
            aria-controls={backId}
            onClick={togglePinned}
        />
    )

    return (
        <div
            className={`item-card__artwork-composition ${hoverLatch ? 'is-hover-latch' : ''}`.trim()}
            onPointerEnter={(event) => {
                if (!hoverLatch || event.pointerType !== 'mouse') return
                setHovered(true)
            }}
            onPointerLeave={(event) => {
                if (!hoverLatch || event.pointerType !== 'mouse') return
                setHovered(false)
                setSuppressHover(false)
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Escape' || !displayedFlipped) return
                event.preventDefault()
                onFlippedChange(false)
                if (hovered) setSuppressHover(true)
            }}
        >
            <div
                className="item-card__skill-flip is-market is-enabled"
                data-flipped={displayedFlipped}
            >
                <div className="item-card__skill-flip-inner">
                    <div
                        aria-hidden={displayedFlipped}
                        inert={displayedFlipped}
                        className="item-card__skill-flip-face item-card__skill-flip-front"
                    >
                        {front}
                    </div>
                    <div
                        id={backId}
                        aria-hidden={!displayedFlipped}
                        inert={!displayedFlipped}
                        className="item-card__skill-flip-face item-card__skill-flip-back"
                    >
                        {back}
                    </div>
                </div>
            </div>
            {hoverLatch ? trigger : null}
            <div className="item-card__artwork-controls">
                <div className="item-card__control-gap">{controlGapAction}</div>
                {hoverLatch ? null : trigger}
                <div className="item-card__control-gap">{controlGapAction}</div>
                {overlay ? (
                    <div
                        className="item-card__secondary-actions"
                        data-card-hit-area="compare"
                    >
                        {overlay}
                    </div>
                ) : null}
            </div>
            {leading ? (
                <div
                    className="item-card__leading-status"
                    data-card-overlay="badge"
                >
                    {leading}
                </div>
            ) : null}
            {artworkAction}
        </div>
    )
}
