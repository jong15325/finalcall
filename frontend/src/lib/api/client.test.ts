import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { ERROR_CODES } from '@/types/errorCodes'
import { apiClient } from './client'
import { ApiError, isApiError } from './errors'
import type { Mock } from 'vitest'

/**
 * 단일 전송로 `apiClient` 의 계약 준수 검증 (FC-056).
 * envelope 언랩(§1.4) · refresh single-flight(§2) · 401 재시도를 고정한다.
 */

/** 성공 envelope 응답 (계약 §1.4) */
function ok(data: unknown, status = 200): Response {
    return new Response(
        JSON.stringify({
            success: true,
            data,
            timestamp: '2026-07-19T00:00:00Z',
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
    )
}

/** 에러 envelope 응답 (계약 §1.4) */
function fail(
    code: string,
    status: number,
    extra: { errors?: unknown[]; retryAfter?: string } = {},
): Response {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }
    if (extra.retryAfter) headers['Retry-After'] = extra.retryAfter

    return new Response(
        JSON.stringify({
            success: false,
            code,
            message: `테스트 오류 ${code}`,
            ...(extra.errors ? { errors: extra.errors } : {}),
            timestamp: '2026-07-19T00:00:00Z',
        }),
        { status, headers },
    )
}

const TOKENS = {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    accessExpiresAt: '2026-07-19T01:00:00Z',
}

function signIn() {
    useAuthStore.getState().setSession({
        ...TOKENS,
        user: { userPublicId: 'U1', nickname: '테스터', isAdmin: false },
    })
}

let fetchMock: Mock

beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
})

describe('envelope 언랩 (계약 §1.4)', () => {
    it('성공 응답에서 data 만 꺼낸다 (success/timestamp 는 호출부로 새지 않는다)', async () => {
        fetchMock.mockResolvedValueOnce(ok({ nickname: '테스터' }))

        await expect(apiClient.get('/me')).resolves.toEqual({
            nickname: '테스터',
        })
    })

    it('에러 응답을 code·status 를 보존한 ApiError 로 throw 한다', async () => {
        fetchMock.mockResolvedValueOnce(fail(ERROR_CODES.BID_007, 409))

        const error = await apiClient.post('/auctions/A1/bids').catch((e) => e)

        expect(isApiError(error)).toBe(true)
        expect((error as ApiError).code).toBe(ERROR_CODES.BID_007)
        expect((error as ApiError).status).toBe(409)
    })

    it('검증 실패의 errors[] 를 fieldErrors 로 보존한다 (필드 단위 표시용)', async () => {
        fetchMock.mockResolvedValueOnce(
            fail('AUTH_002', 409, {
                errors: [{ field: 'nickname', reason: '이미 사용 중입니다.' }],
            }),
        )

        const error = (await apiClient
            .post('/auth/signup')
            .catch((e) => e)) as ApiError

        expect(error.fieldErrors).toEqual([
            { field: 'nickname', reason: '이미 사용 중입니다.' },
        ])
    })

    it('엣지 오류(GATEWAY_429)도 같은 envelope 으로 처리하고 Retry-After 를 ms 로 싣는다', async () => {
        fetchMock.mockResolvedValueOnce(
            fail(ERROR_CODES.GATEWAY_429, 429, { retryAfter: '3' }),
        )

        const error = (await apiClient
            .get('/auctions')
            .catch((e) => e)) as ApiError

        expect(error.code).toBe(ERROR_CODES.GATEWAY_429)
        expect(error.retryAfterMs).toBe(3000)
    })

    it('204 는 본문 없이 성공한다 (로그아웃·탈퇴 경로)', async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

        await expect(apiClient.post('/auth/logout')).resolves.toBeUndefined()
    })

    it('비정형(HTML 등) 응답은 파싱을 시도하다 죽지 않고 NETWORK_ERROR 로 정규화된다', async () => {
        fetchMock.mockResolvedValueOnce(
            new Response('<html>502 Bad Gateway</html>', { status: 502 }),
        )

        const error = (await apiClient
            .get('/auctions')
            .catch((e) => e)) as ApiError

        expect(error.code).toBe('NETWORK_ERROR')
        expect(error.status).toBe(502)
    })
})

describe('인증 첨부', () => {
    it('세션이 있으면 Authorization 헤더를 붙인다', async () => {
        signIn()
        fetchMock.mockResolvedValueOnce(ok(null))

        await apiClient.get('/me')

        const headers = (fetchMock.mock.calls[0][1] as RequestInit)
            .headers as Headers
        expect(headers.get('Authorization')).toBe('Bearer access-1')
    })

    it('auth:false 면 세션이 있어도 붙이지 않는다 (로그인·가입은 공개 경로)', async () => {
        signIn()
        fetchMock.mockResolvedValueOnce(ok(null))

        await apiClient.post('/auth/login', {}, { auth: false })

        const headers = (fetchMock.mock.calls[0][1] as RequestInit)
            .headers as Headers
        expect(headers.get('Authorization')).toBeNull()
    })
})

describe('401 refresh 회전 (계약 §2)', () => {
    it('401 이면 refresh 후 원요청을 재시도하고, 회전된 토큰을 저장한다', async () => {
        signIn()
        fetchMock
            .mockResolvedValueOnce(fail(ERROR_CODES.COMMON_005, 401)) // 원요청
            .mockResolvedValueOnce(
                ok({
                    accessToken: 'access-2',
                    refreshToken: 'refresh-2',
                    accessExpiresAt: '2026-07-19T02:00:00Z',
                }),
            ) // refresh
            .mockResolvedValueOnce(ok({ nickname: '테스터' })) // 재시도

        await expect(apiClient.get('/me')).resolves.toEqual({
            nickname: '테스터',
        })

        const state = useAuthStore.getState()
        expect(state.accessToken).toBe('access-2')
        // 회전된 신규 refreshToken 을 저장하지 않으면 다음 회전이 폐기 토큰으로 나간다.
        expect(state.refreshToken).toBe('refresh-2')
        // 사용자 요약은 회전으로 지워지지 않는다.
        expect(state.user?.nickname).toBe('테스터')
    })

    it('★ 동시 401 다발이 refresh 를 단 1회로 합류시킨다 (single-flight)', async () => {
        signIn()

        let refreshCalls = 0
        fetchMock.mockImplementation(async (url: string) => {
            if (String(url).includes('/auth/refresh')) {
                refreshCalls += 1
                // 회전에 시간이 걸리는 동안 다른 401 들이 도착하는 상황을 만든다.
                await new Promise((resolve) => setTimeout(resolve, 10))
                return ok({
                    accessToken: 'access-2',
                    refreshToken: 'refresh-2',
                    accessExpiresAt: '2026-07-19T02:00:00Z',
                })
            }
            // 새 액세스 토큰으로 재시도된 요청만 통과시킨다.
            return useAuthStore.getState().accessToken === 'access-2'
                ? ok({ ok: true })
                : fail(ERROR_CODES.COMMON_005, 401)
        })

        const results = await Promise.all([
            apiClient.get('/me'),
            apiClient.get('/me/balance'),
            apiClient.get('/me/orders'),
            apiClient.get('/auctions'),
        ])

        /*
         * 계약 §2 의 refresh 는 1회성 회전이다 — 병렬로 N 번 부르면 두 번째부터는 폐기된 토큰을
         * 제시하게 되고 서버가 재사용 탐지로 세션 전체를 무효화한다(정상 사용자가 로그아웃된다).
         */
        expect(refreshCalls).toBe(1)
        expect(results).toEqual([
            { ok: true },
            { ok: true },
            { ok: true },
            { ok: true },
        ])
    })

    it('합류가 끝나면 다음 401 은 새 refresh 를 시작한다 (프로미스가 고착되지 않는다)', async () => {
        signIn()

        // 서버가 인정하는 액세스 토큰. 스토어의 토큰과 다르면 401 을 준다.
        let serverAccess = 'server-1'
        let refreshCalls = 0

        fetchMock.mockImplementation(async (url: string) => {
            if (String(url).includes('/auth/refresh')) {
                refreshCalls += 1
                serverAccess = `server-${refreshCalls + 1}`
                return ok({
                    accessToken: serverAccess,
                    refreshToken: `refresh-${refreshCalls + 1}`,
                    accessExpiresAt: '2026-07-19T02:00:00Z',
                })
            }
            return useAuthStore.getState().accessToken === serverAccess
                ? ok({ ok: true })
                : fail(ERROR_CODES.COMMON_005, 401)
        })

        await expect(apiClient.get('/me')).resolves.toEqual({ ok: true })
        expect(refreshCalls).toBe(1)

        // 새 액세스 토큰마저 만료된 상황 — in-flight 프로미스가 남아 있으면 여기서 회전이 안 된다.
        serverAccess = 'server-expired-again'

        await expect(apiClient.get('/me')).resolves.toEqual({ ok: true })
        expect(refreshCalls).toBe(2)
    })

    it('refresh 가 AUTH_004 로 실패하면 세션을 비우고 원요청을 재시도하지 않는다', async () => {
        signIn()
        fetchMock
            .mockResolvedValueOnce(fail(ERROR_CODES.COMMON_005, 401))
            .mockResolvedValueOnce(fail(ERROR_CODES.AUTH_004, 401))

        const error = (await apiClient.get('/me').catch((e) => e)) as ApiError

        expect(error.code).toBe(ERROR_CODES.AUTH_004)
        expect(useAuthStore.getState().accessToken).toBeNull()
        expect(useAuthStore.getState().refreshToken).toBeNull()
        // 원요청 + refresh 뿐 — 죽은 세션으로 재시도하지 않는다.
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('refresh 토큰이 없으면 회전을 시도조차 하지 않는다 (비로그인 401)', async () => {
        fetchMock.mockResolvedValueOnce(fail(ERROR_CODES.COMMON_005, 401))

        const error = (await apiClient.get('/me').catch((e) => e)) as ApiError

        expect(error.code).toBe(ERROR_CODES.COMMON_005)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('★ 인증 경로의 401 은 회전하지 않는다 (무한 루프 방지)', async () => {
        signIn()
        fetchMock.mockResolvedValueOnce(fail(ERROR_CODES.AUTH_003, 401))

        const error = (await apiClient
            .post('/auth/login', {}, { auth: false })
            .catch((e) => e)) as ApiError

        // 로그인 실패(AUTH_003)는 정상 신호다. 여기서 회전하면 refresh → 401 → refresh 로 돈다.
        expect(error.code).toBe(ERROR_CODES.AUTH_003)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})

describe('URL 조립', () => {
    it('base 는 계약 §1.1 의 /api/v1 이다', async () => {
        fetchMock.mockResolvedValueOnce(ok(null))

        await apiClient.get('/auctions')

        expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auctions')
    })

    it('null·undefined 쿼리는 보내지 않는다 (미선택 필터가 빈 값으로 나가지 않게)', async () => {
        fetchMock.mockResolvedValueOnce(ok(null))

        await apiClient.get('/auctions', {
            query: {
                status: 'ACTIVE',
                minLevel: 0,
                element: null,
                kind: undefined,
            },
        })

        expect(fetchMock.mock.calls[0][0]).toBe(
            '/api/v1/auctions?status=ACTIVE&minLevel=0',
        )
    })
})
