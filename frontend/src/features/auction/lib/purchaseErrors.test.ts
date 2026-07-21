import { describe, expect, it } from 'vitest'
import { purchaseErrorViewOf } from './purchaseErrors'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 즉시구매 실패 문구 매핑 (계약 §3.1 · §5) — FC-090.
 *
 * 고정하는 것: **코드별 문구**. 같은 422(AUCTION_005 vs BID_005)라도 다른 안내를 낸다.
 */

function apiError(code: string, status = 422, message = 'server text') {
    return new ApiError({ code, message, status })
}

describe('purchaseErrorViewOf', () => {
    it('AUCTION_005(미설정) — 입찰로 유도', () => {
        const view = purchaseErrorViewOf(apiError(ERROR_CODES.AUCTION_005))
        expect(view.title).toContain('설정하지 않은')
    })

    it('AUCTION_006(구매 불가) — 종료로 못 박지 않는다(미개시 포함)', () => {
        const view = purchaseErrorViewOf(apiError(ERROR_CODES.AUCTION_006, 409))
        expect(view.title).toContain('즉시구매할 수 없는')
        expect(view.description).toContain('시작하지 않았')
    })

    it('AUCTION_009(자기구매) — 본인 경매 안내', () => {
        const view = purchaseErrorViewOf(apiError(ERROR_CODES.AUCTION_009, 403))
        expect(view.title).toContain('등록한 경매')
    })

    it('★ BID_005(잔액 부족)는 AUCTION_005 와 다른 문구', () => {
        const insufficient = purchaseErrorViewOf(apiError(ERROR_CODES.BID_005))
        const notSet = purchaseErrorViewOf(apiError(ERROR_CODES.AUCTION_005))
        expect(insufficient.title).toContain('잔액이 부족')
        expect(insufficient.title).not.toBe(notSet.title)
    })

    it('세션 만료(COMMON_005·AUTH_004)는 재로그인 안내', () => {
        expect(
            purchaseErrorViewOf(apiError(ERROR_CODES.COMMON_005, 401)).title,
        ).toContain('로그인이 만료')
        expect(
            purchaseErrorViewOf(apiError(ERROR_CODES.AUTH_004, 401)).title,
        ).toContain('로그인이 만료')
    })

    it('모르는 코드는 서버 message 로 폴백', () => {
        const view = purchaseErrorViewOf(
            apiError('WEIRD_999', 500, '서버 원문'),
        )
        expect(view.title).toBe('즉시구매하지 못했습니다')
        expect(view.description).toBe('서버 원문')
    })

    it('ApiError 가 아니면 일반 폴백', () => {
        const view = purchaseErrorViewOf(new Error('boom'))
        expect(view.title).toBe('즉시구매하지 못했습니다')
        expect(view.description).toContain('잠시 후')
    })
})
