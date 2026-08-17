import { Link } from 'react-router'

export type ItemCardAction =
    | { kind: 'link'; to: string; label: string }
    | { kind: 'button'; label: string; onPress: () => void }

export default function ItemCardActionSurface({
    action,
    opensDialog = false,
    area = 'content',
    keyboard = true,
    className = '',
}: {
    action: ItemCardAction
    opensDialog?: boolean
    area?: 'content' | 'artwork' | 'control-gap' | 'footer'
    keyboard?: boolean
    className?: string
}) {
    const actionClassName =
        `item-card__primary-action item-card__primary-action--${area} focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2 ${className}`.trim()
    const accessibility = keyboard
        ? { 'aria-label': action.label }
        : { 'aria-hidden': true as const, tabIndex: -1 }

    if (action.kind === 'link') {
        return (
            <Link
                to={action.to}
                {...accessibility}
                data-card-hit-area={area}
                className={actionClassName}
            />
        )
    }

    return (
        <button
            type="button"
            {...accessibility}
            data-card-hit-area={area}
            aria-haspopup={opensDialog ? 'dialog' : undefined}
            className={actionClassName}
            onClick={action.onPress}
        />
    )
}
