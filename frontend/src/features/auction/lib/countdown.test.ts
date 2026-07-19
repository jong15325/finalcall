import { describe, expect, it } from 'vitest'
import {
    CRITICAL_THRESHOLD_MS,
    URGENT_THRESHOLD_MS,
    countdownFrom,
    urgencyLabelOf,
} from './countdown'

/**
 * 카운트다운 파생 테스트 (FC-058).
 * ★ 순수 함수라 시계를 주입한다 — 테스트가 `Date.now()` 에 매달리지 않는다.
 */

const NOW = Date.parse('2026-07-19T12:00:00Z')
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

describe('countdownFrom — 표기 단위', () => {
    it('하루 이상이면 일·시간', () => {
        expect(
            countdownFrom(at(2 * 86_400_000 + 3 * 3_600_000), NOW).text,
        ).toBe('2일 3시간')
    })

    it('한 시간 이상이면 시간·분 (초는 흔들리기만 하고 쓸모가 없다)', () => {
        expect(countdownFrom(at(3_600_000 + 20 * 60_000), NOW).text).toBe(
            '1시간 20분',
        )
    })

    it('한 시간 미만에서만 mm:ss 로 내려간다', () => {
        expect(countdownFrom(at(4 * 60_000 + 31_000), NOW).text).toBe('04:31')
        expect(countdownFrom(at(9_000), NOW).text).toBe('00:09')
    })

    it('마감했으면 "마감" — 음수 시간이 새지 않는다', () => {
        const past = countdownFrom(at(-60_000), NOW)
        expect(past.text).toBe('마감')
        expect(past.remainingMs).toBe(0)
        expect(past.urgency).toBe('ended')
    })

    it('파싱 불가 입력에도 던지지 않는다 — 카드 하나가 목록을 죽이면 안 된다', () => {
        expect(() => countdownFrom('not-a-date', NOW)).not.toThrow()
        expect(countdownFrom('not-a-date', NOW).urgency).toBe('ended')
    })
})

describe('countdownFrom — 임계값(도메인 규칙)', () => {
    it('5분 이상은 normal', () => {
        expect(countdownFrom(at(URGENT_THRESHOLD_MS), NOW).urgency).toBe(
            'normal',
        )
    })

    it('5분 미만은 urgent', () => {
        expect(countdownFrom(at(URGENT_THRESHOLD_MS - 1), NOW).urgency).toBe(
            'urgent',
        )
    })

    it('30초 미만은 critical', () => {
        expect(countdownFrom(at(CRITICAL_THRESHOLD_MS - 1), NOW).urgency).toBe(
            'critical',
        )
        expect(countdownFrom(at(CRITICAL_THRESHOLD_MS), NOW).urgency).toBe(
            'urgent',
        )
    })

    it('임계값이 5분·30초다 (도메인 규칙 고정)', () => {
        expect(URGENT_THRESHOLD_MS).toBe(300_000)
        expect(CRITICAL_THRESHOLD_MS).toBe(30_000)
    })
})

describe('급함은 글자로 전달된다', () => {
    it('★ 색이 없으므로 라벨이 유일한 채널이다', () => {
        expect(urgencyLabelOf('critical')).toBe('초읽기')
        expect(urgencyLabelOf('urgent')).toBe('곧 마감')
        expect(urgencyLabelOf('ended')).toBe('마감됨')
    })

    it('normal 은 라벨이 없다 — 전부 강조하면 아무것도 강조되지 않는다', () => {
        expect(urgencyLabelOf('normal')).toBeNull()
    })
})

describe('aria 문장은 축약 표기를 풀어 읽는다', () => {
    it('"04:31" 은 소리로 읽기 어렵다 → "4분 31초 남음"', () => {
        expect(countdownFrom(at(4 * 60_000 + 31_000), NOW).ariaText).toBe(
            '4분 31초 남음',
        )
    })

    it('1분 미만은 초만 읽는다', () => {
        expect(countdownFrom(at(9_000), NOW).ariaText).toBe('9초 남음')
    })
})
