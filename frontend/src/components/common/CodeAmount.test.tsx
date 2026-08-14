import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CodeAmount from './CodeAmount'
import { codeTierClass } from './codeTier'
import { formatCodeCompact, formatCodeFull } from './codeFormat'

/**
 * CodeAmount 계약 검증 (frontend-ui-system-contract §2.4.1).
 * 축약은 표시 변환일 뿐이며 통화 단위와 코드 구간색은 공용 컴포넌트가 소유한다.
 */
describe('formatCodeCompact', () => {
    it('만·억 단위로 축약한다', () => {
        expect(formatCodeCompact(10000)).toBe('1만')
        expect(formatCodeCompact(2480000)).toBe('248만')
        expect(formatCodeCompact(9900000000)).toBe('99억')
    })

    it('만 미만은 천단위 구분으로 둔다', () => {
        expect(formatCodeCompact(5000)).toBe('5,000')
        expect(formatCodeCompact(0)).toBe('0')
    })

    it('나누어떨어지지 않으면 소수 1자리까지 표기한다', () => {
        expect(formatCodeCompact(12345)).toBe('1.2만')
        expect(formatCodeCompact(250000000)).toBe('2.5억')
    })
})

describe('formatCodeFull', () => {
    it('전체값을 천단위 구분으로 표기한다', () => {
        expect(formatCodeFull(2480000)).toBe('2,480,000')
        expect(formatCodeFull(10001)).toBe('10,001')
    })
})

describe('<CodeAmount>', () => {
    it.each([
        [9_999, 'text-amount-code-tier-1'],
        [10_000, 'text-amount-code-tier-2'],
        [100_000, 'text-amount-code-tier-3'],
        [1_000_000, 'text-amount-code-tier-4'],
        [10_000_000, 'text-amount-code-tier-5'],
        [100_000_000, 'text-amount-code-tier-6'],
    ] as const)('공용 tier helper가 %s 경계를 판정한다', (value, className) => {
        expect(codeTierClass(value)).toBe(className)
    })

    it('aria-label과 시각 표시는 숫자 뒤에 코드 단위를 둔다', () => {
        const { rerender } = render(
            <CodeAmount value={2480000} mode="compact" />,
        )
        expect(screen.getByLabelText('2,480,000 코드')).toBeInTheDocument()
        expect(screen.getByText('248만')).toHaveClass('text-amount-code-tier-4')
        expect(screen.getByText('코드')).toHaveClass('text-content-muted')

        rerender(<CodeAmount value={2480000} mode="full" />)
        expect(screen.getByLabelText('2,480,000 코드')).toBeInTheDocument()
        expect(screen.getByText('2,480,000')).toBeInTheDocument()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('cash는 구간색 없이 숫자 뒤에 캐시 단위를 둔다', () => {
        render(<CodeAmount currency="cash" value={120_000} />)

        expect(screen.getByLabelText('120,000 캐시')).toBeInTheDocument()
        expect(screen.getByText('120,000')).toHaveClass('text-content-fg')
        expect(screen.getByText('캐시')).toHaveClass('text-content-muted')
    })

    it.each([
        [0, 'text-amount-code-tier-1'],
        [9_999, 'text-amount-code-tier-1'],
        [10_000, 'text-amount-code-tier-2'],
        [99_999, 'text-amount-code-tier-2'],
        [100_000, 'text-amount-code-tier-3'],
        [999_999, 'text-amount-code-tier-3'],
        [1_000_000, 'text-amount-code-tier-4'],
        [9_999_999, 'text-amount-code-tier-4'],
        [10_000_000, 'text-amount-code-tier-5'],
        [99_999_999, 'text-amount-code-tier-5'],
        [100_000_000, 'text-amount-code-tier-6'],
    ] as const)('%s 코드를 승인된 구간색으로 표시한다', (value, className) => {
        const view = render(<CodeAmount value={value} />)

        expect(
            view.container.querySelector('[aria-hidden="true"]'),
        ).toHaveClass(className)
        view.unmount()
    })

    it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
        '값 없음(%s)은 단위·aria-label 없이 "-"로 표시한다',
        (value) => {
            render(<CodeAmount currency="cash" value={value} />)

            expect(screen.getByText('-')).toBeInTheDocument()
            expect(screen.queryByLabelText(/(?:코드|캐시)$/)).toBeNull()
            expect(screen.queryByRole('img')).not.toBeInTheDocument()
        },
    )
})
