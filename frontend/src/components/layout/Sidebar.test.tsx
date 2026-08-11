import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import Sidebar from './Sidebar'

/**
 * 좌측 사이드바 핀(고정) 토글 · hover 확장 (FC-087 — 목업 §5.1 Vuexy 핀 모델).
 *
 * 고정하는 것:
 *  1. **핀 ON**: 항상 펼침(260px) 고정, hover 무시. 아이콘 = 채운 라디오(2 path), aria "고정 해제".
 *  2. **핀 OFF(기본)**: 레일(70px). hover → 260px flyout, mouseLeave → 70px 로 확실히 접힘(stuck 없음).
 *     아이콘 = 빈 원(1 path), aria "고정".
 *  3. 핀 버튼은 **어느 상태에서도 접근 가능** — 레일에서도 hover flyout 이 열리며 노출(xl:flex).
 *  4. 버튼 클릭 → onTogglePin.
 *
 * ★ css:false 라 `xl:` 클래스는 적용되지 않지만 **문자열로 존재**한다 — 폭 클래스 토글로 상태를 검증한다.
 */

function renderSidebar(
    props: Partial<React.ComponentProps<typeof Sidebar>> = {},
) {
    const onTogglePin = props.onTogglePin ?? vi.fn()
    const onCloseMobile = props.onCloseMobile ?? vi.fn()
    renderWithProviders(
        <Sidebar
            pinned={props.pinned ?? false}
            mobileOpen={props.mobileOpen ?? false}
            onTogglePin={onTogglePin}
            onCloseMobile={onCloseMobile}
        />,
    )
    return { onTogglePin, onCloseMobile }
}

describe('<Sidebar> 핀 토글 · hover', () => {
    it('핀 ON: 항상 260px 고정 + hover 무시 + 채운 라디오(2 path)', () => {
        renderSidebar({ pinned: true })
        const aside = screen.getByRole('complementary', { name: '주 메뉴' })
        expect(aside.className).toContain('xl:w-[260px]')
        expect(aside.className).toContain('xl:relative')
        expect(aside.className).toContain('xl:z-20')

        // hover 해도 폭이 바뀌지 않는다(핀 ON 은 hover 무시).
        fireEvent.mouseEnter(aside)
        expect(aside.className).toContain('xl:w-[260px]')
        expect(aside.className).not.toContain('xl:shadow-2xl')

        const toggle = screen.getByRole('button', {
            name: '네비게이션 고정 해제',
        })
        expect(toggle).toHaveAttribute('aria-pressed', 'true')
        expect(toggle.querySelectorAll('path')).toHaveLength(2)
    })

    it('핀 OFF(기본): 레일 70px + 빈 원(1 path) + aria "고정"', () => {
        renderSidebar({ pinned: false })
        const aside = screen.getByRole('complementary', { name: '주 메뉴' })
        expect(aside.className).toContain('xl:w-[70px]')
        expect(aside.className).not.toContain('xl:w-[260px]')

        const toggle = screen.getByRole('button', { name: '네비게이션 고정' })
        expect(toggle).toHaveAttribute('aria-pressed', 'false')
        expect(toggle.querySelectorAll('path')).toHaveLength(1)
    })

    it('핀 OFF hover → 260px 확장, mouseLeave → 70px 로 확실히 접힘(stuck 없음)', () => {
        renderSidebar({ pinned: false })
        const aside = screen.getByRole('complementary', { name: '주 메뉴' })

        fireEvent.mouseEnter(aside)
        expect(aside.className).toContain('xl:w-[260px]')
        expect(aside.className).toContain('xl:shadow-2xl')
        // 확장(flyout) 중엔 핀 버튼이 노출돼(xl:flex) 다시 고정할 수 있다.
        expect(
            screen.getByRole('button', { name: '네비게이션 고정' }).className,
        ).toContain('xl:flex')

        fireEvent.mouseLeave(aside)
        expect(aside.className).toContain('xl:w-[70px]')
        expect(aside.className).not.toContain('xl:shadow-2xl')
    })

    it('핀 버튼 클릭 → onTogglePin', () => {
        const { onTogglePin } = renderSidebar({ pinned: false })
        fireEvent.click(screen.getByRole('button', { name: '네비게이션 고정' }))
        expect(onTogglePin).toHaveBeenCalledOnce()
    })
})
