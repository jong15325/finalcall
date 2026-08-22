import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CHARACTER_PROFILE_OPTIONS } from '../fixtures/characterProfile'
import CharacterProfileCandidate from './CharacterProfileCandidate'

describe('CharacterProfileCandidate', () => {
    it('운영과 동일한 기본 캐릭터 16개 선택판을 보여준다', () => {
        render(
            <CharacterProfileCandidate
                characters={CHARACTER_PROFILE_OPTIONS}
            />,
        )
        expect(screen.getAllByRole('button')).toHaveLength(16)
        expect(
            screen.queryByRole('button', { name: '캐릭터 13 선택' }),
        ).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '캐릭터 25 선택' }))
        expect(screen.getByAltText('캐릭터 수집가 프로필')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_13_avatar.png',
        )
        expect(document.querySelector('[src*="_btn_"]')).not.toBeInTheDocument()
    })
})
