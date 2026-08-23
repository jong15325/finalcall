import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ShopPurchaseDialog from './ShopPurchaseDialog'

describe('<ShopPurchaseDialog>', () => {
    it('공통 패널의 콘텐츠 슬롯과 옵션 액션을 사용한다', () => {
        const onClose = vi.fn()
        const onConfirm = vi.fn()
        render(
            <ShopPurchaseDialog
                open
                itemName="7레벨 - 갑옷"
                price={2_500_000}
                gameMoneyAvailable={5_000_000}
                isSubmitting={false}
                submitError={null}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        )

        expect(
            screen.getByRole('dialog', { name: '7레벨 - 갑옷' }),
        ).toHaveClass('app-modal-panel')
        expect(screen.getByText('2,500,000')).toBeVisible()
        const cancel = screen.getByRole('button', { name: '취소' })
        const confirm = screen.getByRole('button', { name: '구매 확정' })
        expect(cancel).toHaveAttribute('data-modal-button', 'secondary')
        expect(confirm).toHaveAttribute('data-modal-button', 'primary')
        fireEvent.click(confirm)
        expect(onConfirm).toHaveBeenCalledOnce()
        fireEvent.click(cancel)
        expect(onClose).toHaveBeenCalledOnce()
    })
})
