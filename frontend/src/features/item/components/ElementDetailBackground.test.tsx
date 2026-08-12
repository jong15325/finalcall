import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ElementDetailBackground from './ElementDetailBackground'

describe('ElementDetailBackground', () => {
    it('상세 콘텐츠만 감싸고 별도 scene·이미지·Canvas를 만들지 않는다', () => {
        const { container } = render(
            <ElementDetailBackground element={2}>
                <button type="button">입찰하기</button>
            </ElementDetailBackground>,
        )

        expect(container.querySelector('.element-detail')).toHaveAttribute(
            'data-element',
            'fire',
        )
        expect(container.querySelector('.element-detail__scene')).toBeNull()
        expect(container.querySelector('img')).toBeNull()
        expect(container.querySelector('canvas')).toBeNull()
        expect(screen.getByRole('button', { name: '입찰하기' })).toBeVisible()
    })

    it('미등록 element는 neutral로 제한한다', () => {
        const { container } = render(
            <ElementDetailBackground element={9}>
                상세 정보
            </ElementDetailBackground>,
        )
        expect(container.querySelector('.element-detail')).toHaveAttribute(
            'data-element',
            'neutral',
        )
    })
})
