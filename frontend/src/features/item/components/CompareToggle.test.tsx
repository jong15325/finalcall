import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CompareToggle from './CompareToggle'

/**
 * CompareToggle 검증 (rebuild-contract-map 주의 3).
 * 선택/비활성은 DOM 속성(aria-pressed·disabled) — opacity 만으로 상태를 표시하지 않는다.
 */

describe('<CompareToggle>', () => {
    it('선택 상태를 aria-pressed 로 표현한다', () => {
        const { rerender } = render(
            <CompareToggle pressed={false} onToggle={() => {}} />,
        )
        expect(
            screen.getByRole('button', { name: '비교 담기' }),
        ).toHaveAttribute('aria-pressed', 'false')

        rerender(<CompareToggle pressed onToggle={() => {}} />)
        const selected = screen.getByRole('button', { name: '비교 담기' })
        expect(selected).toHaveAttribute('aria-pressed', 'true')
        expect(selected).toHaveClass(
            'border-gray-900',
            'bg-orange',
            'text-gray-900',
        )
        expect(selected).not.toHaveClass('text-white')
    })

    it('클릭하면 반대값을 콜백으로 올린다(controlled)', async () => {
        const user = userEvent.setup()
        const onToggle = vi.fn()
        render(<CompareToggle pressed={false} onToggle={onToggle} />)

        await user.click(screen.getByRole('button'))
        expect(onToggle).toHaveBeenCalledWith(true)
    })

    it('비활성은 disabled 속성으로 — 클릭이 콜백을 부르지 않는다', async () => {
        const user = userEvent.setup()
        const onToggle = vi.fn()
        render(<CompareToggle disabled pressed={false} onToggle={onToggle} />)

        const button = screen.getByRole('button')
        expect(button).toBeDisabled()
        await user.click(button)
        expect(onToggle).not.toHaveBeenCalled()
    })

    it('라벨을 주입할 수 있다', () => {
        render(
            <CompareToggle
                pressed={false}
                label="비교에서 빼기"
                onToggle={() => {}}
            />,
        )
        expect(
            screen.getByRole('button', { name: '비교에서 빼기' }),
        ).toBeInTheDocument()
    })

    it('아이콘 크기를 유지하면서 44px hit area를 제공한다', () => {
        render(<CompareToggle pressed={false} onToggle={() => {}} />)

        const button = screen.getByRole('button')
        expect(button).toHaveClass('size-11')
        expect(button.querySelector('svg')).toHaveClass('size-[15px]')
    })
})
