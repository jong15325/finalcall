import { describe, expect, it } from 'vitest'
import {
    formatGoldforceDays,
    goldforceRemainingDays,
    resolveFrameType,
} from './frame'

/**
 * 프레임 파생 검증 (rebuild-contract-map §2.2·§6.3).
 * 계약이 뒷받침하는 프레임은 골드포스뿐 — 나머지는 STANDARD 폴백, 잔여일은 클라 파생.
 */

const NOW = Date.parse('2026-07-21T00:00:00Z')
const DAY = 86_400_000
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

describe('resolveFrameType', () => {
    it('골드포스가 활성이면 GOLDFORCE', () => {
        expect(resolveFrameType({ goldforceExpireAt: at(DAY) }, NOW)).toBe(
            'GOLDFORCE',
        )
    })

    it('만료·미적용 골드포스는 STANDARD 폴백', () => {
        expect(resolveFrameType({ goldforceExpireAt: at(-DAY) }, NOW)).toBe(
            'STANDARD',
        )
        expect(resolveFrameType({ goldforceExpireAt: null }, NOW)).toBe(
            'STANDARD',
        )
    })

    it('visual 자체가 없어도 STANDARD (undefined 렌더 방지)', () => {
        expect(resolveFrameType(undefined, NOW)).toBe('STANDARD')
        expect(resolveFrameType(null, NOW)).toBe('STANDARD')
        expect(resolveFrameType({}, NOW)).toBe('STANDARD')
    })
})

describe('goldforceRemainingDays', () => {
    it('활성 잔여일을 올림해 반환한다', () => {
        expect(goldforceRemainingDays(at(3 * DAY), NOW)).toBe(3)
        // 부분일도 최소 하루로 보인다(올림)
        expect(goldforceRemainingDays(at(DAY + 1000), NOW)).toBe(2)
    })

    it('활성이되 하루 미만이면 하한 1로 보정', () => {
        expect(goldforceRemainingDays(at(1000), NOW)).toBe(1)
    })

    it('999일을 넘으면 상한 999로 보정', () => {
        expect(goldforceRemainingDays(at(5000 * DAY), NOW)).toBe(999)
    })

    it('비활성(만료·미적용)은 null — 슬롯을 렌더하지 않는다', () => {
        expect(goldforceRemainingDays(at(-DAY), NOW)).toBeNull()
        expect(goldforceRemainingDays(null, NOW)).toBeNull()
        expect(goldforceRemainingDays(undefined, NOW)).toBeNull()
    })
})

describe('formatGoldforceDays', () => {
    it('3자리로 0 채움', () => {
        expect(formatGoldforceDays(1)).toBe('001')
        expect(formatGoldforceDays(42)).toBe('042')
        expect(formatGoldforceDays(999)).toBe('999')
    })
})
