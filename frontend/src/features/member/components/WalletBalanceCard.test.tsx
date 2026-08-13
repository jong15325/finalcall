import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import WalletBalanceCard from './WalletBalanceCard'
import type { BalanceResponse } from '@/lib/api/balance'

/**
 * 지갑 잔액 카드 (FC-075) — 4값 표시 + 홀드 미터 + 충전 자리.
 *
 * 고정하는 것:
 *  1. gameMoneyAvailable·gameMoneyBalance·gameMoneyHeld·cashBalance 를 각각(뭉개지 않고) 표시.
 *  2. 홀드 미터 = 홀드/총 비율(aria-valuenow), 총 0 이면 0.
 *  3. 충전은 DOM `disabled`(색만 X) — 미구현 자리.
 *  4. 로딩·에러 상태.
 */

const balance: BalanceResponse = {
    cashBalance: 120_000,
    gameMoneyBalance: 6_000_000,
    gameMoneyHeld: 1_500_000,
    gameMoneyAvailable: 4_500_000,
}

function renderCard(
    props: Partial<React.ComponentProps<typeof WalletBalanceCard>> = {},
) {
    return render(
        <WalletBalanceCard
            balance={props.balance ?? balance}
            isLoading={props.isLoading ?? false}
            isError={props.isError ?? false}
        />,
    )
}

describe('<WalletBalanceCard>', () => {
    it('잔액 네 값을 각각 전체값으로 표시한다', () => {
        renderCard()
        // aria-label 은 항상 전체값 + " 코드"(CodeAmount 규칙).
        expect(screen.getByLabelText('4,500,000 코드')).toBeInTheDocument()
        expect(screen.getByLabelText('6,000,000 코드')).toBeInTheDocument()
        expect(screen.getByLabelText('1,500,000 코드')).toBeInTheDocument()
        expect(screen.getByLabelText('120,000 캐시')).toBeInTheDocument()
        expect(screen.getByLabelText('4,500,000 코드')).toHaveClass(
            'text-[2rem]',
            'flex-wrap',
            'break-all',
        )
        expect(screen.getByRole('link', { name: '교환하기' })).toHaveAttribute(
            'href',
            '#exchange-form',
        )
    })

    it('홀드 미터가 홀드/총 비율을 aria-valuenow 로 노출한다', () => {
        renderCard() // 1,500,000 / 6,000,000 = 25%
        const meter = screen.getByRole('progressbar', {
            name: '입찰 보류 비율',
        })
        expect(meter).toHaveAttribute('aria-valuenow', '25')
    })

    it('총 보유가 0 이면 홀드 미터 비율은 0 이다', () => {
        renderCard({
            balance: {
                cashBalance: 0,
                gameMoneyBalance: 0,
                gameMoneyHeld: 0,
                gameMoneyAvailable: 0,
            },
        })
        expect(
            screen.getByRole('progressbar', { name: '입찰 보류 비율' }),
        ).toHaveAttribute('aria-valuenow', '0')
    })

    it('충전은 DOM disabled 속성으로 비활성이다(미구현 자리)', () => {
        renderCard()
        expect(screen.getByRole('button', { name: /충전/ })).toBeDisabled()
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
