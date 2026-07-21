import type { OrderRole, OrderSourceType, OrderSummary } from '@/lib/api/orders'

/**
 * 거래내역 역할·출처 표시 파생 (계약 §4.3 · purchase-spec §5.2) — FC-090.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **수수료·정산액 노출은 역할로 판정한다 — 값 유무가 아니라 `myRole` 로.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 계약이 `feeAmount`·`settleAmount` 를 **판매자 응답에만** 싣는다(구매자엔 부재). 화면이
 * "값이 있으면 보여준다" 로 판정하면, 서버가 실수로 구매자에게 값을 흘렸을 때 그대로 노출한다.
 * `myRole==='SELLER'` 를 **먼저** 물어 판매자 회계 영역을 가둔다 — 구매자 카드엔 절대 안 나온다.
 *
 * ★ 순수 함수만 둔다(표시 파생). 상대(counterparty)는 이미 마스킹돼 오므로 여기서 가공하지 않는다.
 */

/** 판매자 주문인가 — 수수료·정산 영역 노출의 유일한 기준. */
export function isSellerOrder(order: OrderSummary): boolean {
    return order.myRole === 'SELLER'
}

/**
 * 수수료·정산액을 보여줄 것인가.
 *
 * ★ 판매자이면서 **두 값이 실제로 왔을 때만** 참이다. 판매자여도 서버가 값을 빼먹으면(계약 이탈)
 *   "-" 를 억지로 그리지 않고 영역 자체를 숨긴다. 구매자면 값 유무와 무관하게 항상 거짓.
 */
export function showsSellerAccounting(order: OrderSummary): boolean {
    return (
        isSellerOrder(order) &&
        order.feeAmount !== undefined &&
        order.settleAmount !== undefined
    )
}

/** 역할 배지 문구. 내가 산 거래인지 판 거래인지 한 글자로 가른다. */
export function orderRoleLabelOf(role: OrderRole): string {
    return role === 'SELLER' ? '판매' : '구매'
}

/**
 * 상대 표기 — 역할에 따라 상대의 직함이 뒤집힌다.
 *
 * ★ 내가 구매자면 상대는 판매자, 내가 판매자면 상대는 구매자다. 마스킹된 닉네임은 그대로 붙인다.
 */
export function counterpartyLabelOf(order: OrderSummary): string {
    const title = order.myRole === 'SELLER' ? '구매자' : '판매자'
    return `${title} ${order.counterpartyMasked}`
}

/**
 * 출처 표시. 현재 `AUCTION` 만 실재한다(BID/BUYNOW 구분 미노출).
 *
 * ★ 미등록 출처(SHOP 등 후속)는 코드를 그대로 노출한다(무음 실패 방지 — `itemCode` 태도).
 */
export function orderSourceLabelOf(sourceType: OrderSourceType): string {
    switch (sourceType) {
        case 'AUCTION':
            return '경매'
        case 'SHOP':
            return '고정가'
        default:
            return sourceType
    }
}
