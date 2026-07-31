import { describe, expect, it } from 'vitest'
import {
    GAME_WRAP_WIDTH,
    getStringByte,
    MEMO_MAX_BYTES,
    charByteWidth,
    wrap28,
} from './memoBytes'

/**
 * 바이트 폭·28바이트 줄바꿈 (FC-172) — memo-domain-spec §8.3 / 백엔드 `StringByteCounter` 동치.
 *
 * 고정하는 것:
 *  1. 숫자·ASCII 영문/기호(48–57·65–122) = 1바이트, 한글·그 외 = 2바이트.
 *  2. wrap28 은 28바이트마다 끊되 **글자 중간을 자르지 않는다**(경계 넘는 글자는 통째로 다음 줄).
 *  3. 각 줄의 바이트 폭은 28 이하다.
 */

describe('charByteWidth', () => {
    it('숫자(0–9)는 1바이트', () => {
        expect(charByteWidth('0')).toBe(1)
        expect(charByteWidth('9')).toBe(1)
    })

    it('ASCII 영문(대·소문자)은 1바이트', () => {
        expect(charByteWidth('A')).toBe(1)
        expect(charByteWidth('z')).toBe(1)
    })

    it('한글은 2바이트', () => {
        expect(charByteWidth('가')).toBe(2)
        expect(charByteWidth('힣')).toBe(2)
    })

    it('공백·한글 문장부호 등 65–122 밖은 2바이트', () => {
        expect(charByteWidth(' ')).toBe(2) // code 32
        expect(charByteWidth('。')).toBe(2)
    })
})

describe('getStringByte', () => {
    it('빈 문자열은 0', () => {
        expect(getStringByte('')).toBe(0)
    })

    it('영문숫자 혼합은 글자 수와 같다', () => {
        expect(getStringByte('abc123')).toBe(6)
    })

    it('한글은 글자당 2바이트', () => {
        expect(getStringByte('가나다')).toBe(6)
    })

    it('한글+영문 혼합 합산', () => {
        // '안녕'(4) + 'hi'(2) = 6
        expect(getStringByte('안녕hi')).toBe(6)
    })

    it('상한(112바이트)은 한글 56자에서 딱 도달', () => {
        expect(getStringByte('가'.repeat(56))).toBe(MEMO_MAX_BYTES)
    })

    it('보충문자(이모지)는 서로게이트 2코드유닛 각 2바이트 = 4 (백엔드 charAt 동치)', () => {
        // '😀'(U+1F600)는 UTF-16 서로게이트 쌍(코드유닛 2개, .length === 2). 백엔드
        // StringByteCounter 는 charAt(코드유닛)로 순회해 각 서로게이트를 2바이트로 세어 4가 된다.
        expect('😀'.length).toBe(2)
        expect(getStringByte('😀')).toBe(4)
        // 한글+이모지 혼합: '가'(2) + '😀'(4) = 6
        expect(getStringByte('가😀')).toBe(6)
    })
})

describe('wrap28', () => {
    it('빈 문자열은 빈 한 줄', () => {
        expect(wrap28('')).toEqual([''])
    })

    it('28바이트 이하는 한 줄', () => {
        // 한글 14자 = 28바이트 정확히 (경계에 딱 맞음 → 그대로 한 줄)
        const line = '가'.repeat(14)
        expect(wrap28(line)).toEqual([line])
    })

    it('28바이트 초과는 다음 줄로 넘긴다', () => {
        // 한글 15자 = 30바이트 → 14자(28) + 1자
        const lines = wrap28('가'.repeat(15))
        expect(lines).toHaveLength(2)
        expect(lines[0]).toBe('가'.repeat(14))
        expect(lines[1]).toBe('가')
    })

    it('글자 중간을 자르지 않는다 — 경계 걸친 글자는 통째로 다음 줄', () => {
        // 영문 27자(27바이트) + 한글 1자(2바이트) → 27+2=29 > 28 이므로 한글은 다음 줄
        const text = 'a'.repeat(27) + '가'
        const lines = wrap28(text)
        expect(lines[0]).toBe('a'.repeat(27))
        expect(lines[1]).toBe('가')
    })

    it('모든 줄의 바이트 폭이 28 이하', () => {
        const text =
            '골드포스방어구아직판매하시나요가격조정가능하시면쪽지주세요'
        for (const line of wrap28(text)) {
            expect(getStringByte(line)).toBeLessThanOrEqual(GAME_WRAP_WIDTH)
        }
    })
})
