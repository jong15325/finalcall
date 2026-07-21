import { describe, expect, it } from 'vitest'
import { loginErrorMessage, signupErrorMessage } from './authErrors'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 인증 에러 문구 매핑 (FC-078).
 *
 * 고정하는 것:
 *  1. 로그인 `AUTH_003` 은 단일 문구(아이디/비밀번호 구분 없음, SEC-007).
 *  2. 가입 `AUTH_001`(중복 아이디)·`AUTH_002`(중복 닉네임)는 code 로 구분(둘 다 409).
 *  3. 서버 원문(`message`)은 절대 새어 나오지 않는다.
 */

function apiError(code: string, status: number): ApiError {
    return new ApiError({ code, message: 'raw server text', status })
}

describe('loginErrorMessage', () => {
    it('AUTH_003 은 아이디/비밀번호 구분 없는 단일 문구를 낸다', () => {
        const message = loginErrorMessage(apiError(ERROR_CODES.AUTH_003, 401))
        expect(message).toBe('아이디 또는 비밀번호가 올바르지 않습니다.')
        expect(message).not.toContain('raw server text')
    })

    it('400 은 형식 확인 문구를 낸다', () => {
        expect(loginErrorMessage(apiError('COMMON_001', 400))).toBe(
            '아이디와 비밀번호를 다시 확인해 주세요.',
        )
    })

    it('그 밖은 일반 전송 실패 문구로 폴백한다', () => {
        expect(loginErrorMessage(new Error('boom'))).toBe(
            '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        )
    })
})

describe('signupErrorMessage', () => {
    it('AUTH_001 은 중복 아이디 문구를 낸다(원문 미노출)', () => {
        const message = signupErrorMessage(apiError(ERROR_CODES.AUTH_001, 409))
        expect(message).toBe(
            '이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.',
        )
        expect(message).not.toContain('raw server text')
    })

    it('AUTH_002 는 중복 닉네임 문구를 낸다(409 를 code 로 구분)', () => {
        expect(signupErrorMessage(apiError(ERROR_CODES.AUTH_002, 409))).toBe(
            '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.',
        )
    })

    it('400 은 형식 확인 문구를 낸다', () => {
        expect(signupErrorMessage(apiError('COMMON_001', 400))).toBe(
            '입력값을 확인해 주세요. 아이디·비밀번호·닉네임 형식을 지켜 주세요.',
        )
    })

    it('그 밖은 일반 전송 실패 문구로 폴백한다', () => {
        expect(signupErrorMessage(new Error('boom'))).toBe(
            '회원가입을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        )
    })
})
