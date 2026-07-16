import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { ERROR_CODES } from '@/types/errorCodes';

/**
 * QueryClient — 보수적 기본값.
 * - 4xx(도메인 에러)는 재시도하지 않는다. 단 GATEWAY_429 는 Retry-After 존중 백오프로 재시도한다
 *   ([1.6] — 기존 envelope 소비 로직 재사용, 신규 파서 없음).
 * - 5xx·네트워크는 제한 재시도.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isApiError(error)) {
          if (error.code === ERROR_CODES.GATEWAY_429) return failureCount < 3;
          if (error.status >= 400 && error.status < 500) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attempt, error) => {
        // 429 는 서버가 준 Retry-After(ms) 우선, 없으면 지수 백오프.
        if (isApiError(error) && error.retryAfterMs != null) return error.retryAfterMs;
        return Math.min(1000 * 2 ** attempt, 30_000);
      },
    },
    mutations: {
      retry: false,
    },
  },
});
