import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import OtpInput from './OtpInput'

/**
 * OTP 6칸 입력 (FC-138) — 목업 §10 이식.
 *
 * 고정하는 것:
 *  1. 한 칸=한 자리, 숫자만, 입력 시 다음 칸으로 자동 넘김.
 *  2. 붙여넣기(6자리)는 각 칸에 분배하고 완성 시 onComplete 1회.
 *  3. 백스페이스는 빈 칸에서 이전 칸으로.
 *  4. 접근성: 그룹 라벨 + 칸별 aria-label.
 */

/** 상위가 value 를 소유하므로 제어 래퍼로 감싼다(컴포넌트와 동일 계약). */
function Harness({ onComplete }: { onComplete?: (c: string) => void }) {
    const [value, setValue] = useState('')
    return (
        <>
            <label id="lbl">코드</label>
            <OtpInput
                value={value}
                labelledById="lbl"
                onChange={setValue}
                onComplete={onComplete}
            />
            <output data-testid="val">{value}</output>
        </>
    )
}

function cells(): HTMLInputElement[] {
    return [1, 2, 3, 4, 5, 6].map(
        (n) => screen.getByLabelText(`${n}번째 자리`) as HTMLInputElement,
    )
}

describe('<OtpInput>', () => {
    it('6칸을 그룹 라벨과 함께 렌더한다', () => {
        render(<Harness />)
        expect(screen.getByRole('group')).toHaveAttribute(
            'aria-labelledby',
            'lbl',
        )
        expect(cells()).toHaveLength(6)
    })

    it('숫자를 입력하면 값에 반영하고 다음 칸으로 넘어간다', () => {
        render(<Harness />)
        const c = cells()
        fireEvent.change(c[0], { target: { value: '4' } })
        expect(screen.getByTestId('val')).toHaveTextContent('4')
        expect(c[1]).toHaveFocus()
    })

    it('숫자가 아니면 무시한다', () => {
        render(<Harness />)
        fireEvent.change(cells()[0], { target: { value: 'a' } })
        expect(screen.getByTestId('val').textContent).toBe('')
    })

    it('★ 6자리 붙여넣기는 각 칸에 분배하고 onComplete 를 1회 부른다', () => {
        const onComplete = vi.fn()
        render(<Harness onComplete={onComplete} />)
        fireEvent.paste(cells()[0], {
            clipboardData: { getData: () => '429170' },
        })
        expect(screen.getByTestId('val')).toHaveTextContent('429170')
        expect(onComplete).toHaveBeenCalledTimes(1)
        expect(onComplete).toHaveBeenCalledWith('429170')
    })

    it('빈 칸에서 백스페이스는 이전 칸으로 이동하며 값을 지운다', () => {
        render(<Harness />)
        const c = cells()
        fireEvent.change(c[0], { target: { value: '4' } })
        // c[1] 에 포커스, 비어 있음 → 백스페이스로 c[0] 으로 이동·삭제
        fireEvent.keyDown(c[1], { key: 'Backspace' })
        expect(screen.getByTestId('val').textContent).toBe('')
        expect(c[0]).toHaveFocus()
    })
})
