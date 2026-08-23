import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppModalButton from './AppModalButton'

describe('<AppModalButton>', () => {
    it.each(['primary', 'secondary', 'danger'] as const)(
        '%s 변형을 공통 버튼 계약으로 렌더링한다',
        (variant) => {
            render(<AppModalButton variant={variant}>{variant}</AppModalButton>)

            const button = screen.getByRole('button', { name: variant })
            expect(button.dataset.modalButton).toBe(variant)
            expect(button.classList.contains('app-modal-button')).toBe(true)
            expect(
                button.querySelector('.app-modal-button__label')?.textContent,
            ).toBe(variant)
        },
    )

    it('비활성 상태와 기존 className을 보존한다', () => {
        render(
            <AppModalButton disabled className="feature-layout-only">
                처리 중
            </AppModalButton>,
        )

        const button = screen.getByRole('button', { name: '처리 중' })
        expect(button).toBeDisabled()
        expect(button.classList.contains('feature-layout-only')).toBe(true)
    })
})
