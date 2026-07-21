import { describe, expect, it } from 'vitest'
import { relocateErrorMessage } from './relocateErrors'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * relocate 에러 문구 (FC-076) — code 로 분기, 서버 원문 미노출.
 * 각 코드가 서로 다른 대응(만실 vs 슬롯점유 vs 소유자 vs TEMP아님)을 낸다.
 */

function apiError(code: string, status: number): ApiError {
    return new ApiError({ code, message: '서버원문-노출금지', status })
}

describe('relocateErrorMessage', () => {
    it('INV_001(만실) — 인벤토리 비우기 안내', () => {
        const message = relocateErrorMessage(apiError(ERROR_CODES.INV_001, 409))
        expect(message).toContain('가득')
        expect(message).not.toContain('서버원문')
    })

    it('INV_002(슬롯 점유) — 재시도 안내', () => {
        expect(
            relocateErrorMessage(apiError(ERROR_CODES.INV_002, 409)),
        ).toContain('사용 중')
    })

    it('ITEM_002(소유자 아님) — 내 아이템 아님', () => {
        expect(
            relocateErrorMessage(apiError(ERROR_CODES.ITEM_002, 403)),
        ).toContain('내 아이템이 아닙니다')
    })

    it('ITEM_003(TEMP 아님) — 이미 옮겨졌거나 이동 불가', () => {
        expect(
            relocateErrorMessage(apiError(ERROR_CODES.ITEM_003, 409)),
        ).toContain('이미 옮겨졌거나')
    })

    it('미상 에러는 일반 문구로 폴백', () => {
        expect(relocateErrorMessage(new Error('boom'))).toContain(
            '이동하지 못했습니다',
        )
    })
})
