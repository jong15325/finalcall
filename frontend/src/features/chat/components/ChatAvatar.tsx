import ProfileAvatar from '@/features/member/components/ProfileAvatar'

export default function ChatAvatar({
    nickname,
    primaryCharacterId,
    compact = false,
}: {
    nickname: string
    primaryCharacterId?: number | null
    compact?: boolean
}) {
    return (
        <ProfileAvatar
            primaryCharacterId={primaryCharacterId}
            name={nickname}
            className={`${compact ? 'size-8' : 'size-10'} rounded-full border border-content-line`}
        />
    )
}
