import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import BidPanel from './BidPanel'
import type { AuctionDetail } from '@/lib/api/auctions'

/**
 * 입찰 패널 CTA 분기 (FC-072).
 *
 * 고정하는 것:
 *  1. 상태별 CTA(마감 비활성 / 비로그인 로그인유도 / 판매자 취소 / 진행 입찰).
 *  2. **즉시구매 버튼을 만들지 않는다**(404, §5) — buyNowPrice 는 참고가 표기만.
 *  3. 판매자 취소는 입찰 0건일 때만 활성(DOM disabled 속성).
 */

const NOW = Date.parse('2026-07-21T00:00:00Z')

const baseAuction: AuctionDetail = {
    auctionPublicId: '01J3AUCTION0001',
    status: 'ACTIVE',
    item: {
        typeCode: 1123,
        mainCategory: 1,
        subGroup: 1,
        element: 2,
        kind: 3,
        level: 5,
        skill1: 104,
        skill2: 207,
        skillPercent: 18,
        goldforceExpireAt: null,
        nameSnapshot: '불의 전투도끼',
        specSnapshot: '한손 도끼',
    },
    startPrice: 1_000_000,
    buyNowPrice: 3_900_000,
    highestBidAmount: 2_480_000,
    bidCount: 3,
    startAt: null,
    endAt: '2026-07-21T01:00:00Z',
    sellerNickname: '토르',
    resultType: null,
    highestBidderMasked: 'le***',
    extensionCount: 1,
    maxEndAt: '2026-07-21T02:00:00Z',
    createdAt: '2026-07-20T00:00:00Z',
    minNextBidAmount: 2_600_000,
}

const noop = () => {}

function renderPanel(overrides: Partial<Parameters<typeof BidPanel>[0]> = {}) {
    return renderWithProviders(
        <BidPanel
            isAuthed
            auction={baseAuction}
            phase="live"
            now={NOW}
            balance={undefined}
            isOwn={false}
            loginHref="/login?redirectUrl=%2Fauctions%2F01J3AUCTION0001"
            cancelPending={false}
            cancelError={null}
            onBid={noop}
            onCancel={noop}
            {...overrides}
        />,
    )
}

describe('<BidPanel>', () => {
    it('진행 + 로그인 + 타인 경매 → "입찰하기" 버튼', () => {
        const onBid = vi.fn()
        renderPanel({ onBid })
        const button = screen.getByRole('button', { name: '입찰하기' })
        button.click()
        expect(onBid).toHaveBeenCalledOnce()
    })

    it('마감(now>=endAt 판정)이면 "입찰 마감" DOM disabled', () => {
        renderPanel({ phase: 'ended' })
        expect(screen.getByRole('button', { name: '입찰 마감' })).toBeDisabled()
        expect(
            screen.queryByRole('button', { name: '입찰하기' }),
        ).not.toBeInTheDocument()
    })

    it('비로그인이면 로그인 유도 링크(returnUrl 포함)', () => {
        renderPanel({ isAuthed: false })
        const link = screen.getByRole('link', { name: '로그인하고 입찰' })
        expect(link).toHaveAttribute(
            'href',
            '/login?redirectUrl=%2Fauctions%2F01J3AUCTION0001',
        )
    })

    it('판매자 본인 + 입찰 0건 → "경매 취소" 활성', () => {
        const onCancel = vi.fn()
        renderPanel({
            isOwn: true,
            auction: { ...baseAuction, bidCount: 0 },
            onCancel,
        })
        const button = screen.getByRole('button', { name: '경매 취소' })
        expect(button).toBeEnabled()
        button.click()
        expect(onCancel).toHaveBeenCalledOnce()
        // 입찰 버튼은 숨긴다.
        expect(
            screen.queryByRole('button', { name: '입찰하기' }),
        ).not.toBeInTheDocument()
    })

    it('판매자 본인 + 입찰 존재 → "경매 취소" DOM disabled + 안내', () => {
        renderPanel({ isOwn: true })
        expect(screen.getByRole('button', { name: '경매 취소' })).toBeDisabled()
        expect(
            screen.getByText('입찰이 있어 취소할 수 없습니다.'),
        ).toBeInTheDocument()
    })

    it('★ 즉시구매 버튼을 만들지 않는다(404) — 참고가만 표기', () => {
        renderPanel()
        expect(screen.getByText('즉시구매 참고가')).toBeInTheDocument()
        expect(
            screen.queryByRole('button', { name: /즉시구매/ }),
        ).not.toBeInTheDocument()
    })

    it('최고입찰자 마스킹을 표기한다(원문 아님)', () => {
        renderPanel()
        expect(screen.getByText('최고 입찰자 le***')).toBeInTheDocument()
    })
})
