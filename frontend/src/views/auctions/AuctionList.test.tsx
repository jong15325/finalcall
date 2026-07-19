import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuctionList from './AuctionList'
import {
    okEnvelope,
    renderWithProviders,
    stubMatchMedia,
} from '@/test/renderWithProviders'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 경매 목록 (FC-059).
 *
 * 이 파일이 고정하는 것:
 *  1. **자리표시자가 아니다** — 실제 카드가 렌더된다(홈과 **같은** `AuctionGridCard`).
 *  2. **★★ `kind` 종속이 화면에도 있다** — 대분류 전에는 종류 선택지가 없다.
 *  3. **필터 ↔ URL ↔ 요청**이 한 줄로 이어진다.
 *  4. **★ "N개 이상"** — 커서 페이지에는 총건수가 없다.
 *  5. **★ "더 보기"가 키보드로 닿는다** — 센티넬만으로는 접근 불가.
 *  6. **정렬 전환 시 커서 초기화**.
 *  7. **계약에 없는 컨트롤이 없다** — 자유문 검색·mainCategory·skill.
 *  8. 로딩·빈·에러, 그리고 **빈 결과에서 필터를 되돌릴 수단**.
 */

const NOW = Date.parse('2026-07-19T12:00:00Z')

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
        endAt: new Date(NOW + 3 * 3_600_000).toISOString(),
        sellerNickname: '대장장이길드',
        ...rest,
    }
}

const auctions = (count: number, prefix = 'A') =>
    Array.from({ length: count }, (_, index) =>
        auction({
            auctionPublicId: `${prefix}-${index + 1}`,
            item: { nameSnapshot: `${prefix} 아이템 ${index + 1}` } as never,
        }),
    )

interface StubOptions {
    /** 페이지를 순서대로 준다. `'error'` 면 500 */
    pages?: AuctionSummary[][] | 'error'
}

/** 요청 URL 을 전부 기록한다 — 무엇이 쿼리로 나갔는지가 이 화면의 핵심 검증이다. */
function stubAuctions({ pages = [[auction()]] }: StubOptions = {}) {
    const calls: string[] = []

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (!url.includes('/auctions'))
            throw new Error(`예상치 못한 요청: ${url}`)
        calls.push(url)

        if (pages === 'error') {
            return new Response(
                JSON.stringify({
                    success: false,
                    code: 'COMMON_500',
                    message: '서버 오류',
                    timestamp: '2026-07-19T12:00:00Z',
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        const cursor = new URL(url, 'http://localhost').searchParams.get(
            'cursor',
        )
        const index = cursor ? Number(cursor) : 0
        const content = pages[index] ?? []
        const hasNext = index + 1 < pages.length

        return okEnvelope({
            content,
            nextCursor: hasNext ? String(index + 1) : null,
            hasNext,
        })
    })

    vi.stubGlobal('fetch', fetchMock)
    return { calls, fetchMock }
}

/** 마지막 요청의 쿼리 파라미터. */
const lastQuery = (calls: string[]) =>
    new URL(calls[calls.length - 1], 'http://localhost').searchParams

beforeEach(() => {
    vi.setSystemTime(NOW)
})

describe('경매 목록 — 자리표시자가 아니다', () => {
    it('제목과 정렬은 데이터와 무관하게 즉시 렌더된다', () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        expect(
            screen.getByRole('heading', { name: '경매 목록', level: 1 }),
        ).toBeInTheDocument()
        expect(screen.getByTestId('auction-sort')).toBeInTheDocument()
        expect(screen.getByTestId('auction-list-skeleton')).toBeInTheDocument()
    })

    it('실제 경매 카드가 렌더된다 — 홈과 같은 카드 컴포넌트', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        expect(await screen.findByText('물의 검 +9')).toBeInTheDocument()
        // 홈과 공유하는 `ItemArtSlot` 이 그대로 쓰인다(레벨 칩·아웃라인 프레임).
        expect(screen.getByTestId('item-art-frame')).toBeInTheDocument()
        expect(screen.getByTestId('item-level-chip')).toHaveTextContent('Lv.9')
        expect(screen.queryByText(/FC-055 라우팅 골격/)).not.toBeInTheDocument()
    })

    it('기본 쿼리는 마감 임박순이고 status 를 걸지 않는다', async () => {
        const { calls } = stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        const query = lastQuery(calls)
        expect(query.get('sort')).toBe('endAt,asc')
        expect(query.has('status')).toBe(false)
        expect(query.has('cursor')).toBe(false)
    })
})

describe('★★ kind 종속을 화면이 푼다 (계약 §4.1)', () => {
    it('대분류를 고르기 전에는 종류 선택지가 아예 없고, 왜 없는지 화면이 말한다', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        expect(screen.queryByTestId('filter-kind')).not.toBeInTheDocument()
        expect(screen.getByTestId('kind-dependency-hint')).toHaveTextContent(
            /대분류를 고르면 종류를 고를 수 있습니다/,
        )
    })

    it('★ 대분류를 고르면 종류가 나타나고 라벨이 "무기 종류" 다 — 라벨이 곧 다의성 해소', async () => {
        stubAuctions()
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        await user.click(screen.getByRole('radio', { name: '무기' }))

        const kindGroup = await screen.findByTestId('filter-kind')
        expect(within(kindGroup).getByText('무기 종류')).toBeInTheDocument()
        expect(
            within(kindGroup).getByRole('radio', { name: '검' }),
        ).toBeInTheDocument()
    })

    it('마법을 고르면 종류가 2개뿐이다 — kind 3·4 는 존재하지 않는다(§3.3.1)', async () => {
        stubAuctions()
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        await user.click(screen.getByRole('radio', { name: '마법' }))

        const kindGroup = await screen.findByTestId('filter-kind')
        // 전체 + 일반 + 특수 = 3. 도끼/방패 계열이 새어 들어오면 여기서 잡힌다.
        expect(within(kindGroup).getAllByRole('radio')).toHaveLength(3)
        expect(
            within(kindGroup).queryByRole('radio', { name: '검' }),
        ).toBeNull()
    })

    it('★ 대분류를 바꾸면 이전 종류가 URL·요청에서 사라진다 (성립 불가 조합 차단)', async () => {
        const { calls } = stubAuctions()
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, {
            route: '/auctions?subGroup=1&kind=3',
        })

        await screen.findByText('물의 검 +9')
        expect(lastQuery(calls).get('kind')).toBe('3')

        await user.click(screen.getByRole('radio', { name: '마법' }))

        await waitFor(() => {
            expect(lastQuery(calls).get('subGroup')).toBe('3')
        })
        expect(lastQuery(calls).has('kind')).toBe(false)
    })

    it('URL 에 kind 만 실려 들어와도 요청에 나가지 않는다', async () => {
        const { calls } = stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions?kind=1' })

        await screen.findByText('물의 검 +9')
        expect(lastQuery(calls).has('kind')).toBe(false)
    })
})

describe('필터 ↔ URL ↔ 요청', () => {
    it('URL 의 필터가 그대로 요청 쿼리가 된다', async () => {
        const { calls } = stubAuctions()
        renderWithProviders(<AuctionList />, {
            route: '/auctions?subGroup=2&kind=1&element=3&minLevel=2&maxLevel=8&goldforceActive=true&minPrice=100&maxPrice=900&status=SOLD',
        })

        await screen.findByText('물의 검 +9')
        const query = lastQuery(calls)
        expect(query.get('subGroup')).toBe('2')
        expect(query.get('kind')).toBe('1')
        expect(query.get('element')).toBe('3')
        expect(query.get('minLevel')).toBe('2')
        expect(query.get('maxLevel')).toBe('8')
        expect(query.get('goldforceActive')).toBe('true')
        expect(query.get('minPrice')).toBe('100')
        expect(query.get('maxPrice')).toBe('900')
        expect(query.get('status')).toBe('SOLD')
    })

    it('속성을 고르면 요청에 실리고 칩 줄에 글자로 남는다', async () => {
        const { calls } = stubAuctions()
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        await user.click(
            within(screen.getByTestId('filter-element')).getByRole('radio', {
                name: '불',
            }),
        )

        await waitFor(() => {
            expect(lastQuery(calls).get('element')).toBe('2')
        })
        expect(screen.getByTestId('active-chip-element')).toHaveTextContent(
            '불 속성',
        )
    })

    it('칩을 누르면 그 축만 풀린다', async () => {
        const { calls } = stubAuctions()
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, {
            route: '/auctions?element=2&goldforceActive=true',
        })

        await screen.findByText('물의 검 +9')
        await user.click(screen.getByTestId('active-chip-element'))

        await waitFor(() => {
            expect(lastQuery(calls).has('element')).toBe(false)
        })
        expect(lastQuery(calls).get('goldforceActive')).toBe('true')
    })

    it('전체 해제는 필터만 지우고 정렬은 남긴다', async () => {
        const { calls } = stubAuctions()
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, {
            route: '/auctions?element=2&goldforceActive=true&sort=price,desc',
        })

        await screen.findByText('물의 검 +9')
        await user.click(screen.getByTestId('clear-all-filters'))

        await waitFor(() => {
            expect(lastQuery(calls).has('element')).toBe(false)
        })
        expect(lastQuery(calls).get('sort')).toBe('price,desc')
    })
})

describe('★ 커서 페이징', () => {
    it('총건수가 없으므로 "N개 이상" 이라고 적는다', async () => {
        stubAuctions({ pages: [auctions(3), auctions(2, 'B')] })
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('A 아이템 1')
        expect(screen.getByTestId('auction-list-count')).toHaveTextContent(
            '3개 이상',
        )
    })

    it('마지막 페이지까지 받으면 그때는 정확한 수다', async () => {
        stubAuctions({ pages: [auctions(3), auctions(2, 'B')] })
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('A 아이템 1')
        await user.click(screen.getByTestId('auction-list-more'))

        await screen.findByText('B 아이템 1')
        expect(screen.getByTestId('auction-list-count')).toHaveTextContent(
            '5개',
        )
        expect(screen.getByTestId('auction-list-count')).not.toHaveTextContent(
            '이상',
        )
    })

    it('★★ "더 보기" 는 키보드로 닿는다 — 센티넬만으로는 접근 불가', async () => {
        stubAuctions({ pages: [auctions(3), auctions(2, 'B')] })
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('A 아이템 1')
        const more = screen.getByRole('button', { name: '더 보기' })
        more.focus()
        await user.keyboard('{Enter}')

        expect(await screen.findByText('B 아이템 1')).toBeInTheDocument()
        // 앞 페이지가 사라지지 않고 이어 붙는다.
        expect(screen.getByText('A 아이템 1')).toBeInTheDocument()
    })

    it('다음 페이지 요청에 커서가 실린다', async () => {
        const { calls } = stubAuctions({
            pages: [auctions(3), auctions(2, 'B')],
        })
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('A 아이템 1')
        await user.click(screen.getByTestId('auction-list-more'))

        await screen.findByText('B 아이템 1')
        expect(lastQuery(calls).get('cursor')).toBe('1')
    })

    it('마지막 페이지에서는 "더 보기" 가 사라진다', async () => {
        stubAuctions({ pages: [auctions(3)] })
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('A 아이템 1')
        expect(
            screen.queryByTestId('auction-list-more'),
        ).not.toBeInTheDocument()
    })

    it('★ 정렬을 바꾸면 커서가 초기화된다 — 옛 정렬의 커서로 새 정렬을 요청하지 않는다', async () => {
        const { calls } = stubAuctions({
            pages: [auctions(3), auctions(2, 'B')],
        })
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('A 아이템 1')
        await user.click(screen.getByTestId('auction-list-more'))
        await screen.findByText('B 아이템 1')

        await user.selectOptions(
            screen.getByTestId('auction-sort'),
            'price,asc',
        )

        await waitFor(() => {
            expect(lastQuery(calls).get('sort')).toBe('price,asc')
        })
        expect(lastQuery(calls).has('cursor')).toBe(false)
    })
})

describe('★ 계약에 없는 컨트롤이 없다', () => {
    it('자유문 검색 입력이 없다 — 계약에 q/keyword 가 없다', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
        expect(
            screen.queryByPlaceholderText(/검색|찾기/),
        ).not.toBeInTheDocument()
    })

    it('상품군(mainCategory)·스킬 필터가 없다', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        expect(screen.queryByText(/상품군/)).not.toBeInTheDocument()
        expect(screen.queryByText(/^스킬/)).not.toBeInTheDocument()
    })

    it('정렬 선택지에 "인기순"(bidCount)이 없다', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        const options = within(screen.getByTestId('auction-sort')).getAllByRole(
            'option',
        )
        expect(options.map((option) => option.textContent)).not.toContain(
            '인기순',
        )
    })
})

describe('상태 — 로딩·빈·에러', () => {
    it('★ 기본 목록에 종료 경매가 없다는 사실을 화면이 적는다', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        expect(
            await screen.findByText(
                /기본 목록에는 종료된 경매가 포함되지 않습니다/,
            ),
        ).toBeInTheDocument()
    })

    it('필터 없는 빈 결과는 판매 등록으로 안내한다', async () => {
        stubAuctions({ pages: [[]] })
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        expect(
            await screen.findByTestId('auction-list-empty'),
        ).toBeInTheDocument()
        expect(
            screen.queryByTestId('auction-list-empty-filtered'),
        ).not.toBeInTheDocument()
    })

    it('★ 필터 걸린 빈 결과는 되돌릴 수단을 준다', async () => {
        const { calls } = stubAuctions({ pages: [[]] })
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, {
            route: '/auctions?element=2&minLevel=9',
        })

        const empty = await screen.findByTestId('auction-list-empty-filtered')
        expect(empty).toBeInTheDocument()

        await user.click(screen.getByTestId('empty-reset-filters'))
        await waitFor(() => {
            expect(lastQuery(calls).has('element')).toBe(false)
        })
    })

    it('에러는 다시 시도를 준다 (필터는 남는다)', async () => {
        stubAuctions({ pages: 'error' })
        renderWithProviders(<AuctionList />, { route: '/auctions?element=2' })

        expect(
            await screen.findByTestId('auction-list-error'),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: '다시 시도' }),
        ).toBeInTheDocument()
        // 필터 칩은 그대로 — 실패했다고 사용자의 조건을 지우지 않는다.
        expect(screen.getByTestId('active-chip-element')).toBeInTheDocument()
    })
})

describe('모바일 필터 시트', () => {
    it('시트를 열기 전에는 DOM 에 없다', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        expect(screen.queryByTestId('filter-sheet')).not.toBeInTheDocument()
    })

    it('★ 시트가 모달로 열리고 Escape 로 닫히며 초점이 트리거로 돌아온다', async () => {
        stubAuctions()
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        const trigger = screen.getByTestId('filter-sheet-trigger')
        await user.click(trigger)

        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toHaveAccessibleName('필터')

        await user.keyboard('{Escape}')

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
        expect(trigger).toHaveFocus()
    })

    /*
     * ══════════════════════════════════════════════════════════════════════════
     * ★★ FC-064 리뷰 C-1 회귀 — **부모 리렌더가 시트의 초점을 뺏으면 안 된다.**
     * ══════════════════════════════════════════════════════════════════════════
     * `Sheet` 의 초점 effect 가 `onClose` 에 의존하던 시절, 소비처가 인라인 화살표를 넘기므로
     * **리렌더마다 effect 가 재실행**돼 초점이 패널로 튀었다. 이 화면은 글자 하나마다
     * `setSearchParams` 로 리렌더하므로 **첫 글자 뒤 나머지가 전부 유실**된다.
     * (모바일 입찰 시트에서는 같은 원인으로 소프트 키보드가 매초 닫혔다.)
     * 이 테스트는 수정 전 코드에서 `1000` 대신 `1` 만 남아 실패한다.
     */
    it('★★ 시트 입력에 연속으로 타이핑해도 초점과 값이 유지된다 (C-1 회귀)', async () => {
        stubAuctions()
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        await user.click(screen.getByTestId('filter-sheet-trigger'))

        const dialog = await screen.findByRole('dialog')
        const minPrice = within(dialog).getByRole('spinbutton', {
            name: '가격 최소',
        })

        await user.click(minPrice)
        await user.type(minPrice, '1000')

        expect(minPrice).toHaveValue(1000)
        expect(minPrice).toHaveFocus()
    })

    /*
     * ★ 리뷰 m-6 — 시트를 연 채 데스크톱 폭이 되면 **스스로 닫혀야** 한다.
     *   클래스로 감추기만 하면 열림 상태가 남아 배경 스크롤 잠금과 초점 가둠이
     *   보이지 않는 채로 계속된다("보이지 않는 다이얼로그에 갇힘").
     */
    it('★ 데스크톱 폭으로 넓어지면 시트가 스스로 닫힌다 (m-6 회귀)', async () => {
        stubAuctions()
        const user = userEvent.setup()
        const media = stubMatchMedia()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        await user.click(screen.getByTestId('filter-sheet-trigger'))
        await screen.findByRole('dialog')

        media.setMatches('(min-width: 1024px)', true)

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
        // 배경 스크롤 잠금도 함께 풀린다 — 잠금만 남으면 페이지가 굳는다.
        expect(document.body.style.overflow).not.toBe('hidden')
    })

    it('★ 시트와 레일이 같은 폼이다 — 시트에서 고른 필터가 그대로 요청에 나간다', async () => {
        const { calls } = stubAuctions()
        const user = userEvent.setup()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        await user.click(screen.getByTestId('filter-sheet-trigger'))

        const dialog = await screen.findByRole('dialog')
        await user.click(within(dialog).getByRole('radio', { name: '방어구' }))

        await waitFor(() => {
            expect(lastQuery(calls).get('subGroup')).toBe('2')
        })
        // 시트 안에서도 종류가 종속으로 나타난다(폼이 하나라 자동이다).
        expect(within(dialog).getByText('방어구 종류')).toBeInTheDocument()
    })

    it('필터 버튼이 적용된 개수를 숫자로 알린다 (시트를 닫아도 보인다)', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, {
            route: '/auctions?element=2&goldforceActive=true',
        })

        await screen.findByText('물의 검 +9')
        expect(screen.getByTestId('filter-sheet-trigger')).toHaveTextContent(
            '2',
        )
    })
})

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * 회귀 가드 — **취향이 아니라 측정된 정확성**만 단언한다.
 * ══════════════════════════════════════════════════════════════════════════════
 * 평소 원칙은 "클래스를 단언하지 않는다"이나, 아래 항목들은
 *   · 폭 계산으로 파손이 실증된 지점(FC-058 파손 1·3)
 *   · 대비 수치로 미달이 실증된 지점(WCAG 1.4.11)
 * 이라 **고정하는 것이 취향이 아니라 정확성**이다(FC-057·058 가드와 같은 성격).
 */
describe('회귀 가드 — 모바일 우선·대비', () => {
    it('★ 루트에 가로 넘침 가드가 있다 (FC-058 파손 3)', async () => {
        stubAuctions()
        const { container } = renderWithProviders(<AuctionList />, {
            route: '/auctions',
        })

        await screen.findByText('물의 검 +9')
        const root = container.firstElementChild as HTMLElement
        expect(root.className).toContain('max-w-full')
        expect(root.className).toContain('overflow-x-hidden')
    })

    it('★ 격자는 1열에서 시작한다 — grid-cols-2 기본이 FC-058 파손 1의 원인이었다', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        const grid = await screen.findByTestId('auction-list-grid')
        expect(grid.className).toContain('grid-cols-1')
        // 좁은 폭에서 즉시 2열로 가지 않는다(sm 이상에서만).
        expect(grid.className).not.toMatch(/(^|\s)grid-cols-2(\s|$)/)
    })

    it('★ 스켈레톤도 같은 열 수 규칙이다 — 로딩이 끝날 때 레이아웃이 튀지 않는다', () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        const skeleton = screen.getByTestId('auction-list-skeleton')
        expect(skeleton.className).toContain('grid-cols-1')
        expect(skeleton.className).toContain('sm:grid-cols-2')
    })

    it('★ 필터 칩 테두리는 gray-500 이다 — gray-200 은 흰 면 위 1.26 으로 경계가 사라진다', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions' })

        await screen.findByText('물의 검 +9')
        const chip = within(screen.getByTestId('filter-element'))
            .getByRole('radio', { name: '불' })
            .closest('label') as HTMLElement
        expect(chip.className).toContain('border-gray-500')
    })

    it('★ 적용 필터 칩 테두리도 gray-500 이다 (페이지 배경 위 4.35)', async () => {
        stubAuctions()
        renderWithProviders(<AuctionList />, { route: '/auctions?element=2' })

        await screen.findByText('물의 검 +9')
        expect(screen.getByTestId('active-chip-element').className).toContain(
            'border-gray-500',
        )
    })
})
