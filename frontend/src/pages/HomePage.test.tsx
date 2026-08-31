import { cardInfoFixture } from '@/test/cardInfoFixture'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { okEnvelope, renderWithProviders } from '@/test/renderWithProviders'
import HomePage from './HomePage'
import type { AuctionSummary } from '@/lib/api/auctions'
import type { ShopRecommendationItem, ShopSummary } from '@/lib/api/shop'
import type { CursorPage } from '@/types/api'

/**
 * 홈 `/` (FC-070 — design-brief B-1 · 목업 `#home`).
 *
 * 고정하는 것:
 *  1. **마감 임박 = 실연동 프리뷰** + **클라 마감 제외** — endAt 지난(서버는 여전히 ACTIVE) 경매는
 *     안 보이고, 살아있는 경매만 카드로 뜬다.
 *  2. 배너 캐러셀이 렌더된다(프로모션 배너 region).
 *  3. **목업 섹션 헤드 유지** + **추천 마켓은 자리보류**(호출 없이 404 방지).
 *  4. **공지는 실연동**(FC-204) — `GET /boards/notice/posts`. 빈 응답이면 빈 상태 안내(가짜 데이터 없음).
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
            cardInfo: cardInfoFixture(),
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
    vi.stubGlobal('fetch', createHomeFetch(page, []))
}

function makeShop(overrides: Partial<ShopSummary> = {}): ShopSummary {
    return {
        shopPublicId: 'SHOP-HOME-1',
        status: 'ACTIVE',
        item: {
            typeCode: 1123,
            mainCategory: 1,
            subGroup: 1,
            element: 2,
            kind: 1,
            level: 3,
            skill1: 11,
            skill2: 202,
            skill1Name: '공격시간 감소',
            skill2Name: '체력 회복',
            skillPercent: 33,
            goldforceExpireAt: null,
            nameSnapshot: '추천 아이템',
            specSnapshot: '추천 아이템 설명',
            cardInfo: cardInfoFixture(),
        },
        price: 2_480_000,
        endAt: '2026-09-01T00:00:00Z',
        sellerNickname: '추천상점',
        sellerCompletedSales: 8,
        ...overrides,
    }
}

function createHomeFetch(
    auctionPage: CursorPage<AuctionSummary>,
    recommendations: readonly ShopRecommendationItem[],
) {
    return vi.fn((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input)
        if (url.includes('/home/shop-recommendations')) {
            return Promise.resolve(
                okEnvelope({
                    items: recommendations,
                    calculatedAt: '2026-08-31T03:00:00Z',
                }),
            )
        }
        if (url.includes('/auctions')) {
            return Promise.resolve(okEnvelope(auctionPage))
        }
        return Promise.resolve(
            okEnvelope({ content: [], nextCursor: null, hasNext: false }),
        )
    })
}

function stubHomeRecommendations(items: readonly ShopRecommendationItem[]) {
    const page: CursorPage<AuctionSummary> = {
        content: [],
        nextCursor: null,
        hasNext: false,
    }
    const fetchMock = createHomeFetch(page, items)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

describe('<HomePage>', () => {
    it('비인증 상태에서 공개 추천을 호출하고 카드·추천 근거·구매 모달을 연다', async () => {
        const fetchMock = stubHomeRecommendations([
            { reason: 'TRUSTED_SELLER', shop: makeShop() },
        ])
        renderWithProviders(<HomePage />)

        expect(
            await screen.findByText('완료 판매 5회 이상'),
        ).toBeInTheDocument()
        expect(screen.getByText('2,480,000')).toBeInTheDocument()
        const recommendationCall = fetchMock.mock.calls.find(([input]) => {
            const url = input instanceof Request ? input.url : String(input)
            return url.includes('/home/shop-recommendations')
        })
        expect(recommendationCall).toBeDefined()
        expect(
            fetchMock.mock.calls.some(([input]) => {
                const url = input instanceof Request ? input.url : String(input)
                return url.includes('/me/balance')
            }),
        ).toBe(false)

        fireEvent.click(screen.getByRole('button', { name: /카드정보 보기/ }))
        expect(
            await screen.findByRole('link', { name: '로그인하고 구매' }),
        ).toHaveAttribute('href', '/login')
    })

    it('추천 API 오류와 재시도를 추천 섹션 안에서 처리한다', async () => {
        let recommendationAttempts = 0
        const page: CursorPage<AuctionSummary> = {
            content: [],
            nextCursor: null,
            hasNext: false,
        }
        vi.stubGlobal(
            'fetch',
            vi.fn((input: RequestInfo | URL) => {
                const url = input instanceof Request ? input.url : String(input)
                if (url.includes('/home/shop-recommendations')) {
                    recommendationAttempts += 1
                    if (recommendationAttempts === 1) {
                        return Promise.resolve(
                            new Response(
                                JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'COMMON_500',
                                        message: '일시 오류',
                                    },
                                    timestamp: '2026-08-31T03:00:00Z',
                                }),
                                {
                                    status: 500,
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                },
                            ),
                        )
                    }
                    return Promise.resolve(
                        okEnvelope({
                            items: [{ reason: 'NEW', shop: makeShop() }],
                            calculatedAt: '2026-08-31T03:00:00Z',
                        }),
                    )
                }
                if (url.includes('/auctions')) {
                    return Promise.resolve(okEnvelope(page))
                }
                return Promise.resolve(
                    okEnvelope({
                        content: [],
                        nextCursor: null,
                        hasNext: false,
                    }),
                )
            }),
        )
        renderWithProviders(<HomePage />)

        fireEvent.click(
            await screen.findByRole('button', { name: '다시 시도' }),
        )
        expect(await screen.findByText('방금 등록')).toBeInTheDocument()
        expect(recommendationAttempts).toBe(2)
        expect(screen.getByText('오늘의 경매 마감 임박')).toBeInTheDocument()
        expect(screen.getByText('공지사항')).toBeInTheDocument()
    })

    it('배너·목업 섹션 헤드·자리보류가 항상 렌더된다', async () => {
        stubAuctions([])
        renderWithProviders(<HomePage />)

        expect(
            screen.getByRole('region', { name: '프로모션 배너' }),
        ).toBeInTheDocument()

        // 목업 #home 섹션 헤드(문구 그대로) 유지.
        expect(screen.getByText('오늘의 경매 마감 임박')).toBeInTheDocument()
        expect(screen.getByText('오늘의 추천 마켓')).toBeInTheDocument()
        expect(screen.getByText('공지사항')).toBeInTheDocument()

        await waitFor(() =>
            expect(
                screen.getByText('지금 추천할 수 있는 매물이 없어요'),
            ).toBeInTheDocument(),
        )

        await waitFor(() =>
            expect(
                screen.getByText('지금 마감 임박한 경매가 없어요'),
            ).toBeInTheDocument(),
        )
        // ★ 공지는 실연동 — 빈 응답이면 빈 상태 안내(가짜 제목·날짜 없음).
        await waitFor(() =>
            expect(
                screen.getByText('등록된 공지가 없어요.'),
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
                screen.getByRole('link', {
                    name: 'Lv.3 불도 경매 상세 보기',
                }),
            ).toBeInTheDocument(),
        )
        expect(
            screen.queryByRole('link', { name: '끝난 활 경매 상세 보기' }),
        ).not.toBeInTheDocument()
    })
})
