import { cardInfoFixture } from '@/test/cardInfoFixture'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SellPage from './SellPage'
import {
    okEnvelope,
    renderWithProviders,
    signInForTest,
} from '@/test/renderWithProviders'
import type { InventoryItem } from '@/lib/api/inventory'
import type { Mock } from 'vitest'

/**
 * 판매 페이지 선점 모드 (FC-177).
 *
 * 고정하는 것:
 *  1. `?item=<유효 id>` → 그 아이템만 잠금 카드로 노출(picker 그리드 제거).
 *  2. `?item` 없음/무효 → "판매할 아이템을 선택하세요" 빈 상태(인벤토리로 유도).
 *  3. 인벤토리가 비면 기존 "출품할 아이템이 없습니다" 빈 상태 보존.
 */

let fetchMock: Mock

beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    signInForTest()
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

const sword: InventoryItem = {
    itemInstancePublicId: 'INST-1',
    slotNo: 1,
    summary: {
        typeCode: 1123, // 무기·불·검
        displayName: '불의 검',
        level: 4,
        skill1Code: 104,
        skill2Code: null,
        skillPercent: 18,
        goldforceExpireAt: null,
        cardInfo: cardInfoFixture({
            shortName: 'Lv.3 불검',
            formalName: '3레벨 칼',
            kind: { code: 3, label: '칼', abbreviation: '검' },
            skills: [
                { slot: 1, code: 104, name: '공격력 증가', percent: null },
                { slot: 2, code: null, name: null, percent: null },
            ],
        }),
    },
}

/** GET /me/inventory 만 응답한다(submit 전이라 auctions/shops 는 부르지 않는다). */
function mockInventory(items: InventoryItem[]) {
    fetchMock.mockImplementation(async (url: string) => {
        const u = String(url)
        if (u.includes('/me/inventory')) {
            return okEnvelope({
                capacity: 24,
                used: items.length,
                items,
            })
        }
        return okEnvelope(null)
    })
}

describe('SellPage 선점 모드 (FC-177)', () => {
    it('가격 입력을 즉시 콤마 표기하고 빈 값 삭제를 유지한다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        const startPrice = await screen.findByLabelText('시작가')
        fireEvent.change(startPrice, { target: { value: '001234567' } })
        expect(startPrice).toHaveValue('1,234,567')

        fireEvent.click(
            screen.getByRole('checkbox', { name: '즉시구매가 사용' }),
        )
        const buyNowPrice = screen.getByLabelText('즉시구매가 입력')
        fireEvent.change(buyNowPrice, { target: { value: '2,345,678' } })
        expect(buyNowPrice).toHaveValue('2,345,678')
        fireEvent.change(buyNowPrice, { target: { value: '' } })
        expect(buyNowPrice).toHaveValue('')

        fireEvent.click(screen.getByRole('radio', { name: /고정가/ }))
        const shopPrice = screen.getByLabelText('판매가')
        fireEvent.change(shopPrice, { target: { value: '1234567' } })
        expect(shopPrice).toHaveValue('1,234,567')
        expect(shopPrice).toHaveClass('text-amount-code-tier-4')
        expect(shopPrice.nextElementSibling).toHaveClass(
            'text-amount-code-tier-4',
        )
    })

    it('유효한 입력 금액에 기존 CodeAmount tier 색상을 즉시 적용한다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        const startPrice = await screen.findByLabelText('시작가')
        fireEvent.change(startPrice, { target: { value: '9999' } })
        expect(startPrice).toHaveClass('text-amount-code-tier-1')
        expect(startPrice.nextElementSibling).toHaveClass(
            'text-amount-code-tier-1',
        )
        fireEvent.change(startPrice, { target: { value: '10000' } })
        expect(startPrice).toHaveClass('text-amount-code-tier-2')
        expect(startPrice.nextElementSibling).toHaveClass(
            'text-amount-code-tier-2',
        )

        fireEvent.change(startPrice, { target: { value: '' } })
        expect(startPrice).toHaveClass('text-content-fg')
        expect(startPrice.nextElementSibling).toHaveClass('text-content-fg')
        expect(screen.queryByText('현재 입력 금액:')).toBeNull()
    })

    it('세 가격 input과 코드 suffix가 모든 tier 경계에서 같은 색을 쓴다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        const boundaries = [
            ['9999', 'text-amount-code-tier-1'],
            ['10000', 'text-amount-code-tier-2'],
            ['100000', 'text-amount-code-tier-3'],
            ['1000000', 'text-amount-code-tier-4'],
            ['10000000', 'text-amount-code-tier-5'],
            ['100000000', 'text-amount-code-tier-6'],
        ] as const
        const assertBoundaries = (input: HTMLElement) => {
            for (const [value, className] of boundaries) {
                fireEvent.change(input, { target: { value } })
                expect(input).toHaveClass(className)
                expect(input.nextElementSibling).toHaveClass(className)
            }
        }

        assertBoundaries(await screen.findByLabelText('시작가'))
        fireEvent.click(
            screen.getByRole('checkbox', { name: '즉시구매가 사용' }),
        )
        assertBoundaries(screen.getByLabelText('즉시구매가 입력'))
        fireEvent.click(screen.getByRole('radio', { name: /고정가/ }))
        assertBoundaries(screen.getByLabelText('판매가'))
    })

    it('제거 대상 설명과 금액 미리보기를 노출하지 않는다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        await screen.findByLabelText('시작가')
        expect(screen.queryByText('입찰이 시작되는 기준 가격')).toBeNull()
        expect(
            screen.queryByText(/선택 입력 · 시작가보다 높아야 합니다/),
        ).toBeNull()
        expect(screen.queryByText(/선택 \d일 \(\d+시간\)/)).toBeNull()
        expect(screen.queryByText('현재 입력 금액:')).toBeNull()
    })

    it('세 가격 필드의 중간 편집과 붙여넣기에서 caret 위치를 보존한다', async () => {
        const user = userEvent.setup()
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        const startPrice = (await screen.findByLabelText(
            '시작가',
        )) as HTMLInputElement
        await user.type(startPrice, '1234567')
        await user.click(startPrice)
        startPrice.setSelectionRange(1, 1)
        await user.keyboard('9')
        expect(startPrice).toHaveValue('19,234,567')
        expect(startPrice.selectionStart).toBe(2)
        await user.keyboard('{Backspace}')
        expect(startPrice).toHaveValue('1,234,567')
        expect(startPrice.selectionStart).toBe(1)

        await user.click(
            screen.getByRole('checkbox', { name: '즉시구매가 사용' }),
        )
        const buyNowPrice = screen.getByLabelText('즉시구매가 입력')
        await user.click(buyNowPrice)
        await user.paste('2345678')
        expect(buyNowPrice).toHaveValue('2,345,678')

        await user.click(screen.getByRole('radio', { name: /고정가/ }))
        const shopPrice = screen.getByLabelText('판매가')
        await user.click(shopPrice)
        await user.paste('3456789')
        expect(shopPrice).toHaveValue('3,456,789')
    })

    it('판매 방식 라디오는 roving tab과 APG 방향키를 지원한다', async () => {
        const user = userEvent.setup()
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        const auction = await screen.findByRole('radio', { name: /경매/ })
        const shop = screen.getByRole('radio', { name: /고정가/ })
        expect(auction).toHaveAttribute('tabindex', '0')
        expect(shop).toHaveAttribute('tabindex', '-1')

        auction.focus()
        await user.keyboard('{ArrowRight}')
        expect(shop).toHaveFocus()
        expect(shop).toHaveAttribute('aria-checked', 'true')
        expect(shop).toHaveAttribute('tabindex', '0')
        await user.keyboard('{Home}')
        expect(auction).toHaveFocus()
        expect(auction).toHaveAttribute('aria-checked', 'true')
        await user.keyboard('{End}')
        expect(shop).toHaveFocus()
        await user.keyboard('{ArrowUp}')
        expect(auction).toHaveFocus()

        shop.focus()
        await user.keyboard(' ')
        expect(shop).toHaveFocus()
        expect(shop).toHaveAttribute('aria-checked', 'true')
        auction.focus()
        await user.keyboard('{Enter}')
        expect(auction).toHaveFocus()
        expect(auction).toHaveAttribute('aria-checked', 'true')
    })

    it('콤마 표기된 고정가를 숫자 payload로 전송한다', async () => {
        fetchMock.mockImplementation(
            async (url: string, init?: RequestInit) => {
                if (String(url).includes('/me/inventory')) {
                    return okEnvelope({ capacity: 24, used: 1, items: [sword] })
                }
                if (String(url).includes('/shops') && init?.method === 'POST') {
                    return okEnvelope({ shopPublicId: 'SHOP-1' })
                }
                return okEnvelope(null)
            },
        )
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        await screen.findByRole('heading', { name: /카드정보/ })
        fireEvent.click(screen.getByRole('radio', { name: /고정가/ }))
        fireEvent.change(screen.getByLabelText('판매가'), {
            target: { value: '1234567' },
        })
        fireEvent.click(screen.getAllByRole('button', { name: '판매 등록' })[0])
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(
            within(dialog).getByRole('button', { name: '판매 등록' }),
        )

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining('/shops'),
                expect.objectContaining({
                    body: JSON.stringify({
                        itemInstancePublicId: 'INST-1',
                        price: 1234567,
                    }),
                }),
            ),
        )
    })

    it('금액 미리보기 행을 별도로 표시하지 않는다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        await screen.findByRole('heading', { name: /카드정보/ })
        fireEvent.click(screen.getByRole('radio', { name: /고정가/ }))
        expect(screen.queryByText('판매가를 입력하면 표시됩니다.')).toBeNull()
        expect(screen.queryByText('구매자에게 표시되는 가격')).toBeNull()
        expect(
            screen.getByText('등록 즉시 판매 목록에 노출됩니다.'),
        ).toBeInTheDocument()
        expect(
            screen.getByText('판매 기간은 서버가 정합니다.'),
        ).toBeInTheDocument()
        expect(
            screen.getByText(/판매되지 않으면 임시 보관함으로 자동 회수됩니다/),
        ).toBeInTheDocument()
    })

    it('예상 종료 시각 없이 경매 기간 선택을 유지한다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        const sevenDays = await screen.findByRole('button', {
            name: '7일 168시간',
        })
        fireEvent.click(sevenDays)
        expect(sevenDays).toHaveAttribute('aria-pressed', 'true')
        expect(screen.queryByText('선택 7일 (168시간)')).toBeNull()
        expect(screen.queryByRole('status')).toBeNull()
        expect(screen.queryByText(/예상 종료/)).toBeNull()
        expect(screen.queryByText('실시간')).toBeNull()
    })

    it('즉시구매 입력은 항상 같은 가격 행에 있으며 off에서 draft를 보존하고 오류를 제거한다', async () => {
        const user = userEvent.setup()
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        const checkbox = await screen.findByRole('checkbox', {
            name: '즉시구매가 사용',
        })
        const startPrice = screen.getByLabelText('시작가')
        const buyNow = screen.getByLabelText('즉시구매가 입력')
        expect(checkbox).not.toBeChecked()
        expect(checkbox).not.toHaveAttribute('aria-expanded')
        expect(checkbox).not.toHaveAttribute('aria-controls')
        expect(buyNow).toBeDisabled()
        expect(startPrice.parentElement?.parentElement?.parentElement).toBe(
            buyNow.parentElement?.parentElement?.parentElement,
        )
        expect(startPrice).toHaveClass('text-lg', 'sm:text-3xl')
        expect(buyNow).toHaveClass('text-lg', 'sm:text-3xl')
        expect(startPrice.closest('.grid')).toHaveClass(
            'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
        )

        fireEvent.change(startPrice, {
            target: { value: '2000' },
        })
        checkbox.focus()
        expect(checkbox).toHaveFocus()
        await user.keyboard(' ')
        expect(checkbox).toBeChecked()
        expect(buyNow).toBeEnabled()
        await user.type(buyNow, '1000')
        fireEvent.click(screen.getAllByRole('button', { name: '판매 등록' })[0])
        expect(buyNow).toHaveFocus()
        expect(
            screen.getByText('즉시구매가는 시작가보다 높아야 합니다.'),
        ).toBeInTheDocument()

        await user.click(checkbox)
        expect(buyNow).toBeDisabled()
        expect(screen.queryByText(/즉시구매가는/)).toBeNull()
        await user.click(checkbox)
        expect(buyNow).toBeEnabled()
        expect(buyNow).toHaveValue('1,000')
    })

    it('즉시구매를 켠 채 비우면 입력에 초점을 두고 등록을 막는다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        fireEvent.change(await screen.findByLabelText('시작가'), {
            target: { value: '1000' },
        })
        fireEvent.click(
            screen.getByRole('checkbox', { name: '즉시구매가 사용' }),
        )
        fireEvent.click(screen.getAllByRole('button', { name: '판매 등록' })[0])

        expect(screen.getByLabelText('즉시구매가 입력')).toHaveFocus()
        expect(
            screen.getByText('즉시구매가를 입력해 주세요.'),
        ).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('즉시구매 활성 상태만 auction payload에 금액을 포함한다', async () => {
        fetchMock.mockImplementation(
            async (url: string, init?: RequestInit) => {
                if (String(url).includes('/me/inventory')) {
                    return okEnvelope({ capacity: 24, used: 1, items: [sword] })
                }
                if (
                    String(url).includes('/auctions') &&
                    init?.method === 'POST'
                ) {
                    return okEnvelope({ auctionPublicId: 'AUCTION-1' })
                }
                return okEnvelope(null)
            },
        )
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        fireEvent.change(await screen.findByLabelText('시작가'), {
            target: { value: '1000' },
        })
        fireEvent.click(
            screen.getByRole('checkbox', { name: '즉시구매가 사용' }),
        )
        fireEvent.change(screen.getByLabelText('즉시구매가 입력'), {
            target: { value: '2000' },
        })
        fireEvent.click(screen.getAllByRole('button', { name: '판매 등록' })[0])
        fireEvent.click(
            within(await screen.findByRole('dialog')).getByRole('button', {
                name: '판매 등록',
            }),
        )

        await waitFor(() => {
            const auctionCall = fetchMock.mock.calls.find(
                ([url, init]) =>
                    String(url).includes('/auctions') &&
                    init?.method === 'POST',
            )
            expect(JSON.parse(String(auctionCall?.[1]?.body))).toMatchObject({
                startPrice: 1000,
                buyNowPrice: 2000,
            })
        })
    })

    it('즉시구매를 끄면 draft를 유지하되 auction payload에서 속성을 생략한다', async () => {
        fetchMock.mockImplementation(
            async (url: string, init?: RequestInit) => {
                if (String(url).includes('/me/inventory')) {
                    return okEnvelope({ capacity: 24, used: 1, items: [sword] })
                }
                if (
                    String(url).includes('/auctions') &&
                    init?.method === 'POST'
                ) {
                    return okEnvelope({ auctionPublicId: 'AUCTION-1' })
                }
                return okEnvelope(null)
            },
        )
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        fireEvent.change(await screen.findByLabelText('시작가'), {
            target: { value: '1000' },
        })
        const checkbox = screen.getByRole('checkbox', {
            name: '즉시구매가 사용',
        })
        const buyNow = screen.getByLabelText('즉시구매가 입력')
        fireEvent.click(checkbox)
        fireEvent.change(buyNow, { target: { value: '2000' } })
        fireEvent.click(checkbox)
        expect(buyNow).toBeDisabled()
        expect(buyNow).toHaveValue('2,000')

        fireEvent.click(screen.getAllByRole('button', { name: '판매 등록' })[0])
        fireEvent.click(
            within(await screen.findByRole('dialog')).getByRole('button', {
                name: '판매 등록',
            }),
        )

        await waitFor(() => {
            const auctionCall = fetchMock.mock.calls.find(
                ([url, init]) =>
                    String(url).includes('/auctions') &&
                    init?.method === 'POST',
            )
            const body = JSON.parse(String(auctionCall?.[1]?.body))
            expect(body).not.toHaveProperty('buyNowPrice')
        })
    })

    it('등록 순간을 초 단위로 보존해 dialog와 auction payload에 같은 instant를 쓴다', async () => {
        const capturedNow = Date.parse('2026-08-15T00:00:37Z')
        let submissionNowCalls = 0
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(capturedNow)
        fetchMock.mockImplementation(
            async (url: string, init?: RequestInit) => {
                if (String(url).includes('/me/inventory')) {
                    return okEnvelope({ capacity: 24, used: 1, items: [sword] })
                }
                if (
                    String(url).includes('/auctions') &&
                    init?.method === 'POST'
                ) {
                    return okEnvelope({ auctionPublicId: 'AUCTION-1' })
                }
                return okEnvelope(null)
            },
        )
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        fireEvent.change(await screen.findByLabelText('시작가'), {
            target: { value: '1000' },
        })
        fireEvent.click(screen.getByRole('button', { name: '1일 24시간' }))
        dateNowSpy.mockImplementation(() => {
            if (new Error().stack?.includes('handleOpenConfirm')) {
                submissionNowCalls += 1
                return capturedNow
            }
            return Date.parse('2026-08-15T00:01:11Z')
        })
        fireEvent.click(screen.getAllByRole('button', { name: '판매 등록' })[0])
        const dialog = await screen.findByRole('dialog')
        expect(submissionNowCalls).toBe(1)
        expect(
            within(dialog).getAllByText('2026-08-16 09:00:37').length,
        ).toBeGreaterThan(0)
        fireEvent.click(
            within(dialog).getByRole('button', { name: '판매 등록' }),
        )

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining('/auctions'),
                expect.objectContaining({
                    body: JSON.stringify({
                        itemInstancePublicId: 'INST-1',
                        startPrice: 1000,
                        endAt: '2026-08-16T00:00:37.000Z',
                        maxEndAt: '2026-08-16T00:00:37.000Z',
                    }),
                }),
            ),
        )
    })

    it('가격 영역은 좁은 화면에서 넘침을 막는 구조 클래스를 갖는다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        const startPrice = await screen.findByLabelText('시작가')
        expect(startPrice).toHaveClass('w-full', 'min-w-0')
        expect(startPrice.parentElement).toHaveClass('min-w-0')
    })

    it('?item 유효 → 그 아이템만 잠금 카드로 노출한다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        expect(
            await screen.findByRole('heading', { name: /카드정보/ }),
        ).toBeInTheDocument()
        expect(screen.getByText('3레벨 칼')).toBeInTheDocument()
        expect(
            screen.getByRole('link', { name: '다시 선택' }),
        ).toBeInTheDocument()
        for (const days of [1, 2, 3, 4, 5, 6, 7]) {
            expect(
                screen.getByRole('button', {
                    name: `${days}일 ${days * 24}시간`,
                }),
            ).toBeInTheDocument()
        }
        // 판매 방식 등 이후 폼은 유지된다.
        expect(screen.getByRole('radio', { name: /경매/ })).toBeInTheDocument()
    })

    it('입력 전에는 0 대신 예상 정산 안내 상태를 표시한다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        const summary = await screen.findByRole('region', {
            name: '예상 정산 요약',
        })
        expect(
            within(summary).getByText(
                '시작가를 입력하면 예상 정산액을 확인할 수 있습니다.',
            ),
        ).toBeInTheDocument()
        expect(within(summary).queryByLabelText('0 코드')).toBeNull()
    })

    it('경매 시작가와 유효한 즉시구매가 기준 예상 정산을 함께 표시한다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        fireEvent.change(await screen.findByLabelText('시작가'), {
            target: { value: '1000' },
        })
        fireEvent.click(
            screen.getByRole('checkbox', { name: '즉시구매가 사용' }),
        )
        fireEvent.change(screen.getByLabelText('즉시구매가 입력'), {
            target: { value: '2000' },
        })

        const summary = screen.getByRole('region', { name: '예상 정산 요약' })
        expect(
            within(summary).getByText('시작가 기준 예상 수수료'),
        ).toBeInTheDocument()
        expect(
            within(summary).getByText('시작가 기준 예상 정산액'),
        ).toBeInTheDocument()
        expect(
            within(summary).getByText('즉시구매가 기준 예상 정산액'),
        ).toBeInTheDocument()
        expect(within(summary).getByLabelText('100 코드')).toBeInTheDocument()
        expect(within(summary).getByLabelText('900 코드')).toBeInTheDocument()
        expect(within(summary).getByLabelText('1,880 코드')).toBeInTheDocument()
        expect(
            within(summary).getByText(
                '실제 수수료와 정산액은 최종 낙찰가를 기준으로 서버에서 확정됩니다.',
            ),
        ).toBeInTheDocument()
    })

    it('고정가 판매가 기준 예상 정산과 미판매 자동 회수를 안내한다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        await screen.findByLabelText('시작가')
        fireEvent.click(screen.getByRole('radio', { name: /고정가/ }))
        fireEvent.change(screen.getByLabelText('판매가'), {
            target: { value: '2480000' },
        })

        const summary = screen.getByRole('region', { name: '예상 정산 요약' })
        expect(
            within(summary).getByLabelText('110,200 코드'),
        ).toBeInTheDocument()
        expect(
            within(summary).getByLabelText('2,369,800 코드'),
        ).toBeInTheDocument()
        expect(
            within(summary).getByText(/임시 보관함으로 자동 회수됩니다/),
        ).toBeInTheDocument()
    })

    it('1코드 극소액도 판매가 clamp 결과를 정상 노출한다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        fireEvent.change(await screen.findByLabelText('시작가'), {
            target: { value: '1' },
        })

        const summary = screen.getByRole('region', { name: '예상 정산 요약' })
        expect(within(summary).getByLabelText('1 코드')).toBeInTheDocument()
        expect(within(summary).getByLabelText('0 코드')).toBeInTheDocument()
    })

    it('판매 등록 CTA를 반응형 위치에 하나씩 두고 폼 상태와 무관하게 활성화한다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        await screen.findByRole('heading', { name: /카드정보/ })
        const buttons = screen.getAllByRole('button', { name: '판매 등록' })
        expect(buttons).toHaveLength(2)
        expect(buttons[0]).toHaveClass('lg:hidden')
        expect(buttons[1].parentElement).toHaveClass('hidden', 'lg:block')
        buttons.forEach((button) => expect(button).toBeEnabled())
        expect(screen.queryByText('판매 수수료 안내')).toBeNull()

        fireEvent.click(buttons[0])
        expect(document.getElementById('sellStartPrice')).toHaveFocus()
        expect(screen.queryByRole('dialog')).toBeNull()

        fireEvent.click(screen.getByRole('radio', { name: /고정가/ }))
        expect(
            screen.getAllByRole('button', { name: '판매 등록' }),
        ).toHaveLength(2)
    })

    it('?item 무효(인벤토리에 없음) → 선택 유도 빈 상태를 보인다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=NOPE' })

        expect(
            await screen.findByText('판매할 아이템을 선택하세요'),
        ).toBeInTheDocument()
        expect(screen.queryByText('1. 판매할 아이템')).toBeNull()
        expect(
            screen.getByRole('link', { name: '인벤토리로 가기' }),
        ).toHaveClass(
            'bg-control-action',
            'text-control-action-ink',
            'hover:bg-control-action-hover',
            'focus-visible:ring-control-focus',
        )
    })

    it('?item 없음 → 선택 유도 빈 상태를 보인다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell' })

        expect(
            await screen.findByText('판매할 아이템을 선택하세요'),
        ).toBeInTheDocument()
    })

    it('인벤토리가 비면 기존 "출품할 아이템이 없습니다" 를 보인다', async () => {
        mockInventory([])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        await waitFor(() =>
            expect(
                screen.getByText('출품할 아이템이 없습니다'),
            ).toBeInTheDocument(),
        )
        expect(screen.queryByText('판매할 아이템을 선택하세요')).toBeNull()
    })
})
