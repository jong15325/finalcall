import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from '@/types/errorCodes'
import { ApiError } from '@/lib/api/errors'
import { queryClient, retryDelayMs, shouldRetryQuery } from './queryClient'

/**
 * 재시도 정책 (FC-056 복원, 계약 §1.6).
 * 4xx 무재시도 · GATEWAY_429 만 Retry-After 존중 · 5xx 제한 재시도.
 */

const apiError = (code: string, status: number, retryAfterMs?: number) =>
    new ApiError({ code, message: '테스트', status, retryAfterMs })

describe('쿼리 재시도 여부', () => {
    it('4xx 도메인 에러는 재시도하지 않는다 (잘못된 요청은 다시 보내도 잘못이다)', () => {
        for (const [code, status] of [
            [ERROR_CODES.AUCTION_004, 404],
            [ERROR_CODES.BID_001, 422],
            [ERROR_CODES.BID_006, 409],
            [ERROR_CODES.AUTH_005, 403],
            [ERROR_CODES.GATEWAY_403, 403],
        ] as const) {
            expect(shouldRetryQuery(0, apiError(code, status))).toBe(false)
        }
    })

    it('★ GATEWAY_429 만 4xx 중 예외로 재시도한다 (상한 3회)', () => {
        const rateLimited = apiError(ERROR_CODES.GATEWAY_429, 429)

        expect(shouldRetryQuery(0, rateLimited)).toBe(true)
        expect(shouldRetryQuery(2, rateLimited)).toBe(true)
        expect(shouldRetryQuery(3, rateLimited)).toBe(false)
    })

    it('5xx 는 제한 재시도한다 (상한 2회)', () => {
        const serverError = apiError('COMMON_999', 500)

        expect(shouldRetryQuery(0, serverError)).toBe(true)
        expect(shouldRetryQuery(1, serverError)).toBe(true)
        expect(shouldRetryQuery(2, serverError)).toBe(false)
    })

    it('네트워크 오류(status 0)도 제한 재시도한다', () => {
        const offline = apiError('NETWORK_ERROR', 0)

        expect(shouldRetryQuery(0, offline)).toBe(true)
        expect(shouldRetryQuery(2, offline)).toBe(false)
    })

    it('ApiError 가 아닌 예외도 제한 재시도한다 (분류 불가는 일시 오류로 본다)', () => {
        expect(shouldRetryQuery(0, new Error('알 수 없음'))).toBe(true)
        expect(shouldRetryQuery(2, new Error('알 수 없음'))).toBe(false)
    })
})

describe('재시도 대기', () => {
    it('★ Retry-After 가 있으면 지수 백오프보다 우선한다 (429 를 두들기지 않는다)', () => {
        const rateLimited = apiError(ERROR_CODES.GATEWAY_429, 429, 5000)

        expect(retryDelayMs(0, rateLimited)).toBe(5000)
        expect(retryDelayMs(3, rateLimited)).toBe(5000)
    })

    it('Retry-After 가 없으면 지수 백오프하되 30초를 넘지 않는다', () => {
        const serverError = apiError('COMMON_999', 500)

        expect(retryDelayMs(0, serverError)).toBe(1000)
        expect(retryDelayMs(2, serverError)).toBe(4000)
        expect(retryDelayMs(20, serverError)).toBe(30_000)
    })
})

describe('queryClient 기본값', () => {
    it('mutation 은 재시도하지 않는다 (입찰·정산 중복 실행 방지)', () => {
        expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false)
    })

    it('쿼리 기본값에 정책 함수가 실제로 연결돼 있다', () => {
        const queries = queryClient.getDefaultOptions().queries

        expect(queries?.retry).toBe(shouldRetryQuery)
        expect(queries?.retryDelay).toBe(retryDelayMs)
    })
})
