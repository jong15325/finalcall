import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AppAlertProvider, useAppAlert } from './AppAlertProvider'

function Harness({ onResult }: { onResult: (value: boolean) => void }) {
    const alert = useAppAlert()
    const [status, setStatus] = useState('idle')
    return (
        <>
            <button
                onClick={async () => {
                    const result = await alert.danger({
                        title: '삭제할까요?',
                        description: '복구할 수 없습니다.',
                        confirmLabel: '삭제',
                    })
                    onResult(result)
                    setStatus(result ? 'confirmed' : 'cancelled')
                }}
            >
                열기
            </button>
            <output>{status}</output>
        </>
    )
}

describe('useAppAlert', () => {
    it('한 줄 호출로 위험 확인과 결과 Promise를 제공한다', async () => {
        const onResult = vi.fn()
        render(
            <AppAlertProvider>
                <Harness onResult={onResult} />
            </AppAlertProvider>,
        )
        fireEvent.click(screen.getByRole('button', { name: '열기' }))
        expect(screen.getByRole('alertdialog', { name: '삭제할까요?' }))
        fireEvent.click(screen.getByRole('button', { name: '삭제' }))
        await screen.findByText('confirmed')
        expect(onResult).toHaveBeenCalledWith(true)
    })

    it('취소하면 false를 반환한다', async () => {
        const onResult = vi.fn()
        render(
            <AppAlertProvider>
                <Harness onResult={onResult} />
            </AppAlertProvider>,
        )
        fireEvent.click(screen.getByRole('button', { name: '열기' }))
        fireEvent.click(screen.getByRole('button', { name: '취소' }))
        await screen.findByText('cancelled')
        expect(onResult).toHaveBeenCalledWith(false)
    })
})
