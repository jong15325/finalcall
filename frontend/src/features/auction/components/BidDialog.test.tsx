import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import BidDialog from './BidDialog'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 입찰 다이얼로그 (FC-072 — FC-064 함정 방어 고정).
 *
 * ★ BidDialog 는 컨텍스트가 필요 없는 순수 표시 컴포넌트다(라우터·쿼리·인증 불요) — plain render.
 *
 * 고정하는 것:
 *  1. **초점 강탈 금지**(critical): open 이 안 바뀐 리렌더가 초점을 입력칸으로 되돌리지 않는다.
 *  2. **금액 덮어쓰기 금지**(major·금전): 최소가가 올라도 사용자 입력이 그 이상이면 보존, 미만일
 *     때만 상향. 상승은 안내로만.
 *  3. **전송중 = DOM disabled 속성**.
 *  4. **에러코드 매핑**(bidErrors): 서버 code 로 문구·amountFault 를 낸다(서버 원문 아님).
 */

const baseProps = {
    open: true,
    onClose: vi.fn(),
    auctionName: '불의 전투도끼',
    currentHighestAmount: 2_480_000,
    minNextBidAmount: 2_500_000,
    buyNowPrice: 3_900_000,
    gameMoneyAvailable: 5_720_000,
    isSubmitting: false,
    submitError: null,
    onSubmit: vi.fn(),
}

function getAmountInput(): HTMLInputElement {
    return screen.getByLabelText('입찰 금액') as HTMLInputElement
}

describe('<BidDialog>', () => {
    it('열리면 최소 입찰가로 프리필하고 입력칸에 초점을 준다', async () => {
        render(<BidDialog {...baseProps} onSubmit={vi.fn()} />)
        const input = getAmountInput()
        expect(input.value).toBe('2500000')
        await waitFor(() => expect(input).toHaveFocus())
    })

    it('★ open 이 안 바뀐 리렌더는 초점을 강탈하지 않는다(FC-064 C-1)', async () => {
        const { rerender } = render(<BidDialog {...baseProps} />)
        await waitFor(() => expect(getAmountInput()).toHaveFocus())

        // 사용자가 다른 요소(닫기 버튼)로 초점을 옮긴다.
        const closeBtn = screen.getByRole('button', { name: '닫기' })
        closeBtn.focus()
        expect(closeBtn).toHaveFocus()

        // 매초 카운트다운 리렌더에 해당 — 무관한 prop 변경으로 리렌더(open 불변).
        rerender(<BidDialog {...baseProps} currentHighestAmount={2_600_000} />)

        // 초점 effect 는 [open] 의존이라 재실행되지 않는다 → 입력칸이 초점을 되찾지 않는다.
        expect(closeBtn).toHaveFocus()
        expect(getAmountInput()).not.toHaveFocus()
    })

    it('★ 최소가가 올라도 사용자 입력이 그 이상이면 보존한다(M-1·금전)', () => {
        const { rerender } = render(<BidDialog {...baseProps} />)
        const input = getAmountInput()
        // 사용자가 스나이핑 금액을 직접 입력(edited=true).
        fireEvent.change(input, { target: { value: '9000000' } })
        expect(input.value).toBe('9000000')

        // 재조회로 최소가 상승.
        rerender(<BidDialog {...baseProps} minNextBidAmount={2_600_000} />)

        // 9,000,000 은 새 최소가 이상 → 그대로 둔다(하향 치환 금지).
        expect(getAmountInput().value).toBe('9000000')
        // 상승은 안내로만 말한다.
        expect(screen.getByRole('status')).toHaveTextContent('올랐습니다')
    })

    it('★ 사용자 입력이 새 최소가 미만일 때만 상향한다(M-1)', () => {
        const { rerender } = render(<BidDialog {...baseProps} />)
        fireEvent.change(getAmountInput(), { target: { value: '2510000' } })

        rerender(<BidDialog {...baseProps} minNextBidAmount={2_600_000} />)

        // 2,510,000 < 2,600,000 → 새 최소가로 끌어올린다.
        expect(getAmountInput().value).toBe('2600000')
    })

    it('전송 중이면 제출 버튼에 DOM disabled 속성이 실린다', () => {
        render(<BidDialog {...baseProps} isSubmitting />)
        expect(screen.getByRole('button', { name: '전송 중…' })).toBeDisabled()
    })

    it('최소가 미만 제출은 클라 검증에서 막히고 onSubmit 을 부르지 않는다', () => {
        const onSubmit = vi.fn()
        render(<BidDialog {...baseProps} onSubmit={onSubmit} />)
        const input = getAmountInput()
        fireEvent.change(input, { target: { value: '100' } })
        fireEvent.submit(input.closest('form') as HTMLFormElement)

        expect(onSubmit).not.toHaveBeenCalled()
        expect(screen.getByRole('alert')).toHaveTextContent('이상으로 입찰')
        expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('유효한 금액 제출은 정수로 onSubmit 을 부른다', () => {
        const onSubmit = vi.fn()
        render(<BidDialog {...baseProps} onSubmit={onSubmit} />)
        const input = getAmountInput()
        fireEvent.change(input, { target: { value: '3000000' } })
        fireEvent.submit(input.closest('form') as HTMLFormElement)
        expect(onSubmit).toHaveBeenCalledWith(3_000_000)
    })

    it('★ 서버 BID_002(즉시구매가 이상)는 code 로 매핑해 문구·amountFault 를 낸다', () => {
        const error = new ApiError({
            code: ERROR_CODES.BID_002,
            message: 'raw server message',
            status: 422,
        })
        render(<BidDialog {...baseProps} submitError={error} />)
        expect(screen.getByRole('alert')).toHaveTextContent(
            '즉시구매가 이상은',
        )
        // 서버 원문은 노출하지 않는다.
        expect(screen.queryByText('raw server message')).toBeNull()
        // 금액 결함이므로 입력칸에 aria-invalid.
        expect(getAmountInput()).toHaveAttribute('aria-invalid', 'true')
    })

    it('★ 서버 BID_003(자기 경매)은 amountFault 아님 — 입력칸을 결함 처리하지 않는다', () => {
        const error = new ApiError({
            code: ERROR_CODES.BID_003,
            message: 'x',
            status: 403,
        })
        render(<BidDialog {...baseProps} submitError={error} />)
        expect(screen.getByRole('alert')).toHaveTextContent(
            '내가 등록한 경매',
        )
        expect(getAmountInput()).not.toHaveAttribute('aria-invalid', 'true')
    })
})
