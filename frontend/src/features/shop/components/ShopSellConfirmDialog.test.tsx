import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '@/test/renderWithProviders'
import ShopSellConfirmDialog from './ShopSellConfirmDialog'

const DESKTOP_QUERY = '(min-width: 1280px)'

function renderDialog(
    overrides: Partial<React.ComponentProps<typeof ShopSellConfirmDialog>> = {},
) {
    const props: React.ComponentProps<typeof ShopSellConfirmDialog> = {
        open: true,
        itemName: '불의 검',
        price: 1000,
        isSubmitting: false,
        submitError: null,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        ...overrides,
    }
    render(<ShopSellConfirmDialog {...props} />)
    return props
}

function mockScrollSize(scrollHeight: number, clientHeight: number) {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(
        scrollHeight,
    )
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
        clientHeight,
    )
}

afterEach(() => vi.restoreAllMocks())

describe('ShopSellConfirmDialog 검토 gate', () => {
    it('1280px breakpoint에서 bottom sheet와 중앙 dialog 시각 전환을 맞춘다', () => {
        stubMatchMedia({ [DESKTOP_QUERY]: false })
        mockScrollSize(500, 200)
        renderDialog()
        const dialog = screen.getByRole('dialog', { name: '불의 검' })
        expect(dialog.parentElement).toHaveClass('app-modal-overlay')
        expect(dialog).toHaveClass('app-modal-panel')
        expect(dialog).toHaveAttribute('data-size', 'md')
        expect(screen.getByRole('button', { name: '판매 등록' })).toBeDisabled()
    })

    it('수수료 검토 영역을 스크롤 내용 최하단에 한 번 표시한다', () => {
        stubMatchMedia({ [DESKTOP_QUERY]: true })
        renderDialog()
        const fee = screen.getByRole('heading', { name: '판매 수수료 안내' })
        const scroll = document.querySelector<HTMLElement>('.ci-scroll')!
        expect(screen.getAllByText('판매 수수료 안내')).toHaveLength(1)
        expect(scroll.lastElementChild).toContainElement(fee)
    })

    it('PC에서는 확정 버튼이 즉시 활성화된다', () => {
        stubMatchMedia({ [DESKTOP_QUERY]: true })
        mockScrollSize(500, 200)
        renderDialog()
        expect(screen.getByRole('button', { name: '판매 등록' })).toBeEnabled()
    })

    it('모바일 잠금 상태의 초기 초점과 외부 Tab trap을 지키고, 최하단에서 확정으로 이동한다', async () => {
        stubMatchMedia({ [DESKTOP_QUERY]: false })
        mockScrollSize(500, 200)
        const props = renderDialog()
        const confirm = screen.getByRole('button', { name: '판매 등록' })
        const close = screen.getByRole('button', { name: '닫기' })
        expect(confirm).toBeDisabled()
        await waitFor(() => expect(close).toHaveFocus())
        const outside = document.createElement('button')
        document.body.append(outside)
        outside.focus()
        fireEvent.keyDown(document, { key: 'Tab' })
        expect(close).toHaveFocus()
        outside.focus()
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
        expect(screen.getByRole('button', { name: '다시 확인' })).toHaveFocus()
        const scroll = document.querySelector<HTMLElement>('.ci-scroll')!
        Object.defineProperty(scroll, 'scrollTop', {
            configurable: true,
            value: 300,
        })
        fireEvent.scroll(scroll)
        expect(confirm).toBeEnabled()
        await waitFor(() => expect(confirm).toHaveFocus())
        fireEvent.click(confirm)
        expect(props.onConfirm).toHaveBeenCalledOnce()
    })

    it('모바일에서도 내용이 짧아 전부 보이면 즉시 활성화된다', () => {
        stubMatchMedia({ [DESKTOP_QUERY]: false })
        mockScrollSize(180, 200)
        renderDialog()
        expect(screen.getByRole('button', { name: '판매 등록' })).toBeEnabled()
    })

    it('활성화 후 제출하며 Escape와 dialog 접근성을 유지한다', () => {
        stubMatchMedia({ [DESKTOP_QUERY]: true })
        const props = renderDialog()
        expect(screen.getByRole('dialog', { name: '불의 검' })).toHaveAttribute(
            'aria-modal',
            'true',
        )
        fireEvent.click(screen.getByRole('button', { name: '판매 등록' }))
        expect(props.onConfirm).toHaveBeenCalledOnce()
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(props.onClose).toHaveBeenCalledOnce()
    })
})
