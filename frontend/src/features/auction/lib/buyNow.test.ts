import { describe, expect, it } from 'vitest'
import { buyNowStateOf, endedResultNoteOf } from './buyNow'

/**
 * 즉시구매 활성 조건 + 낙찰 결과 표기 (계약 §3.1 · purchase-spec §8) — FC-090.
 */

describe('buyNowStateOf — 활성 조건', () => {
    const base = {
        buyNowPrice: 3_900_000,
        phase: 'live' as const,
        isOwn: false,
        isAuthed: true,
    }

    it('설정 + 라이브 + 타인 + 로그인 → available', () => {
        expect(buyNowStateOf(base)).toBe('available')
    })

    it('비로그인 → login(구매 유도)', () => {
        expect(buyNowStateOf({ ...base, isAuthed: false })).toBe('login')
    })

    it('즉시구매 미설정(buyNowPrice null) → hidden', () => {
        expect(buyNowStateOf({ ...base, buyNowPrice: null })).toBe('hidden')
    })

    it('★ 자기 경매면 hidden(로그인 여부 무관)', () => {
        expect(buyNowStateOf({ ...base, isOwn: true })).toBe('hidden')
        expect(buyNowStateOf({ ...base, isOwn: true, isAuthed: false })).toBe(
            'hidden',
        )
    })

    it('라이브가 아니면(예약·마감) hidden', () => {
        expect(buyNowStateOf({ ...base, phase: 'scheduled' })).toBe('hidden')
        expect(buyNowStateOf({ ...base, phase: 'ended' })).toBe('hidden')
    })
})

describe('endedResultNoteOf — 낙찰 결과(BUYNOW 포함)', () => {
    it('SOLD + BUYNOW → 즉시구매 낙찰', () => {
        expect(endedResultNoteOf('SOLD', 'BUYNOW')).toBe(
            '즉시구매로 낙찰되었습니다.',
        )
    })

    it('SOLD + BID(입찰 낙찰) → 낙찰', () => {
        expect(endedResultNoteOf('SOLD', 'BID')).toBe('낙찰되었습니다.')
    })

    it('UNSOLD·CANCELLED 는 각 문구', () => {
        expect(endedResultNoteOf('UNSOLD', null)).toBe('유찰되었습니다.')
        expect(endedResultNoteOf('CANCELLED', null)).toBe('취소된 경매입니다.')
    })

    it('★ 시계상 마감(서버 아직 ACTIVE)은 결과를 단정하지 않는다', () => {
        expect(endedResultNoteOf('ACTIVE', null)).toBe(
            '마감되었습니다. 결과가 곧 반영됩니다.',
        )
    })
})
