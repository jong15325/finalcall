import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import AuctionCardCandidate from './AuctionCardCandidate'
import { auctionCardFixture } from '../fixtures/auctionCard'

describe('<AuctionCardCandidate>', () => {
    it('계약 순서와 0개 스킬의 두 없음 행을 유지한다', () => {
        const auction = auctionCardFixture.auctions[0]
        const { container } = renderWithProviders(
            <AuctionCardCandidate
                auction={auction}
                now={auctionCardFixture.now}
            />,
        )
        const card = container.querySelector('[data-auction-card-candidate]')!
        const skillRows = within(card as HTMLElement).getAllByRole('listitem')

        expect(skillRows).toHaveLength(2)
        expect(skillRows[0]).toHaveTextContent('스킬 1 없음')
        expect(skillRows[1]).toHaveTextContent('스킬 2 없음')
        const footer = card.querySelector('.border-t.border-content-line')!
        const text = footer.textContent ?? ''
        for (const [before, after] of [['시작가', '판매자']]) {
            expect(text.indexOf(before)).toBeLessThan(text.indexOf(after))
        }
        expect(
            within(footer as HTMLElement).getByLabelText(/남음/),
        ).toBeVisible()
    })

    it('상세 link 하나와 artwork 보조 surface, 비상호작용 입찰 badge를 제공한다', () => {
        const auction = auctionCardFixture.auctions[2]
        const { container } = renderWithProviders(
            <AuctionCardCandidate
                auction={auction}
                now={auctionCardFixture.now}
            />,
        )
        const detail = screen.getByRole('link', {
            name: `${auction.item.nameSnapshot} 경매 상세 보기`,
        })

        expect(detail).toHaveAttribute('data-card-hit-area', 'content')
        expect(screen.getAllByRole('link')).toHaveLength(1)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(
            container.querySelector('[data-card-hit-area="artwork"]'),
        ).toHaveAttribute('aria-hidden', 'true')
        expect(
            container.querySelector('[data-card-hit-area="compare"]'),
        ).toBeNull()
        expect(
            container.querySelector('[data-auction-phase-badge]'),
        ).toHaveTextContent('진행 중')
        expect(
            container.querySelector('[data-auction-bid-badge]'),
        ).toHaveTextContent('입찰 7건')
        const phaseBadge = container.querySelector(
            '[data-auction-phase-badge]',
        )!
        const bidBadge = container.querySelector('[data-auction-bid-badge]')!
        expect(bidBadge).toHaveAttribute('aria-label', '입찰 7건')
        expect(bidBadge).toHaveAttribute('title', '입찰 7건')
        expect(bidBadge).toHaveClass(
            'min-w-0',
            'inline-flex',
            'items-center',
            'font-mono',
            'tabular-nums',
            'bg-brand-highlight-soft',
            'text-brand-highlight-deep',
        )
        expect(bidBadge).toHaveStyle({
            gap: '5px',
            padding: '3px 7px',
            borderRadius: '999px',
            maxWidth: '100%',
            justifySelf: 'end',
        })
        expect(bidBadge).not.toHaveClass(
            'rounded-lg',
            'bg-content-surface',
            'px-2',
            'py-1',
            'shadow-sm',
        )
        expect(container.querySelector('[data-auction-bid-text]')).toHaveClass(
            'min-w-0',
            'break-all',
            'leading-tight',
        )
        expect(container.querySelector('[data-auction-bid-dot]')).toHaveClass(
            'shrink-0',
            'bg-brand-highlight-bright',
        )
        expect(container.querySelector('[data-auction-bid-dot]')).toHaveStyle({
            width: '7px',
            height: '7px',
            borderRadius: '50%',
        })
        expect(container.querySelector('[data-auction-badge-row]')).toHaveClass(
            'pointer-events-none',
            'grid',
            'min-w-0',
        )
        expect(container.querySelector('[data-auction-badge-row]')).toHaveStyle(
            {
                gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
            },
        )
        expect(phaseBadge).toHaveClass(
            'inline-flex',
            'items-center',
            'shrink-0',
            'whitespace-nowrap',
            'bg-success-soft',
            'text-success-ink',
            'text-[10px]',
            'font-extrabold',
        )
        expect(phaseBadge).toHaveStyle({
            gap: '5px',
            padding: '3px 7px',
            borderRadius: '999px',
        })
        expect(phaseBadge).not.toHaveClass(
            'absolute',
            'bg-content-surface',
            'px-2',
            'py-1',
            'shadow-sm',
        )
        expect(container.querySelector('[data-auction-phase-dot]')).toHaveClass(
            'shrink-0',
            'bg-success',
        )
        expect(container.querySelector('[data-auction-phase-dot]')).toHaveStyle(
            { width: '7px', height: '7px', borderRadius: '50%' },
        )
        expect(bidBadge).not.toHaveClass('absolute', 'line-clamp-2', 'truncate')
        const artwork = container.querySelector('[data-artwork-height]')!
        const badgeRow = container.querySelector('[data-auction-badge-row]')!
        expect(artwork).toHaveClass('relative')
        expect(badgeRow.parentElement).toBe(artwork)
        expect(badgeRow).toHaveClass('absolute', 'top-2')
        expect(badgeRow).toHaveStyle({ left: '8px', right: '8px' })
        expect(
            container.querySelector(
                '.item-frame__overlay [data-auction-badge-row]',
            ),
        ).toBeNull()
        const frame = artwork.querySelector('.item-card__artwork-frame')!
        expect(
            frame.classList.contains(['item-frame', 'fill'].join('--')),
        ).toBe(true)
        expect(
            frame.classList.contains(['item-frame', 'stage'].join('--')),
        ).toBe(true)
        expect(frame.querySelector('.item-frame__stage')).toBeInTheDocument()
        expect(artwork.getElementsByClassName('h-[158px]')).toHaveLength(0)
        expect(artwork).toHaveAttribute('data-artwork-height', '296')
        expect(artwork).toHaveAttribute('data-market-artwork-height', '252')
        expect(296 - 252).toBe(44)
    })

    it('phase tag uses the scheduled and ended semantic soft roles', () => {
        const scheduled = renderWithProviders(
            <AuctionCardCandidate
                auction={auctionCardFixture.auctions[1]}
                now={auctionCardFixture.now}
            />,
        )
        expect(
            scheduled.container.querySelector('[data-auction-phase-badge]'),
        ).toHaveClass('bg-brand-highlight-soft', 'text-brand-highlight-deep')
        expect(
            scheduled.container.querySelector('[data-auction-phase-dot]'),
        ).toHaveClass('bg-brand-highlight-bright')
        scheduled.unmount()

        const ended = renderWithProviders(
            <AuctionCardCandidate
                auction={auctionCardFixture.auctions[3]}
                now={auctionCardFixture.now}
            />,
        )
        expect(
            ended.container.querySelector('[data-auction-phase-badge]'),
        ).toHaveClass('bg-content-soft', 'text-content-muted')
        expect(
            ended.container.querySelector('[data-auction-phase-dot]'),
        ).toHaveClass('bg-brand-structure')
    })

    it('입찰 없음과 긴 천단위 입찰 수를 badge에서 표시한다', () => {
        const empty = renderWithProviders(
            <AuctionCardCandidate
                auction={auctionCardFixture.auctions[0]}
                now={auctionCardFixture.now}
            />,
        )
        expect(
            empty.container.querySelector('[data-auction-bid-badge]'),
        ).toHaveTextContent('입찰 없음')
        empty.unmount()
        const full = renderWithProviders(
            <AuctionCardCandidate
                auction={auctionCardFixture.auctions[5]}
                now={auctionCardFixture.now}
            />,
        )
        expect(
            full.container.querySelector('[data-auction-bid-badge]'),
        ).toHaveTextContent('입찰 9,007조건')
        const badge = full.container.querySelector<HTMLElement>(
            '[data-auction-bid-badge]',
        )!
        expect(badge).toHaveTextContent('입찰 9,007조건')
        expect(badge).toHaveAttribute(
            'aria-label',
            '입찰 9,007,199,254,740,991건',
        )
        expect(badge).toHaveAttribute('title', '입찰 9,007,199,254,740,991건')
        expect(badge.scrollHeight).toBeLessThanOrEqual(badge.clientHeight)
    })

    it('긴 안전정수·판매자·스킬명은 overflow 계약을 가진다', () => {
        const longPrice = auctionCardFixture.auctions[4]
        const longCopy = auctionCardFixture.auctions[3]
        const first = renderWithProviders(
            <AuctionCardCandidate
                auction={longPrice}
                now={auctionCardFixture.now}
            />,
        )
        expect(screen.getByLabelText('9,007,199,254,740,991 코드')).toHaveClass(
            'min-w-0',
            'flex-wrap',
            'break-all',
        )
        first.unmount()
        renderWithProviders(
            <AuctionCardCandidate
                auction={longCopy}
                now={auctionCardFixture.now}
            />,
        )
        expect(screen.getByTitle(longCopy.sellerNickname)).toHaveClass(
            'truncate',
        )
        expect(
            screen.getByText(longCopy.item.skill2Name!).closest('li'),
        ).toHaveClass('item-card__skill-row')
    })
})
