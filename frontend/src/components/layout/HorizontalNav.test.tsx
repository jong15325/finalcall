import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HorizontalNav from './HorizontalNav'

describe('HorizontalNav', () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('fine pointer hover는 grace/reentry를 지원하고 click은 보이는 상태를 toggle한다', () => {
        vi.useFakeTimers()
        const removeMediaListener = vi.fn()
        vi.stubGlobal('matchMedia', () => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: removeMediaListener,
        }))
        const view = render(
            <MemoryRouter>
                <HorizontalNav />
            </MemoryRouter>,
        )
        const trigger = screen.getByRole('button', { name: /마켓/ })
        const boundary = trigger.closest('li') as HTMLElement
        fireEvent.mouseEnter(boundary)
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        fireEvent.mouseLeave(boundary)
        act(() => vi.advanceTimersByTime(100))
        fireEvent.mouseEnter(boundary)
        act(() => vi.advanceTimersByTime(100))
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(trigger)
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(trigger)
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(trigger)
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        fireEvent.mouseLeave(boundary)
        fireEvent.mouseEnter(boundary)
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(trigger)
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        view.unmount()
        expect(vi.getTimerCount()).toBe(0)
        expect(removeMediaListener).toHaveBeenCalled()
    })

    it('fine에서 coarse로 바뀌면 hover와 grace timer를 즉시 정리한다', () => {
        vi.useFakeTimers()
        let fine = true
        const changes: Array<() => void> = []
        const removeMediaListener = vi.fn()
        vi.stubGlobal('matchMedia', () => ({
            get matches() {
                return fine
            },
            addEventListener: (_type: string, listener: () => void) => {
                changes.push(listener)
            },
            removeEventListener: removeMediaListener,
        }))
        const view = render(
            <MemoryRouter>
                <HorizontalNav />
            </MemoryRouter>,
        )
        const trigger = screen.getByRole('button', { name: /마켓/ })
        const boundary = trigger.closest('li') as HTMLElement
        fireEvent.mouseEnter(boundary)
        fireEvent.mouseLeave(boundary)
        expect(vi.getTimerCount()).toBeGreaterThan(0)
        act(() => {
            fine = false
            changes.forEach((listener) => listener())
        })
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        expect(vi.getTimerCount()).toBe(0)
        view.unmount()
        expect(removeMediaListener).toHaveBeenCalled()
    })

    it('Enter와 Space도 현재 open 상태를 일관되게 toggle한다', async () => {
        const user = userEvent.setup()
        render(
            <MemoryRouter>
                <HorizontalNav />
            </MemoryRouter>,
        )
        const trigger = screen.getByRole('button', { name: /마켓/ })
        trigger.focus()
        await user.keyboard('{Enter}')
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        await user.keyboard(' ')
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('coarse pointer에서는 hover로 열리지 않는다', () => {
        vi.stubGlobal('matchMedia', () => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }))
        render(
            <MemoryRouter>
                <HorizontalNav />
            </MemoryRouter>,
        )
        const trigger = screen.getByRole('button', { name: /마켓/ })
        fireEvent.mouseEnter(trigger.closest('li') as HTMLElement)
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
    it('현재 하위 경로의 그룹을 활성 표시한다', () => {
        render(
            <MemoryRouter initialEntries={['/auctions/A-1']}>
                <HorizontalNav />
            </MemoryRouter>,
        )
        expect(
            screen.getByRole('button', { name: /마켓/ }).className,
        ).toContain('border-orange')
    })

    it('/items/:id는 마켓 그룹의 명시적 상세 경로로 활성 표시한다', () => {
        render(
            <MemoryRouter initialEntries={['/items/I-1']}>
                <HorizontalNav />
            </MemoryRouter>,
        )
        expect(
            screen.getByRole('button', { name: /마켓/ }).className,
        ).toContain('border-orange')
    })

    it('좌우 방향키로 최상위 항목을 순환 탐색한다', async () => {
        const user = userEvent.setup()
        render(
            <MemoryRouter>
                <HorizontalNav />
            </MemoryRouter>,
        )
        const roots = document.querySelectorAll<HTMLElement>(
            '[data-horizontal-root]',
        )
        roots[0]?.focus()
        await user.keyboard('{ArrowRight}')
        expect(roots[1]).toHaveFocus()
        await user.keyboard('{ArrowLeft}')
        expect(roots[0]).toHaveFocus()
        await user.keyboard('{ArrowLeft}')
        expect(roots[roots.length - 1]).toHaveFocus()
    })

    it('방향키와 Escape로 하위 메뉴를 탐색하고 닫는다', async () => {
        const user = userEvent.setup()
        render(
            <MemoryRouter>
                <HorizontalNav />
            </MemoryRouter>,
        )
        const trigger = screen.getByRole('button', { name: /마켓/ })
        trigger.focus()
        await user.keyboard('{ArrowDown}')
        expect(
            await screen.findByRole('link', { name: '아이템 마켓' }),
        ).toHaveFocus()
        await user.keyboard('{ArrowDown}')
        expect(screen.getByRole('link', { name: '실시간 경매' })).toHaveFocus()
        await user.keyboard('{Escape}')
        expect(trigger).toHaveFocus()
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('외부 포커스로 이동하면 열린 메뉴를 닫는다', async () => {
        const user = userEvent.setup()
        render(
            <MemoryRouter>
                <HorizontalNav />
                <button type="button">외부</button>
            </MemoryRouter>,
        )
        const trigger = screen.getByRole('button', { name: /마켓/ })
        await user.click(trigger)
        await user.click(screen.getByRole('button', { name: '외부' }))
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
})
