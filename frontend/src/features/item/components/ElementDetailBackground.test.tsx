import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ElementDetailBackground from './ElementDetailBackground'

class MockImage {
    static instances: MockImage[] = []
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    src = ''

    constructor() {
        MockImage.instances.push(this)
    }
}

describe('ElementDetailBackground', () => {
    beforeEach(() => {
        MockImage.instances = []
        vi.stubGlobal('Image', MockImage)
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            null,
        )
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('현재 속성 자산 하나만 요청하고 성공 후에만 배경을 표시한다', () => {
        const { container } = render(
            <ElementDetailBackground element={2}>
                <button type="button">입찰하기</button>
            </ElementDetailBackground>,
        )

        expect(MockImage.instances).toHaveLength(1)
        expect(MockImage.instances[0].src).toContain('fire-detail-v3.jpg')
        expect(container.querySelector('.element-detail__image')).toBeNull()

        act(() => MockImage.instances[0].onload?.())

        expect(container.querySelector('.element-detail__image')).not.toBeNull()
        expect(screen.getByRole('button', { name: '입찰하기' })).toBeVisible()
    })

    it('미등록 코드와 자산 실패는 중립 배경으로 비차단 처리한다', () => {
        const { container, rerender } = render(
            <ElementDetailBackground element={9}>
                <p>상세 정보</p>
            </ElementDetailBackground>,
        )

        expect(MockImage.instances).toHaveLength(0)
        expect(container.firstElementChild).toHaveAttribute(
            'data-element',
            'neutral',
        )

        rerender(
            <ElementDetailBackground element={3}>
                <p>상세 정보</p>
            </ElementDetailBackground>,
        )
        act(() => MockImage.instances[0].onerror?.())

        expect(container.querySelector('.element-detail__image')).toBeNull()
        expect(screen.getByText('상세 정보')).toBeVisible()
    })

    it('속성이 바뀌면 이전 요청 결과를 무시하고 새 속성만 반영한다', () => {
        const { container, rerender } = render(
            <ElementDetailBackground element={4}>내용</ElementDetailBackground>,
        )
        const staleImage = MockImage.instances[0]

        rerender(
            <ElementDetailBackground element={1}>내용</ElementDetailBackground>,
        )
        act(() => staleImage.onload?.())
        expect(container.querySelector('.element-detail__image')).toBeNull()

        act(() => MockImage.instances[1].onload?.())
        expect(container.querySelector('.element-detail__image')).toHaveStyle({
            backgroundImage:
                'url(/img/backgrounds/item-elements/water-detail-v3.jpg)',
        })
    })
})
