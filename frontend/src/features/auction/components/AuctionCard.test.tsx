import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import AuctionCard from './AuctionCard'
import type { AuctionSummary } from '@/lib/api/auctions'

const NOW = Date.parse('2026-07-21T00:00:00Z')
const baseAuction: AuctionSummary = {
    auctionPublicId: '01J3AUCTION0001',
    status: 'ACTIVE',
    item: {
        typeCode: 1123,
        mainCategory: 1,
        subGroup: 1,
        element: 2,
        kind: 1,
        level: 3,
        skill1: 11,
        skill2: 22,
        skill1Name: '공격시간 3 감소',
        skill2Name: '트리플샷',
        skillPercent: 33,
        goldforceExpireAt: null,
        nameSnapshot: '불의 전투도끼',
        specSnapshot: '공격력이 높은 한손 도끼',
    },
    startPrice: 1_000_000,
    buyNowPrice: null,
    highestBidAmount: 2_480_000,
    bidCount: 3,
    startAt: null,
    endAt: '2026-07-21T01:00:00Z',
    sellerNickname: '토르',
}

describe('<AuctionCard>', () => {
    it.each([
        ['스킬 없음', null, null],
        ['스킬 1개', 131, null],
        ['스킬 2개', 131, 202],
    ] as const)('%s도 두 스킬 행을 유지한다', (_, skill1, skill2) => {
        renderWithProviders(
            <AuctionCard
                auction={{
                    ...baseAuction,
                    item: { ...baseAuction.item, skill1, skill2 },
                }}
                now={NOW}
            />,
        )

        expect(screen.getByRole('list', { name: '스킬' })).toHaveClass(
            'item-card__market-skills',
        )
        expect(screen.getAllByRole('listitem')).toHaveLength(2)
        if (skill1 === null)
            expect(screen.getAllByText('없음')).not.toHaveLength(0)
    })

    it('아이템마켓 compact identity와 경매 사실 순서를 조립한다', () => {
        const { container } = renderWithProviders(
            <AuctionCard auction={baseAuction} now={NOW} />,
        )

        expect(screen.getByText('블랙 - 무기')).toBeInTheDocument()
        expect(screen.getByText(/도끼 · Lv\.3/)).toBeInTheDocument()
        expect(screen.getByText('공격시간 3 감소')).toBeInTheDocument()
        expect(screen.getByText('(33%)')).toBeInTheDocument()
        expect(screen.getByText('현재가')).toBeInTheDocument()
        expect(screen.getByText('2,480,000')).toBeInTheDocument()
        expect(screen.getByLabelText('1시간 0분 남음')).toBeInTheDocument()
        expect(screen.getByText('판매자').parentElement).toHaveTextContent(
            '판매자토르',
        )

        const price = container.querySelector('[data-listing-price]')
        const countdown = screen.getByLabelText('1시간 0분 남음')
        const seller = screen.getByText('판매자').parentElement
        expect(price?.compareDocumentPosition(seller as HTMLElement) ?? 0).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        )
        const rail = countdown.closest('[data-auction-info-rail]')
        expect(rail).toHaveClass('pointer-events-none', 'auction-info-rail')
        expect(countdown).toHaveClass(
            'auction-time-display',
            'auction-time-display--bare',
            'ml-auto',
        )
        expect(countdown.querySelector('time')).toHaveClass(
            'auction-time-display__digits',
        )
        expect(countdown.closest('[data-auction-artwork]')).toBeNull()
        expect(
            container.querySelector('[data-auction-countdown-overlay]'),
        ).not.toBeInTheDocument()
        const artwork = container.querySelector('[data-auction-artwork]')
        expect(artwork?.compareDocumentPosition(rail as HTMLElement)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        )
        expect(rail?.compareDocumentPosition(price as HTMLElement)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        )
        expect(price?.parentElement).not.toContainElement(countdown)
    })

    it('artwork를 마켓 기준보다 44px 확장한다', () => {
        const { container } = renderWithProviders(
            <AuctionCard auction={baseAuction} now={NOW} />,
        )
        const artwork = container.querySelector('[data-auction-artwork]')

        expect(artwork).toHaveClass('h-[296px]')
        expect(artwork).toHaveAttribute('data-market-artwork-height', '252')
    })

    it('phase와 전체값을 보존한 입찰 badge를 artwork에 표시한다', () => {
        const { container } = renderWithProviders(
            <AuctionCard
                auction={{ ...baseAuction, bidCount: Number.MAX_SAFE_INTEGER }}
                now={NOW}
            />,
        )

        expect(screen.getByText('진행 중')).toBeInTheDocument()
        expect(
            screen.getByLabelText('입찰 9,007,199,254,740,991건'),
        ).toHaveTextContent('입찰 9,007조건')
        const stack = container.querySelector('[data-auction-badge-stack]')
        const phase = container.querySelector('[data-auction-phase-badge]')
        const bid = container.querySelector('[data-auction-bid-count]')
        const rail = container.querySelector('[data-auction-info-rail]')
        const time = container.querySelector('[data-auction-time-display]')
        expect(stack).toHaveClass(
            'pointer-events-none',
            'right-2',
            'top-2',
            'flex-col',
            'items-end',
            'max-w-[calc(100%-1rem)]',
        )
        expect(phase?.closest('[data-auction-artwork]')).not.toBeNull()
        expect(bid?.closest('[data-auction-info-rail]')).not.toBeNull()
        expect(bid?.closest('[data-auction-artwork]')).toBeNull()
        expect(rail?.children).toHaveLength(2)
        expect(rail?.firstElementChild).toBe(bid?.parentElement)
        expect(rail?.lastElementChild).toBe(time)
        expect(time).toHaveClass('auction-time-display--bare')
    })

    it('입찰이 없으면 시작가만 표시하고 입찰 badge는 렌더하지 않는다', () => {
        renderWithProviders(
            <AuctionCard
                auction={{
                    ...baseAuction,
                    highestBidAmount: null,
                    bidCount: 0,
                }}
                now={NOW}
            />,
        )

        expect(screen.getByText('시작가')).toBeInTheDocument()
        expect(screen.queryByText('입찰 없음')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('입찰 없음')).not.toBeInTheDocument()
        expect(screen.queryByTitle('입찰 없음')).not.toBeInTheDocument()
    })

    it('마감 시각이 지나면 서버 ACTIVE 상태도 마감으로 표시한다', () => {
        renderWithProviders(
            <AuctionCard
                auction={{ ...baseAuction, endAt: '2026-07-20T23:00:00Z' }}
                now={NOW}
            />,
        )
        expect(screen.getAllByText('마감')).toHaveLength(2)
        expect(screen.queryByText('진행 중')).not.toBeInTheDocument()
    })

    it('keyboard 주 action은 하나이며 비교 control을 렌더하지 않는다', () => {
        renderWithProviders(<AuctionCard auction={baseAuction} now={NOW} />)

        const links = screen.getAllByRole('link')
        expect(links).toHaveLength(1)
        expect(links[0]).toHaveAccessibleName('불의 전투도끼 경매 상세 보기')
        expect(links[0]).toHaveAttribute('href', '/auctions/01J3AUCTION0001')
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('이미지는 pointer 보조 상세 link를 가지며 접근성 트리에는 중복되지 않는다', () => {
        const { container } = renderWithProviders(
            <AuctionCard auction={baseAuction} now={NOW} />,
        )
        const artworkLink = container.querySelector(
            '[data-card-hit-area="artwork"]',
        )

        expect(artworkLink).toHaveAttribute('aria-hidden', 'true')
        expect(artworkLink).toHaveAttribute('tabindex', '-1')
        expect(artworkLink).toHaveAttribute('href', '/auctions/01J3AUCTION0001')
        expect(artworkLink).toHaveClass('!inset-0')
        expect(
            container.querySelector('[aria-label="입찰 3건"]'),
        ).toHaveAttribute('title', '입찰 3건')
    })
})
