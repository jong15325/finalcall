/**
 * 판매자 수수료 **예상** 계산 (fee-policy-spec v1.0) — FC-073.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **이 값은 예상치다. 정산 시 서버가 확정한다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 실제 수수료는 낙찰가(final_price) 기준으로 **EPIC-CLOSING 의 정산 TX 안에서** 확정된다
 * (fee-policy-spec §3·§7). 이 함수는 등록 화면에서 **시작가 기준 예상**을 보여줄 뿐이며,
 * 화면은 반드시 "예상 · 정산 시 서버 확정"을 함께 표기한다. 서버가 정본이고 여기는 미리보기다.
 *
 * 정책(fee-policy-spec §2·§3, 판매자 단독 부담):
 *  - **구간별 누진(marginal)** 6/5/4/3% — 각 구간에 속하는 부분에만 해당 요율.
 *  - **원(=G) 단위 사사오입** 을 누진 합계 직후 1회.
 *  - **상한(cap) 300,000** → **최소 100** → **판매가 상한** 순으로 클램프
 *    (판매가 0 이면 수수료 0, 정산액은 항상 0 이상).
 *  - `settle = P − fee`.
 *
 * ★ 계산 순서(§3)를 그대로 인코딩한다. 순서를 바꾸면 경계값이 어긋난다. 워크드 예시
 *   (P=2,480,000 → fee 110,200 · settle 2,369,800)를 단위 테스트가 고정한다.
 */

/** 구간 경계·요율(fee-policy-spec §2). 화면 수수료 안내표가 이 값을 표시에 쓴다. */
export const FEE_TIER_1_LIMIT = 100_000
export const FEE_TIER_2_LIMIT = 1_000_000
export const FEE_TIER_3_LIMIT = 3_000_000
export const FEE_CAP = 300_000
export const FEE_MIN = 100

export interface SellerFeeEstimate {
    /** 예상 수수료(사업자 귀속). 판매가 0 이면 0 */
    fee: number
    /** 예상 정산액(판매자 귀속) = 판매가 − 수수료 */
    settle: number
}

/**
 * 시작가(또는 판매가) P 로 판매자 수수료·정산 **예상**을 계산한다.
 *
 * @param price 판매가(게임머니, 정수). 음수·비정수·비유한값은 0/버림 처리한다.
 */
export function computeSellerFee(price: number): SellerFeeEstimate {
    const P = Math.max(0, Math.floor(Number.isFinite(price) ? price : 0))

    // 1. 누진 합계(구간 부분 적용) — fee-policy-spec §3.
    let raw = 0
    raw += Math.min(P, FEE_TIER_1_LIMIT) * 0.06
    if (P > FEE_TIER_1_LIMIT) {
        raw += (Math.min(P, FEE_TIER_2_LIMIT) - FEE_TIER_1_LIMIT) * 0.05
    }
    if (P > FEE_TIER_2_LIMIT) {
        raw += (Math.min(P, FEE_TIER_3_LIMIT) - FEE_TIER_2_LIMIT) * 0.04
    }
    if (P > FEE_TIER_3_LIMIT) {
        raw += (P - FEE_TIER_3_LIMIT) * 0.03
    }

    // 2. 원단위 사사오입(round half up — 양수라 Math.round 와 일치).
    let fee = Math.round(raw)
    // 3. 상한.
    fee = Math.min(fee, FEE_CAP)
    // 4. 최소(판매가 0 이면 수수료 없음).
    fee = Math.max(fee, P > 0 ? FEE_MIN : 0)
    // 5. 수수료는 판매가를 넘지 않는다(FC-176: settle >= 0).
    fee = Math.min(fee, P)

    return { fee, settle: P - fee }
}

/** 구간표 표시행(fee-policy-spec §2). 화면 안내표가 그대로 렌더한다. */
export const FEE_BRACKETS: readonly { range: string; rate: string }[] = [
    { range: '~ 100,000', rate: '6%' },
    { range: '100,001 ~ 1,000,000', rate: '5%' },
    { range: '1,000,001 ~ 3,000,000', rate: '4%' },
    { range: '3,000,001 ~', rate: '3%' },
]
