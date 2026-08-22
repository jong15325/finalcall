import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CharacterProfileSelector from './CharacterProfileSelector'

describe('CharacterProfileSelector', () => {
    it('허용된 기본 캐릭터 16개만 밀착 배치한다', () => {
        const { container } = render(
            <CharacterProfileSelector value={1} onChange={vi.fn()} />,
        )
        expect(screen.getAllByRole('button')).toHaveLength(16)
        expect(
            screen.queryByRole('button', { name: '캐릭터 13 선택' }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: '캐릭터 25 선택' }),
        ).toBeInTheDocument()
        expect(container.querySelector('[data-character-roster]')).toHaveClass(
            'gap-0',
        )
        expect(container.innerHTML).not.toContain('_btn_')
    })

    it('작은 이미지는 click 기본에서 normal hover로 눈에 띄게 교체된다', () => {
        render(<CharacterProfileSelector value={1} onChange={vi.fn()} />)
        const button = screen.getByRole('button', { name: '캐릭터 1 선택' })
        expect(button.querySelector('img')).toHaveAttribute(
            'src',
            '/art/characters/select/ch_01_xyrho_nomal_click.png',
        )
        fireEvent.mouseEnter(button)
        expect(button.querySelector('img')).toHaveAttribute(
            'src',
            '/art/characters/select/ch_01_xyrho_nomal.png',
        )
    })

    it('키보드 접근 가능한 native button 선택을 전달한다', () => {
        const onChange = vi.fn()
        render(<CharacterProfileSelector value={1} onChange={onChange} />)
        const button = screen.getByRole('button', { name: '캐릭터 28 선택' })
        button.focus()
        expect(button).toHaveFocus()
        fireEvent.click(button)
        expect(onChange).toHaveBeenCalledWith(28)
    })

    it('외부 value 변경 시 선택 표시만 수렴하고 16개를 유지한다', () => {
        const { rerender } = render(
            <CharacterProfileSelector value={25} onChange={vi.fn()} />,
        )
        expect(
            screen.getByRole('button', { name: '캐릭터 25 선택' }),
        ).toHaveAttribute('aria-pressed', 'true')
        expect(
            screen.getByRole('button', { name: '캐릭터 1 선택' }),
        ).toBeInTheDocument()

        rerender(<CharacterProfileSelector value={1} onChange={vi.fn()} />)
        expect(
            screen.getByRole('button', { name: '캐릭터 1 선택' }),
        ).toHaveAttribute('aria-pressed', 'true')
        expect(
            screen.getByRole('button', { name: '캐릭터 25 선택' }),
        ).toBeInTheDocument()
    })
})
