import { describe, expect, it } from 'vitest'
import { createAuctionErrorViewOf } from './sellErrors'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 경매 등록 실패 문구 (계약 §3.1 · §5) — FC-073.
 *
 * 고정하는 것: **코드별 문구·초점 필드 매핑**. `AUCTION_003`(즉시구매가)·`AUCTION_008`(시간)은
 * 같은 422 라도 사용자가 고칠 필드가 다르다 — 서버 원문 message 를 그대로 노출하지 않는다.
 */

const apiError = (code: string, status = 422) =>
    new ApiError({ code, message: '서버 원문 메시지', status })

describe('createAuctionErrorViewOf', () => {
    it('AUCTION_001(미소유·미보유·미존재)은 아이템 필드로 안내한다', () => {
        const view = createAuctionErrorViewOf(
            apiError(ERROR_CODES.AUCTION_001, 403),
        )
        expect(view.field).toBe('item')
        expect(view.title).toContain('출품할 수 없는')
    })

    it('AUCTION_002(이미 출품중)도 아이템 필드', () => {
        const view = createAuctionErrorViewOf(
            apiError(ERROR_CODES.AUCTION_002, 409),
        )
        expect(view.field).toBe('item')
        expect(view.title).toContain('이미 출품')
    })

    it('AUCTION_003(buyNowPrice≤startPrice)은 즉시구매가 필드', () => {
        const view = createAuctionErrorViewOf(apiError(ERROR_CODES.AUCTION_003))
        expect(view.field).toBe('buyNowPrice')
        expect(view.description).toContain('시작가')
    })

    it('AUCTION_008(시간 파라미터 위반)은 마감 시각 필드', () => {
        const view = createAuctionErrorViewOf(apiError(ERROR_CODES.AUCTION_008))
        expect(view.field).toBe('endAt')
        expect(view.title).toContain('시간')
    })

    it('세션 만료(AUTH_004·COMMON_005)는 재로그인 안내', () => {
        expect(
            createAuctionErrorViewOf(apiError(ERROR_CODES.AUTH_004, 401)).title,
        ).toContain('로그인')
        expect(
            createAuctionErrorViewOf(apiError(ERROR_CODES.COMMON_005, 401))
                .title,
        ).toContain('로그인')
    })

    it('모르는 코드는 화면을 깨지 않고 서버 message 로 폴백한다', () => {
        const view = createAuctionErrorViewOf(apiError('AUCTION_999', 500))
        expect(view.title).toBe('경매를 등록하지 못했습니다')
        expect(view.description).toBe('서버 원문 메시지')
        expect(view.field).toBeUndefined()
    })

    it('ApiError 가 아닌 값도 안전하게 폴백한다', () => {
        const view = createAuctionErrorViewOf(new Error('네트워크'))
        expect(view.title).toBe('경매를 등록하지 못했습니다')
        expect(view.field).toBeUndefined()
    })
})
