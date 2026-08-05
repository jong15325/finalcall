import { apiClient } from './client'
import type { AuctionItemBlock } from './auctions'
import type { CursorPage } from '@/types/api'

/**
 * 거래내역(주문) API (계약 §4.3 `GET /me/orders` · SaleOrderResponse) — FC-090.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **역할 인지 응답이다 — `feeAmount`·`settleAmount` 는 판매자에게만 온다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 같은 주문이라도 `myRole` 에 따라 필드 집합이 다르다(계약 §4.3 · purchase-spec §5.2). 구매자
 * 응답에는 두 필드가 **아예 없고**(부재), 판매자 응답에만 실린다 — 판매자 측 회계이기 때문이다.
 * 그래서 타입에서 둘을 **optional** 로 두고, 화면은 `myRole` 로 분기한다(값 유무가 아니라 역할로).
 *
 * ★ 계약 스키마와 1:1. 클라 편의를 위한 필드 추가·개명 금지(`types/api.ts` 상단 규칙).
 * ★ 상대(counterparty)는 **마스킹된 닉네임만** 온다 — `userPublicId`·`loginId` 는 오지 않는다
 *   (회원 열거 방지, SEC-007). 상대 식별은 화면에서 하지 않는다.
 */

/** 요청자 대비 파생 역할(계약 §4.3). */
export type OrderRole = 'BUYER' | 'SELLER'

/**
 * 주문 출처(계약 §4.3). 코어는 `AUCTION` 만 내려온다(BID/BUYNOW 구분은 미노출, purchase-spec §7-B3).
 *
 * ★ 알려진 값을 유니온으로 좁히되 `(string & {})` 를 열어둔다 — 고정가(SHOP) 등이 뒤에 붙을 수
 *   있고, 그때 타입 에러 대신 중립 폴백으로 흐른다(계약 §3.3 태도).
 */
export type OrderSourceType =
    'AUCTION' | 'SHOP' | (string & Record<never, never>)

/**
 * OrderSummary (계약 §4.3 — `GET /me/orders` content 항목).
 *
 * ★ `feeAmount`·`settleAmount` 는 **`myRole==='SELLER'` 일 때만 존재**한다. 구매자 응답에는
 *   필드 자체가 없다(부재). `settleAmount = finalPrice − feeAmount`(판매자 정산액, fee-policy-spec).
 */
export interface OrderSummary {
    orderPublicId: string
    myRole: OrderRole
    sourceType: OrderSourceType
    /** 상대 닉네임 마스킹(앞 2자 + `***`). 구매자엔 판매자, 판매자엔 구매자 */
    counterpartyMasked: string
    /** §3.3 공통 item 블록 요약(경매 상세와 동일 스키마) */
    item: AuctionItemBlock
    /** 구매자가 지불한 최종가(양 역할 공통) */
    finalPrice: number
    status: string
    createdAt: string
    /**
     * 아이템 인스턴스 외부 식별자(ULID). 배송 상태 교차 조회 키(계약 §4.6·§4.3, FC-193 additive).
     * OrderDetail 동명 필드와 같은 의미. 서버·클라 배포 시차로 부재할 수 있어 optional 로 둔다.
     */
    itemInstancePublicId?: string
    /** 판매자 전용 — 플랫폼 수수료(구매자 응답엔 부재) */
    feeAmount?: number
    /** 판매자 전용 — 정산 수취액 = finalPrice − feeAmount(구매자 응답엔 부재) */
    settleAmount?: number
}

/** 목록 필터·페이징(계약 §4.3 — role/sourceType 필터 + cursor). */
export interface OrderListQuery {
    /** 역할 축으로 좁힘(미지정=구매+판매 모두) */
    role?: OrderRole
    /** 출처 축으로 좁힘(현재 AUCTION 만 실재) */
    sourceType?: OrderSourceType
    cursor?: string
    size?: number
}

/**
 * `GET /me/orders` — **인증 필요**. 서버가 `buyer_id = me OR seller_id = me` 로 스코프한다
 * (제3자 주문 미노출, IDOR 방지 — purchase-spec §5.1). cursor 페이지·`created_at desc`.
 */
export function getMyOrders(
    query: OrderListQuery = {},
    signal?: AbortSignal,
): Promise<CursorPage<OrderSummary>> {
    return apiClient.get<CursorPage<OrderSummary>>('/me/orders', {
        query: { ...query },
        signal,
    })
}
