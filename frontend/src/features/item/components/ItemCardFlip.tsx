import { useId } from 'react'
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
}: ItemCardFlipProps) {
    const backId = useId()

    return (
        <div
            className="item-card__artwork-composition"
            onKeyDown={(event) => {
                if (event.key !== 'Escape' || !flipped) return
                event.preventDefault()
                onFlippedChange(false)
            }}
        >
            <div
                className="item-card__skill-flip is-market is-enabled"
                data-flipped={flipped}
            >
                <div className="item-card__skill-flip-inner">
                    <div
                        aria-hidden={flipped}
                        inert={flipped}
                        className="item-card__skill-flip-face item-card__skill-flip-front"
                    >
                        {front}
                    </div>
                    <div
                        id={backId}
                        aria-hidden={!flipped}
                        inert={!flipped}
                        className="item-card__skill-flip-face item-card__skill-flip-back"
                    >
                        {back}
                    </div>
                </div>
            </div>
            <div className="item-card__artwork-controls">
                <div className="item-card__control-gap">
                    {controlGapAction}
                </div>
                <button
                    type="button"
                    className="item-card__skill-flip-trigger"
                    data-card-hit-area="flip"
                    aria-label={`${label} 스킬 ${flipped ? '닫기' : '보기'}`}
                    aria-expanded={flipped}
                    aria-controls={backId}
                    onClick={() => onFlippedChange(!flipped)}
                />
                <div className="item-card__control-gap">
                    {controlGapAction}
                </div>
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
