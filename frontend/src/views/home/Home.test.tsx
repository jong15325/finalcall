import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import Home from './Home'
import {
    okEnvelope,
    renderWithProviders,
    signInForTest,
} from '@/test/renderWithProviders'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 홈 (FC-058).
 *
 * 이 파일이 고정하는 것:
 *  1. **홈이 자리표시자가 아니다** — 실제 경매 데이터와 아이템 아트가 렌더된다.
 *  2. **스크롤 0px 카운트다운** — `endAt` 파생이며 하드코딩이 아니다.
 *  3. **섹션별 에러 격리** — 한 섹션이 죽어도 다른 섹션은 산다.
 *  4. **`/shops` 를 부르지 않는다** — 백엔드에 컨트롤러가 없다(FC-048 전력).
 *  5. **속성이 글자로 읽힌다** — 색 구분이 사라진 자리를 라벨이 대신한다.
 *  6. 로그인 여부와 무관하게 홈이 보인다(공개 커머스).
 */

// 2026-07-19T12:00:00Z 고정. 카운트다운이 시계에 매달리지 않게 한다.
const NOW = Date.parse('2026-07-19T12:00:00Z')
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

function auction(overrides: Partial<AuctionSummary> = {}): AuctionSummary {
    return {
        auctionPublicId: 'A-001',
        status: 'ACTIVE',
        item: {
            typeCode: 1113,
            mainCategory: 1,
            subGroup: 1,
            element: 1,
            kind: 3,
            level: 9,
            skill1: 119,
            skill2: 382,
            skillPercent: 18,
            goldforceExpireAt: null,
            nameSnapshot: '물의 검 +9',
            specSnapshot: '공격데미지 4 증가',
        },
        startPrice: 10_000,
        buyNowPrice: null,
        highestBidAmount: null,
        bidCount: 0,
        startAt: null,
        endAt: at(4 * 60_000 + 31_000),
        // 라벨("판매자")과 값이 겹치지 않는 이름을 쓴다 — 겹치면 무엇을 찾았는지 모호해진다.
        sellerNickname: '대장장이길드',
        ...overrides,
    }
}

const page = (content: AuctionSummary[]) => ({
    content,
    nextCursor: null,
    hasNext: false,
})

interface StubOptions {
    closingSoon?: AuctionSummary[] | 'error'
    newListings?: AuctionSummary[] | 'error'
}

/** 네트워크 봉쇄 + 두 섹션 응답만 열어둔다. 예상 밖 URL 은 즉시 실패시킨다. */
function stubAuctions({
    closingSoon = [auction()],
    newListings = [auction({ auctionPublicId: 'A-100' })],
}: StubOptions = {}) {
    // init 까지 받는다 — 공개 GET 이 Authorization 을 붙이지 않는지 검사해야 한다.
    const fetchMock = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
            void init
            const url = String(input)

            if (url.includes('/auctions')) {
                const isClosingSoon = url.includes('endAt')
                const source = isClosingSoon ? closingSoon : newListings
                if (source === 'error') {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            code: 'COMMON_500',
                            message: '서버 오류',
                            timestamp: at(0),
                        }),
                        {
                            status: 500,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    )
                }
                return okEnvelope(page(source))
            }

            if (url.includes('/me/balance')) {
                return okEnvelope({
                    cashBalance: 0,
                    gameMoneyBalance: 0,
                    gameMoneyHeld: 0,
                    gameMoneyAvailable: 0,
                })
            }

            throw new Error(`예상치 못한 요청: ${url}`)
        },
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

beforeEach(() => {
    vi.setSystemTime(NOW)
})

describe('홈 — 자리표시자가 아니다', () => {
    it('두 섹션 제목이 데이터와 무관하게 즉시 렌더된다 (첫 화면이 백지가 아니다)', () => {
        stubAuctions()
        renderWithProviders(<Home />)

        // 아직 요청이 끝나지 않은 시점에도 껍데기는 서 있다.
        expect(
            screen.getByRole('heading', { name: '마감 임박' }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', { name: '새로 올라온 매물' }),
        ).toBeInTheDocument()
        expect(screen.getByTestId('closing-soon-skeleton')).toBeInTheDocument()
    })

    it('실제 경매가 렌더된다', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        expect(await screen.findAllByText('물의 검 +9')).not.toHaveLength(0)
        expect(screen.queryByText(/FC-055 라우팅 골격/)).not.toBeInTheDocument()
    })

    it('★ 아이템 아트가 실물로 뜬다 — 경로에 레벨·속성·종류가 실린다', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        const images = await screen.findAllByRole('img')
        const src = images[0].getAttribute('src')
        // level 9 · water · sword — 보정 없이 표시 레벨 그대로.
        expect(src).toBe('/art/items/level9/l/water/sword.png')
    })

    it('아트 대체 텍스트가 "이미지"가 아니라 그림의 내용을 적는다', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        const images = await screen.findAllByRole('img')
        const alt = images[0].getAttribute('alt') ?? ''
        expect(alt).toContain('물 속성')
        expect(alt).toContain('무기 · 검')
        expect(alt).toContain('9레벨')
    })
})

describe('스크롤 0px 카운트다운 — endAt 파생', () => {
    it('남은 시간이 endAt 에서 계산된다 (하드코딩 아님)', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        const countdowns = await screen.findAllByTestId('countdown')
        expect(countdowns[0]).toHaveAttribute(
            'dateTime',
            at(4 * 60_000 + 31_000),
        )
        expect(within(countdowns[0]).getByText('04:31')).toBeInTheDocument()
    })

    it('endAt 이 다르면 표기도 다르다 — 고정 문자열이 아니다', async () => {
        stubAuctions({
            closingSoon: [
                auction({ endAt: at(2 * 86_400_000 + 3 * 3_600_000) }),
            ],
        })
        renderWithProviders(<Home />)

        expect(await screen.findByText('2일 3시간')).toBeInTheDocument()
    })

    it('임박은 색이 아니라 글자로 전달된다 (색이 없으므로 유일한 채널)', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        expect(await screen.findAllByText('곧 마감')).not.toHaveLength(0)
    })

    it('★ "실시간 갱신" 류 문구를 쓰지 않는다 — 폴링하지 않는다', () => {
        stubAuctions()
        const { container } = renderWithProviders(<Home />)

        expect(container.textContent).not.toMatch(/실시간|자동 갱신|초마다/)
    })
})

describe('구조 변주 — 같은 리듬을 반복하지 않는다', () => {
    it('마감 임박은 피처드 1건 + 행목록, 새 매물은 격자다', async () => {
        stubAuctions({
            closingSoon: [
                auction({ auctionPublicId: 'A-1' }),
                auction({ auctionPublicId: 'A-2' }),
                auction({ auctionPublicId: 'A-3' }),
            ],
        })
        renderWithProviders(<Home />)

        expect(await screen.findByText('다음 마감')).toBeInTheDocument()
        // 피처드는 판매자까지 보여주는 가장 밀도 높은 표현이다(행목록·격자에는 없다).
        expect(screen.getByText('대장장이길드')).toBeInTheDocument()
    })
})

describe('속성 표시 — 색 구분이 사라진 자리', () => {
    it('★ 속성이 축 이름과 함께 글자로 읽힌다 ("물"이 아니라 "물 속성")', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        expect(await screen.findAllByText('물 속성')).not.toHaveLength(0)
    })

    it('속성·종류·레벨이 모두 텍스트로 존재한다 (색 단독 전달 없음)', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        const tags = (await screen.findAllByTestId('item-attribute-tags'))[0]
        expect(within(tags).getByText('물 속성')).toBeInTheDocument()
        expect(within(tags).getByText('무기 · 검')).toBeInTheDocument()
        expect(within(tags).getByText('Lv.9')).toBeInTheDocument()
    })
})

describe('가격 — 현재가와 시작가를 구분한다', () => {
    it('입찰이 없으면 "시작가"로 적는다', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        expect(await screen.findAllByText('시작가')).not.toHaveLength(0)
        expect(screen.queryByText('현재가')).not.toBeInTheDocument()
    })

    it('입찰이 있으면 "현재가" + 최고가', async () => {
        stubAuctions({
            closingSoon: [auction({ highestBidAmount: 42_000, bidCount: 3 })],
        })
        renderWithProviders(<Home />)

        expect(await screen.findAllByText('현재가')).not.toHaveLength(0)
        expect(screen.getByText('42,000')).toBeInTheDocument()
        expect(screen.getByText('입찰 3건')).toBeInTheDocument()
    })
})

describe('상태 설계', () => {
    it('빈 목록은 자리를 지우지 않고 다음 행동을 준다', async () => {
        stubAuctions({ closingSoon: [], newListings: [] })
        renderWithProviders(<Home />)

        expect(
            await screen.findByTestId('closing-soon-empty'),
        ).toBeInTheDocument()
        expect(screen.getByTestId('new-listings-empty')).toBeInTheDocument()
        // 섹션 제목이 남아 있다 — "여기가 원래 뭐가 있는 곳인지" 알 수 있다.
        expect(
            screen.getByRole('heading', { name: '마감 임박' }),
        ).toBeInTheDocument()
        expect(
            screen.getAllByRole('link', { name: '판매 등록하기' }),
        ).toHaveLength(2)
    })

    it('★★ 에러는 섹션별로 격리된다 — 한 섹션이 죽어도 나머지는 산다', async () => {
        stubAuctions({ closingSoon: 'error' })
        renderWithProviders(<Home />)

        expect(
            await screen.findByTestId('closing-soon-error'),
        ).toBeInTheDocument()
        // 다른 섹션은 자기 데이터로 정상 렌더된다.
        await waitFor(() =>
            expect(
                screen.queryByTestId('new-listings-skeleton'),
            ).not.toBeInTheDocument(),
        )
        expect(
            screen.queryByTestId('new-listings-error'),
        ).not.toBeInTheDocument()
        expect(screen.getAllByText('물의 검 +9').length).toBeGreaterThan(0)
    })

    it('에러 자리에도 다시 시도 + 대안 출구가 있다', async () => {
        stubAuctions({ newListings: 'error' })
        renderWithProviders(<Home />)

        await screen.findByTestId('new-listings-error')
        expect(
            screen.getByRole('button', { name: '다시 시도' }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', { name: '경매 전체 보기' }),
        ).toBeInTheDocument()
    })
})

describe('★ 계약에 있어도 구현이 없는 것은 부르지 않는다', () => {
    it('/shops 를 요청하지 않는다 (백엔드에 ShopController 가 없다 — FC-048 전력)', async () => {
        const fetchMock = stubAuctions()
        renderWithProviders(<Home />)

        await screen.findAllByTestId('countdown')

        const urls = fetchMock.mock.calls.map((call) => String(call[0]))
        expect(urls.some((url) => url.includes('/shops'))).toBe(false)
        expect(urls.some((url) => url.includes('/market-prices'))).toBe(false)
    })

    it('두 섹션이 각자 요청한다 — 정렬 파라미터가 계약 화이트리스트 안이다', async () => {
        const fetchMock = stubAuctions()
        renderWithProviders(<Home />)

        await screen.findAllByTestId('countdown')

        const urls = fetchMock.mock.calls.map((call) => String(call[0]))
        expect(
            urls.some(
                (url) =>
                    url.includes('status=ACTIVE') &&
                    url.includes('sort=endAt%2Casc'),
            ),
        ).toBe(true)
        expect(urls.some((url) => url.includes('sort=createdAt%2Cdesc'))).toBe(
            true,
        )
    })
})

describe('공개 커머스 — 로그인 여부와 무관하다', () => {
    it('비로그인도 매물을 본다', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        expect(await screen.findAllByText('물의 검 +9')).not.toHaveLength(0)
    })

    it('로그인해도 같은 내용을 본다 (로그인 사용자를 튕기지 않는다)', async () => {
        stubAuctions()
        signInForTest()
        renderWithProviders(<Home />)

        expect(await screen.findAllByText('물의 검 +9')).not.toHaveLength(0)
    })

    it('★ 목록 요청에 Authorization 을 붙이지 않는다 (공개 GET)', async () => {
        const fetchMock = stubAuctions()
        signInForTest()
        renderWithProviders(<Home />)

        await screen.findAllByTestId('countdown')

        const auctionCall = fetchMock.mock.calls.find((call) =>
            String(call[0]).includes('/auctions'),
        )
        const headers = new Headers(
            (auctionCall?.[1] as RequestInit | undefined)?.headers,
        )
        expect(headers.has('Authorization')).toBe(false)
    })
})
