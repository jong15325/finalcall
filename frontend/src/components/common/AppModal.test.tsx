import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import AppModal from './AppModal'

describe('<AppModal>', () => {
    it('portal dialog에 공통 제목·닫기·내용을 렌더링한다', () => {
        const onClose = vi.fn()
        render(
            <AppModal open title="공통 폼" onClose={onClose}>
                <label htmlFor="field">내용</label>
                <input id="field" />
            </AppModal>,
        )

        expect(screen.getByRole('dialog', { name: '공통 폼' })).toBeTruthy()
        expect(screen.getByRole('button', { name: '닫기' })).toBeTruthy()
        expect(screen.getByLabelText('내용')).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: '닫기' }))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('배경·Escape 닫기와 처리 중 잠금을 공통 처리한다', () => {
        const onClose = vi.fn()
        const focusRef = createRef<HTMLButtonElement>()
        const { container, rerender } = render(
            <AppModal
                open
                title="확인"
                onClose={onClose}
                initialFocusRef={focusRef}
            >
                <button ref={focusRef}>확인</button>
            </AppModal>,
        )
        const overlay = document.body.querySelector('.app-modal-overlay')!
        fireEvent.mouseDown(overlay)
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(2)

        onClose.mockClear()
        rerender(
            <AppModal open title="확인" onClose={onClose} closeDisabled>
                처리 중
            </AppModal>,
        )
        fireEvent.mouseDown(document.body.querySelector('.app-modal-overlay')!)
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).not.toHaveBeenCalled()
        expect(container).toBeTruthy()
    })

    it('액션 옵션만으로 취소·확정 버튼을 조립한다', () => {
        const onClose = vi.fn()
        const onConfirm = vi.fn()
        render(
            <AppModal
                open
                title="구매"
                onClose={onClose}
                actions={[
                    {
                        id: 'cancel',
                        label: '취소',
                        variant: 'secondary',
                        close: true,
                    },
                    {
                        id: 'confirm',
                        label: '구매 확정',
                        variant: 'primary',
                        onClick: onConfirm,
                    },
                ]}
            >
                구매 내용
            </AppModal>,
        )

        const cancel = screen.getByRole('button', { name: '취소' })
        const confirm = screen.getByRole('button', { name: '구매 확정' })
        expect(cancel).toHaveAttribute('data-modal-button', 'secondary')
        expect(confirm).toHaveAttribute('data-modal-button', 'primary')
        fireEvent.click(confirm)
        expect(onConfirm).toHaveBeenCalledOnce()
        fireEvent.click(cancel)
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('중첩 모달에서는 최상위 모달만 Escape를 처리하고 scroll lock을 유지한다', () => {
        const onParentClose = vi.fn()
        const onChildClose = vi.fn()
        const { rerender } = render(
            <>
                <AppModal open title="작성" onClose={onParentClose}>
                    작성 내용
                </AppModal>
                <AppModal open title="전송 확인" onClose={onChildClose}>
                    확인 내용
                </AppModal>
            </>,
        )

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onChildClose).toHaveBeenCalledOnce()
        expect(onParentClose).not.toHaveBeenCalled()

        rerender(
            <AppModal open title="작성" onClose={onParentClose}>
                작성 내용
            </AppModal>,
        )
        expect(document.body.style.overflow).toBe('hidden')
    })

    it('focus trap은 inert 배경을 건너뛰고 활성 overlay 안에서 순환한다', () => {
        render(
            <AppModal
                open
                title="구매"
                contentInert
                onClose={vi.fn()}
                overlay={
                    <div>
                        <button>취소</button>
                        <button>확인</button>
                    </div>
                }
            >
                <button>배경 액션</button>
            </AppModal>,
        )

        const cancel = screen.getByRole('button', { name: '취소' })
        const confirm = screen.getByRole('button', { name: '확인' })
        confirm.focus()
        fireEvent.keyDown(document, { key: 'Tab' })
        expect(cancel).toHaveFocus()
    })
})
