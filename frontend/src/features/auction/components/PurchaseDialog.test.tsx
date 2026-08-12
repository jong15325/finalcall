import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import PurchaseDialog from './PurchaseDialog'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 즉시구매 확인 다이얼로그 (FC-090).
 *
 * 고정하는 것: 확인 콜백·전송중 disabled·에러 code 매핑·닫힘 시 미렌더.
 */

function renderDialog(
    overrides: Partial<Parameters<typeof PurchaseDialog>[0]> = {},
) {
    const props = {
        open: true,
        auctionName: '불의 전투도끼',
        buyNowPrice: 3_900_000,
        gameMoneyAvailable: 5_000_000,
        isSubmitting: false,
        submitError: null as unknown,
        onClose: () => {},
        onConfirm: () => {},
        ...overrides,
    }
    return renderWithProviders(<PurchaseDialog {...props} />)
}

describe('<PurchaseDialog>', () => {
    it('닫힘(open=false)이면 아무것도 렌더하지 않는다', () => {
        renderDialog({ open: false })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('확정 버튼이 onConfirm 을 부른다', () => {
        const onConfirm = vi.fn()
        renderDialog({ onConfirm })
        const confirm = screen.getByRole('button', { name: '즉시구매 확정' })
        expect(confirm).toHaveClass(
            'bg-control-action',
            'text-control-action-ink',
            'hover:bg-control-action-hover',
            'focus-visible:ring-control-focus',
        )
        confirm.click()
        expect(onConfirm).toHaveBeenCalledOnce()
    })

    it('전송 중이면 확정 버튼 DOM disabled', () => {
        renderDialog({ isSubmitting: true })
        expect(screen.getByRole('button', { name: '전송 중…' })).toBeDisabled()
    })

    it('서버 BID_005(잔액 부족)를 code 로 매핑해 문구를 낸다', () => {
        renderDialog({
            submitError: new ApiError({
                code: ERROR_CODES.BID_005,
                message: 'server text',
                status: 422,
            }),
        })
        expect(screen.getByRole('alert')).toHaveTextContent('잔액이 부족')
    })
})
