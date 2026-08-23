import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ActionConfirmDialog from './ActionConfirmDialog'

describe('<ActionConfirmDialog>', () => {
    it('공통 확인 문구와 취소·확인 액션을 제공한다', () => {
        const onCancel = vi.fn()
        const onConfirm = vi.fn()
        render(
            <ActionConfirmDialog
                open
                title="삭제할까요?"
                description="복구할 수 없습니다."
                confirmLabel="삭제"
                onCancel={onCancel}
                onConfirm={onConfirm}
            />,
        )

        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '취소' }))
        expect(onCancel).toHaveBeenCalledOnce()
        fireEvent.click(screen.getByRole('button', { name: '삭제' }))
        expect(onConfirm).toHaveBeenCalledOnce()
    })

    it('처리 중에는 취소·확인·닫기를 모두 잠근다', () => {
        render(
            <ActionConfirmDialog
                open
                title="전송할까요?"
                description="쪽지를 전송합니다."
                confirmLabel="보내기"
                pendingLabel="보내는 중…"
                isPending
                onCancel={vi.fn()}
                onConfirm={vi.fn()}
            />,
        )

        expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled()
        expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
        expect(
            screen.getByRole('button', { name: '보내는 중…' }),
        ).toBeDisabled()
    })
})
