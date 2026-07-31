/**
 * 메모 아바타 (FC-172) — 닉네임 이니셜 원형. 시스템(운영자) 메모는 네이비 채움 + 골드 글자로
 * 회원 아바타와 구분한다(별도 이미지 자산 없음 · 정직성).
 */
interface MemoAvatarProps {
    initial: string
    system?: boolean
    /** 크기 유틸(예: `size-10`). 기본 `size-10`. */
    className?: string
}

function MemoAvatar({
    initial,
    system = false,
    className = 'size-10',
}: MemoAvatarProps) {
    return (
        <span
            aria-hidden
            className={`grid flex-none place-items-center rounded-full border text-sm font-extrabold ${
                system
                    ? 'border-navy bg-navy text-gold-bright'
                    : 'border-line bg-surface-sunken text-gray-500'
            } ${className}`}
        >
            {initial}
        </span>
    )
}

export default MemoAvatar
