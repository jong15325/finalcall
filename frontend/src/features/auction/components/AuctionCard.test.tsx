import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useCompareStore } from '@/store/compareStore'
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

    it('입찰이 있으면 "현재가" 라벨 + 입찰 N회', () => {
        renderWithProviders(<AuctionCard auction={baseAuction} now={NOW} />)
        expect(screen.getByText('현재가')).toBeInTheDocument()
        expect(screen.getByText('3회')).toBeInTheDocument()
    })

    it('입찰이 없으면 "시작가" 라벨 + 0회', () => {
        const noBids: AuctionSummary = {
            ...baseAuction,
            highestBidAmount: null,
            bidCount: 0,
        }
        renderWithProviders(<AuctionCard auction={noBids} now={NOW} />)
        expect(screen.getByText('시작가')).toBeInTheDocument()
        expect(screen.getByText('0회')).toBeInTheDocument()
    })

    it('속성 라벨(가로 카드 element-dot)을 표시한다', () => {
        renderWithProviders(<AuctionCard auction={baseAuction} now={NOW} />)
        // element 2 = 불
        expect(screen.getByText('불')).toBeInTheDocument()
    })

    it('두 스킬의 슬롯 라벨과 슬롯2 발동확률을 표시한다', () => {
        renderWithProviders(<AuctionCard auction={baseAuction} now={NOW} />)

        expect(screen.getByText('스킬 1')).toBeInTheDocument()
        expect(screen.getByText('공격시간 3 감소')).toBeInTheDocument()
        expect(screen.getByText('스킬 2')).toBeInTheDocument()
        expect(screen.getByText('트리플샷')).toBeInTheDocument()
        expect(screen.getByText('33%')).toBeInTheDocument()
    })

    it('skill1이 없어도 skill2를 슬롯 2로 유지한다', () => {
        renderWithProviders(
            <AuctionCard
                auction={{
                    ...baseAuction,
                    item: {
                        ...baseAuction.item,
                        skill1: null,
                        skill1Name: null,
                    },
                }}
                now={NOW}
            />,
        )

        expect(screen.queryByText('스킬 1')).not.toBeInTheDocument()
        expect(screen.getByText('스킬 2')).toBeInTheDocument()
        expect(screen.getByText('33%')).toBeInTheDocument()
    })

    it('스킬명이 없으면 코드로 중립 표기한다', () => {
        renderWithProviders(
            <AuctionCard
                auction={{
                    ...baseAuction,
                    item: {
                        ...baseAuction.item,
                        skill1Name: null,
                        skill2Name: null,
                    },
                }}
                now={NOW}
            />,
        )

        expect(screen.getByText('스킬 #11')).toBeInTheDocument()
        expect(screen.getByText('스킬 #22')).toBeInTheDocument()
    })

    it('스킬이 없으면 빈 상태를 표시한다', () => {
        renderWithProviders(
            <AuctionCard
                auction={{
                    ...baseAuction,
                    item: {
                        ...baseAuction.item,
                        skill1: null,
                        skill2: null,
                        skill1Name: null,
                        skill2Name: null,
                    },
                }}
                now={NOW}
            />,
        )

        expect(screen.getByText('스킬 없음')).toBeInTheDocument()
    })

    it('활성 골드포스 잔여일을 카드 접근성 트리에 포함한다', () => {
        renderWithProviders(
            <AuctionCard
                auction={{
                    ...baseAuction,
                    item: {
                        ...baseAuction.item,
                        goldforceExpireAt: '2026-07-24T00:00:00Z',
                    },
                }}
                now={NOW}
            />,
        )

        expect(screen.getByLabelText('골드포스 잔여 3일')).toBeInTheDocument()
    })

    it('카드 전체가 auctionPublicId 상세 링크다', () => {
        renderWithProviders(<AuctionCard auction={baseAuction} now={NOW} />)
        const link = screen.getByRole('link', {
            name: '불의 전투도끼 경매 상세 보기',
        })
        expect(link).toHaveAttribute('href', '/auctions/01J3AUCTION0001')
    })

    it('상세 링크와 비교 버튼을 형제 인터랙션으로 분리한다', () => {
        renderWithProviders(<AuctionCard auction={baseAuction} now={NOW} />)

        const link = screen.getByRole('link', {
            name: '불의 전투도끼 경매 상세 보기',
        })
        const compareButton = screen.getByRole('button', {
            name: '불의 전투도끼 비교에 담기',
        })

        expect(link).not.toContainElement(compareButton)
        expect(link.parentElement).toBe(
            compareButton.parentElement?.parentElement?.parentElement,
        )
    })

    it('비교 버튼 클릭은 링크 이동 없이 비교 상태만 토글한다', async () => {
        const user = userEvent.setup()
        useCompareStore.getState().clear()
        renderWithProviders(<AuctionCard auction={baseAuction} now={NOW} />)

        const compareButton = screen.getByRole('button', {
            name: '불의 전투도끼 비교에 담기',
        })
        await user.click(compareButton)

        expect(compareButton).toHaveAttribute('aria-pressed', 'true')
        expect(
            useCompareStore
                .getState()
                .items.some(
                    (item) =>
                        item.listingId === baseAuction.auctionPublicId,
                ),
        ).toBe(true)
        expect(screen.getByRole('link')).toHaveAttribute(
            'href',
            '/auctions/01J3AUCTION0001',
        )
        useCompareStore.getState().clear()
    })
})
