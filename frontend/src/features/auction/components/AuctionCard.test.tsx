import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import AuctionCard from './AuctionCard'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 경매 카드 (FC-071).
 *
 * 고정하는 것:
 *  1. **마감 판정은 클라(`now >= endAt`)** — 서버 status 가 ACTIVE 여도 endAt 이 지났으면 "마감".
 *  2. 가격 라벨은 입찰 유무로 갈린다(현재가/시작가).
 *  3. 카드 전체가 `auctionPublicId` 상세 링크(경매 item 블록엔 인스턴스 ID 가 없다).
 */

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

describe('<AuctionCard>', () => {
    it('진행 중(now < endAt)이면 "진행 중" 배지 + 카운트다운', () => {
        renderWithProviders(<AuctionCard auction={baseAuction} now={NOW} />)
        expect(screen.getByText('진행 중')).toBeInTheDocument()
        expect(screen.queryByText('마감')).not.toBeInTheDocument()
    })

    it('★ 서버 status=ACTIVE 여도 endAt 이 지났으면 "마감"(클라 판정)', () => {
        const ended: AuctionSummary = {
            ...baseAuction,
            endAt: '2026-07-20T23:00:00Z', // NOW 이전
        }
        renderWithProviders(<AuctionCard auction={ended} now={NOW} />)
        // 상태 배지·카운트다운 두 채널 모두 마감을 알린다.
        expect(screen.getAllByText('마감').length).toBeGreaterThanOrEqual(1)
        expect(screen.queryByText('진행 중')).not.toBeInTheDocument()
    })

    it('입찰이 있으면 "현재가" 라벨 + 최고가', () => {
        renderWithProviders(<AuctionCard auction={baseAuction} now={NOW} />)
        expect(screen.getByText('현재가')).toBeInTheDocument()
        expect(screen.getByText('입찰 3건')).toBeInTheDocument()
    })

    it('입찰이 없으면 "시작가" 라벨 + 입찰 없음', () => {
        const noBids: AuctionSummary = {
            ...baseAuction,
            highestBidAmount: null,
            bidCount: 0,
        }
        renderWithProviders(<AuctionCard auction={noBids} now={NOW} />)
        expect(screen.getByText('시작가')).toBeInTheDocument()
        expect(screen.getByText('입찰 없음')).toBeInTheDocument()
    })

    it('카드 전체가 auctionPublicId 상세 링크다', () => {
        renderWithProviders(<AuctionCard auction={baseAuction} now={NOW} />)
        const link = screen.getByRole('link', {
            name: '불의 전투도끼 경매 상세 보기',
        })
        expect(link).toHaveAttribute('href', '/auctions/01J3AUCTION0001')
    })
})
