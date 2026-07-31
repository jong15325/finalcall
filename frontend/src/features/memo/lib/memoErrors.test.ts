import { describe, expect, it } from 'vitest'
import {
    deleteMemoErrorMessage,
    memoAccessErrorMessage,
    sendMemoErrorMessage,
} from './memoErrors'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 메모 에러 매핑 (FC-172) — 계약 §5 MEMO_001~004.
 *
 * 고정하는 것:
 *  1. 발신은 수신자 없음(MEMO_001)·자기 발신(MEMO_004)을 각각 구분 안내.
 *  2. 조회·삭제는 없음(MEMO_002)·당사자 아님(MEMO_003)을 열거 완화 목적상 한 문구로.
 *  3. 서버 원문(message)을 노출하지 않는다.
 */

function err(code: string, status: number): ApiError {
    return new ApiError({ code, message: 'raw server text', status })
}

describe('sendMemoErrorMessage', () => {
    it('MEMO_001 은 수신자 확인 안내', () => {
        expect(sendMemoErrorMessage(err(ERROR_CODES.MEMO_001, 404))).toContain(
            '닉네임',
        )
    })

    it('MEMO_004 는 자기 발신 안내', () => {
        expect(sendMemoErrorMessage(err(ERROR_CODES.MEMO_004, 422))).toContain(
            '자기 자신',
        )
    })

    it('400 은 형식 안내', () => {
        expect(sendMemoErrorMessage(err('COMMON_000', 400))).toContain('형식')
    })

    it('★ 서버 원문을 노출하지 않는다', () => {
        expect(
            sendMemoErrorMessage(err(ERROR_CODES.MEMO_001, 404)),
        ).not.toContain('raw server text')
    })

    it('미지·네트워크는 generic 폴백', () => {
        expect(sendMemoErrorMessage(new Error('boom'))).toContain(
            '보내지 못했습니다',
        )
    })
})

describe('memoAccessErrorMessage / deleteMemoErrorMessage', () => {
    it('MEMO_002·MEMO_003 은 한 문구(열거 완화)', () => {
        const a = memoAccessErrorMessage(err(ERROR_CODES.MEMO_002, 404))
        const b = memoAccessErrorMessage(err(ERROR_CODES.MEMO_003, 403))
        expect(a).toBe(b)
    })

    it('삭제 실패는 새로고침 안내', () => {
        expect(
            deleteMemoErrorMessage(err(ERROR_CODES.MEMO_002, 404)),
        ).toContain('새로고침')
    })

    it('★ 서버 원문을 노출하지 않는다', () => {
        expect(
            memoAccessErrorMessage(err(ERROR_CODES.MEMO_003, 403)),
        ).not.toContain('raw server text')
    })
})
