import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuctionDetail from './AuctionDetail'
import { ROUTES } from '@/configs/routes.config'
import { ERROR_CODES } from '@/types/errorCodes'
import {
    okEnvelope,
    renderWithProviders,
    signInForTest,
    stubMatchMedia,
} from '@/test/renderWithProviders'
import type {
    AuctionDetail as AuctionDetailData,
    BidSummary,
} from '@/lib/api/auctions'

/**
 * 경매 상세 + 입찰 (FC-064).
 *
 * 이 파일이 고정하는 것:
 *  1. **자리표시자가 아니다** — 아트·스펙·입찰·이력이 실제로 렌더된다.
 *  2. **★★ 마감 판정은 `endAt` 이다** — `status: "ACTIVE"` 로 내려온 종료 경매에
 *     **입찰 폼이 뜨지 않는다**(마감 강등 워커 부재 대응).
 *  3. **★ 즉시구매 버튼이 없다** — 미구현 경로(`/purchase`)를 **한 번도 호출하지 않는다**.
 *  4. **isSeller 분기** — 닉네임 비교로 폼을 숨기되 서버 `BID_003` 도 처리한다.
 *  5. **★ 카운트다운 재동기화** — 입찰 응답의 `endAt`(소프트클로즈 연장)이 즉시 반영된다.
 *  6. `BID_001`·`BID_004` 등 **코드별 문구 분기**.
 *  7. 계약에 없는 것을 만들지 않았다 — 스킬 이름·낙찰 단정.
 */

const NOW = Date.parse('2026-07-20T12:00:00Z')
const IN_10_MIN = new Date(NOW + 10 * 60_000).toISOString()
const IN_25_MIN = new Date(NOW + 25 * 60_000).toISOString()
const PAST = new Date(NOW - 60_000).toISOString()

function detail(overrides: Partial<AuctionDetailData> = {}): AuctionDetailData {
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
        buyNowPrice: 90_000,
        highestBidAmount: 12_000,
        bidCount: 2,
        startAt: null,
        endAt: IN_10_MIN,
        sellerNickname: '대장장이길드',
        resultType: null,
        highestBidderMasked: '길동***',
        extensionCount: 0,
        maxEndAt: IN_25_MIN,
        createdAt: '2026-07-19T00:00:00Z',
        minNextBidAmount: 12_500,
        ...rest,
    }
}

function bid(overrides: Partial<BidSummary> = {}): BidSummary {
    return {
        bidPublicId: 'B-001',
        bidderMasked: '길동***',
        amount: 12_000,
        status: 'ACTIVE',
        createdAt: '2026-07-20T11:50:00Z',
        ...overrides,
    }
}

interface StubOptions {
    auction?: AuctionDetailData
    /** null 이면 404(`AUCTION_004`) */
    auctionError?: { code: string; status: number } | null
    bids?: BidSummary[]
    /** 입찰 POST 응답. 에러 코드를 주면 실패로 응답한다 */
    bidResult?:
        | { endAt: string; currentHighestAmount: number }
        | { code: string; status: number }
}

function errorResponse(code: string, status: number) {
    return new Response(
        JSON.stringify({
            success: false,
            code,
            message: `서버 메시지 ${code}`,
            timestamp: '2026-07-20T12:00:00Z',
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
    )
}

/** 요청을 전부 기록한다 — **무엇을 호출했는가**가 이 화면의 핵심 검증 중 하나다. */
function stubAuction({
    auction = detail(),
    auctionError,
    bids = [bid()],
    bidResult,
}: StubOptions = {}) {
    const calls: { method: string; url: string; body?: string }[] = []
    let current = auction

    const fetchMock = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input)
            const method = init?.method ?? 'GET'
            calls.push({ method, url, body: init?.body as string | undefined })

            if (method === 'POST' && url.includes('/bids')) {
                if (!bidResult)
                    throw new Error('입찰 응답이 준비되지 않았습니다')
                if ('code' in bidResult) {
                    return errorResponse(bidResult.code, bidResult.status)
                }
                // 소프트클로즈 연장·최고가 갱신이 서버 상태에도 반영된다.
                current = {
                    ...current,
                    endAt: bidResult.endAt,
                    highestBidAmount: bidResult.currentHighestAmount,
                    minNextBidAmount: bidResult.currentHighestAmount + 500,
                    bidCount: current.bidCount + 1,
                }
                return okEnvelope({
                    bidPublicId: 'B-NEW',
                    amount: bidResult.currentHighestAmount,
                    currentHighestAmount: bidResult.currentHighestAmount,
                    endAt: bidResult.endAt,
                })
            }

            if (url.includes('/bids')) {
                return okEnvelope({
                    content: bids,
                    page: 0,
                    size: 20,
                    totalElements: bids.length,
                    totalPages: 1,
                })
            }

            if (auctionError) {
                return errorResponse(auctionError.code, auctionError.status)
            }
            return okEnvelope(current)
        },
    )

    vi.stubGlobal('fetch', fetchMock)
    return { calls, fetchMock }
}

function renderDetail() {
    return renderWithProviders(
        <Routes>
            <Route element={<AuctionDetail />} path={ROUTES.auctionDetail} />
        </Routes>,
        { route: '/auctions/A-001' },
    )
}

/*
 * ★★ **가짜 시계를 반드시 켠다.** 이 화면의 판정이 `now >= endAt` 이라 실제 시계로 돌리면
 *    "고정 시각 기준으로 10분 뒤" 인 매물이 러너가 도는 날짜에 따라 이미 마감이 되어
 *    입찰 폼 자체가 사라진다 — 코드가 아니라 달력 때문에 붉어지는 테스트가 된다.
 *    `shouldAdvanceTime` 로 타이머는 계속 흐르게 둔다(react-query·user-event 가 멈추지 않도록).
 */
beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
})

afterEach(() => {
    vi.useRealTimers()
})

describe('경매 상세 — 자리표시자가 아니다', () => {
    it('이름·아트·스펙이 렌더된다 — 목록과 같은 ItemArtSlot', async () => {
        stubAuction()
        renderDetail()

        expect(
            await screen.findByRole('heading', {
                level: 1,
                name: '물의 검 +9',
            }),
        ).toBeInTheDocument()
        expect(screen.getByTestId('item-art-frame')).toBeInTheDocument()
        expect(screen.queryByText(/FC-055 라우팅 골격/)).not.toBeInTheDocument()
    })

    it('★ specSnapshot 이 화면에 나온다 — FC-059 가 남겨둔 자리', async () => {
        stubAuction()
        renderDetail()

        expect(
            await screen.findByTestId('auction-spec-snapshot'),
        ).toHaveTextContent('공격데미지 4 증가')
    })

    it('★ 스킬은 이름이 아니라 코드 중립 표기다 — 매핑 API 가 계약에 없다', async () => {
        stubAuction()
        renderDetail()

        const specs = await screen.findByTestId('auction-spec-list')
        expect(specs).toHaveTextContent('스킬 #119 · 18%')
        expect(specs).toHaveTextContent('스킬 #382 · 18%')
    })

    it('마법은 skill1 이 구조적으로 없다 — 빈 줄을 만들지 않는다', async () => {
        stubAuction({
            auction: detail({
                item: {
                    ...detail().item,
                    subGroup: 3,
                    kind: 1,
                    skill1: null,
                    skill2: 500,
                },
            }),
        })
        renderDetail()

        const specs = await screen.findByTestId('auction-spec-list')
        expect(specs).toHaveTextContent('스킬 #500')
        expect(specs).not.toHaveTextContent('없음')
    })

    it('입찰 이력이 렌더되고, 마스킹된 입찰자만 나온다', async () => {
        stubAuction()
        renderDetail()

        const list = await screen.findByTestId('bid-history-list')
        expect(within(list).getByText('길동***')).toBeInTheDocument()
        expect(within(list).getByText('12,000 GM')).toBeInTheDocument()
    })

    it('입찰이 없으면 이력이 비었다고 말하고 다음 행동을 준다', async () => {
        stubAuction({ bids: [] })
        renderDetail()

        expect(
            await screen.findByTestId('bid-history-empty'),
        ).toHaveTextContent('아직 입찰이 없습니다')
    })
})

describe('★★ 마감 판정은 서버 status 가 아니라 endAt 이다', () => {
    it('status 가 ACTIVE 여도 endAt 이 지났으면 입찰 폼이 없다', async () => {
        stubAuction({ auction: detail({ status: 'ACTIVE', endAt: PAST }) })
        signInForTest()
        renderDetail()

        expect(
            await screen.findByTestId('auction-ended-notice'),
        ).toHaveTextContent('마감된 경매입니다')
        expect(screen.queryByTestId('auction-bid-form')).not.toBeInTheDocument()
    })

    it('★ 마감이면 모바일 하단 바에도 입찰 버튼이 없다 — 상태 글자만 남는다', async () => {
        stubAuction({ auction: detail({ status: 'ACTIVE', endAt: PAST }) })
        signInForTest()
        renderDetail()

        await screen.findByTestId('auction-ended-notice')
        expect(
            screen.queryByTestId('sticky-bid-trigger'),
        ).not.toBeInTheDocument()
        expect(screen.getByTestId('sticky-phase-label')).toHaveTextContent(
            '마감',
        )
    })

    it('★ 낙찰이라 단정하지 않는다 — 최고 입찰까지만 적는다', async () => {
        stubAuction({ auction: detail({ status: 'ACTIVE', endAt: PAST }) })
        renderDetail()

        const bidder = await screen.findByTestId('auction-highest-bidder')
        expect(bidder).toHaveTextContent('최고 입찰')
        expect(bidder).not.toHaveTextContent('낙찰')
    })

    it('시작 전 경매는 마감과 다른 안내를 낸다 — 기다리면 열린다', async () => {
        stubAuction({
            auction: detail({
                status: 'SCHEDULED',
                startAt: IN_10_MIN,
                endAt: IN_25_MIN,
            }),
        })
        signInForTest()
        renderDetail()

        expect(
            await screen.findByTestId('auction-scheduled-notice'),
        ).toHaveTextContent('아직 시작하지 않은')
        expect(screen.queryByTestId('auction-bid-form')).not.toBeInTheDocument()
    })

    it('진행 중이면 입찰 폼과 하단 바 CTA 가 둘 다 있다', async () => {
        stubAuction()
        signInForTest()
        renderDetail()

        expect(
            await screen.findByTestId('auction-bid-form'),
        ).toBeInTheDocument()
        expect(screen.getByTestId('sticky-bid-trigger')).toBeInTheDocument()
    })
})

describe('★ 즉시구매 — 계약에 있으나 백엔드에 없다', () => {
    it('즉시구매 버튼이 없다', async () => {
        stubAuction()
        signInForTest()
        renderDetail()

        await screen.findByTestId('auction-bid-form')
        expect(
            screen.queryByRole('button', { name: /즉시구매/ }),
        ).not.toBeInTheDocument()
    })

    it('buyNowPrice 는 정보로만 적힌다', async () => {
        stubAuction()
        renderDetail()

        expect(
            await screen.findByTestId('auction-spec-list'),
        ).toHaveTextContent('90,000 GM')
    })

    it('★★ /purchase 를 한 번도 호출하지 않는다', async () => {
        const { calls } = stubAuction()
        signInForTest()
        renderDetail()

        await screen.findByTestId('auction-bid-form')
        expect(calls.some((call) => call.url.includes('/purchase'))).toBe(false)
    })
})

describe('★ 주체별 분기 — isSeller · 비로그인', () => {
    it('판매자 본인에게는 입찰 폼 대신 안내가 뜬다 (닉네임 파생)', async () => {
        stubAuction()
        signInForTest({ nickname: '대장장이길드' })
        renderDetail()

        expect(
            await screen.findByTestId('auction-own-notice'),
        ).toHaveTextContent('내가 등록한 경매')
        expect(screen.queryByTestId('auction-bid-form')).not.toBeInTheDocument()
    })

    it('비로그인은 폼 대신 로그인 링크를 본다 — 복귀 주소를 달고 간다', async () => {
        stubAuction()
        renderDetail()

        const notice = await screen.findByTestId('auction-login-notice')
        expect(
            within(notice).getByRole('link', { name: '로그인' }),
        ).toHaveAttribute(
            'href',
            expect.stringContaining(encodeURIComponent('/auctions/A-001')),
        )
        expect(screen.queryByTestId('auction-bid-form')).not.toBeInTheDocument()
    })
})

describe('입찰 흐름', () => {
    it('최소 입찰가가 입력칸에 미리 채워지고 안내로도 적힌다', async () => {
        stubAuction()
        signInForTest()
        renderDetail()

        expect(await screen.findByTestId('bid-amount-input')).toHaveValue(
            12_500,
        )
        expect(screen.getByTestId('auction-min-next-bid')).toHaveTextContent(
            '12,500 GM',
        )
    })

    /*
     * ★ 리뷰 M-1(최소가 상승 시 사용자 입력 보존)의 **규칙 자체는
     *   `features/auction/lib/bidAmount.test.ts` 가 전수 고정**한다. 렌더 타이밍이 아니라
     *   입력·출력만으로 확인되는 자리에 두는 편이 금전 판단에 맞다.
     *   여기서는 그 규칙이 **화면에 배선돼 있는지**(프리필·안내 자리)만 본다.
     */
    it('★ 지수 표기는 요청으로 나가지 않는다 (m-3 상한 가드)', async () => {
        const { calls } = stubAuction()
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        const input = await screen.findByTestId('bid-amount-input')
        await user.clear(input)
        // `Number.isInteger(1e21) === true` 라 종전 검사는 이걸 통과시켰다.
        await user.type(input, '1e21')
        await user.click(screen.getByTestId('bid-submit'))

        expect(await screen.findByTestId('bid-error')).toBeInTheDocument()
        expect(calls.some((call) => call.method === 'POST')).toBe(false)
    })

    it('★★ 성공하면 응답의 endAt 으로 카운트다운이 재동기화되고 연장을 알린다', async () => {
        const { calls } = stubAuction({
            bidResult: { endAt: IN_25_MIN, currentHighestAmount: 12_500 },
        })
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        await screen.findByTestId('bid-amount-input')
        await user.click(screen.getByTestId('bid-submit'))

        const success = await screen.findByTestId('bid-success')
        expect(success).toHaveTextContent('12,500 GM')
        expect(success).toHaveTextContent('연장')

        // 요청 본문이 계약대로 `{ amount }` 다.
        const post = calls.find((call) => call.method === 'POST')
        expect(post?.body).toBe(JSON.stringify({ amount: 12_500 }))

        /*
         * ★ **화면의 모든 카운트다운이 새 마감 시각을 가리킨다** — 본문 입찰 상자와
         *   하단 고정 바가 각각 있으므로 하나만 맞으면 다른 하나가 옛 시각으로 달린다.
         *   글자가 아니라 `dateTime` 을 본다(초 단위 표기는 러너 속도에 흔들린다).
         */
        await waitFor(() => {
            for (const countdown of screen.getAllByTestId('countdown')) {
                expect(countdown).toHaveAttribute('datetime', IN_25_MIN)
            }
        })
    })

    it('연장이 없으면 연장 문구를 붙이지 않는다 — 거짓말하지 않는다', async () => {
        stubAuction({
            bidResult: { endAt: IN_10_MIN, currentHighestAmount: 12_500 },
        })
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        await screen.findByTestId('bid-amount-input')
        await user.click(screen.getByTestId('bid-submit'))

        const success = await screen.findByTestId('bid-success')
        expect(success).not.toHaveTextContent('연장')
    })

    it('★ 최소가 미만은 요청을 보내지 않는다 — 서버가 이미 알려준 값으로 막는다', async () => {
        const { calls } = stubAuction()
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        const input = await screen.findByTestId('bid-amount-input')
        await user.clear(input)
        await user.type(input, '11000')
        await user.click(screen.getByTestId('bid-submit'))

        expect(await screen.findByTestId('bid-error')).toHaveTextContent(
            '12,500 이상',
        )
        expect(calls.some((call) => call.method === 'POST')).toBe(false)
    })

    it('빈 값 제출도 요청을 보내지 않는다', async () => {
        const { calls } = stubAuction()
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        const input = await screen.findByTestId('bid-amount-input')
        await user.clear(input)
        await user.click(screen.getByTestId('bid-submit'))

        expect(await screen.findByTestId('bid-error')).toBeInTheDocument()
        expect(calls.some((call) => call.method === 'POST')).toBe(false)
    })
})

describe('★ 입찰 실패 — 코드별로 다른 문구', () => {
    async function submitAndFail(code: string, status: number) {
        stubAuction({ bidResult: { code, status } })
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        await screen.findByTestId('bid-amount-input')
        await user.click(screen.getByTestId('bid-submit'))
        return screen.findByTestId('bid-error')
    }

    it('BID_001 은 최소 입찰가를 다시 안내한다', async () => {
        const error = await submitAndFail(ERROR_CODES.BID_001, 422)
        expect(error).toHaveTextContent('12,500')
    })

    it('BID_004 는 "기다리면 된다" 고 말한다 — BID_006 과 다른 문구', async () => {
        const error = await submitAndFail(ERROR_CODES.BID_004, 409)
        expect(error).toHaveTextContent('최고 입찰자')
        expect(error).not.toHaveTextContent('마감')
    })

    it('BID_006 은 마감이라고 말한다', async () => {
        const error = await submitAndFail(ERROR_CODES.BID_006, 409)
        expect(error).toHaveTextContent('마감')
    })

    it('★ BID_003(자기 경매)은 폼을 숨겼어도 응답이 오면 처리한다', async () => {
        const error = await submitAndFail(ERROR_CODES.BID_003, 403)
        expect(error).toHaveTextContent('내가 등록한 경매')
    })

    it('BID_005(잔액 부족)는 금액 입력을 결함으로 표시한다', async () => {
        const error = await submitAndFail(ERROR_CODES.BID_005, 422)
        expect(error).toHaveTextContent('잔액')
        expect(screen.getByTestId('bid-amount-input')).toHaveAttribute(
            'aria-invalid',
            'true',
        )
    })
})

describe('상세 조회 실패', () => {
    it('404(AUCTION_004)는 재시도를 권하지 않고 목록으로 보낸다', async () => {
        stubAuction({
            auctionError: { code: ERROR_CODES.AUCTION_004, status: 404 },
        })
        renderDetail()

        const notice = await screen.findByTestId('auction-detail-not-found')
        expect(notice).toHaveTextContent('경매를 찾을 수 없습니다')
        expect(
            screen.queryByRole('button', { name: '다시 시도' }),
        ).not.toBeInTheDocument()
    })

    it('그 밖의 실패는 다시 시도할 수 있다', async () => {
        stubAuction({
            auctionError: { code: 'COMMON_500', status: 500 },
        })
        renderDetail()

        expect(
            await screen.findByTestId('auction-detail-error'),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: '다시 시도' }),
        ).toBeInTheDocument()
    })
})

describe('모바일 — 입찰 정보와 카드 정보가 함께 보인다', () => {
    it('하단 고정 바가 현재가와 남은 시간을 상시 노출한다', async () => {
        stubAuction()
        renderDetail()

        const bar = await screen.findByTestId('auction-sticky-bar')
        expect(within(bar).getByTestId('sticky-price')).toHaveTextContent(
            '12,000 GM',
        )
        expect(within(bar).getByTestId('countdown')).toBeInTheDocument()
    })

    it('★ 입찰 CTA 는 시트를 연다 — 상세는 페이지, 입찰은 시트', async () => {
        stubAuction()
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        await screen.findByTestId('auction-sticky-bar')
        expect(screen.queryByTestId('bid-sheet')).not.toBeInTheDocument()

        await user.click(screen.getByTestId('sticky-bid-trigger'))

        const sheet = await screen.findByTestId('bid-sheet')
        expect(within(sheet).getByRole('dialog')).toHaveAttribute(
            'aria-modal',
            'true',
        )
        // 시트 안에도 같은 입찰 상자가 있다(폼이 한 벌이라 두 경로가 갈라지지 않는다).
        expect(within(sheet).getByTestId('auction-bid-box')).toBeInTheDocument()
    })

    it('아트를 누르면 확대 라이트박스가 뜨고, 거래 액션은 들어 있지 않다', async () => {
        stubAuction()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        await user.click(await screen.findByTestId('auction-art-zoom-trigger'))

        const lightbox = await screen.findByTestId('auction-art-lightbox')
        expect(within(lightbox).getByRole('dialog')).toBeInTheDocument()
        expect(
            within(lightbox).queryByRole('button', { name: /입찰/ }),
        ).not.toBeInTheDocument()
        expect(
            within(lightbox).queryByTestId('auction-spec-list'),
        ).not.toBeInTheDocument()
    })
})

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ FC-064 리뷰 C-1 회귀 — **매초 리렌더가 시트의 초점을 뺏으면 안 된다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 이 화면은 `useNow()` 로 **초당 한 번 리렌더**한다. `Sheet` 의 초점 effect 가 `onClose`
 * (인라인 화살표)에 의존하던 시절, 그 리렌더마다 effect 가 재실행돼
 * cleanup 이 트리거로 → 본문이 패널로 초점을 옮겼다.
 * **실기에서는 모바일 소프트 키보드가 매초 닫혀 최소가보다 높은 금액을 칠 수 없었다.**
 *
 * 종전 테스트가 못 잡은 이유는 (a) 시트 안 입력에 타이핑하지 않았고 (b) 시트를 1초 이상
 * 열어두지 않아서다. 그래서 **시간을 실제로 흘려보낸 뒤** 초점을 확인한다.
 */
describe('★★ 시트 초점 안정성 (C-1 회귀)', () => {
    it('시트를 열고 3초가 지나도 초점이 금액 입력칸에 남아 있다', async () => {
        stubAuction()
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        await screen.findByTestId('auction-sticky-bar')
        await user.click(screen.getByTestId('sticky-bid-trigger'))

        const sheet = await screen.findByTestId('bid-sheet')
        const input = within(sheet).getByTestId('bid-amount-input')
        await user.click(input)
        expect(input).toHaveFocus()

        // 카운트다운이 세 번 똑딱인다 — 종전 코드라면 여기서 초점이 패널로 튄다.
        await act(async () => {
            vi.advanceTimersByTime(3000)
        })

        expect(input).toHaveFocus()
    })

    it('시간이 흐르는 동안 이어서 타이핑한 금액이 온전히 남는다', async () => {
        stubAuction()
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        await screen.findByTestId('auction-sticky-bar')
        await user.click(screen.getByTestId('sticky-bid-trigger'))

        const sheet = await screen.findByTestId('bid-sheet')
        const input = within(sheet).getByTestId('bid-amount-input')

        await user.clear(input)
        await user.type(input, '100')
        await act(async () => {
            vi.advanceTimersByTime(1500)
        })
        /*
         * ★ **여기서 초점을 확인하는 것이 핵심이다.** 뒤이어 `user.type` 을 부르면 그 함수가
         *   요소를 다시 focus 하므로, 마지막 값만 보면 결함이 있어도 통과한다(실기에서는
         *   그 사이 소프트 키보드가 이미 닫혔다). 시간이 흐른 직후를 본다.
         */
        expect(input).toHaveFocus()

        await user.type(input, '000')
        expect(input).toHaveValue(100_000)
    })

    it('라이트박스도 같다 — 매초 리렌더에도 닫기 버튼 초점이 유지된다', async () => {
        stubAuction()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        await user.click(await screen.findByTestId('auction-art-zoom-trigger'))
        const lightbox = await screen.findByTestId('auction-art-lightbox')
        const close = within(lightbox).getByRole('button', {
            name: '아트 닫기',
        })

        await user.click(close)
        // 닫혔다가 다시 열어도 같은 이야기를 하려면 다시 연다.
        await user.click(screen.getByTestId('auction-art-zoom-trigger'))
        const reopened = await screen.findByTestId('auction-art-lightbox')
        const reopenedClose = within(reopened).getByRole('button', {
            name: '아트 닫기',
        })
        reopenedClose.focus()

        await act(async () => {
            vi.advanceTimersByTime(3000)
        })

        expect(reopenedClose).toHaveFocus()
    })

    it('★ 데스크톱 폭이 되면 입찰 시트가 스스로 닫힌다 (m-6 회귀)', async () => {
        stubAuction()
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        const media = stubMatchMedia()
        renderDetail()

        await screen.findByTestId('auction-sticky-bar')
        await user.click(screen.getByTestId('sticky-bid-trigger'))
        await screen.findByTestId('bid-sheet')

        media.setMatches('(min-width: 1024px)', true)

        await waitFor(() => {
            expect(screen.queryByTestId('bid-sheet')).not.toBeInTheDocument()
        })
        expect(document.body.style.overflow).not.toBe('hidden')
    })

    /*
     * ★ 리뷰 m-2 — 초점 가둠이 jsdom 에서 **무조건 조기 반환**돼 무테스트였다.
     *   `visibleFocusables` 가 레이아웃 정보가 없는 환경에서 숨김 필터를 건너뛰게 바꿔
     *   이제 가둠 자체를 검증할 수 있다.
     */
    it('★ Tab 이 시트 밖으로 새지 않는다 (m-2 — 종전엔 검증 불가였다)', async () => {
        stubAuction()
        signInForTest()
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderDetail()

        await screen.findByTestId('auction-sticky-bar')
        await user.click(screen.getByTestId('sticky-bid-trigger'))

        const sheet = await screen.findByTestId('bid-sheet')
        const panel = within(sheet).getByRole('dialog')
        const focusables = within(panel).getAllByRole('button')
        const last = focusables[focusables.length - 1]

        last.focus()
        await user.tab()

        // 마지막에서 Tab 하면 시트의 첫 요소로 감긴다 — 뒤의 페이지로 새지 않는다.
        expect(panel.contains(document.activeElement)).toBe(true)
    })
})
