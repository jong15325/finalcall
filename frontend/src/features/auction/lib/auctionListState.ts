/**
 * 경매 목록 표시 상태 분기 (FC-071).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **데이터가 있으면 오류·로딩보다 우선한다 — 가진 것을 지우지 않는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 무한스크롤에서 배경 재조회가 실패해도 이미 받은 카드는 유효하다. `isError` 를 최우선으로
 * 두면 스크롤 도중 한 번의 네트워크 실패가 **화면 전체를 오류 배너로 치환**한다. 그래서
 * 판정 순서를 "가진 데이터 우선"으로 둔다 — 오류는 **아직 아무것도 못 받았을 때만** 전면에 낸다
 * (부분 실패 배너는 화면이 별도로 얹는다).
 *
 * ★ **성립 불가 조합(마법 subGroup=3 & kind≥3)은 여기서 오류가 아니다.** `normalizeFilters` 가
 *   그 kind 를 요청 전에 지우므로(계약 §4.1) 서버는 200 + 결과를 준다. 걸러진 결과가 0건이면
 *   그냥 `empty` 다 — 오류로 오분류하지 않는다.
 */

export type AuctionListStatus = 'loading' | 'error' | 'empty' | 'ready'

export interface AuctionListStateInput {
    /** 첫 페이지를 아직 받지 못한 대기 상태(react-query `isPending`) */
    isPending: boolean
    /** 조회 실패(react-query `isError`) */
    isError: boolean
    /** 현재까지 펼쳐진 카드 총수 */
    itemCount: number
}

/**
 * 표시 상태를 하나로 정한다.
 *
 * 우선순위: **데이터 있음 → 로딩 → 오류 → 빈결과**.
 * - `ready`   : 카드가 하나라도 있으면(배경 오류·재조회와 무관하게) 목록을 보여준다.
 * - `loading` : 아직 첫 데이터가 없고 대기 중 — 목록 영역에만 스켈레톤(전체 블러 금지).
 * - `error`   : 아직 첫 데이터가 없고 실패 — 재시도 배너.
 * - `empty`   : 성공했으나 조건에 맞는 경매가 0건.
 */
export function auctionListStatusOf(
    input: AuctionListStateInput,
): AuctionListStatus {
    if (input.itemCount > 0) return 'ready'
    if (input.isPending) return 'loading'
    if (input.isError) return 'error'
    return 'empty'
}
