import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WALLET_BALANCE_OPTIONS } from '../fixtures/walletBalance'
import { WALLET_BALANCE_VARIANTS } from '../scenarioMetadata'
import WalletBalanceCandidate from './WalletBalanceCandidate'

const balance = {
    gameMoneyBalance: 1_520_000,
    gameMoneyAvailable: 1_240_000,
    gameMoneyHeld: 280_000,
    cashBalance: 50_000,
}

const longBalance = {
    gameMoneyBalance: 9_007_199_254_740_000,
    gameMoneyAvailable: 8_607_199_254_740_000,
    gameMoneyHeld: 400_000_000_000_000,
    cashBalance: 7_777_777_777_777,
}

describe('WalletBalanceCandidate', () => {
    it.each(WALLET_BALANCE_OPTIONS)(
        '$name이 실제 지갑 4값을 CodeAmount full로 유지한다',
        ({ id }) => {
            const view = render(
                <WalletBalanceCandidate
                    balance={balance}
                    state="ready"
                    variant={id}
                />,
            )

            expect(
                view.container.querySelector(`[data-wallet-variant="${id}"]`),
            ).toBeInTheDocument()
            for (const accessibleAmount of [
                '1,520,000 코드',
                '1,240,000 코드',
                '280,000 코드',
                '50,000 코드',
            ]) {
                expect(
                    screen.getByLabelText(accessibleAmount),
                ).toBeInTheDocument()
            }
            expect(
                screen.getAllByRole('button', { name: '충전 준비 중' })[0],
            ).toBeDisabled()
        },
    )

    it.each([
        ['loading', 'status', '지갑 잔액을 불러오는 중'],
        ['error', 'alert', '지갑 잔액을 불러오지 못했습니다'],
    ] as const)('%s 상태를 명시적으로 노출한다', (state, role, name) => {
        render(
            <WalletBalanceCandidate
                balance={balance}
                state={state}
                variant={WALLET_BALANCE_VARIANTS.balancedMetrics}
            />,
        )

        const stateRegion = screen.getByRole(role)
        expect(stateRegion).toBeVisible()
        if (role === 'status') {
            expect(stateRegion).toHaveAccessibleName(name)
        } else {
            expect(stateRegion).toHaveTextContent(name)
        }
    })

    it.each(WALLET_BALANCE_OPTIONS)(
        '$shortName의 긴 안전정수가 390px·200% 확대 수심 클래스 밖으로 넘치지 않는다',
        ({ id }) => {
            const view = render(
                <WalletBalanceCandidate
                    balance={longBalance}
                    state="ready"
                    variant={id}
                />,
            )

            const candidate = view.container.querySelector(
                '[data-wallet-variant]',
            )!
            expect(candidate).toHaveClass(
                'w-full',
                'min-w-0',
                'max-w-full',
                'overflow-hidden',
            )
            expect(candidate.querySelectorAll('.overflow-x-auto')).toHaveLength(
                0,
            )
            for (const amount of candidate.querySelectorAll(
                '[aria-label$="코드"]',
            )) {
                expect(amount).toHaveClass(
                    'max-w-full',
                    'min-w-0',
                    'flex-wrap',
                    'break-all',
                )
            }
        },
    )

    it('균형 지표형과 가용액 중심형은 390px에서 1열, 640px 이상에서 동일 3열이다', () => {
        const first = render(
            <WalletBalanceCandidate
                balance={balance}
                state="ready"
                variant={WALLET_BALANCE_VARIANTS.availableFirst}
            />,
        )
        expect(
            first.container.querySelector('[data-wallet-metrics]'),
        ).toHaveClass('grid-cols-1', 'sm:grid-cols-3')
        first.unmount()

        const balanced = render(
            <WalletBalanceCandidate
                balance={balance}
                state="ready"
                variant={WALLET_BALANCE_VARIANTS.balancedMetrics}
            />,
        )
        expect(
            balanced.container.querySelector('[data-wallet-metrics]'),
        ).toHaveClass('grid-cols-1', 'sm:grid-cols-3')
    })
})
