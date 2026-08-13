import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import WalletSummaryCard from './WalletSummaryCard'
import type { BalanceResponse } from '@/lib/api/balance'

/**
 * 지갑 summary 카드 (FC-074) — 잔액 세 값 표시 + 자리보류.
 *
 * 고정하는 것:
 *  1. gameMoneyAvailable·gameMoneyBalance·gameMoneyHeld 를 각각(뭉개지 않고) 표시.
 *  2. 충전은 DOM `disabled`(색만 X). "지갑 자세히" → /me/wallet.
 *  3. 로딩·에러 상태.
 */

const balance: BalanceResponse = {
    cashBalance: 120_000,
    gameMoneyBalance: 6_000_000,
    gameMoneyHeld: 280_000,
    gameMoneyAvailable: 5_720_000,
}

function renderCard(
    props: Partial<React.ComponentProps<typeof WalletSummaryCard>> = {},
) {
    return render(
        <MemoryRouter>
            <WalletSummaryCard
                balance={props.balance ?? balance}
                isLoading={props.isLoading ?? false}
                isError={props.isError ?? false}
            />
        </MemoryRouter>,
    )
}

describe('<WalletSummaryCard>', () => {
    it('잔액 세 값을 각각 전체값으로 표시한다', () => {
        renderCard()
        // aria-label 은 항상 전체값 + " 코드"(CodeAmount 규칙).
        expect(screen.getByLabelText('5,720,000 코드')).toBeInTheDocument()
        expect(screen.getByLabelText('6,000,000 코드')).toBeInTheDocument()
        expect(screen.getByLabelText('280,000 코드')).toBeInTheDocument()
        expect(screen.getByLabelText('120,000 캐시')).toBeInTheDocument()
        expect(screen.getByLabelText('5,720,000 코드')).toHaveClass(
            'text-[2rem]',
            'flex-wrap',
            'break-all',
        )
        expect(screen.getByText('총 보유')).toBeInTheDocument()
        expect(screen.getByText('입찰 보류')).toBeInTheDocument()
        for (const label of [
            '6,000,000 코드',
            '280,000 코드',
            '120,000 캐시',
        ]) {
            expect(screen.getByLabelText(label)).toHaveClass('text-xl')
        }
    })

    it('충전은 DOM disabled 속성으로 비활성이다', () => {
        renderCard()
        expect(screen.getByRole('button', { name: /충전/ })).toBeDisabled()
    })

    it('"지갑 자세히"는 /me/wallet 로 링크한다', () => {
        renderCard()
        expect(
            screen.getByRole('link', { name: /지갑 자세히/ }),
        ).toHaveAttribute('href', '/me/wallet')
    })

    it('로딩 중에는 금액을 표시하지 않는다', () => {
        renderCard({ balance: undefined, isLoading: true })
        expect(screen.queryByLabelText(/(?:코드|캐시)$/)).toBeNull()
    })

    it('에러 시 안내 문구를 표시한다', () => {
        renderCard({ balance: undefined, isError: true })
        expect(
            screen.getByText(
                '잔액을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
            ),
        ).toBeInTheDocument()
    })
})
