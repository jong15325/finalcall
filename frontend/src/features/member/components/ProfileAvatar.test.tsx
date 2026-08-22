import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProfileAvatar from './ProfileAvatar'

describe('ProfileAvatar', () => {
    it('제거된 13~24는 fallback하고 스페셜 ID를 매핑한다', () => {
        const { rerender } = render(
            <ProfileAvatar primaryCharacterId={13} name="자이로" />,
        )
        expect(screen.getByAltText('자이로 프로필')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_01_xyrho.png',
        )
        rerender(<ProfileAvatar primaryCharacterId={25} name="스페셜" />)
        expect(screen.getByAltText('스페셜 프로필')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_13_avatar.png',
        )
    })

    it('누락되거나 잘못된 ID는 1번으로 fallback한다', () => {
        render(<ProfileAvatar primaryCharacterId={99} name="탈퇴 회원" />)
        expect(screen.getByAltText('탈퇴 회원 프로필')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_01_xyrho.png',
        )
    })
})
