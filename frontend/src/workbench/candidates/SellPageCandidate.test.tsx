import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import SellPageCandidate, { SELL_STUDY_VARIANTS } from './SellPageCandidate'

describe('SellPageCandidate', () => {
    it.each(SELL_STUDY_VARIANTS)(
        '%s 안에 공통 판매 계약을 표시한다',
        (variant) => {
            const { container } = render(
                <SellPageCandidate variant={variant} />,
            )

            expect(
                screen.getByRole('heading', { name: '황혼의 수호자 갑옷' }),
            ).toBeVisible()
            expect(screen.getByText(/대지의 가호/)).toBeVisible()
            expect(screen.getByRole('tab', { name: '경매' })).toHaveAttribute(
                'aria-selected',
                'true',
            )
            expect(screen.getByRole('button', { name: /1일/ })).toBeVisible()
            expect(screen.getByRole('button', { name: /3일/ })).toBeVisible()
            expect(screen.getByRole('button', { name: /7일/ })).toBeVisible()
            expect(
                screen.getAllByText('2026. 08. 17. 14:30:00 KST'),
            ).toHaveLength(2)
            expect(container.querySelector('[data-sell-study]')).toHaveClass(
                variant === 'console' || variant === 'horizontal-flow'
                    ? 'lg:grid-cols-3'
                    : variant === 'guided' || variant === 'vertical-flow'
                      ? 'grid-cols-1'
                      : 'lg:grid-cols-2',
            )
            expect(screen.getByRole('tab', { name: '경매' })).toHaveClass(
                'border-control-action',
                'text-control-action-hover',
                'focus-visible:ring-2',
            )
            expect(screen.getByLabelText('시작가')).toHaveClass(
                'min-h-11',
                'tabular-nums',
                'outline-none',
            )
            expect(screen.getByRole('button', { name: /3일/ })).toHaveClass(
                'border-control-action',
                'focus-visible:ring-2',
            )
        },
    )

    it.each([
        ['balanced', 'order-1', 'order-2', 'order-2'],
        ['guided', 'order-1', 'order-2', 'order-2'],
        ['console', 'order-1', 'order-2', 'lg:sticky'],
        ['time-first', 'order-2', 'order-1', 'order-2'],
        ['review-first', 'order-2', 'order-2', 'order-1'],
        ['vertical-flow', 'order-1', 'order-2', 'order-2'],
        ['horizontal-flow', 'order-1', 'order-2', 'order-2'],
    ] as const)(
        '%s 안은 아이템·설정·요약의 고유 위계를 제공한다',
        (variant, itemClass, settingsClass, summaryClass) => {
            const { container } = render(
                <SellPageCandidate variant={variant} />,
            )
            expect(
                container.querySelector('[data-sell-region="item"]'),
            ).toHaveClass(itemClass)
            expect(
                container.querySelector('[data-sell-region="settings"]'),
            ).toHaveClass(settingsClass)
            expect(
                container.querySelector('[data-sell-region="summary"]'),
            ).toHaveClass(summaryClass)
        },
    )

    it('기간, 직접 설정, 소프트클로즈와 고정가 안내를 전환한다', async () => {
        const user = userEvent.setup()
        render(<SellPageCandidate variant="balanced" />)

        await user.click(screen.getByRole('button', { name: /7일/ }))
        expect(screen.getAllByText('2026. 08. 21. 14:30:00 KST')).toHaveLength(
            2,
        )

        await user.click(screen.getByRole('button', { name: /고급 시간 설정/ }))
        expect(screen.getByLabelText(/직접 종료 시각/)).toBeVisible()
        await user.click(screen.getByRole('checkbox'))
        expect(
            screen.getByText(/마감 60초 전 입찰 시 120초 연장/),
        ).toBeVisible()

        await user.click(screen.getByRole('tab', { name: '고정가' }))
        expect(
            screen.getByText('판매 기한은 서버가 자동 결정합니다.'),
        ).toBeVisible()
        expect(screen.queryByLabelText('경매 기간')).not.toBeInTheDocument()
    })
})
