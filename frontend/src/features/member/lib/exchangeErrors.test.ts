import { describe, expect, it } from 'vitest'
import { exchangeErrorMessage } from './exchangeErrors'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 교환 에러 문구 매핑 (FC-075) — code 로 분기, 원문 미노출.
 * EXC_001/EXC_002 는 form 테스트에서 다루므로 여기서는 400·폴백 분기를 고정한다.
 */
describe('exchangeErrorMessage', () => {
    it('EXC_001 = 캐시 부족', () => {
        expect(
            exchangeErrorMessage(
                new ApiError({
                    code: ERROR_CODES.EXC_001,
                    message: 'x',
                    status: 422,
                }),
            ),
        ).toBe('캐시 잔액이 부족합니다. 교환할 금액을 다시 확인해 주세요.')
    })

    it('400 검증 실패는 금액 형식 문구', () => {
        expect(
            exchangeErrorMessage(
                new ApiError({ code: 'COMMON_001', message: 'x', status: 400 }),
            ),
        ).toBe('교환 금액이 올바르지 않습니다.')
    })

    it('알 수 없는 오류는 일반 전송 실패 문구', () => {
        expect(exchangeErrorMessage(new Error('boom'))).toBe(
            '교환을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        )
    })
})
