import { describe, expect, it } from 'vitest'
import { fullJitterDelay } from './chatRuntime'

describe('fullJitterDelay', () => {
    it('1·2·4·8·16초 지수 cap과 최대 30초 안에서 full jitter를 만든다', () => {
        expect(fullJitterDelay(0, () => 0.5)).toBe(500)
        expect(fullJitterDelay(1, () => 0.5)).toBe(1_000)
        expect(fullJitterDelay(4, () => 0.5)).toBe(8_000)
        expect(fullJitterDelay(8, () => 0.5)).toBe(15_000)
        expect(fullJitterDelay(20, () => 0.999)).toBeLessThan(30_000)
    })
})
