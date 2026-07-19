import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from './Home'
import {
    okEnvelope,
    renderWithProviders,
    signInForTest,
} from '@/test/renderWithProviders'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 홈 (FC-058 → 사용자 피드백 재작업).
 *
 * 이 파일이 고정하는 것:
 *  1. **홈이 자리표시자가 아니다** — 실제 경매 데이터와 아이템 아트가 렌더된다.
 *  2. **스크롤 0px 카운트다운** — `endAt` 파생이며 하드코딩이 아니다.
 *  3. **섹션별 에러 격리** — 한 섹션이 죽어도 다른 섹션은 산다.
 *  4. **`/shops` 를 부르지 않는다** — 백엔드에 컨트롤러가 없다(FC-048 전력).
 *  5. **★ 태그를 지웠어도 정보가 남는다** — `alt`·레벨 칩·골드포스 칩.
 *  6. **★ 아웃라인이 아트에 밀착한다** — 카드 테두리가 아니다(§5.12).
 *  7. **★ AI 시세 자리에 동작하는 컨트롤이 없다** — 계약에 없는 기능이다.
 *  8. 로그인 여부와 무관하게 홈이 보인다(공개 커머스).
 */

// 2026-07-19T12:00:00Z 고정. 카운트다운이 시계에 매달리지 않게 한다.
const NOW = Date.parse('2026-07-19T12:00:00Z')
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

function auction(overrides: Partial<AuctionSummary> = {}): AuctionSummary {
    const { item, ...rest } = overrides
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
            ...item,
        },
        startPrice: 10_000,
        buyNowPrice: null,
        highestBidAmount: null,
        bidCount: 0,
        startAt: null,
        endAt: at(4 * 60_000 + 31_000),
        sellerNickname: '대장장이길드',
        ...rest,
    }
}

/** n건을 서로 다른 id 로 만든다 — 캐러셀·대기열 분배를 검사하려면 여러 건이 필요하다. */
const auctions = (count: number, overrides: Partial<AuctionSummary> = {}) =>
    Array.from({ length: count }, (_, index) =>
        auction({
            auctionPublicId: `A-${index + 1}`,
            endAt: at((index + 1) * 60_000),
            ...overrides,
        }),
    )

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
    it('섹션 제목이 데이터와 무관하게 즉시 렌더된다 (첫 화면이 백지가 아니다)', () => {
        stubAuctions()
        renderWithProviders(<Home />)

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
        // level 9 · water · sword — 보정 없이 표시 레벨 그대로.
        expect(images[0].getAttribute('src')).toBe(
            '/art/items/level9/l/water/sword.png',
        )
    })
})

describe('★ 태그를 지웠어도 정보가 사라지지 않는다', () => {
    it('속성 태그 알약이 더 이상 없다 (사용자 지시)', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        await screen.findAllByTestId('countdown')
        expect(
            screen.queryByTestId('item-attribute-tags'),
        ).not.toBeInTheDocument()
    })

    it('★ 속성·종류·레벨이 대체 텍스트에 온전히 남는다 (유일한 스크린리더 경로)', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        const images = await screen.findAllByRole('img')
        const alt = images[0].getAttribute('alt') ?? ''
        expect(alt).toContain('물 속성')
        expect(alt).toContain('무기 · 검')
        expect(alt).toContain('9레벨')
    })

    it('★ 레벨은 화면에도 남는다 — 이름이 말해주지 않는 유일한 축이기 때문', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        const chips = await screen.findAllByTestId('item-level-chip')
        expect(chips[0]).toHaveTextContent('Lv.9')
    })

    it('속성·종류는 이름이 이미 말한다 — 태그는 제목의 중복이었다', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        // "물의 검" 은 속성(물)과 종류(검)를 둘 다 담고 있다.
        expect(await screen.findAllByText('물의 검 +9')).not.toHaveLength(0)
    })
})

describe('★ 골드포스 아웃라인 (design-system §5.12)', () => {
    const withGoldforce = (offsetMs: number) =>
        auction({ item: { goldforceExpireAt: at(offsetMs) } } as never)

    it('활성이면 금 아웃라인, 아니면 블랙 아웃라인 — 같은 구조의 2겹', async () => {
        stubAuctions({
            closingSoon: [withGoldforce(86_400_000)],
            newListings: [auction({ auctionPublicId: 'A-plain' })],
        })
        renderWithProviders(<Home />)

        // 두 섹션이 **모두** 그려진 뒤에 센다 — 새 매물이 아직 로딩이면 마지막 프레임이
        // 골드포스 카드라 검사가 무의미해진다.
        await waitFor(() =>
            expect(screen.getAllByTestId('item-art-frame')).toHaveLength(2),
        )
        const frames = screen.getAllByTestId('item-art-frame')

        expect(frames[0]).toHaveClass('fc-outline-gold')
        expect(frames[0]).not.toHaveClass('fc-outline-black')
        expect(frames[1]).toHaveClass('fc-outline-black')
        expect(frames[1]).not.toHaveClass('fc-outline-gold')
    })

    it('★★ 아웃라인이 아트에 밀착한다 — 프레임이 <img> 를 직접 감싼다', async () => {
        stubAuctions({ closingSoon: [withGoldforce(86_400_000)] })
        renderWithProviders(<Home />)

        const frame = (await screen.findAllByTestId('item-art-frame'))[0]
        // 프레임 → 베벨 → img. 사이에 카드·레이아웃 요소가 끼면 밀착이 깨진다.
        const img = within(frame).getAllByRole('img')[0]
        expect(img.parentElement).toHaveClass('fc-art-bevel')
        expect(img.parentElement?.parentElement).toBe(frame)
    })

    it('★★ 아웃라인이 카드 테두리가 아니다 — 원본 문서가 기각한 안', async () => {
        stubAuctions({ closingSoon: [withGoldforce(86_400_000)] })
        renderWithProviders(<Home />)

        await screen.findAllByTestId('item-art-frame')
        // 금 클래스는 오직 아트 프레임에만 붙는다. 카드(.card)에 붙으면 안 된다.
        for (const el of document.querySelectorAll('.fc-outline-gold')) {
            expect(el).toHaveAttribute('data-testid', 'item-art-frame')
            expect(el.classList.contains('card')).toBe(false)
        }
    })

    it('두께가 아트 배율에서 파생된다 (--art-scale, §5.12 공식)', async () => {
        stubAuctions({ closingSoon: [withGoldforce(86_400_000)] })
        renderWithProviders(<Home />)

        const frame = (await screen.findAllByTestId('item-art-frame'))[0]
        // 마감 임박 카드는 아트 2배 → --art-scale: 2 (§5.12 사용자 확정값 = 5px).
        expect(frame.getAttribute('style')).toContain('--art-scale: 2')
    })

    it('★ 아웃라인을 전부 제거해도 정보 손실이 없다 — "골드포스"가 글자로 남는다', async () => {
        stubAuctions({ closingSoon: [withGoldforce(86_400_000)] })
        renderWithProviders(<Home />)

        // ① 본문 칩의 텍스트
        expect(await screen.findAllByText('골드포스')).not.toHaveLength(0)
        // ② 대체 텍스트
        const images = screen.getAllByRole('img')
        expect(images[0].getAttribute('alt')).toContain('골드포스')
    })

    it('만료된 골드포스는 활성이 아니다 (클라 파생 — 계약 §3.3)', async () => {
        stubAuctions({ closingSoon: [withGoldforce(-1000)] })
        renderWithProviders(<Home />)

        const frame = (await screen.findAllByTestId('item-art-frame'))[0]
        expect(frame).toHaveClass('fc-outline-black')
        expect(screen.queryByTestId('goldforce-chip')).not.toBeInTheDocument()
    })

    it('셰인은 골드포스에만 흐른다 (모두 반짝이면 희소성이 사라진다)', async () => {
        stubAuctions({
            closingSoon: [withGoldforce(86_400_000)],
            newListings: [auction({ auctionPublicId: 'A-plain' })],
        })
        renderWithProviders(<Home />)

        const shines = await screen.findAllByTestId('goldforce-shine')
        const frames = screen.getAllByTestId('item-art-frame')
        expect(shines).toHaveLength(1)
        expect(frames.length).toBeGreaterThan(1)
    })
})

/**
 * jsdom 은 레이아웃을 계산하지 않아 `clientWidth`/`scrollWidth` 가 0이다.
 * 캐러셀은 그 두 값으로 페이지를 세므로, **실제 브라우저의 치수를 주입**해 검사한다
 * (컴포넌트에 테스트용 분기를 심는 것보다 정직하다 — 프로덕션 경로를 그대로 탄다).
 */
function stubTrackSize(view: number, content: number) {
    const track = screen.getByTestId('carousel-track')
    Object.defineProperty(track, 'clientWidth', {
        value: view,
        configurable: true,
    })
    Object.defineProperty(track, 'scrollWidth', {
        value: content,
        configurable: true,
    })
    // 상태 갱신이 React 밖에서 일어나므로 act 로 감싸 렌더까지 흘려보낸다.
    act(() => {
        track.dispatchEvent(new Event('scroll'))
    })
    return track
}

describe('★ 마감 임박 — 하나의 영역, 하나의 캐러셀 (라이브러리 0)', () => {
    it('★★ 모든 매물이 한 캐러셀 안에 있다 — 피처드/행목록 분리가 없다', async () => {
        stubAuctions({ closingSoon: auctions(8) })
        renderWithProviders(<Home />)

        const carousel = await screen.findByTestId('snap-carousel')
        // 8건 전부가 같은 트랙의 슬라이드다.
        expect(within(carousel).getAllByRole('listitem')).toHaveLength(8)
        // 별도 "다음 마감" 목록이 더는 없다.
        expect(
            screen.queryByRole('heading', { name: '다음 마감' }),
        ).not.toBeInTheDocument()
    })

    it('마감 순서가 슬라이드 순서다 — 왼쪽이 가장 급하다', async () => {
        stubAuctions({ closingSoon: auctions(8) })
        renderWithProviders(<Home />)

        const carousel = await screen.findByTestId('snap-carousel')
        const slides = within(carousel).getAllByRole('listitem')
        const countdowns = slides.map((slide) =>
            within(slide).getByTestId('countdown').getAttribute('dateTime')!,
        )
        const asTime = countdowns.map((iso) => Date.parse(iso))
        expect(asTime).toEqual([...asTime].sort((a, b) => a - b))
    })

    it('데스크톱 3장 기준으로 8건이 3페이지가 된다 (3·3·2)', async () => {
        stubAuctions({ closingSoon: auctions(8) })
        renderWithProviders(<Home />)

        await screen.findByTestId('snap-carousel')
        stubTrackSize(900, 2400) // 한 화면 900px, 내용 2400px → 3페이지

        expect(screen.getByTestId('carousel-position')).toHaveTextContent(
            '1 / 3',
        )
    })

    it('다음 버튼이 한 화면분을 넘긴다 (보이는 것이 통째로 교체된다)', async () => {
        const user = userEvent.setup()
        stubAuctions({ closingSoon: auctions(8) })
        renderWithProviders(<Home />)

        await screen.findByTestId('snap-carousel')
        const track = stubTrackSize(900, 2400)
        const scrollBy = vi.fn()
        track.scrollBy = scrollBy

        await user.click(screen.getByRole('button', { name: '다음 매물' }))

        expect(scrollBy).toHaveBeenCalledWith({ left: 900 })
        expect(screen.getByTestId('carousel-position')).toHaveTextContent(
            '2 / 3',
        )
    })

    it('★ 양 끝에서 버튼이 비활성 — 누를 수 없는 곳으로 안내하지 않는다', async () => {
        stubAuctions({ closingSoon: auctions(8) })
        renderWithProviders(<Home />)

        await screen.findByTestId('snap-carousel')
        stubTrackSize(900, 2400)

        /*
         * ★ `toBeDisabled()` 가 아니라 `aria-disabled` 를 본다 — 템플릿 `ui/Button` 이
         *   `disabled` prop 을 DOM 에 전달하지 않고 클래스만 바꾸기 때문이다.
         *   보조기술이 실제로 읽는 신호를 검사한다(`SnapCarousel` 주석에 근거).
         */
        expect(
            screen.getByRole('button', { name: '이전 매물' }),
        ).toHaveAttribute('aria-disabled', 'true')
        expect(
            screen.getByRole('button', { name: '다음 매물' }),
        ).toHaveAttribute('aria-disabled', 'false')
    })

    it('★ 넘길 것이 없으면 컨트롤을 만들지 않는다 (동작 없는 버튼 금지)', async () => {
        stubAuctions({ closingSoon: [auction()] })
        renderWithProviders(<Home />)

        await screen.findByTestId('snap-carousel')
        stubTrackSize(900, 300) // 내용이 한 화면 안에 다 들어간다

        expect(
            screen.queryByRole('button', { name: '다음 매물' }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByTestId('carousel-position'),
        ).not.toBeInTheDocument()
    })

    it('마감 임박은 8건을 요청한다 (데스크톱 3열 기준 3페이지)', async () => {
        const fetchMock = stubAuctions()
        renderWithProviders(<Home />)

        await screen.findAllByTestId('countdown')
        const urls = fetchMock.mock.calls.map((call) => String(call[0]))
        expect(
            urls.some(
                (url) =>
                    url.includes('sort=endAt%2Casc') && url.includes('size=8'),
            ),
        ).toBe(true)
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

    it('★ "실시간 갱신" 류 문구를 쓰지 않는다 — 폴링하지 않는다', () => {
        stubAuctions()
        const { container } = renderWithProviders(<Home />)

        expect(container.textContent).not.toMatch(/실시간|자동 갱신|초마다/)
    })
})

describe('★ 마감 임박을 "마감 임박처럼" — 위계로 만든다', () => {
    it('임박 상태가 글자로 확정된다 (색이 아니라 낱말)', async () => {
        stubAuctions({ closingSoon: [auction({ endAt: at(60_000) })] })
        renderWithProviders(<Home />)

        const badge = await screen.findByTestId('urgency-badge')
        expect(badge).toHaveTextContent('곧 마감')
    })

    it('30초 미만은 "초읽기"로 한 단계 올라간다 (도메인 임계값 유지)', async () => {
        stubAuctions({ closingSoon: [auction({ endAt: at(10_000) })] })
        renderWithProviders(<Home />)

        const badge = await screen.findByTestId('urgency-badge')
        expect(badge).toHaveTextContent('초읽기')
        expect(badge).toHaveAttribute('data-urgency', 'critical')
    })

    it('★ 평시에는 배지가 없다 — 전부 강조하면 아무것도 강조되지 않는다', async () => {
        stubAuctions({ closingSoon: [auction({ endAt: at(3 * 86_400_000) })] })
        renderWithProviders(<Home />)

        await screen.findAllByTestId('countdown')
        expect(screen.queryByTestId('urgency-badge')).not.toBeInTheDocument()
    })

    it('★ 가짜 긴급성을 쓰지 않는다 (PRODUCT.md anti-reference)', () => {
        stubAuctions({ closingSoon: [auction({ endAt: at(10_000) })] })
        const { container } = renderWithProviders(<Home />)

        expect(container.textContent).not.toMatch(
            /지금 안 사면|서두르|놓치지|마지막 기회|단 하나/,
        )
    })
})

describe('밀도 — 피처드 카드가 가벼워졌다', () => {
    it('★ 판매자를 훑기 화면에서 뺐다 (상세로 옮긴다)', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        await screen.findAllByTestId('countdown')
        expect(screen.queryByText('대장장이길드')).not.toBeInTheDocument()
    })

    it('가격은 남는다 — 뺀 것은 밀도지 정보의 핵심이 아니다', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        expect(await screen.findAllByText('시작가')).not.toHaveLength(0)
        expect(screen.getAllByText('10,000').length).toBeGreaterThan(0)
    })

    it('입찰 건수는 급박함의 진짜 근거라 남긴다', async () => {
        stubAuctions({
            closingSoon: [auction({ highestBidAmount: 42_000, bidCount: 3 })],
        })
        renderWithProviders(<Home />)

        expect(await screen.findAllByText('현재가')).not.toHaveLength(0)
        expect(screen.getAllByText('입찰 3건').length).toBeGreaterThan(0)
    })
})

describe('★ AI 시세 — 자리만 잡는다', () => {
    it('영역이 존재하고 "준비 중"이라고 정직하게 말한다', async () => {
        stubAuctions()
        renderWithProviders(<Home />)

        const teaser = screen.getByTestId('market-insight-teaser')
        expect(within(teaser).getByText('AI 시세 분석')).toBeInTheDocument()
        expect(within(teaser).getByText('준비 중')).toBeInTheDocument()
        await screen.findAllByTestId('countdown')
    })

    it('★★ 동작하지 않는 컨트롤이 하나도 없다 (FC-057 검색 선례)', () => {
        stubAuctions()
        renderWithProviders(<Home />)

        const teaser = screen.getByTestId('market-insight-teaser')
        expect(within(teaser).queryByRole('button')).not.toBeInTheDocument()
        expect(within(teaser).queryByRole('link')).not.toBeInTheDocument()
        expect(within(teaser).queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('★ 가짜 시세 숫자를 그리지 않는다 — 진짜 시세로 오인되면 손해로 이어진다', () => {
        stubAuctions()
        renderWithProviders(<Home />)

        const teaser = screen.getByTestId('market-insight-teaser')
        expect(teaser.textContent ?? '').not.toMatch(/\d[\d,]{2,}/)
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
    it('/shops·/market-prices 를 요청하지 않는다 (AI 시세 자리가 생겨도 마찬가지)', async () => {
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
