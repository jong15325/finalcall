import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { postExchange } from './exchange'
import type { Mock } from 'vitest'

/**
 * 교환 api `postExchange` 의 계약 준수 검증 (FC-075, 계약 §4.4).
 * 요청 body(방향 고정·정수 금액) · **`Idempotency-Key` 헤더 필수** · 응답 언랩을 고정한다.
 */

function ok(data: unknown): Response {
    return new Response(
        JSON.stringify({
            success: true,
            data,
            timestamp: '2026-07-21T00:00:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
    )
}

let fetchMock: Mock

beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    useAuthStore.getState().setSession({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessExpiresAt: '2026-07-21T01:00:00Z',
        user: { userPublicId: 'U1', nickname: '테스터', isAdmin: false },
    })
})

describe('postExchange (계약 §4.4)', () => {
    it('방향 고정·정수 금액 body 로 POST /exchanges 를 호출한다', async () => {
        fetchMock.mockResolvedValueOnce(
            ok({ gameMoneyAmount: 10_000, appliedRate: 1 }),
        )

        await expect(postExchange(10_000)).resolves.toEqual({
            gameMoneyAmount: 10_000,
            appliedRate: 1,
        })

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toContain('/exchanges')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body as string)).toEqual({
            direction: 'CASH_TO_GAME',
            cashAmount: 10_000,
        })
    })

    it('Idempotency-Key 헤더를 반드시 첨부한다(SEC-004)', async () => {
        fetchMock.mockResolvedValueOnce(
            ok({ gameMoneyAmount: 1, appliedRate: 1 }),
        )

        await postExchange(1)

        const headers = new Headers(fetchMock.mock.calls[0][1].headers)
        const key = headers.get('Idempotency-Key')
        expect(key).toBeTruthy()
        // uuid 형태(비어있지 않은 식별자) 확인
        expect(key?.length).toBeGreaterThanOrEqual(8)
    })
})
