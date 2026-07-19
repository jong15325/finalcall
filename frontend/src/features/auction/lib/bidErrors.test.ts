import { describe, expect, it } from 'vitest'
import { bidErrorViewOf } from './bidErrors'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 입찰 실패 문구 (계약 §3.1 · §5) — FC-064.
 *
 * 이 파일이 고정하는 것:
 *  1. **★★ 같은 409 라도 코드마다 문구가 다르다** — `BID_004`(기다리면 됨)와
 *     `BID_006`(끝남)이 한 문장으로 뭉개지면 사용자가 끝난 경매를 기다린다.
 *  2. **`BID_006` ↔ `BID_007` 이 반대 안내다** — 마감은 끝, 미개시는 기다림.
 *  3. `BID_001` 은 **금액을 다시 안내**한다(서버 파생 최소가).
 *  4. `BID_003`(자기 경매) 분기가 **존재한다** — 닉네임 비교로 숨겨도 인가는 서버가 한다.
 *  5. 모르는 코드는 화면을 깨지 않고 서버 message 로 폴백한다.
 */

const apiError = (code: string, message = '서버 메시지', status = 422) =>
    new ApiError({ code, message, status })

describe('★ 금액이 문제인 코드는 amountFault 로 표시된다', () => {
    it('BID_001 은 최소 입찰가를 금액으로 다시 안내한다', () => {
        const view = bidErrorViewOf(apiError(ERROR_CODES.BID_001), 12_500)

        expect(view.title).toContain('최소 입찰가')
        expect(view.description).toContain('12,500')
        expect(view.amountFault).toBe(true)
    })

    it('최소 입찰가가 없으면(종료 경매) 금액 없이 안내한다 — "null 이상" 을 적지 않는다', () => {
        const view = bidErrorViewOf(apiError(ERROR_CODES.BID_001), null)

        expect(view.description).not.toContain('null')
        expect(view.description).toContain('최소 입찰가')
    })

    it('BID_002(즉시구매가 이상)·BID_005(잔액 부족)도 금액 결함이다', () => {
        expect(
            bidErrorViewOf(apiError(ERROR_CODES.BID_002), 100).amountFault,
        ).toBe(true)
        expect(
            bidErrorViewOf(apiError(ERROR_CODES.BID_005), 100).amountFault,
        ).toBe(true)
    })
})

describe('★★ 같은 409 를 코드로 가른다', () => {
    it('BID_004 는 "기다리면 된다" 고 말한다', () => {
        const view = bidErrorViewOf(
            apiError(ERROR_CODES.BID_004, '연속 입찰', 409),
            100,
        )

        expect(view.title).toContain('최고 입찰자')
        expect(view.description).toContain('다른 사람')
        expect(view.amountFault).toBe(false)
    })

    it('BID_006 은 끝났다고 말한다', () => {
        const view = bidErrorViewOf(
            apiError(ERROR_CODES.BID_006, '마감', 409),
            null,
        )
        expect(view.title).toContain('마감')
    })

    it('BID_007 은 반대로 시작 전이라고 말한다 — 마감 문구와 겹치지 않는다', () => {
        const ended = bidErrorViewOf(apiError(ERROR_CODES.BID_006), null)
        const notStarted = bidErrorViewOf(apiError(ERROR_CODES.BID_007), null)

        expect(notStarted.title).toContain('시작하지 않은')
        expect(notStarted.title).not.toBe(ended.title)
    })
})

describe('★ 표시 제어로 숨긴 경로도 서버 응답을 처리한다', () => {
    it('BID_003(자기 경매) 분기가 있다 — 다른 탭에서 계정이 바뀌면 여기 도달한다', () => {
        const view = bidErrorViewOf(
            apiError(ERROR_CODES.BID_003, '자기 경매', 403),
            100,
        )

        expect(view.title).toContain('내가 등록한 경매')
        expect(view.amountFault).toBe(false)
    })

    it('AUCTION_004 는 재시도를 권하지 않는다 — 없는 경매다', () => {
        const view = bidErrorViewOf(
            apiError(ERROR_CODES.AUCTION_004, '없음', 404),
            null,
        )
        expect(view.title).toContain('찾을 수 없습니다')
    })

    it('세션 만료(COMMON_005·AUTH_004)는 다시 로그인하라고 말한다', () => {
        for (const code of [ERROR_CODES.COMMON_005, ERROR_CODES.AUTH_004]) {
            expect(
                bidErrorViewOf(apiError(code, '만료', 401), null).title,
            ).toContain('로그인')
        }
    })
})

describe('폴백', () => {
    it('모르는 코드는 서버 message 를 그대로 보여준다', () => {
        const view = bidErrorViewOf(
            apiError('BID_999', '알 수 없는 사유', 500),
            null,
        )

        expect(view.title).toBe('입찰하지 못했습니다')
        expect(view.description).toBe('알 수 없는 사유')
    })

    it('ApiError 가 아닌 값(네트워크 예외 등)도 문구를 낸다', () => {
        const view = bidErrorViewOf(new TypeError('failed to fetch'), null)

        expect(view.title).toBe('입찰하지 못했습니다')
        expect(view.description).toContain('다시 시도')
    })
})
