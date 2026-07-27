import { describe, expect, it } from 'vitest'
import { emailErrorInfo, emailErrorMessage } from './emailVerifyErrors'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 이메일 인증 에러 매핑 (FC-138) — 계약 §5 EMAIL_001~007.
 *
 * 고정하는 것:
 *  1. 코드별 재시도성 분류(again/reissue/wait/info/setup/field)가 목업 카탈로그와 일치.
 *  2. 서버 원문(message)을 노출하지 않는다 — 우리 문구만.
 *  3. 미지 에러·네트워크는 generic 폴백.
 */

function err(code: string, status: number): ApiError {
    return new ApiError({ code, message: 'raw server text', status })
}

describe('emailErrorInfo', () => {
    it('EMAIL_001(불일치)은 again — 코드 다시 입력', () => {
        expect(emailErrorInfo(err(ERROR_CODES.EMAIL_001, 422)).kind).toBe(
            'again',
        )
    })

    it('EMAIL_002(만료)·EMAIL_003(시도초과)은 reissue — 코드 재발급', () => {
        expect(emailErrorInfo(err(ERROR_CODES.EMAIL_002, 422)).kind).toBe(
            'reissue',
        )
        expect(emailErrorInfo(err(ERROR_CODES.EMAIL_003, 429)).kind).toBe(
            'reissue',
        )
    })

    it('EMAIL_004(쿨다운)은 wait, EMAIL_005(이미인증)은 info', () => {
        expect(emailErrorInfo(err(ERROR_CODES.EMAIL_004, 429)).kind).toBe(
            'wait',
        )
        expect(emailErrorInfo(err(ERROR_CODES.EMAIL_005, 409)).kind).toBe(
            'info',
        )
    })

    it('EMAIL_006(미설정)은 setup, EMAIL_007(중복)은 field', () => {
        expect(emailErrorInfo(err(ERROR_CODES.EMAIL_006, 409)).kind).toBe(
            'setup',
        )
        expect(emailErrorInfo(err(ERROR_CODES.EMAIL_007, 409)).kind).toBe(
            'field',
        )
    })

    it('★ 서버 원문을 문구로 노출하지 않는다', () => {
        expect(
            emailErrorMessage(err(ERROR_CODES.EMAIL_001, 422)),
        ).not.toContain('raw server text')
    })

    it('미지 코드·네트워크는 generic 폴백', () => {
        expect(emailErrorInfo(new Error('boom')).kind).toBe('generic')
        expect(emailErrorInfo(err('WHAT_999', 500)).kind).toBe('generic')
    })
})
