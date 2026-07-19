import { describe, expect, it } from 'vitest'
import {
    isMinRaised,
    reconcileAmountWithMin,
    validateBidAmount,
} from './bidAmount'
import { formatGameMoney } from './auctionPrice'

/**
 * 입찰 금액 규칙 (FC-064 리뷰 M-1·m-3 회귀).
 *
 * 이 파일이 고정하는 것:
 *  1. **★★ 최소가가 올라도 그보다 높은 사용자 입력은 보존된다** — 하향 치환은 금전 사고다.
 *  2. 최소가 미만일 때만 끌어올린다. 프리필은 늘 최신 최소가를 따른다.
 *  3. **★ 지수 표기가 요청으로 나가지 않는다** — `Number.isInteger(1e21) === true` 였다.
 */

describe('★★ M-1 — 사용자가 넣은 금액을 덮어쓰지 않는다', () => {
    it('사용자 입력이 새 최소가보다 높으면 그대로 둔다 (스나이핑 보존)', () => {
        expect(
            reconcileAmountWithMin({
                current: '100000',
                minNextBidAmount: 13_000,
                edited: true,
            }),
        ).toBe('100000')
    })

    it('사용자 입력이 새 최소가와 같으면 그대로 둔다', () => {
        expect(
            reconcileAmountWithMin({
                current: '13000',
                minNextBidAmount: 13_000,
                edited: true,
            }),
        ).toBe('13000')
    })

    it('사용자 입력이 새 최소가 미만일 때만 끌어올린다', () => {
        expect(
            reconcileAmountWithMin({
                current: '12600',
                minNextBidAmount: 13_000,
                edited: true,
            }),
        ).toBe('13000')
    })

    it('손대지 않은 프리필은 늘 최신 최소가를 따른다', () => {
        expect(
            reconcileAmountWithMin({
                current: '12500',
                minNextBidAmount: 13_000,
                edited: false,
            }),
        ).toBe('13000')
    })

    it('사용자가 비워 둔 칸은 최소가로 채운다 — 빈 값을 지키는 건 의미가 없다', () => {
        expect(
            reconcileAmountWithMin({
                current: '',
                minNextBidAmount: 13_000,
                edited: true,
            }),
        ).toBe('13000')
    })

    it('숫자로 읽을 수 없는 입력은 보존한다 — 사용자가 고치는 중이다', () => {
        expect(
            reconcileAmountWithMin({
                current: '12e',
                minNextBidAmount: 13_000,
                edited: true,
            }),
        ).toBe('12e')
    })

    it('★ 최소가가 내려가도 사용자 입력을 내리지 않는다', () => {
        expect(
            reconcileAmountWithMin({
                current: '100000',
                minNextBidAmount: 9_000,
                edited: true,
            }),
        ).toBe('100000')
    })
})

describe('최소가 상승 안내', () => {
    it('올랐을 때만 알린다', () => {
        expect(isMinRaised(12_500, 13_000)).toBe(true)
    })

    it('첫 관측(비교 대상 없음)은 알리지 않는다 — 첫 진입마다 배너가 뜨면 안 된다', () => {
        expect(isMinRaised(null, 13_000)).toBe(false)
    })

    it('같거나 내려가면 알리지 않는다', () => {
        expect(isMinRaised(13_000, 13_000)).toBe(false)
        expect(isMinRaised(13_000, 12_500)).toBe(false)
    })
})

describe('★ m-3 — 제출 전 검증', () => {
    const check = (raw: string, min: number | null = 12_500) =>
        validateBidAmount(raw, min, formatGameMoney)

    it('정상 금액은 숫자로 통과한다', () => {
        expect(check('12500')).toEqual({ ok: true, amount: 12_500 })
    })

    it('앞뒤 공백은 허용한다', () => {
        expect(check('  13000  ')).toEqual({ ok: true, amount: 13_000 })
    })

    it('★★ 지수 표기를 막는다 — Number.isInteger(1e21) 는 true 다', () => {
        expect(check('1e21').ok).toBe(false)
        expect(check('1E5').ok).toBe(false)
    })

    it('안전 정수를 넘는 자릿수를 막는다 — 정밀도가 조용히 깎인다', () => {
        expect(check('99999999999999999999').ok).toBe(false)
    })

    it('부호·소수점·빈 값·문자를 막는다', () => {
        for (const raw of ['-1', '+5', '1.5', '', '   ', '만원', '1,000']) {
            expect(check(raw).ok).toBe(false)
        }
    })

    it('0 을 막는다', () => {
        expect(check('0').ok).toBe(false)
    })

    it('최소가 미만은 금액을 다시 안내하며 막는다', () => {
        const result = check('11000')
        expect(result.ok).toBe(false)
        expect(result.ok === false && result.message).toContain('12,500')
    })

    it('최소가가 없으면(종료 경매) 하한 비교를 하지 않는다', () => {
        expect(check('1', null)).toEqual({ ok: true, amount: 1 })
    })
})
