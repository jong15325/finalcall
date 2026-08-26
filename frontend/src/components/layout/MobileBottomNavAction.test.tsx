import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import MobileBottomNavAction, {
    DesktopPageButton,
    MobileBottomNavButton,
} from './MobileBottomNavAction'

describe('<MobileBottomNavAction>', () => {
    it('하단 내비게이션 액션 슬롯에 접근 가능한 등록 링크를 렌더한다', async () => {
        const slot = document.createElement('span')
        slot.id = 'mobile-bottom-nav-action-slot'
        document.body.append(slot)

        const view = render(
            <MemoryRouter>
                <MobileBottomNavAction label="아이템 판매 등록" to="/sell" />
            </MemoryRouter>,
        )

        const action = await screen.findByRole('link', {
            name: '아이템 판매 등록',
        })
        expect(slot).toContainElement(action)
        expect(action).toHaveAttribute('href', '/sell')
        expect(action).toHaveAttribute('data-mobile-nav-action')

        view.unmount()
        await waitFor(() => expect(slot).toBeEmptyDOMElement())
        slot.remove()
    })

    it('링크가 아닌 액션도 모바일 슬롯과 데스크톱 페이지 하단에서 같은 버튼으로 제공한다', async () => {
        const slot = document.createElement('span')
        slot.id = 'mobile-bottom-nav-action-slot'
        document.body.append(slot)
        let count = 0

        render(
            <MemoryRouter>
                <MobileBottomNavButton
                    label="새 대화 시작"
                    onClick={() => count++}
                />
                <DesktopPageButton label="쪽지 쓰기" onClick={() => count++} />
            </MemoryRouter>,
        )

        const mobileAction = await screen.findByRole('button', {
            name: '새 대화 시작',
        })
        const desktopAction = screen.getByRole('button', {
            name: '쪽지 쓰기',
        })
        expect(slot).toContainElement(mobileAction)
        expect(mobileAction).toHaveAttribute('data-mobile-nav-action')
        expect(
            desktopAction.closest('[data-desktop-page-action]'),
        ).not.toBeNull()

        fireEvent.click(mobileAction)
        fireEvent.click(desktopAction)
        expect(count).toBe(2)
        slot.remove()
    })
})
