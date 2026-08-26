import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import ShopCardInfoDialog from './ShopCardInfoDialog'
import { renderWithProviders, signInForTest } from '@/test/renderWithProviders'
import type { ShopSummary } from '@/lib/api/shop'
import type { BalanceResponse } from '@/lib/api/balance'
import { cardInfoFixture } from '@/test/cardInfoFixture'

/**
 * 카드정보 즉시구매 모달 (FC-146) — 승인 목업 `market-quickbuy-cardinfo.html`.
 *
 * 고정하는 것:
 *  1. 카드정보 렌더 — 속성표(타입·명칭·채널제한·속성·골드포스)·특수스킬. **랭크 뱃지·탭 없음**.
 *  2. 상태 분기(ShopBuyPanel 재사용) — 판매종료→비활성 / 자기상품→비활성 / 비로그인→로그인 유도.
 *  3. 구매 흐름 — 바로 구매 → 확인 → 성공. 실패는 code 로 분기(SHOP_005 잔액 부족).
 */

const NOW = Date.parse('2026-07-23T00:00:00Z')

const baseShop: ShopSummary = {
    shopPublicId: '01JMARKET0001',
    status: 'ACTIVE',
    item: {
        typeCode: 1121,
        mainCategory: 1,
        subGroup: 1,
        element: 2,
        kind: 1,
        level: 3,
        skill1: 11,
        skill2: 202,
        skill1Name: '공격시간 3 감소',
        skill2Name: '트리플샷',
        skillPercent: 33,
        goldforceExpireAt: null,
        nameSnapshot: '불의 전투도끼',
        specSnapshot: '공격력이 높은 한손 도끼',
        cardInfo: cardInfoFixture({
            kind: { code: 1, label: '도끼', abbreviation: '도' },
            shortName: 'Lv.3 불도',
            formalName: '3레벨 도끼',
            skills: [
                { slot: 1, code: 11, name: '공격시간 3 감소', percent: null },
                { slot: 2, code: 202, name: '트리플샷', percent: 33 },
            ],
        }),
    },
    price: 2_480_000,
    endAt: '2026-07-30T00:00:00Z',
    sellerNickname: '신뢰상점',
    sellerCompletedSales: 128,
}

const balance: BalanceResponse = {
    cashBalance: 0,
    gameMoneyBalance: 8_500_000,
    gameMoneyHeld: 0,
    gameMoneyAvailable: 8_500_000,
}

function errEnvelope(code: string, status: number) {
    return new Response(
        JSON.stringify({
            success: false,
            code,
            message: 'raw server text',
            timestamp: '2026-07-23T00:00:00Z',
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
    )
}

function stubFetch(handler: (url: string, method: string) => Response) {
    const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(handler(String(input), init?.method ?? 'GET')),
    )
    vi.stubGlobal('fetch', fn)
    return fn
}

function renderDialog(
    props: Partial<Parameters<typeof ShopCardInfoDialog>[0]> = {},
) {
    return renderWithProviders(
        <ShopCardInfoDialog
            isAuthed
            shop={baseShop}
            now={NOW}
            balance={balance}
            isOwn={false}
            loginHref="/login?redirectUrl=%2Fmarket"
            onClose={() => {}}
            {...props}
        />,
    )
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('<ShopCardInfoDialog>', () => {
    it('카드정보 속성표·특수스킬을 렌더하고 랭크 뱃지·탭은 두지 않는다', () => {
        signInForTest()
        renderDialog()

        expect(screen.getByRole('dialog')).toHaveClass('shop-cardinfo')
        expect(
            screen.getByRole('dialog').querySelector('.card-info-content'),
        ).toBeInTheDocument()
        expect(
            screen.getByText('거래 128회').closest('.ci-scroll'),
        ).toHaveClass('card-info-content-shell')

        // 속성표 — 명칭·채널제한(level 파생)·속성.
        expect(screen.getByText('3레벨 도끼')).toBeInTheDocument()
        expect(screen.getByText('채널제한')).toBeInTheDocument()
        // level 3 → 초보채널 이상(channelLimitOf 파생, 표시 전용).
        expect(screen.getByText('초보채널 이상')).toBeInTheDocument()
        expect(screen.getByText('불')).toBeInTheDocument()

        // 특수스킬 섹션(탭 없이 직접 노출).
        expect(
            screen.getByRole('heading', { name: '특수 스킬' }),
        ).toBeInTheDocument()
        expect(screen.getByText('공격시간 3 감소')).toBeInTheDocument()
        expect(screen.getByText('트리플샷')).toBeInTheDocument()

        // ★ 랭크 뱃지(S/A/B/C)·탭 라벨은 렌더하지 않는다.
        expect(screen.queryByText('기본 특징')).not.toBeInTheDocument()
        expect(screen.queryByText('능력 수치')).not.toBeInTheDocument()
        expect(screen.queryByText('합성 조건')).not.toBeInTheDocument()
    })

    it('판매자 영역에 완료 판매 건수를 실값("거래 N회")으로 표시한다', () => {
        signInForTest()
        renderDialog()
        // sellerCompletedSales=128 → 신뢰 칩 "거래 128회"(계약 실필드, 하드코딩 아님).
        expect(screen.getByText('거래 128회')).toBeInTheDocument()
    })

    it('완료 판매 건수 0이면 "신규 판매자"로 정직하게 표기한다', () => {
        signInForTest()
        renderDialog({ shop: { ...baseShop, sellerCompletedSales: 0 } })
        expect(screen.getByText('신규 판매자')).toBeInTheDocument()
        expect(screen.queryByText('거래 0회')).not.toBeInTheDocument()
    })

    it('자기 상품은 구매 CTA 를 DOM 비활성으로 잠근다', () => {
        signInForTest()
        renderDialog({ isOwn: true })
        const cta = screen.getByRole('button', { name: '내 상품입니다' })
        expect(cta).toBeDisabled()
        expect(cta).toHaveAttribute('data-modal-button', 'primary')
    })

    it('판매 종료 상품은 상태 라벨로 비활성화한다', () => {
        signInForTest()
        renderDialog({ shop: { ...baseShop, status: 'SOLD' } })
        const cta = screen.getByRole('button', { name: '판매 완료' })
        expect(cta).toBeDisabled()
    })

    it('비로그인은 로그인 유도 링크(returnUrl)를 노출한다', () => {
        renderDialog({ isAuthed: false, balance: undefined })
        const link = screen.getByRole('link', { name: '로그인하고 구매' })
        expect(link).toHaveAttribute('href', '/login?redirectUrl=%2Fmarket')
        expect(link).toHaveClass('app-modal-button')
        expect(link).toHaveAttribute('data-modal-button', 'primary')
    })

    it('바로 구매 → 확인 → 성공까지 흐른다', async () => {
        signInForTest()
        stubFetch((url, method) => {
            if (
                url.includes('/shops/01JMARKET0001/purchase') &&
                method === 'POST'
            ) {
                return new Response(
                    JSON.stringify({
                        success: true,
                        data: {
                            orderPublicId: 'O-1',
                            finalPrice: 2_480_000,
                        },
                        timestamp: '2026-07-23T00:00:00Z',
                    }),
                    {
                        status: 201,
                        headers: { 'Content-Type': 'application/json' },
                    },
                )
            }
            return new Response('{}', { status: 200 })
        })

        renderDialog()
        const buyButton = screen.getByRole('button', { name: '바로 구매' })
        expect(buyButton).toHaveAttribute('data-modal-button', 'primary')
        fireEvent.click(buyButton)
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('alertdialog')).toHaveClass('app-modal-panel')
        expect(screen.getByRole('button', { name: '취소' })).toHaveAttribute(
            'data-modal-button',
            'secondary',
        )
        expect(
            screen.getByRole('button', { name: '구매 확정' }),
        ).toHaveAttribute('data-modal-button', 'primary')
        // 확인 서브뷰 — 구매 후 잔액 표기.
        expect(screen.getByText('구매 후 잔액')).toBeInTheDocument()
        expect(screen.getByText('구매 후 잔액').closest('dl')).toHaveClass(
            'liquid-frost-inset',
        )
        expect(screen.getByText('구매 후 잔액').closest('dl')).not.toHaveClass(
            'bg-content-soft',
        )

        fireEvent.click(screen.getByRole('button', { name: '구매 확정' }))

        await waitFor(() =>
            expect(screen.getByText('구매 완료')).toBeInTheDocument(),
        )
    })

    it('잔액 부족(SHOP_005)은 code 로 분기해 표면화한다', async () => {
        signInForTest()
        stubFetch((url, method) => {
            if (url.includes('/purchase') && method === 'POST') {
                return errEnvelope('SHOP_005', 422)
            }
            return new Response('{}', { status: 200 })
        })

        renderDialog()
        fireEvent.click(screen.getByRole('button', { name: '바로 구매' }))
        fireEvent.click(screen.getByRole('button', { name: '구매 확정' }))

        await waitFor(() =>
            expect(
                screen.getByText('게임머니 잔액이 부족합니다'),
            ).toBeInTheDocument(),
        )
        // 서버 원문(raw server text)은 노출하지 않는다.
        expect(screen.queryByText('raw server text')).not.toBeInTheDocument()
    })
})
