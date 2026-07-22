import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import ListSearchBar from './ListSearchBar'

/**
 * 목록 검색바 (FC-108 — 계약 C3 클라 힌트·디바운스).
 *
 * 고정하는 것:
 *  1. **디바운스** — 매 타건이 아니라 멈춘 뒤 한 번만 커밋한다.
 *  2. **최소 2자(C3)** — 1자는 커밋하지 않고 힌트만 보인다(서버 400 조합 차단).
 *  3. **지우기** — 빈 문자열 커밋으로 검색을 해제한다.
 *  4. **외부 정본 반영** — value(=URL) 변경이 입력에 되돌아온다.
 */

const DEBOUNCE_MS = 300

function renderBar(onChange = vi.fn(), value = '') {
    render(
        <ListSearchBar
            value={value}
            label="아이템 검색"
            placeholder="아이템 이름으로 검색"
            onChange={onChange}
        />,
    )
    return { onChange, input: screen.getByLabelText('아이템 검색') }
}

describe('ListSearchBar', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('디바운스 후 한 번만 커밋한다', () => {
        const { onChange, input } = renderBar()

        fireEvent.change(input, { target: { value: '불' } })
        fireEvent.change(input, { target: { value: '불꽃' } })
        fireEvent.change(input, { target: { value: '불꽃검' } })
        expect(onChange).not.toHaveBeenCalled()

        act(() => void vi.advanceTimersByTime(DEBOUNCE_MS))
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith('불꽃검')
    })

    it('★ 1자는 커밋하지 않고 힌트를 보인다(최소 2자, C3)', () => {
        const { onChange, input } = renderBar()

        fireEvent.change(input, { target: { value: '불' } })
        act(() => void vi.advanceTimersByTime(DEBOUNCE_MS))

        expect(onChange).not.toHaveBeenCalled()
        expect(screen.getByText('검색어는 2자 이상 입력하세요.')).toBeVisible()
    })

    it('입력을 비우면 빈 문자열을 커밋해 검색을 해제한다', () => {
        const { onChange, input } = renderBar(vi.fn(), '불꽃검')

        fireEvent.change(input, { target: { value: '' } })
        act(() => void vi.advanceTimersByTime(DEBOUNCE_MS))

        expect(onChange).toHaveBeenCalledWith('')
    })

    it('지우기 버튼은 즉시 빈 문자열을 커밋한다', () => {
        const { onChange } = renderBar(vi.fn(), '불꽃검')

        fireEvent.click(screen.getByLabelText('검색어 지우기'))
        expect(onChange).toHaveBeenCalledWith('')
    })

    it('trim 후 같은 값이면 재커밋하지 않는다(정본과 일치)', () => {
        const { onChange, input } = renderBar(vi.fn(), '불꽃검')

        fireEvent.change(input, { target: { value: '불꽃검 ' } })
        act(() => void vi.advanceTimersByTime(DEBOUNCE_MS))

        expect(onChange).not.toHaveBeenCalled()
    })

    it('외부 value(=URL) 변경이 입력값에 반영된다', () => {
        const onChange = vi.fn()
        const { rerender } = render(
            <ListSearchBar
                value=""
                label="아이템 검색"
                placeholder="검색"
                onChange={onChange}
            />,
        )
        rerender(
            <ListSearchBar
                value="물의검"
                label="아이템 검색"
                placeholder="검색"
                onChange={onChange}
            />,
        )
        expect(screen.getByLabelText('아이템 검색')).toHaveValue('물의검')
    })
})
