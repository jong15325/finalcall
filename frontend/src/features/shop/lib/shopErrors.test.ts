import { describe, expect, it } from 'vitest'
import { createShopErrorViewOf, shopPurchaseErrorViewOf } from './shopErrors'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 고정가 마켓 실패 문구 매핑 (계약 §3.2 · §5 SHOP_001~006) — FC-094.
 *
 * 고정하는 것: **코드별 문구**. SHOP_004(종료)·SHOP_005(잔액)·SHOP_006(자기구매)이 다른 안내를 낸다.
 */

function apiError(code: string, status = 409, message = 'server text') {
    return new ApiError({ code, message, status })
}

describe('shopPurchaseErrorViewOf', () => {
    it('SHOP_004(이미 판매/종료) — "판매됨"으로 못 박지 않는다(만료 포함)', () => {
        const view = shopPurchaseErrorViewOf(apiError(ERROR_CODES.SHOP_004))
        expect(view.title).toContain('구매할 수 없는')
        expect(view.description).toContain('기한이 지나')
    })

    it('★ SHOP_005(잔액 부족)는 SHOP_004 와 다른 문구', () => {
        const insufficient = shopPurchaseErrorViewOf(
            apiError(ERROR_CODES.SHOP_005, 422),
        )
        const closed = shopPurchaseErrorViewOf(apiError(ERROR_CODES.SHOP_004))
        expect(insufficient.title).toContain('잔액이 부족')
        expect(insufficient.title).not.toBe(closed.title)
    })

    it('SHOP_006(자기구매) — 내 상품 안내', () => {
        const view = shopPurchaseErrorViewOf(
            apiError(ERROR_CODES.SHOP_006, 403),
        )
        expect(view.title).toContain('내가 등록한')
    })

    it('SHOP_003(없음) — 미존재 안내', () => {
        const view = shopPurchaseErrorViewOf(
            apiError(ERROR_CODES.SHOP_003, 404),
        )
        expect(view.title).toContain('찾을 수 없습니다')
    })

    it('세션 만료(COMMON_005·AUTH_004)는 재로그인 안내', () => {
        expect(
            shopPurchaseErrorViewOf(apiError(ERROR_CODES.COMMON_005, 401)).title,
        ).toContain('로그인이 만료')
    })

    it('모르는 코드는 서버 message 로 폴백', () => {
        const view = shopPurchaseErrorViewOf(
            apiError('WEIRD_999', 500, '서버 원문'),
        )
        expect(view.title).toBe('구매하지 못했습니다')
        expect(view.description).toBe('서버 원문')
    })

    it('ApiError 가 아니면 일반 폴백', () => {
        const view = shopPurchaseErrorViewOf(new Error('boom'))
        expect(view.title).toBe('구매하지 못했습니다')
        expect(view.description).toContain('잠시 후')
    })
})

describe('createShopErrorViewOf', () => {
    it('SHOP_001(출품 불가) — 403 단일, 사유 단정 없이 재확인 유도', () => {
        const view = createShopErrorViewOf(apiError(ERROR_CODES.SHOP_001, 403))
        expect(view.title).toContain('출품할 수 없는')
    })

    it('SHOP_002(이미 출품중) — 중복 출품 안내', () => {
        const view = createShopErrorViewOf(apiError(ERROR_CODES.SHOP_002))
        expect(view.title).toContain('이미 출품 중')
    })

    it('모르는 코드는 서버 message 로 폴백', () => {
        const view = createShopErrorViewOf(apiError('WEIRD_999', 500, '서버 원문'))
        expect(view.title).toBe('상품을 등록하지 못했습니다')
        expect(view.description).toBe('서버 원문')
    })
})
