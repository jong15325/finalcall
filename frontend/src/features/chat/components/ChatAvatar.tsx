export default function ChatAvatar({
    nickname,
    compact = false,
}: {
    nickname: string
    compact?: boolean
}) {
    return (
        <span
            aria-hidden
            className={`${compact ? 'size-8 text-xs' : 'size-10 text-sm'} inline-flex shrink-0 items-center justify-center rounded-full bg-brand-highlight-soft font-bold text-brand-highlight-deep`}
        >
            {nickname.slice(0, 1) || '?'}
        </span>
    )
}
