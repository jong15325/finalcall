import { describe, expect, it } from 'vitest'
import { parseAmount, parseLocalDateTime, validateSellForm } from './sellForm'
import type { SellFormValues } from './sellForm'

/**
 * 경매 등록 폼 검증 (계약 §3.1) — FC-073.
 *
 * 고정하는 것: **금액 정수화·안전정수 가드**, **시간 관계 검증**(endAt>now·startAt≤endAt·
 * maxEndAt≥endAt), **buyNowPrice>startPrice**(AUCTION_003 선행), **선택 필드 미설정 시 키 제외**.
 */

const NOW = new Date('2026-07-25T00:00:00Z').getTime()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** ms → 로컬 `datetime-local` 문자열(입력은 로컬 시간으로 해석되므로 로컬 성분으로 만든다). */
function toLocalInput(ms: number): string {
    const d = new Date(ms)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const base: SellFormValues = {
    itemInstancePublicId: 'ITEM_01',
    startPrice: '2,500,000',
    buyNowPrice: '',
    startAt: '',
    endAt: toLocalInput(NOW + DAY),
    softCloseWindowSec: null,
    softCloseExtendSec: null,
    maxEndAt: toLocalInput(NOW + 2 * DAY),
}

describe('parseAmount — 정수(long)·안전정수 가드', () => {
    it('천단위 구분·기호를 제거하고 정수로 만든다', () => {
        expect(parseAmount('2,500,000')).toBe(2_500_000)
        expect(parseAmount(' 10000 ')).toBe(10_000)
    })

    it('빈 값·0 이하·비숫자는 null', () => {
        expect(parseAmount('')).toBeNull()
        expect(parseAmount('0')).toBeNull()
        expect(parseAmount('abc')).toBeNull()
    })

    it('지수표기는 숫자만 남겨 안전하게 무력화한다(정밀도 사고 방지)', () => {
        // "1e9" → 숫자만 "19" 로 축약(지수 해석 안 함).
        expect(parseAmount('1e9')).toBe(19)
    })

    it('안전정수 상한을 넘는 과대 자리수는 null', () => {
        expect(parseAmount('9'.repeat(16))).toBeNull()
    })
})

describe('parseLocalDateTime — 로컬 → UTC ISO', () => {
    it('로컬 문자열을 Instant(ISO) 로 변환한다', () => {
        const result = parseLocalDateTime(toLocalInput(NOW + DAY))
        expect(result).not.toBeNull()
        expect(result?.iso).toBe(new Date(NOW + DAY).toISOString())
    })

    it('빈 값·비정상은 null', () => {
        expect(parseLocalDateTime('')).toBeNull()
        expect(parseLocalDateTime('not-a-date')).toBeNull()
    })
})

describe('validateSellForm — 정상 경로', () => {
    it('필수만 채우면 통과하고 선택 키는 빠진다', () => {
        const result = validateSellForm(base, NOW)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.request.itemInstancePublicId).toBe('ITEM_01')
        expect(result.request.startPrice).toBe(2_500_000)
        expect(result.request.endAt).toBe(new Date(NOW + DAY).toISOString())
        expect(result.request.maxEndAt).toBe(
            new Date(NOW + 2 * DAY).toISOString(),
        )
        // 선택 필드 미설정 → 키 자체가 없어야 한다.
        expect('buyNowPrice' in result.request).toBe(false)
        expect('startAt' in result.request).toBe(false)
        expect('softCloseWindowSec' in result.request).toBe(false)
        expect('softCloseExtendSec' in result.request).toBe(false)
    })

    it('선택 필드를 채우면 요청에 포함된다', () => {
        const result = validateSellForm(
            {
                ...base,
                buyNowPrice: '3,900,000',
                startAt: toLocalInput(NOW + HOUR),
                softCloseWindowSec: 60,
                softCloseExtendSec: 120,
            },
            NOW,
        )
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.request.buyNowPrice).toBe(3_900_000)
        expect(result.request.startAt).toBe(new Date(NOW + HOUR).toISOString())
        expect(result.request.softCloseWindowSec).toBe(60)
        expect(result.request.softCloseExtendSec).toBe(120)
    })
})

describe('validateSellForm — 검증 실패', () => {
    const fieldsOf = (values: SellFormValues) => {
        const result = validateSellForm(values, NOW)
        return result.ok ? [] : result.errors.map((error) => error.field)
    }

    it('아이템 미선택', () => {
        expect(fieldsOf({ ...base, itemInstancePublicId: null })).toContain(
            'item',
        )
    })

    it('시작가 미입력·0', () => {
        expect(fieldsOf({ ...base, startPrice: '' })).toContain('startPrice')
        expect(fieldsOf({ ...base, startPrice: '0' })).toContain('startPrice')
    })

    it('즉시구매 참고가 ≤ 시작가 (AUCTION_003 선행 가드)', () => {
        expect(fieldsOf({ ...base, buyNowPrice: '2,500,000' })).toContain(
            'buyNowPrice',
        )
        expect(fieldsOf({ ...base, buyNowPrice: '2,000,000' })).toContain(
            'buyNowPrice',
        )
    })

    it('즉시구매 참고가 > 시작가는 통과', () => {
        expect(fieldsOf({ ...base, buyNowPrice: '2,500,001' })).not.toContain(
            'buyNowPrice',
        )
    })

    it('마감 시각이 현재 이하', () => {
        expect(
            fieldsOf({ ...base, endAt: toLocalInput(NOW - HOUR) }),
        ).toContain('endAt')
    })

    it('마감 시각 미입력', () => {
        expect(fieldsOf({ ...base, endAt: '' })).toContain('endAt')
    })

    it('시작 시각 > 마감 시각', () => {
        expect(
            fieldsOf({ ...base, startAt: toLocalInput(NOW + 3 * DAY) }),
        ).toContain('startAt')
    })

    it('최대 연장 시각 < 마감 시각', () => {
        expect(
            fieldsOf({ ...base, maxEndAt: toLocalInput(NOW + HOUR) }),
        ).toContain('maxEndAt')
    })

    it('최대 연장 시각 미입력', () => {
        expect(fieldsOf({ ...base, maxEndAt: '' })).toContain('maxEndAt')
    })

    it('여러 오류를 한 번에 모은다', () => {
        const fields = fieldsOf({
            ...base,
            itemInstancePublicId: null,
            startPrice: '',
            endAt: '',
        })
        expect(fields).toEqual(
            expect.arrayContaining(['item', 'startPrice', 'endAt']),
        )
    })
})
