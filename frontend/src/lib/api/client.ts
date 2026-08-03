import appConfig from '@/configs/app.config'
import { ERROR_CODES } from '@/types/errorCodes'
import { ApiError, networkError, normalizeErrorResponse } from './errors'
import {
    applyRotatedTokens,
    getAccessToken,
    getRefreshToken,
    resetSession,
} from './session'
import type { ApiEnvelope } from '@/types/api'
import type { SessionTokens } from '@/store/authStore'

/**
 * 단일 HTTP 전송로 (FC-056).
 *
 * ★★ **템플릿 axios 서비스 층(`services/**`)을 이 파일이 대체한다.** 전송로가 둘이면 토큰 첨부·
 *    envelope 언랩·401 회전·재시도 정책이 두 벌로 갈라지고, 한쪽만 고치는 사고가 난다.
 *    FC-055 가 공존 상태로 남겨둔 것을 여기서 하나로 합쳤다.
 *
 * base URL 은 계약 §1.1 의 `/api/v1`(`appConfig.apiPrefix`). dev 에서는 vite 프록시가 이 경로를
 * `:8080` 으로 넘기며 `X-Gateway-Token` 을 붙인다(D-068).
 */
export const API_BASE_URL = appConfig.apiPrefix

/**
 * 401 이어도 refresh 회전을 시도하지 않는 경로 — 무한 루프 방지.
 * 인증 계열 자체가 401 을 정상 신호로 쓴다(로그인 실패 AUTH_003, refresh 무효 AUTH_004).
 */
const AUTH_PATHS = new Set(['/auth/login', '/auth/signup', '/auth/refresh'])

export interface RequestOptions {
    /** 쿼리 파라미터 — `undefined`/`null` 값은 제외된다 */
    query?: Record<string, string | number | boolean | null | undefined>
    /** JSON 본문 */
    body?: unknown
    /** 추가 헤더 (예: 교환의 `Idempotency-Key`) */
    headers?: Record<string, string>
    /** 인증 첨부 여부 (기본 true). 공개 GET 에서 false 가능. */
    auth?: boolean
    signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = `${API_BASE_URL}${path}`
    if (!query) return url

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null)
            params.set(key, String(value))
    }
    const qs = params.toString()
    return qs ? `${url}?${qs}` : url
}

/**
 * `Retry-After` → ms.
 * delta-seconds 형식만 지원한다(HTTP-date 미지원 — 게이트웨이는 초 단위를 보낸다, 계약 §1.6).
 */
function parseRetryAfterMs(headers: Headers): number | undefined {
    const raw = headers.get('Retry-After')
    if (!raw) return undefined

    const seconds = Number(raw)
    return Number.isFinite(seconds) ? seconds * 1000 : undefined
}

/**
 * envelope 언랩 (계약 §1.4).
 * 성공 → `data` 반환. 에러 → `ApiError` throw. 204/빈 본문 → `undefined`.
 *
 * ★ 엣지 오류(`GATEWAY_*`)도 **동일 envelope** 이라 별도 파서를 두지 않는다(계약 §1.6).
 *   게이트웨이/서비스 구분은 클라이언트 관심사가 아니다.
 */
async function unwrap<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T

    const text = await res.text()
    if (!text) {
        if (res.ok) return undefined as T
        throw networkError(`빈 응답 (HTTP ${res.status})`, res.status)
    }

    let envelope: ApiEnvelope<T>
    try {
        envelope = JSON.parse(text) as ApiEnvelope<T>
    } catch {
        throw networkError(`비정형 응답 (HTTP ${res.status})`, res.status)
    }

    if (envelope.success) return envelope.data

    throw normalizeErrorResponse(
        envelope,
        res.status,
        parseRetryAfterMs(res.headers),
    )
}

async function rawFetch(
    path: string,
    method: string,
    options: RequestOptions,
): Promise<Response> {
    const { query, body, headers, auth = true, signal } = options
    const finalHeaders = new Headers(headers)
    if (body !== undefined) finalHeaders.set('Content-Type', 'application/json')
    finalHeaders.set('Accept', 'application/json')

    if (auth) {
        const token = getAccessToken()
        if (token) finalHeaders.set('Authorization', `Bearer ${token}`)
    }

    try {
        return await fetch(buildUrl(path, query), {
            method,
            headers: finalHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal,
        })
    } catch (error) {
        // 취소는 에러가 아니다 — 호출자(react-query)가 그대로 인식해야 한다.
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error
        }
        throw networkError('네트워크 요청 실패')
    }
}

// ── refresh 회전 (계약 §2 회전 정책, SEC-006) ──────────────────────────────
/**
 * ★★ **single-flight** — 진행 중인 refresh 프로미스를 모듈 레벨에 하나만 둔다.
 *
 *  왜: 화면 하나가 열릴 때 병렬 요청이 여럿 나간다. 액세스 토큰이 만료돼 있으면 그 요청들이
 *  **동시에 401** 을 받는다. 각자 refresh 를 부르면 refresh 가 N 번 병렬로 나가는데,
 *  우리 계약의 refresh 는 **1회성 회전**(재발급 시 이전 refreshToken 폐기)이다.
 *  → 첫 호출이 회전시킨 순간 나머지는 **폐기된 토큰을 제시**하게 되고, 서버는 이를
 *    **재사용 탐지**로 보아 세션 전체를 무효화한다. 즉 없으면 정상 사용자가 로그아웃된다.
 *  → 모두가 같은 프로미스에 합류시킨다. 회전은 1회, 결과는 공유.
 */
let refreshPromise: Promise<void> | null = null

/**
 * ★★ **세션 세대(epoch)** — 세션 리셋(로그아웃·계정 전환·refresh 실패)마다 증가한다(FC-174).
 *  refresh 는 비동기라 시작 시점과 착지 시점 사이에 세션이 바뀔 수 있다. 이 카운터로
 *  (i) stale 착지가 자기 promise 를 다시 null 로 만들어 새 세션의 in-flight 를 지우는 사고와,
 *  (ii) finally 의 promise 정리 대상 오인을 막는다.
 */
let refreshEpoch = 0

/**
 * 세션 리셋 시 in-flight refresh 를 무효화한다(spec §3.4).
 * epoch 을 올려 진행 중이던 single-flight 가 다음 요청에 재사용되지 않게 하고,
 * 그 refresh 가 나중에 착지해도 `refreshPromise` 정리 대상이 어긋나지 않게 한다.
 */
export function invalidateRefresh(): void {
    refreshEpoch += 1
    refreshPromise = null
}

async function performRefresh(): Promise<void> {
    // ★ 세대 가드용 라인리지 캡처 — 착지 시점에 이 값이 그대로여야 rotate 결과를 신뢰한다(spec §3.4).
    const startedRefreshToken = getRefreshToken()
    if (!startedRefreshToken) {
        resetSession()
        throw new ApiError({
            code: ERROR_CODES.AUTH_004,
            message: '세션이 없습니다. 다시 로그인해 주세요.',
            status: 401,
        })
    }

    const res = await rawFetch('/auth/refresh', 'POST', {
        body: { refreshToken: startedRefreshToken },
        auth: false,
    })

    try {
        // 응답: { accessToken, refreshToken(회전된 신규), accessExpiresAt } — 계약 §2
        const rotated = await unwrap<SessionTokens>(res)

        // ★★ 세대 가드: 착지 시점의 refreshToken 이 시작 때와 다르면(그 사이 로그아웃·계정 전환으로
        //    세션이 리셋/교체됨) 이 회전 결과는 **이전 계정 것**이다 — store 에 쓰지 않고 조용히 폐기한다.
        //    쓰면 새 세션 토큰을 이전 계정 회전토큰으로 덮어써 신원이 뒤바뀐다(defect ii, spec §1.2).
        if (getRefreshToken() !== startedRefreshToken) return

        applyRotatedTokens(rotated)
    } catch (error) {
        // AUTH_004 등 refresh 실패 → 세션 소멸이므로 캐시까지 리셋(계약 §2, spec §3.3).
        // 단, 이미 세션이 바뀐 뒤 착지한 stale 실패면 **새 세션을 죽이지 않는다**(가드).
        if (getRefreshToken() === startedRefreshToken) resetSession()
        throw error
    }
}

function refreshSession(): Promise<void> {
    if (!refreshPromise) {
        const epoch = refreshEpoch
        refreshPromise = performRefresh().finally(() => {
            // ★ 내 세대의 promise 일 때만 비운다 — 그 사이 세션이 리셋돼 새 refresh 가 걸렸다면
            //   그 promise 를 건드리지 않는다(spec §3.4).
            if (refreshEpoch === epoch) refreshPromise = null
        })
    }
    return refreshPromise
}

/** 테스트 전용 — 모듈 싱글턴인 in-flight refresh 를 비운다(테스트 간 누수 차단). */
export function __resetRefreshStateForTest(): void {
    invalidateRefresh()
}

/**
 * 코어 요청. envelope 언랩 후 `data` 반환.
 * 401(+인증 경로 아님 + refresh 보유) 시 회전 1회 시도 후 원요청을 **한 번만** 재시도한다.
 */
async function request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
): Promise<T> {
    const res = await rawFetch(path, method, options)

    const shouldRefresh =
        res.status === 401 &&
        options.auth !== false &&
        !AUTH_PATHS.has(path) &&
        getRefreshToken() !== null

    if (shouldRefresh) {
        // 실패 시 throw → 재시도 없이 전파된다(세션은 이미 정리됨).
        await refreshSession()
        return unwrap<T>(await rawFetch(path, method, options))
    }

    return unwrap<T>(res)
}

/** 계약 엔드포인트 단위 함수는 이 헬퍼 위에 구축한다. */
export const apiClient = {
    get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
        request<T>('GET', path, options),
    post: <T>(
        path: string,
        body?: unknown,
        options?: Omit<RequestOptions, 'body'>,
    ) => request<T>('POST', path, { ...options, body }),
    patch: <T>(
        path: string,
        body?: unknown,
        options?: Omit<RequestOptions, 'body'>,
    ) => request<T>('PATCH', path, { ...options, body }),
    put: <T>(
        path: string,
        body?: unknown,
        options?: Omit<RequestOptions, 'body'>,
    ) => request<T>('PUT', path, { ...options, body }),
    delete: <T>(
        path: string,
        body?: unknown,
        options?: Omit<RequestOptions, 'body'>,
    ) => request<T>('DELETE', path, { ...options, body }),
}
