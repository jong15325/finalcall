import { CLIENT_ERROR_CODES, ERROR_CODES } from '@/types/errorCodes'
import type { ApiErrorResponse, FieldError } from '@/types/api'

/**
 * 정규화된 API 에러 (FC-056 복원).
 * 계약 §1.4 에러 envelope + HTTP status + (429의) 재시도 대기를 담는다.
 * 에러 분기는 `code`(ERROR_CODES 상수)로 한다 — status 로 분기하면 같은 409 안의 서로 다른
 * 사용자 대응(예: BID_004 vs BID_006)을 구분할 수 없다.
 */
export class ApiError extends Error {
    readonly code: string
    readonly status: number
    readonly fieldErrors?: FieldError[]
    /** GATEWAY_429 의 `Retry-After` 를 ms 로 환산(있을 때만). 재시도 백오프에서 소비한다. */
    readonly retryAfterMs?: number

    constructor(params: {
        code: string
        message: string
        status: number
        fieldErrors?: FieldError[]
        retryAfterMs?: number
    }) {
        super(params.message)
        this.name = 'ApiError'
        this.code = params.code
        this.status = params.status
        this.fieldErrors = params.fieldErrors
        this.retryAfterMs = params.retryAfterMs
    }
}

export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError
}

/** 특정 코드 매칭 (예: `hasErrorCode(err, ERROR_CODES.AUTH_004)`) */
export function hasErrorCode(error: unknown, code: string): boolean {
    return isApiError(error) && error.code === code
}

/**
 * 서버(또는 엣지) 에러 envelope → ApiError.
 * `GATEWAY_403` 은 별도 분기를 두지 않는다(§1.6 — 정상 경유 클라는 만나지 않는다). 정규화만 한다.
 */
export function normalizeErrorResponse(
    body: ApiErrorResponse,
    status: number,
    retryAfterMs?: number,
): ApiError {
    return new ApiError({
        code: body.code,
        message: body.message,
        status,
        fieldErrors: body.errors,
        retryAfterMs,
    })
}

/** envelope 파싱조차 실패한 경우(네트워크·비정형 응답)의 폴백. */
export function networkError(message: string, status = 0): ApiError {
    return new ApiError({
        code: CLIENT_ERROR_CODES.NETWORK_ERROR,
        message,
        status,
    })
}

/** 재시도 판단 헬퍼 — `GATEWAY_429` 만 재시도 대상(백오프는 `retryAfterMs` 존중). */
export function isRateLimited(error: unknown): error is ApiError {
    return isApiError(error) && error.code === ERROR_CODES.GATEWAY_429
}
