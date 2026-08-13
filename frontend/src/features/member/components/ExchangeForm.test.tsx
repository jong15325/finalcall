import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ExchangeForm from './ExchangeForm'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'
import type { ExchangeResponse } from '@/lib/api/exchange'

/**
 * 교환 폼 (FC-075) — 캐시→게임머니 교환 입력·검증·결과.
 *
 * 고정하는 것:
 *  1. 유효 정수 입력 → onExchange(정수)로 서버 호출.
 *  2. 빈 값/보유 초과는 서버 미호출(클라 선차단), 제출 버튼 DOM disabled.
 *  3. 성공 결과에서만 지급액·appliedRate 표기(환율은 서버 소유).
 *  4. 서버 에러 code 매핑(EXC_001/EXC_002) — 원문 미노출.
 */

const result: ExchangeResponse = { gameMoneyAmount: 10_000, appliedRate: 1 }

function renderForm(
    props: Partial<React.ComponentProps<typeof ExchangeForm>> = {},
) {
    const onExchange = props.onExchange ?? vi.fn()
    const utils = render(
        <ExchangeForm
            cashBalance={props.cashBalance ?? 120_000}
            isSubmitting={props.isSubmitting ?? false}
            submitError={props.submitError ?? null}
            result={props.result}
            onExchange={onExchange}
        />,
    )
    return { onExchange, ...utils }
}

describe('<ExchangeForm>', () => {
    it('유효 정수 입력 시 onExchange 로 정수를 전달한다', () => {
        const { onExchange } = renderForm()
        fireEvent.change(screen.getByLabelText('교환할 캐시'), {
            target: { value: '10000' },
        })
        fireEvent.click(screen.getByRole('button', { name: /교환하기/ }))
        expect(onExchange).toHaveBeenCalledWith(10_000)
    })

    it('입력에서 숫자 외 문자는 제거한다', () => {
        const { onExchange } = renderForm()
        fireEvent.change(screen.getByLabelText('교환할 캐시'), {
            target: { value: '1a2,3 4' },
        })
        fireEvent.click(screen.getByRole('button', { name: /교환하기/ }))
        expect(onExchange).toHaveBeenCalledWith(1234)
    })

    it('빈 값이면 제출 버튼이 비활성이고 서버를 부르지 않는다', () => {
        const { onExchange } = renderForm()
        expect(screen.getByRole('button', { name: /교환하기/ })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: /교환하기/ }))
        expect(onExchange).not.toHaveBeenCalled()
    })

    it('보유 캐시 초과 입력은 버튼이 비활성이다', () => {
        const { onExchange } = renderForm({ cashBalance: 5_000 })
        fireEvent.change(screen.getByLabelText('교환할 캐시'), {
            target: { value: '10000' },
        })
        expect(screen.getByRole('button', { name: /교환하기/ })).toBeDisabled()
        expect(onExchange).not.toHaveBeenCalled()
    })

    it('성공 결과에서만 지급액·환율을 표기한다', () => {
        renderForm({ result })
        expect(screen.getByLabelText('120,000 캐시')).toBeInTheDocument()
        expect(screen.getByLabelText('10,000 코드')).toBeInTheDocument()
        expect(screen.getByText('적용 환율 1 : 1')).toBeInTheDocument()
        expect(screen.getByText('교환이 완료되었습니다.')).toBeInTheDocument()
    })

    it('결과 이전에는 지급액 대신 안내만 보인다', () => {
        renderForm()
        expect(
            screen.getByText('교환 후 지급액이 여기에 표시됩니다.'),
        ).toBeInTheDocument()
    })

    it('EXC_001 은 캐시 부족 문구로 매핑한다(원문 미노출)', () => {
        renderForm({
            submitError: new ApiError({
                code: ERROR_CODES.EXC_001,
                message: 'raw server text',
                status: 422,
            }),
        })
        expect(
            screen.getByText(
                '캐시 잔액이 부족합니다. 교환할 금액을 다시 확인해 주세요.',
            ),
        ).toBeInTheDocument()
        expect(screen.queryByText('raw server text')).toBeNull()
    })

    it('EXC_002 는 역방향 미지원 문구로 매핑한다', () => {
        renderForm({
            submitError: new ApiError({
                code: ERROR_CODES.EXC_002,
                message: 'raw',
                status: 422,
            }),
        })
        expect(
            screen.getByText('현재는 캐시 → 게임머니 교환만 지원합니다.'),
        ).toBeInTheDocument()
    })
})
