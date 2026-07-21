import { apiClient } from './client'

/**
 * 화폐 — 캐시↔게임머니 교환 (계약 §4.4 `POST /exchanges`) — FC-075.
 *
 * ★ **방향은 `CASH_TO_GAME` 고정.** 역방향 환전은 계약상 범위 밖(domain-spec §12)이라
 *   서버가 `EXC_002` 로 거절한다 → 클라도 방향 선택 UI 를 두지 않는다.
 * ★ **`Idempotency-Key` 헤더 필수(SEC-004).** 동일 키 재요청은 서버가 1회만 처리한다
 *   → 401 회전 후 `client.ts` 가 **같은 options(=같은 헤더)** 로 재전송해도 이중 지급이 없다.
 *   키를 이 함수 안에서 1회 생성해 호출자가 빠뜨릴 여지를 없앤다.
 * ★ 금액은 **정수(long)** — 축약값을 API 에 절대 싣지 않는다(rebuild-contract-map §3.1).
 */

/** 교환 방향 — 현재 캐시→게임머니 단방향만 지원. */
export type ExchangeDirection = 'CASH_TO_GAME'

export interface ExchangeRequest {
    direction: ExchangeDirection
    /** 교환할 캐시(정수). 가용 캐시 이내 — 초과 시 서버가 `EXC_001`. */
    cashAmount: number
}

export interface ExchangeResponse {
    /** 지급된 게임머니(정수). 서버가 환율을 적용해 산출. */
    gameMoneyAmount: number
    /** 적용 환율(게임머니/캐시). 비율은 서버 소유(ON-HOLD 스텁) — 클라가 복제하지 않는다. */
    appliedRate: number
}

/**
 * 캐시 → 게임머니 교환. 성공 201 `{ gameMoneyAmount, appliedRate }`.
 * 에러 `EXC_001`(캐시 부족 422)·`EXC_002`(역방향 미지원 422).
 */
export function postExchange(cashAmount: number): Promise<ExchangeResponse> {
    return apiClient.post<ExchangeResponse>(
        '/exchanges',
        { direction: 'CASH_TO_GAME', cashAmount } satisfies ExchangeRequest,
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
    )
}
