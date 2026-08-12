import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import AuctionPreviewCard from './AuctionPreviewCard'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 홈 프리뷰 세로 카드 (FC-070).
 *
 * 고정하는 것:
 *  1. 카드 전체가 `auctionPublicId` 상세 링크(경매 item 블록엔 인스턴스 ID 가 없다).
 *  2. **마감 판정은 클라(`now >= endAt`)** — 서버 status=ACTIVE 여도 endAt 이 지났으면 "마감".
 *  3. 가격 라벨은 입찰 유무로 갈린다(현재가/시작가).
 */

const NOW = Date.parse('2026-07-21T00:00:00Z')

const baseAuction: AuctionSummary = {
    auctionPublicId: '01J3PREVIEW0001',
    status: 'ACTIVE',
    item: {
        typeCode: 1123,
        mainCategory: 1,
        subGroup: 1,
        element: 2,
        kind: 1,
        level: 3,
        skill1: 11,
        skill2: null,
        skillPercent: 10,
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

describe('<AuctionPreviewCard>', () => {
    it('카드 전체가 auctionPublicId 상세 링크다', () => {
        renderWithProviders(
            <AuctionPreviewCard auction={baseAuction} now={NOW} />,
        )
        const link = screen.getByRole('link', {
            name: '불의 전투도끼 경매 상세 보기',
        })
        expect(link).toHaveAttribute('href', '/auctions/01J3PREVIEW0001')
        expect(link).toHaveClass('item-card__primary-action--content')
        expect(link).toBeEmptyDOMElement()
        expect(screen.queryByText('카드정보 보기')).not.toBeInTheDocument()
        const links = document.querySelectorAll('a[href="/auctions/01J3PREVIEW0001"]')
        expect(links).toHaveLength(3)
        const artworkLink = document.querySelector(
            '[data-card-hit-area="artwork"]',
        )
        const gapLink = document.querySelector(
            '[data-card-hit-area="control-gap"]',
        )
        expect(artworkLink).toHaveAttribute('aria-hidden', 'true')
        expect(artworkLink).toHaveAttribute('tabindex', '-1')
        expect(artworkLink).toHaveClass('item-card__primary-action--artwork')
        expect(artworkLink?.previousElementSibling).toHaveClass(
            'item-card__artwork-controls',
        )
        expect(gapLink?.parentElement).toHaveClass('item-card__control-gap')
        expect(gapLink?.closest('.item-card__secondary-actions')).toBeNull()
        expect(link.closest('article')).toHaveClass(
            'hover:shadow-[var(--shadow-card-hover)]',
        )
    })

    it('진행 중(now < endAt)이면 "진행 중" 배지', () => {
        renderWithProviders(
            <AuctionPreviewCard auction={baseAuction} now={NOW} />,
        )
        expect(screen.getByText('진행 중')).toBeInTheDocument()
    })

    it('★ 서버 status=ACTIVE 여도 endAt 이 지났으면 "마감"(클라 판정)', () => {
        const ended: AuctionSummary = {
            ...baseAuction,
            endAt: '2026-07-20T23:00:00Z', // NOW 이전
        }
        renderWithProviders(<AuctionPreviewCard auction={ended} now={NOW} />)
        expect(screen.getAllByText('마감').length).toBeGreaterThanOrEqual(1)
        expect(screen.queryByText('진행 중')).not.toBeInTheDocument()
    })

    it('입찰이 있으면 "현재가" 라벨', () => {
        renderWithProviders(
            <AuctionPreviewCard auction={baseAuction} now={NOW} />,
        )
        expect(screen.getByText('현재가')).toBeInTheDocument()
    })

    it('입찰이 없으면 "시작가" 라벨', () => {
        const noBids: AuctionSummary = {
            ...baseAuction,
            highestBidAmount: null,
            bidCount: 0,
        }
        renderWithProviders(<AuctionPreviewCard auction={noBids} now={NOW} />)
        expect(screen.getByText('시작가')).toBeInTheDocument()
    })
})
