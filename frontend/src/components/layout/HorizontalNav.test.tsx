import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import HorizontalNav from './HorizontalNav'

describe('HorizontalNav', () => {
    it('현재 하위 경로의 그룹을 활성 표시한다', () => {
        render(<MemoryRouter initialEntries={['/auctions/A-1']}><HorizontalNav /></MemoryRouter>)
        expect(screen.getByRole('button', { name: /마켓/ }).className).toContain('border-orange')
    })

    it('방향키와 Escape로 하위 메뉴를 탐색하고 닫는다', async () => {
        const user = userEvent.setup()
        render(<MemoryRouter><HorizontalNav /></MemoryRouter>)
        const trigger = screen.getByRole('button', { name: /마켓/ })
        trigger.focus()
        await user.keyboard('{ArrowDown}')
        expect(await screen.findByRole('link', { name: '아이템 마켓' })).toHaveFocus()
        await user.keyboard('{ArrowDown}')
        expect(screen.getByRole('link', { name: '실시간 경매' })).toHaveFocus()
        await user.keyboard('{Escape}')
        expect(trigger).toHaveFocus()
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('외부 포커스로 이동하면 열린 메뉴를 닫는다', async () => {
        const user = userEvent.setup()
        render(<MemoryRouter><HorizontalNav /><button type="button">외부</button></MemoryRouter>)
        const trigger = screen.getByRole('button', { name: /마켓/ })
        await user.click(trigger)
        await user.click(screen.getByRole('button', { name: '외부' }))
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
})
