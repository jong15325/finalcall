import { apiClient } from './client'

/**
 * 화폐 — 잔액 조회 (계약 §4.4) — FC-057.
 *
 * ★ 계약이 준 네 값을 **그대로** 둔다. 클라 편의를 위해 합치거나 개명하지 않는다
 *   (`types/api.ts` 상단 규칙). 특히 `gameMoneyBalance`(보유 총액)와
 *   `gameMoneyAvailable`(입찰 홀드를 뺀 가용액)을 **한 값으로 뭉개지 마라** — 입찰 중인
 *   사용자에게 이 둘은 다른 숫자이고, 가용액을 "보유"라 부르면 잔액을 축소해 보이게 한다.
 */
export interface BalanceResponse {
    /** 캐시(원화 충전분) */
    cashBalance: number
    /** 게임머니 보유 총액 */
    gameMoneyBalance: number
    /** 진행 중 입찰에 묶인 금액 */
    gameMoneyHeld: number
    /** 실제로 쓸 수 있는 금액 = balance - held */
    gameMoneyAvailable: number
}

/** `GET /me/balance` — 인증 필요. 비로그인 호출은 401 이므로 훅에서 `enabled` 로 막는다. */
export function getMyBalance(): Promise<BalanceResponse> {
    return apiClient.get<BalanceResponse>('/me/balance')
}
