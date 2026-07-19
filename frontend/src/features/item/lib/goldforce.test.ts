import { describe, expect, it } from 'vitest'
import { goldforceStateOf, isGoldforceActive } from './goldforce'

/**
 * 골드포스 파생 테스트 (FC-058 재작업).
 * 계약 §3.3: 서버는 만료 시각만 준다 — **활성 여부는 클라 파생**이고 그 판정이 여기다.
 */

const NOW = Date.parse('2026-07-19T12:00:00Z')
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

describe('goldforceStateOf', () => {
    it('미래 만료는 활성', () => {
        expect(goldforceStateOf(at(60_000), NOW)).toBe('active')
    })

    it('과거 만료는 만료 — "없음"과 구분한다', () => {
        expect(goldforceStateOf(at(-1), NOW)).toBe('expired')
    })

    it('null·undefined 는 미적용', () => {
        expect(goldforceStateOf(null, NOW)).toBe('none')
        expect(goldforceStateOf(undefined, NOW)).toBe('none')
    })

    it('정확히 지금 만료면 활성이 아니다 (경계)', () => {
        expect(goldforceStateOf(at(0), NOW)).toBe('expired')
    })

    it('파싱 불가 값에 던지지 않는다 — 값 하나가 카드를 깨뜨리지 않는다', () => {
        expect(() => goldforceStateOf('not-a-date', NOW)).not.toThrow()
        expect(goldforceStateOf('not-a-date', NOW)).toBe('none')
    })
})

describe('isGoldforceActive', () => {
    it('활성만 true — 만료·미적용은 둘 다 false', () => {
        expect(isGoldforceActive(at(1000), NOW)).toBe(true)
        expect(isGoldforceActive(at(-1000), NOW)).toBe(false)
        expect(isGoldforceActive(null, NOW)).toBe(false)
    })
})
