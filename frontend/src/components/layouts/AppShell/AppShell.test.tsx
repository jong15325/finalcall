import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import AppShell from './AppShell'
import {
    renderWithProviders,
    signInForTest,
    okEnvelope,
} from '@/test/renderWithProviders'
import { PRIMARY_DESTINATIONS, MOBILE_TAB_DESTINATIONS } from './navigation'

/**
 * 공용 셸 (FC-057).
 *
 * 이 파일이 고정하는 것:
 *  1. **비로그인도 셸을 본다** — 템플릿의 `authenticated` 셸 분기가 되살아나지 못하게 막는다.
 *  2. **내비 목적지가 백엔드 있는 것만** — 미구현 화면이 슬그머니 내비에 오르지 못하게 막는다.
 *  3. **잔액은 로그인일 때만 요청·표시** — 비로그인 401 폭주를 막는다.
 *  4. **데스크톱·모바일이 각각 존재** — 한쪽을 지우고 "반응형으로 접었다"고 하지 못하게 막는다.
 */

const BALANCE = {
    cashBalance: 50000,
    gameMoneyBalance: 1234567,
    gameMoneyHeld: 234567,
    gameMoneyAvailable: 1000000,
}

/** 네트워크를 봉쇄하고 잔액 응답만 열어둔다. */
function stubBalance() {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/me/balance')) return okEnvelope(BALANCE)
        throw new Error(`예상치 못한 요청: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

const desktopNav = () => screen.getByRole('navigation', { name: '주요 메뉴' })
const mobileNav = () => screen.getByRole('navigation', { name: '하단 탭 메뉴' })

beforeEach(() => {
    stubBalance()
})

describe('AppShell — 비로그인도 셸을 본다', () => {
    it('브랜드·내비·본문이 모두 렌더된다(셸 없는 화면이 아니다)', () => {
        renderWithProviders(<AppShell>본문</AppShell>)

        // 워드마크는 헤더 2곳(데스크톱·모바일) + 푸터 1곳에서 같은 컴포넌트로 나온다.
        expect(screen.getAllByText('FinalCall').length).toBeGreaterThan(0)
        expect(desktopNav()).toBeInTheDocument()
        expect(mobileNav()).toBeInTheDocument()
        expect(screen.getByText('본문')).toBeInTheDocument()
    })

    it('계정 자리가 비지 않는다 — 로그인·회원가입 CTA 가 지킨다', () => {
        renderWithProviders(<AppShell>본문</AppShell>)

        expect(
            screen.getAllByRole('link', { name: '로그인' }).length,
        ).toBeGreaterThan(0)
        expect(
            screen.getByRole('link', { name: '회원가입' }),
        ).toBeInTheDocument()
        // 계정 메뉴(드롭다운)는 로그인해야 나온다.
        expect(
            screen.queryByRole('button', { name: '계정 메뉴' }),
        ).not.toBeInTheDocument()
    })
})

describe('AppShell — 로그인 상태', () => {
    it('계정 메뉴가 나오고 로그인 CTA 는 사라진다', () => {
        signInForTest()
        renderWithProviders(<AppShell>본문</AppShell>)

        expect(
            screen.getAllByRole('button', { name: '계정 메뉴' }).length,
        ).toBeGreaterThan(0)
        expect(
            screen.queryByRole('link', { name: '회원가입' }),
        ).not.toBeInTheDocument()
    })

    it('셸 자체는 인증 여부와 무관하게 그대로다 — 내용물만 바뀐다', () => {
        signInForTest()
        renderWithProviders(<AppShell>본문</AppShell>)

        expect(desktopNav()).toBeInTheDocument()
        expect(mobileNav()).toBeInTheDocument()
    })
})

describe('AppShell — 내비 목적지', () => {
    it('데스크톱 내비는 백엔드가 있는 4곳만 싣는다', () => {
        renderWithProviders(<AppShell>본문</AppShell>)
        const links = within(desktopNav()).getAllByRole('link')

        expect(links.map((el) => el.textContent)).toEqual([
            '홈',
            '경매',
            '판매하기',
            '내 아이템',
        ])
        expect(links.map((el) => el.getAttribute('href'))).toEqual([
            '/',
            '/auctions',
            '/sell',
            '/me/inventory',
        ])
    })

    it('★ 백엔드 미구현 목적지를 내비에 올리지 않는다 (FC-048 재발 방지)', () => {
        renderWithProviders(<AppShell>본문</AppShell>)

        const shellHrefs = [
            ...within(desktopNav()).getAllByRole('link'),
            ...within(mobileNav()).getAllByRole('link'),
        ].map((el) => el.getAttribute('href'))

        for (const unbuilt of [
            '/shops',
            '/market-prices',
            '/me/orders',
            '/me/wallet',
        ]) {
            expect(shellHrefs).not.toContain(unbuilt)
        }
    })

    it('모바일 탭바는 5칸 고정이다 — 개수가 바뀌면 전 탭이 움직인다', () => {
        renderWithProviders(<AppShell>본문</AppShell>)

        expect(within(mobileNav()).getAllByRole('link')).toHaveLength(5)
        expect(MOBILE_TAB_DESTINATIONS).toHaveLength(5)
    })

    it('활성 항목만 aria-current 를 갖는다 (색 단독 전달 금지)', () => {
        renderWithProviders(<AppShell>본문</AppShell>, { route: '/auctions' })

        const current = within(desktopNav())
            .getAllByRole('link')
            .filter((el) => el.getAttribute('aria-current') === 'page')

        expect(current).toHaveLength(1)
        expect(current[0]).toHaveTextContent('경매')
    })

    it('홈은 정확히 일치할 때만 활성이다 — 아니면 모든 경로에서 활성이 된다', () => {
        renderWithProviders(<AppShell>본문</AppShell>, { route: '/auctions' })

        const home = within(desktopNav()).getByRole('link', { name: '홈' })
        expect(home).not.toHaveAttribute('aria-current')
    })

    it('하위 경로에서도 상위 목적지가 활성이다', () => {
        renderWithProviders(<AppShell>본문</AppShell>, {
            route: '/auctions/01JABCDEF',
        })

        expect(
            within(desktopNav()).getByRole('link', { name: '경매' }),
        ).toHaveAttribute('aria-current', 'page')
    })

    it('데스크톱과 모바일은 접기가 아니라 각각의 트리다', () => {
        renderWithProviders(<AppShell>본문</AppShell>)

        // 같은 목적지 집합에서 출발하되 모바일만 MY 를 더 갖는다.
        expect(within(desktopNav()).getAllByRole('link')).toHaveLength(
            PRIMARY_DESTINATIONS.length,
        )
        expect(
            within(mobileNav()).getByRole('link', { name: /MY/ }),
        ).toHaveAttribute('href', '/me/profile')
    })
})

describe('AppShell — 잔액 (계약 §4.4)', () => {
    it('비로그인이면 GET /me/balance 를 아예 부르지 않는다', async () => {
        const fetchMock = stubBalance()
        renderWithProviders(<AppShell>본문</AppShell>)

        await screen.findByText('본문')
        expect(fetchMock).not.toHaveBeenCalled()
        expect(
            screen.queryByTestId('balance-indicator'),
        ).not.toBeInTheDocument()
    })

    it('로그인이면 잔액을 불러 표시한다', async () => {
        signInForTest()
        renderWithProviders(<AppShell>본문</AppShell>)

        expect(await screen.findByText('50,000')).toBeInTheDocument()
        expect(screen.getAllByText('1,000,000').length).toBeGreaterThan(0)
    })

    it('★ 가용액을 "게임머니"라 부르지 않는다 — 홀드분만큼 잔액이 줄어 보인다', async () => {
        signInForTest()
        renderWithProviders(<AppShell>본문</AppShell>)

        await screen.findByText('50,000')
        expect(screen.getAllByText('게임머니 가용').length).toBeGreaterThan(0)
        // 보유·홀드 내역은 별도로 읽힌다(스크린리더).
        expect(
            screen.getAllByText(/게임머니 보유 1,234,567, 입찰 홀드 234,567/)
                .length,
        ).toBeGreaterThan(0)
    })

    it('잔액 조회가 실패해도 셸은 살아 있다 — 헤더에 상시 에러를 띄우지 않는다', async () => {
        signInForTest()
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('', { status: 500 })),
        )

        renderWithProviders(<AppShell>본문</AppShell>)

        expect(await screen.findByText('본문')).toBeInTheDocument()
        expect(desktopNav()).toBeInTheDocument()
    })
})

describe('AppShell — 접근성', () => {
    it('본문 바로가기 링크가 main 을 가리킨다', () => {
        const { container } = renderWithProviders(<AppShell>본문</AppShell>)

        const skip = screen.getByRole('link', { name: '본문 바로가기' })
        expect(skip).toHaveAttribute('href', '#main-content')
        expect(container.querySelector('#main-content')).toBeInTheDocument()
    })

    it('두 내비가 서로 구분되는 이름을 갖는다(중복 landmark 금지)', () => {
        renderWithProviders(<AppShell>본문</AppShell>)

        const names = screen
            .getAllByRole('navigation')
            .map((el) => el.getAttribute('aria-label'))
        expect(new Set(names).size).toBe(names.length)
    })
})
