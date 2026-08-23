import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NewChatDialog, ReportChatDialog } from './ChatDialogs'

describe('ChatDialogs 공통 모달', () => {
    it('새 대화 폼을 AppModal action으로 제출한다', async () => {
        const onClose = vi.fn()
        const onSubmit = vi.fn().mockResolvedValue(true)
        render(
            <NewChatDialog
                open
                error={null}
                pending={false}
                onClose={onClose}
                onSubmit={onSubmit}
            />,
        )

        expect(screen.getByRole('dialog')).toHaveClass('app-modal-panel')
        expect(
            screen.getByRole('button', { name: '새 대화 창 닫기' }),
        ).toHaveClass('app-modal-close')
        fireEvent.change(screen.getByLabelText('상대 닉네임'), {
            target: { value: '루나상점' },
        })
        const submit = screen.getByRole('button', { name: '대화 작성' })
        expect(submit).toHaveAttribute('data-modal-button', 'primary')
        fireEvent.click(submit)

        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('루나상점'))
        expect(onClose).toHaveBeenCalled()
    })

    it('신고 동작에 공통 danger action을 사용한다', () => {
        render(
            <ReportChatDialog
                open
                counterpartNickname="루나상점"
                error={null}
                pending={false}
                onClose={vi.fn()}
                onSubmit={vi.fn().mockResolvedValue(false)}
            />,
        )

        expect(screen.getByRole('dialog')).toHaveClass('app-modal-panel')
        expect(
            screen.getByRole('button', { name: '신고 창 닫기' }),
        ).toHaveClass('app-modal-close')
        expect(
            screen.getByRole('button', { name: '메시지 신고' }),
        ).toHaveAttribute('data-modal-button', 'danger')
    })
})
