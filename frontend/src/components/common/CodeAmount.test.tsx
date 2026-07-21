import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CodeAmount from './CodeAmount'
import { formatCodeCompact, formatCodeFull } from './codeFormat'

/**
 * CodeAmount 계약 검증 (rebuild-contract-map §3.2).
 * 축약은 표시 변환일 뿐 — aria-label 은 mode 무관하게 항상 전체값.
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
    it('aria-label 은 mode 와 무관하게 전체값 + " 코드"', () => {
        const { rerender } = render(
            <CodeAmount value={2480000} mode="compact" />,
        )
        expect(screen.getByLabelText('2,480,000 코드')).toBeInTheDocument()
        // 시각 표기는 축약
        expect(screen.getByText('248만')).toBeInTheDocument()

        rerender(<CodeAmount value={2480000} mode="full" />)
        expect(screen.getByLabelText('2,480,000 코드')).toBeInTheDocument()
        expect(screen.getByText('2,480,000')).toBeInTheDocument()
    })

    it('값 없음(null)은 "-"로, 아이콘·aria-label 없이 표기한다', () => {
        render(<CodeAmount value={null} />)
        expect(screen.getByText('-')).toBeInTheDocument()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
})
