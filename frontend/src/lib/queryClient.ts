import { QueryClient } from '@tanstack/react-query'

/**
 * QueryClient — 보수적 기본값 (FC-055 이관, 정책 일부는 FC-056 에서 복원).
 *
 * ★ **왜 react-query 를 유지하는가** — 템플릿은 zustand + axios(+ swr)를 쓰지만 우리 서버 상태
 *   요구는 그 위에 있다. 근거는 FC-055 반환 참조. 요약하면 커서 페이징(`useInfiniteQuery`)·
 *   캐시 키 분리·무효화가 이미 계약 형태에 맞물려 있다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **FC-056 에서 반드시 복원할 재시도 정책** — 지금은 에러 코드 모듈이 없어 단순화돼 있다.
 * ══════════════════════════════════════════════════════════════════════════════
 * 원본(`lib/api/errors` + `types/errorCodes` 이식 후) 정책은 이랬다:
 *   - 4xx(도메인 에러)는 **재시도하지 않는다**. 잘못된 요청을 세 번 더 보내도 잘못이다.
 *   - 단 **`GATEWAY_429` 는 예외** — 서버가 준 `Retry-After`(ms)를 존중해 백오프 재시도한다
 *     (계약 [1.6]. 신규 파서 없이 기존 envelope 소비 로직을 재사용한다).
 *   - 5xx·네트워크는 제한 재시도(2회).
 *   - mutation 은 재시도하지 않는다(입찰·정산 중복 실행 방지).
 * 지금은 마지막 항목만 살아 있고 4xx/429 분기가 빠져 있다 — **429 를 지수 백오프로 두들기면
 * 게이트웨이 rate limit 을 스스로 악화시킨다.** FC-056 이 에러 계층을 이식할 때 되살릴 것.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1, // FC-056 에서 코드 인지 정책으로 교체
        },
        mutations: {
            retry: false,
        },
    },
})
