import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import WithdrawDialog from './WithdrawDialog'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 탈퇴 확인 다이얼로그 (FC-074) — 명시 동의 검증(D-080).
 *
 * ★ 컨텍스트 불요 순수 표시 컴포넌트 — plain render.
 *
 * 고정하는 것:
 *  1. 동의 체크 전에는 확정 버튼이 DOM disabled(색만 X).
 *  2. 동의 후에만 onConfirm 호출.
 *  3. 전송 중 disabled.
 *  4. 서버 MEMBER_002(진행 중 거래) code 매핑, 원문 미노출.
 */

const baseProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    isSubmitting: false,
    submitError: null,
}

function confirmButton(): HTMLButtonElement {
    return screen.getByRole('button', {
        name: '탈퇴 확정',
    }) as HTMLButtonElement
}

describe('<WithdrawDialog>', () => {
    it('open=false 면 아무것도 렌더하지 않는다', () => {
        render(<WithdrawDialog {...baseProps} open={false} />)
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('★ 동의 체크 전에는 확정 버튼이 DOM disabled 다', () => {
        render(<WithdrawDialog {...baseProps} />)
        expect(confirmButton()).toBeDisabled()
    })

    it('★ 동의 체크 후 확정하면 onConfirm 을 부른다', () => {
        const onConfirm = vi.fn()
        render(<WithdrawDialog {...baseProps} onConfirm={onConfirm} />)

        fireEvent.click(screen.getByRole('checkbox'))
        const button = confirmButton()
        expect(button).toBeEnabled()

        fireEvent.click(button)
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('전송 중이면 동의했어도 확정 버튼이 disabled 다', () => {
        render(<WithdrawDialog {...baseProps} isSubmitting />)
        fireEvent.click(screen.getByRole('checkbox'))
        // 전송 중에는 라벨이 "처리 중…" 으로 바뀐다.
        expect(screen.getByRole('button', { name: '처리 중…' })).toBeDisabled()
    })

    it('잔액 소멸·복구 불가 경고를 표시한다(D-080)', () => {
        render(<WithdrawDialog {...baseProps} />)
        expect(screen.getByText(/모두 소멸/)).toBeInTheDocument()
        expect(screen.getByText(/세션이 전부 폐기/)).toBeInTheDocument()
    })

    it('★ 서버 MEMBER_002(진행 중 거래)는 code 로 문구를 내고 원문을 노출하지 않는다', () => {
        const error = new ApiError({
            code: ERROR_CODES.MEMBER_002,
            message: 'raw in-progress trade',
            status: 409,
        })
        render(<WithdrawDialog {...baseProps} submitError={error} />)
        expect(screen.getByRole('alert')).toHaveTextContent('진행 중인 거래')
        expect(screen.queryByText('raw in-progress trade')).toBeNull()
    })
})
