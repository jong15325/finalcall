import { Link } from 'react-router'

export type ItemCardAction =
    | { kind: 'link'; to: string; label: string }
    | { kind: 'button'; label: string; onPress: () => void }

export default function ItemCardActionSurface({
    action,
    opensDialog = false,
}: {
    action: ItemCardAction
    opensDialog?: boolean
}) {
    const className =
        'inline-flex min-h-10 w-full items-center justify-center rounded-md bg-control-action px-3 py-2 text-body font-bold text-content-fg transition-colors hover:bg-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2'

    if (action.kind === 'link') {
        return (
            <Link
                to={action.to}
                aria-label={action.label}
                className={className}
            >
                카드정보 보기
            </Link>
        )
    }

    return (
        <button
            type="button"
            aria-label={action.label}
            aria-haspopup={opensDialog ? 'dialog' : undefined}
            className={className}
            onClick={action.onPress}
        >
            카드정보 보기
        </button>
    )
}
