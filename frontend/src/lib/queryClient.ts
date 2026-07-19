import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/** 5xx·네트워크 오류 재시도 상한 */
const TRANSIENT_RETRY_LIMIT = 2
/** GATEWAY_429 재시도 상한 */
const RATE_LIMIT_RETRY_LIMIT = 3
/** 지수 백오프 상한 */
const MAX_BACKOFF_MS = 30_000

/**
 * QueryClient — 재시도 정책 복원(FC-056).
 *
 * ★ **왜 react-query 인가** — 템플릿은 zustand + axios(+swr)를 쓰지만 우리 서버 상태 요구가
 *   그 위에 있다(FC-055 판단). 커서 페이징(`useInfiniteQuery`)·캐시 키 분리·입찰 후 무효화가
 *   이미 계약 형태에 맞물려 있다.
 *
 * ★★ **재시도 정책은 세 갈래다** — 이 갈래가 정책의 전부다.
 *  1) **4xx 는 재시도하지 않는다.** 도메인 에러다. 잘못된 요청을 세 번 더 보내도 잘못이다.
 *  2) **단 `GATEWAY_429` 는 예외** — 게이트웨이가 준 `Retry-After` 를 **존중해** 재시도한다
 *     (계약 §1.6). 429 를 지수 백오프로 두들기면 rate limit 을 스스로 악화시킨다.
 *  3) **5xx·네트워크는 제한 재시도**(2회, 지수 백오프).
 *
 * ★ mutation 은 재시도하지 않는다 — 입찰·정산의 중복 실행 방지. 멱등키가 있는 교환도
 *   재시도 여부는 호출부가 명시적으로 정하게 둔다.
 */

/** 쿼리 재시도 여부 (테스트가 정책을 직접 겨냥할 수 있도록 분리) */
export function shouldRetryQuery(
    failureCount: number,
    error: unknown,
): boolean {
    if (isApiError(error)) {
        if (error.code === ERROR_CODES.GATEWAY_429) {
            return failureCount < RATE_LIMIT_RETRY_LIMIT
        }
        if (error.status >= 400 && error.status < 500) return false
    }
    return failureCount < TRANSIENT_RETRY_LIMIT
}

/** 재시도 대기(ms). 서버가 준 `Retry-After` 가 우리 추측보다 정확하므로 우선한다. */
export function retryDelayMs(attempt: number, error: unknown): number {
    if (isApiError(error) && error.retryAfterMs != null) {
        return error.retryAfterMs
    }
    return Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS)
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: shouldRetryQuery,
            retryDelay: retryDelayMs,
        },
        mutations: {
            retry: false,
        },
    },
})
