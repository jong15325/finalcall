import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AuctionCountdownTagCandidate, {
    AUCTION_COUNTDOWN_TAG_VARIANTS,
} from './AuctionCountdownTagCandidate'

describe('AuctionCountdownTagCandidate', () => {
    it('3계열 12개의 독립 후보와 설계 근거를 제공한다', () => {
        expect(AUCTION_COUNTDOWN_TAG_VARIANTS).toHaveLength(12)
        expect(
            new Set(AUCTION_COUNTDOWN_TAG_VARIANTS.map(({ id }) => id)).size,
        ).toBe(12)
        expect(
            new Set(
                AUCTION_COUNTDOWN_TAG_VARIANTS.map(
                    ({ structure }) => structure,
                ),
            ).size,
        ).toBe(12)
        expect(
            new Set(AUCTION_COUNTDOWN_TAG_VARIANTS.map(({ family }) => family)),
        ).toEqual(
            new Set([
                'mini-timecode',
                'auction-info-rail',
                'split-status-time',
            ]),
        )
        for (const variant of AUCTION_COUNTDOWN_TAG_VARIANTS) {
            expect(variant.reference).not.toHaveLength(0)
            expect(variant.rationale).not.toHaveLength(0)
        }
    })

    it('12개 후보 DOM 구조가 모두 다르고 시간은 read-only data로 렌더한다', () => {
        const { container } = render(
            <>
                {AUCTION_COUNTDOWN_TAG_VARIANTS.map((variant) => (
                    <div key={variant.id} className="relative">
                        <AuctionCountdownTagCandidate variant={variant} />
                    </div>
                ))}
            </>,
        )
        const candidates = [
            ...container.querySelectorAll<HTMLElement>(
                '[data-countdown-candidate]',
            ),
        ]
        expect(
            new Set(candidates.map((candidate) => candidate.innerHTML)).size,
        ).toBe(12)
        expect(
            container.querySelectorAll('[data-auction-time-display]'),
        ).toHaveLength(13)
        expect(container.querySelectorAll('time')).toHaveLength(13)
    })

    it('상태만 VuexyBadge를 사용하고 모든 overlay가 pointer를 통과한다', () => {
        const { container } = render(
            <>
                {AUCTION_COUNTDOWN_TAG_VARIANTS.map((variant) => (
                    <div key={variant.id} className="relative">
                        <AuctionCountdownTagCandidate variant={variant} />
                    </div>
                ))}
            </>,
        )
        const statusCandidates = AUCTION_COUNTDOWN_TAG_VARIANTS.filter(
            ({ id }) =>
                [
                    'rail-status-time',
                    'split-corners',
                    'split-top-bottom',
                    'split-dot-time',
                    'split-label-time',
                ].includes(id),
        )
        expect(container.querySelectorAll('[data-vuexy-badge]')).toHaveLength(
            statusCandidates.length,
        )
        expect(
            screen.getAllByLabelText('진행중, 경매 마감까지 12분 48초'),
        ).toHaveLength(12)
        for (const candidate of container.querySelectorAll(
            '[data-countdown-candidate]',
        )) {
            expect(candidate).toHaveClass('pointer-events-none')
        }
    })
})
