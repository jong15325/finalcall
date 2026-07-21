import { describe, expect, it } from 'vitest'
import {
    EXPIRY_IMMINENT_MS,
    expiryStateOf,
    hasImminentExpiry,
} from './tempStorageExpiry'

/**
 * 만료 임박 파생 (FC-076) — 서버는 expireAt 만 주고 "임박"은 클라가 판정(24h).
 */

const NOW = Date.parse('2026-07-21T00:00:00Z')
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

describe('expiryStateOf', () => {
    it('null 은 만료 개념 없음(none)', () => {
        expect(expiryStateOf(null, NOW)).toBe('none')
        expect(expiryStateOf(undefined, NOW)).toBe('none')
    })

    it('과거 시각은 expired', () => {
        expect(expiryStateOf(at(-1000), NOW)).toBe('expired')
    })

    it('24시간 이내면 imminent', () => {
        expect(expiryStateOf(at(EXPIRY_IMMINENT_MS - 1000), NOW)).toBe(
            'imminent',
        )
    })

    it('24시간을 넘기면 safe', () => {
        expect(expiryStateOf(at(EXPIRY_IMMINENT_MS + 1000), NOW)).toBe('safe')
    })

    it('파싱 불가 값은 none 으로 흘린다(행을 깨지 않음)', () => {
        expect(expiryStateOf('not-a-date', NOW)).toBe('none')
    })
})

describe('hasImminentExpiry', () => {
    it('임박·만료 항목이 하나라도 있으면 true', () => {
        expect(
            hasImminentExpiry(
                [
                    { expireAt: at(2 * EXPIRY_IMMINENT_MS) },
                    { expireAt: at(1000) },
                ],
                NOW,
            ),
        ).toBe(true)
    })

    it('전부 여유·없음이면 false', () => {
        expect(
            hasImminentExpiry(
                [{ expireAt: null }, { expireAt: at(2 * EXPIRY_IMMINENT_MS) }],
                NOW,
            ),
        ).toBe(false)
    })
})
