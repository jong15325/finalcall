import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ActiveFilterBar from './ActiveFilterBar'

describe('<ActiveFilterBar>', () => {
    it('조건을 개별 해제하고 전체 초기화한다', async () => {
        const user = userEvent.setup()
        const onRemove = vi.fn()
        const onReset = vi.fn()
        render(
            <ActiveFilterBar
                items={[{ id: 'skill', label: '스킬 6%', onRemove }]}
                onReset={onReset}
            />,
        )

        expect(screen.getByRole('group', { name: '적용된 조건' })).toBeVisible()
        await user.click(
            screen.getByRole('button', { name: '스킬 6% 필터 해제' }),
        )
        await user.click(screen.getByRole('button', { name: '전체 초기화' }))
        expect(onRemove).toHaveBeenCalledOnce()
        expect(onReset).toHaveBeenCalledOnce()
    })

    it('적용된 조건이 없으면 빈 바를 만들지 않는다', () => {
        const { container } = render(
            <ActiveFilterBar items={[]} onReset={vi.fn()} />,
        )

        expect(container).toBeEmptyDOMElement()
    })
})
