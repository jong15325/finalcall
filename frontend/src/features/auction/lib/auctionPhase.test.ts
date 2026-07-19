import { describe, expect, it } from 'vitest'
import {
    auctionPhaseLabelOf,
    auctionPhaseOf,
    isBiddablePhase,
    isOwnAuction,
} from './auctionPhase'
import type { AuctionPhaseInput } from './auctionPhase'

/**
 * 경매 단계 판정 (FC-064).
 *
 * 이 파일이 고정하는 것:
 *  1. **★★ 서버 `status: "ACTIVE"` 라도 `endAt` 이 지났으면 마감이다** — 마감 강등 워커가
 *     없어 실제로 그렇게 내려온다. 이게 깨지면 종료 경매에 입찰 바가 뜬다.
 *  2. 종료 상태(SOLD·UNSOLD·CANCELLED)는 시각과 무관하게 마감.
 *  3. 예약 경매는 `startAt` 전까지 '시작 전' — 마감과 **다른** 상태다(안내 문구가 정반대).
 *  4. 미등록 status·파싱 불가 값이 화면을 깨지 않는다.
 *  5. 판매자 판정은 닉네임 비교이고, 비로그인은 판매자가 아니다.
 */

const NOW = Date.parse('2026-07-20T12:00:00Z')
const PAST = '2026-07-20T11:59:59Z'
const FUTURE = '2026-07-20T13:00:00Z'

function input(overrides: Partial<AuctionPhaseInput> = {}): AuctionPhaseInput {
    return { status: 'ACTIVE', startAt: null, endAt: FUTURE, ...overrides }
}

describe('★★ 마감은 서버 status 가 아니라 endAt 으로 판정한다', () => {
    it('status 가 ACTIVE 여도 endAt 이 지났으면 마감이다', () => {
        expect(auctionPhaseOf(input({ endAt: PAST }), NOW)).toBe('ended')
    })

    it('endAt 과 now 가 같은 순간이면 이미 마감이다 (경계는 닫는 쪽)', () => {
        const endAt = new Date(NOW).toISOString()
        expect(auctionPhaseOf(input({ endAt }), NOW)).toBe('ended')
    })

    it('endAt 이 남았고 시작했으면 진행 중이다', () => {
        expect(auctionPhaseOf(input(), NOW)).toBe('live')
    })

    it('endAt 을 파싱할 수 없으면 마감으로 흘린다 — 안전한 쪽은 잠그는 쪽', () => {
        expect(auctionPhaseOf(input({ endAt: '언제까지' }), NOW)).toBe('ended')
    })
})

describe('종료 상태는 시각과 무관하다', () => {
    it.each(['SOLD', 'UNSOLD', 'CANCELLED'])(
        '%s 는 endAt 이 남았어도 마감이다',
        (status) => {
            expect(auctionPhaseOf(input({ status }), NOW)).toBe('ended')
        },
    )

    it('우리가 모르는 status 는 에러가 아니라 시각 판정으로 흐른다', () => {
        expect(auctionPhaseOf(input({ status: 'PAUSED' }), NOW)).toBe('live')
        expect(
            auctionPhaseOf(input({ status: 'PAUSED', endAt: PAST }), NOW),
        ).toBe('ended')
    })
})

describe('★ 시작 전과 마감은 다른 상태다', () => {
    it('startAt 이 아직 안 왔으면 시작 전이다', () => {
        expect(
            auctionPhaseOf(
                input({ status: 'SCHEDULED', startAt: FUTURE }),
                NOW,
            ),
        ).toBe('scheduled')
    })

    it('startAt 이 지났으면 진행 중이다', () => {
        expect(
            auctionPhaseOf(input({ status: 'SCHEDULED', startAt: PAST }), NOW),
        ).toBe('live')
    })

    it('시작 전이어도 endAt 이 지났으면 마감이 이긴다', () => {
        expect(
            auctionPhaseOf(input({ startAt: FUTURE, endAt: PAST }), NOW),
        ).toBe('ended')
    })

    it('startAt 파싱 실패는 즉시 시작으로 흘린다', () => {
        expect(auctionPhaseOf(input({ startAt: '언제' }), NOW)).toBe('live')
    })
})

describe('입찰 가능 여부와 라벨', () => {
    it('진행 중일 때만 입찰 가능하다', () => {
        expect(isBiddablePhase('live')).toBe(true)
        expect(isBiddablePhase('ended')).toBe(false)
        expect(isBiddablePhase('scheduled')).toBe(false)
    })

    it('마감 라벨은 결과를 단정하지 않는다 — "낙찰"이 아니라 "마감"', () => {
        expect(auctionPhaseLabelOf('ended')).toBe('마감')
        expect(auctionPhaseLabelOf('scheduled')).toBe('시작 전')
        expect(auctionPhaseLabelOf('live')).toBe('진행 중')
    })
})

describe('★ 판매자 판정 — 계약에 isSeller 가 없어 닉네임으로 파생한다', () => {
    it('닉네임이 같으면 내 경매다', () => {
        expect(isOwnAuction('대장장이', '대장장이')).toBe(true)
    })

    it('다르면 남의 경매다', () => {
        expect(isOwnAuction('대장장이', '테스터')).toBe(false)
    })

    it('비로그인(null·undefined·빈 문자열)은 절대 판매자가 아니다', () => {
        expect(isOwnAuction('대장장이', null)).toBe(false)
        expect(isOwnAuction('대장장이', undefined)).toBe(false)
        // 빈 닉네임끼리 우연히 같아져 남의 경매를 내 것으로 판정하면 안 된다.
        expect(isOwnAuction('', '')).toBe(false)
    })
})
