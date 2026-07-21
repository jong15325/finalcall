import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postExchange } from '@/lib/api/exchange'
import { balanceKeys } from './balance'
import type { ExchangeResponse } from '@/lib/api/exchange'

/**
 * 캐시→게임머니 교환 변이 (계약 §4.4 `POST /exchanges`) — FC-075.
 *
 * ★ 성공 시 **잔액을 무효화한다** — 교환은 캐시를 줄이고 게임머니(가용·총 보유)를 늘리므로
 *   `balanceKeys.me()`(FC-057) 를 다시 가져와 지갑·헤더가 즉시 새 값을 반영한다.
 * ★ 서버 원문 에러는 호출부가 `error` 로 받아 code 로 문구를 낸다(`exchangeErrors.ts`).
 */
export function useExchange() {
    const queryClient = useQueryClient()

    return useMutation<ExchangeResponse, Error, number>({
        mutationFn: (cashAmount) => postExchange(cashAmount),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: balanceKeys.me() })
        },
    })
}
