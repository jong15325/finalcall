import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BrandWordmark from './BrandWordmark'

/**
 * 브랜드 워드마크 (FC-057).
 *
 * ★ 구 프론트에서 `AuthFormLayout`·`AdminLayout` 이 각자 워드마크를 그려 **표현이 갈라진**
 *   전력이 있다. 이 테스트는 "단일 출처"와 접근성만 못박는다.
 *
 * ★★ **시각 표현은 더 이상 단언하지 않는다**(사용자 방침 2026-07-19 — 시각은 템플릿 소관).
 *    종전에는 `border-b-2` + `--brand-accent` 퍼플 마감선을 단언했는데, 그 결정이 폐기되면서
 *    **테스트가 죽은 결정을 붙잡고 있는** 상태가 됐다. 색·굵기·자간을 테스트로 고정하면
 *    템플릿 관례가 바뀔 때마다 무관한 테스트가 붉어진다.
 */
describe('BrandWordmark', () => {
    it('한 덩어리 이름으로 읽힌다 — 철자 단위로 끊기지 않는다', () => {
        render(<BrandWordmark />)
        expect(screen.getByText('FinalCall')).toBeInTheDocument()
    })

    it('접근성 이름과 시각 활자가 중복해서 읽히지 않는다', () => {
        render(<BrandWordmark />)

        // 보이는 활자는 aria-hidden, 읽히는 이름은 sr-only — 둘이 겹쳐 읽히면 안 된다.
        expect(screen.getByText('FINALCALL')).toHaveAttribute(
            'aria-hidden',
            'true',
        )
        expect(screen.getByText('FinalCall')).toHaveClass('sr-only')
    })

    it('★ 폐기된 브랜드 액센트가 되살아나지 않는다', () => {
        const { container } = render(<BrandWordmark />)

        // `--brand-accent` 토큰은 제거됐다. 참조가 남아 있으면 죽은 변수를 가리키게 된다.
        expect(container.innerHTML).not.toContain('--brand-accent')
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
