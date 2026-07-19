import { useQuery } from '@tanstack/react-query'
import { getMyBalance } from '@/lib/api/balance'
import { useIsAuthenticated } from '@/store/authStore'
import type { BalanceResponse } from '@/lib/api/balance'

/**
 * 잔액 쿼리 (계약 §4.4) — FC-057.
 *
 * ★ **키 계층을 여기서 시작한다.** FC-055 가 react-query 를 남긴 이유가 "캐시 키 분리가 곧
 *   무효화 전략"이었다. 뒤에 올 티켓(입찰·충전·교환)은 성공 후
 *   `queryClient.invalidateQueries({ queryKey: balanceKeys.me() })` 로 이 값을 갱신한다.
 */
export const balanceKeys = {
    all: ['balance'] as const,
    me: () => [...balanceKeys.all, 'me'] as const,
}

/**
 * 내 잔액.
 *
 * ★★ **`enabled: isAuthed` 가 핵심이다.** 셸은 전 화면에 붙고 **비로그인도 셸을 본다**.
 *    가드가 없으면 손님이 홈에 들어온 순간 `GET /me/balance` 가 401 로 떨어지고, 그 401 이
 *    `apiClient` 의 refresh 회전을 깨우려 든다. 없는 세션을 되살리려는 시도라 아무 이득 없이
 *    콘솔·서버 로그만 더럽힌다.
 *
 * ★ 금액은 **잠깐 사이에도 바뀐다**(입찰 홀드). 전역 기본 `staleTime` 30초를 그대로 쓰되
 *   창 포커스 복귀 시에는 다시 가져온다 — 다른 탭에서 입찰하고 돌아온 경우가 흔하다.
 */
export function useMyBalance() {
    const isAuthed = useIsAuthenticated()

    return useQuery<BalanceResponse>({
        queryKey: balanceKeys.me(),
        queryFn: getMyBalance,
        enabled: isAuthed,
        refetchOnWindowFocus: true,
    })
}
