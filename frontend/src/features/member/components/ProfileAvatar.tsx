import { profileImageSrc } from '../lib/characterProfile'

interface ProfileAvatarProps {
    primaryCharacterId?: number | null
    name: string
    className?: string
}

export default function ProfileAvatar({
    primaryCharacterId,
    name,
    className = '',
}: ProfileAvatarProps) {
    return (
        <span
            className={`inline-grid shrink-0 place-items-center overflow-hidden bg-content-soft ${className}`}
        >
            <img
                src={profileImageSrc(primaryCharacterId)}
                alt={`${name} 프로필`}
                className="h-full w-full object-contain [image-rendering:pixelated]"
            />
        </span>
    )
}
