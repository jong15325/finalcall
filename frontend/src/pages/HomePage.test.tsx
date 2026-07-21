import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { okEnvelope, renderWithProviders } from '@/test/renderWithProviders'
import HomePage from './HomePage'
import type { AuctionSummary } from '@/lib/api/auctions'
import type { CursorPage } from '@/types/api'

/**
 * 홈 `/` (FC-070 — design-brief B-1 · 목업 `#home`).
 *
 * 고정하는 것:
 *  1. **마감 임박 = 실연동 프리뷰** + **클라 마감 제외** — endAt 지난(서버는 여전히 ACTIVE) 경매는
 *     안 보이고, 살아있는 경매만 카드로 뜬다.
 *  2. 배너 캐러셀이 렌더된다(프로모션 배너 region).
 *  3. **추천 마켓·공지는 자리보류** — "준비 중"/"연동 예정" 비활성 표기(호출 없이 404 방지).
 */

function makeAuction(overrides: Partial<AuctionSummary>): AuctionSummary {
    return {
        auctionPublicId: 'A-DEFAULT',
        status: 'ACTIVE',
        item: {
            typeCode: 1123,
            mainCategory: 1,
            subGroup: 1,
            element: 2,
            kind: 1,
            level: 3,
            skill1: null,
            skill2: null,
            skillPercent: 0,
            goldforceExpireAt: null,
            nameSnapshot: '기본 아이템',
            specSnapshot: '설명',
        },
        startPrice: 1_000_000,
        buyNowPrice: null,
        highestBidAmount: null,
        bidCount: 0,
        startAt: null,
        endAt: new Date(Date.now() + 3_600_000).toISOString(),
        sellerNickname: '판매자',
        ...overrides,
    }
}

function stubAuctions(content: AuctionSummary[]) {
    const page: CursorPage<AuctionSummary> = {
        content,
        nextCursor: null,
        hasNext: false,
    }
    vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(okEnvelope(page))),
    )
}

describe('<HomePage>', () => {
    it('배너·추천 마켓·공지 자리보류가 항상 렌더된다', async () => {
        stubAuctions([])
        renderWithProviders(<HomePage />)

        expect(
            screen.getByRole('region', { name: '프로모션 배너' }),
        ).toBeInTheDocument()
        // 추천 마켓·공지는 API 호출 없이 비활성 자리로만 존재한다.
        expect(screen.getByText('준비 중')).toBeInTheDocument()
        expect(screen.getByText('연동 예정')).toBeInTheDocument()

        await waitFor(() =>
            expect(
                screen.getByText('지금 마감 임박한 경매가 없어요'),
            ).toBeInTheDocument(),
        )
    })

    it('★ 살아있는 경매만 카드로 뜨고, endAt 지난 경매는 걸러진다(클라 마감 판정)', async () => {
        stubAuctions([
            makeAuction({
                auctionPublicId: 'A-LIVE',
                item: {
                    ...makeAuction({}).item,
                    nameSnapshot: '살아있는 검',
                },
                endAt: new Date(Date.now() + 1_800_000).toISOString(),
            }),
            makeAuction({
                auctionPublicId: 'A-ENDED',
                status: 'ACTIVE', // 서버는 여전히 ACTIVE
                item: {
                    ...makeAuction({}).item,
                    nameSnapshot: '끝난 활',
                },
                endAt: new Date(Date.now() - 60_000).toISOString(),
            }),
        ])

        renderWithProviders(<HomePage />)

        await waitFor(() =>
            expect(
                screen.getByRole('link', { name: '살아있는 검 경매 상세 보기' }),
            ).toBeInTheDocument(),
        )
        expect(
            screen.queryByRole('link', { name: '끝난 활 경매 상세 보기' }),
        ).not.toBeInTheDocument()
    })
})
