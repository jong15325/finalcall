import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BrandWordmark from './BrandWordmark'

/**
 * 브랜드 워드마크 (FC-057).
 *
 * ★ 구 프론트에서 `AuthFormLayout`·`AdminLayout` 이 각자 워드마크를 그려 **표현이 갈라진**
 *   전력이 있다. 이 테스트는 표현 규칙을 한곳에 못박아 복제본이 생겨도 어긋남을 드러낸다.
 */
describe('BrandWordmark', () => {
    it('한 덩어리 이름으로 읽힌다 — "FINAL" "CALL" 로 끊기지 않는다', () => {
        render(<BrandWordmark />)
        expect(screen.getByText('FinalCall')).toBeInTheDocument()
    })

    it('★ 색분할이 아니다 — 글자는 둘 다 near-black 이고 퍼플은 마감선뿐', () => {
        const { container } = render(<BrandWordmark />)

        const call = screen.getByText('CALL')
        // 마감선: 2px + 브랜드 액센트
        expect(call).toHaveClass('border-b-2')
        expect(call.className).toContain('border-[var(--brand-accent)]')
        // 글자 자체를 퍼플로 칠하지 않는다.
        expect(call.className).not.toContain('text-[var(--brand-accent)]')

        // 활자 색은 래퍼가 한 번만 정한다(FINAL/CALL 이 서로 다른 색을 갖지 않는다).
        const wrapper = container.firstElementChild
        expect(wrapper?.className).toContain('text-gray-900')
        expect(screen.getByText('FINAL').className).not.toContain('text-')
    })

    it('로고 이미지가 아니라 활자다 — img 를 쓰지 않는다', () => {
        const { container } = render(<BrandWordmark />)
        expect(container.querySelector('img')).toBeNull()
    })

    it('크기 변형이 활자 크기만 바꾼다', () => {
        const { container: sm } = render(<BrandWordmark size="sm" />)
        expect(sm.firstElementChild?.className).toContain('text-lg')

        const { container: lg } = render(<BrandWordmark size="lg" />)
        expect(lg.firstElementChild?.className).toContain('text-3xl')
    })
})
